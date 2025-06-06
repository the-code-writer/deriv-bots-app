import { ContractType, MarketType, ContractDurationUnitType, BasisType, CurrencyType, BasisTypeEnum, ContractTypeEnum, CurrenciesEnum, BotConfig } from './types';
import { TradeRewardStructures } from './trade-reward-structures';
import { ContractParamsFactory } from './contract-factory';
import { getRandomDigit } from '@/common/utils/snippets';
import { isPercentage, isNonNegativeNumber } from '../../common/utils/snippets';

type NonNegativeNumber = number & { __nonNegative: true };
type Percentage = number & { __percentage: true };

export interface StrategyStepInput {
    amount: NonNegativeNumber;
    basis: BasisType;
    currency: CurrencyType;
    contract_type: ContractType;
    duration: number;
    duration_unit: ContractDurationUnitType;
    symbol: MarketType;
    barrier?: string | number;
}

export interface StrategyStepOutput extends StrategyStepInput {
    formula?: string;
    profitPercentage: Percentage;
    anticipatedProfit: NonNegativeNumber;
    stepIndex?: number;
    stepNumber?: number;
    isEmergencyRecovery?: boolean;
    stopAfterTradeLoss?: boolean;
}

export interface StrategyMeta {
    currency: CurrencyType;
    basis: BasisType;
    baseStake: NonNegativeNumber;
    minStake?: NonNegativeNumber;
    maxStake?: NonNegativeNumber;
    isAggressive: boolean;
    maxRiskExposure?: number;
    maxSequence?: number;
    maxConsecutiveLosses?: number;
    profitPercentage?: number;
    lossRecoveryPercentage?: number;
    anticipatedProfitPercentage?: number;
}

export interface StrategyConfig {
    strategyName: string;
    strategySteps: StrategyStepInput[] | StrategyStepOutput[];
    isAggressive: boolean;
    id: string;
    title: string;
    description: string;
    version: string;
    publisher: string;
    timestamp: number;
    signature: string;
    meta: StrategyMeta;
    profitPercentage?: number;
    lossRecoveryPercentage?: number;
    anticipatedProfitPercentage?: number;
}

export interface StrategyMetrics {
    totalRiskExposure: number;
    maxSingleRisk: number;
    rewardToRiskRatios: number[];
    averageRewardToRiskRatio: number;
    maxRewardToRiskRatio: number;
    minRewardToRiskRatio: number;
    winProbability: number;
    riskOfRuin: number;
}

export interface StrategyVisualization {
    chartData: Array<{
        step: number;
        amount: number;
        potentialProfit: number;
        riskPercentage: number;
    }>;
    summary: {
        totalPotentialProfit: number;
        maxDrawdown: number;
    };
}

export interface OptimizationPreset {
    maxRisk: number;
    riskMultiplier: number;
}

export interface OptimizationAnalysis {
    originalRisk: number;
    optimizedRisk: number;
    originalPotential: number;
    optimizedPotential: number;
    riskReduction: number;
    potentialGain: number;
}

export interface OptimizationCriteria {
    maxRisk?: number;
    targetProfit?: number;
    maxConsecutiveLosses?: number;
    riskMultiplier?: number;
}

export class StrategyParser {
    private rewardCalculator: TradeRewardStructures;
    private baseStake: number;
    public strategyConfig: StrategyConfig;
    private computedSteps: StrategyStepOutput[] = [];
    private computedAllStrategies: Map<number, StrategyStepOutput[]> = new Map();

    public OPTIMIZATION_PRESETS: {
        conservative: OptimizationPreset;
        aggressive: OptimizationPreset;
    };

    public botConfig: BotConfig;

    constructor(strategyJson: any, baseStake: number, botConfig: BotConfig) {
        this.rewardCalculator = new TradeRewardStructures();
        this.botConfig = botConfig;
        this.baseStake = baseStake || botConfig.baseStake as number;
        this.strategyConfig = this.validateAndCompleteStrategyJson(strategyJson);

        this.computeAllSteps(botConfig);

        this.OPTIMIZATION_PRESETS = {
            conservative: {
                maxRisk: this.strategyConfig.meta.maxStake ? this.strategyConfig.meta.maxStake * 0.5 : this.baseStake * 6,
                riskMultiplier: 1.1
            },
            aggressive: {
                maxRisk: this.strategyConfig.meta.maxStake || this.baseStake * 12,
                riskMultiplier: 1.5
            }
        };
    }


    public getStrategyMetrics(): StrategyMetrics {
        if (this.computedSteps.length === 0) {
            return {
                totalRiskExposure: 0,
                maxSingleRisk: 0,
                rewardToRiskRatios: [],
                averageRewardToRiskRatio: 0,
                maxRewardToRiskRatio: 0,
                minRewardToRiskRatio: 0,
                winProbability: 0,
                riskOfRuin: 0
            };
        }

        // Initialize metrics in a single pass
        let totalRiskExposure = 0;
        let maxSingleRisk = 0;
        let totalRewardToRisk = 0;
        let maxRewardToRisk = -Infinity;
        let minRewardToRisk = Infinity;
        let positiveOutcomes = 0;
        let totalLossExposure = 0;
        const rewardToRiskRatios: number[] = [];

        for (const step of this.computedSteps) {
            const amount = step.amount;
            const anticipatedProfit = step.anticipatedProfit || 0;
            const ratio = anticipatedProfit / amount;

            // Accumulate metrics
            totalRiskExposure += amount;
            if (amount > maxSingleRisk) maxSingleRisk = amount;

            rewardToRiskRatios.push(ratio);
            totalRewardToRisk += ratio;

            if (ratio > maxRewardToRisk) maxRewardToRisk = ratio;
            if (ratio < minRewardToRisk) minRewardToRisk = ratio;

            if (anticipatedProfit > 0) positiveOutcomes++;
            if (anticipatedProfit < 0) totalLossExposure += amount;
        }

        // Calculate derived metrics
        const averageRewardToRiskRatio = totalRewardToRisk / this.computedSteps.length;
        const winProbability = positiveOutcomes / this.computedSteps.length;
        const riskOfRuin = totalLossExposure / totalRiskExposure;

        return {
            totalRiskExposure,
            maxSingleRisk,
            rewardToRiskRatios,
            averageRewardToRiskRatio,
            maxRewardToRiskRatio: maxRewardToRisk === -Infinity ? 0 : maxRewardToRisk,
            minRewardToRiskRatio: minRewardToRisk === Infinity ? 0 : minRewardToRisk,
            winProbability,
            riskOfRuin
        };
    }

    private adjustForDynamicRisk(currentAmount: number, consecutiveLosses: number): number {
        const riskFactor = 1 + (consecutiveLosses * 0.1); // 10% increase per loss
        const maxAllowed = this.baseStake * this.strategyConfig.meta.maxRiskExposure!;
        return Math.min(currentAmount * riskFactor, maxAllowed);
    }

    private validateAndCompleteStrategyJson(json: any): StrategyConfig {
        // Check if this is the new format (direct strategy object)
        if (json.strategySteps && json.meta) {
            return this.processSingleStrategy(json);
        }

        throw new StrategyError('INVALID_STRATEGY', "Invalid strategy JSON format");
    }

    private processSingleStrategy(strategy: any): StrategyConfig {
        if (!strategy.strategySteps) {
            throw new StrategyError('INVALID_STRATEGY', "Strategy is missing required strategySteps field");
        }

        const computedBaseStake = this.baseStake as NonNegativeNumber;
        const computedMinStake = (this.botConfig?.minStake || strategy.meta?.minStake || computedBaseStake) as NonNegativeNumber;
        const computedMaxStake = (strategy.meta?.maxStake || ((computedMinStake * 12) + (computedBaseStake * 4))) as NonNegativeNumber;
        const computedMaxRiskExposure = (computedBaseStake * 12) as NonNegativeNumber;

        let totalPotentialLoss = 0;
        strategy.strategySteps.forEach((step: any) => {
            totalPotentialLoss += step.amount || this.baseStake;
        });

        const processedStrategy: StrategyConfig = {
            strategyName: strategy.id || "UNNAMED_STRATEGY",
            strategySteps: strategy.strategySteps.map((step: any) => ({
                ...step,
                currency: step.currency || (this.botConfig?.currency || strategy.meta?.currency),
                basis: step.basis || strategy.meta?.basis
            })),
            id: strategy.id,
            title: strategy.title,
            description: strategy.description,
            version: strategy.version,
            publisher: strategy.publisher,
            timestamp: strategy.timestamp,
            signature: strategy.signature,
            isAggressive: strategy.isAggressive ?? false,
            meta: {
                currency: this.botConfig?.currency || strategy.meta?.currency || CurrenciesEnum.Default,
                basis: strategy.meta?.basis || BasisTypeEnum.Default,
                baseStake: computedBaseStake,
                minStake: computedMinStake,
                maxStake: computedMaxStake,
                isAggressive: strategy.isAggressive ?? false,
                maxRiskExposure: computedMaxRiskExposure,
                maxSequence: strategy.strategySteps.length,
                maxConsecutiveLosses: strategy.meta?.maxConsecutiveLosses || strategy.strategySteps.length - 1,
                profitPercentage: strategy.meta?.profitPercentage || 0,
                lossRecoveryPercentage: strategy.meta?.lossRecoveryPercentage || 0,
                anticipatedProfitPercentage: strategy.meta?.anticipatedProfitPercentage || 0
            }
        };

        return processedStrategy;
    }

    private computeAllSteps(botConfig?: BotConfig): void {
        let cumulativeLoss = 0;
        this.computedSteps = [];
        const config = this.getSingleStrategyConfig();

        for (let i = 0; i < config.meta.maxSequence!; i++) {
            const stepIndex = Math.min(i, config.strategySteps.length - 1);
            const currentStepInput = config.strategySteps[stepIndex];

            let currentAmount: number;
            let formula: string;
            let profitPercentage: number;
            let anticipatedProfit: number;

            if (i === 0) {
                // First step - use config settings if available
                if (botConfig) {
                    currentAmount = botConfig.baseStake || this.baseStake;
                    const contractType = botConfig.contractType || currentStepInput.contract_type;
                    const market = botConfig.market || currentStepInput.symbol;

                    profitPercentage = this.rewardCalculator.calculateProfitPercentage(
                        contractType,
                        currentAmount
                    );
                    anticipatedProfit = currentAmount * (profitPercentage / 100);
                    formula = `Config-based Stake: ${currentAmount.toFixed(2)} (${profitPercentage.toFixed(2)}%)`;

                    // Override step values with config if available
                    currentStepInput.contract_type = contractType;
                    currentStepInput.symbol = market;
                    if (botConfig.contractDurationValue) {
                        currentStepInput.duration = botConfig.contractDurationValue;
                    }
                    if (botConfig.contractDurationUnits) {
                        currentStepInput.duration_unit = botConfig.contractDurationUnits;
                    }
                } else {
                    // Fall back to JSON strategy first step
                    currentAmount = this.baseStake;
                    profitPercentage = this.rewardCalculator.calculateProfitPercentage(
                        currentStepInput.contract_type,
                        currentAmount
                    );
                    anticipatedProfit = currentAmount * (profitPercentage / 100);
                    formula = `Base Stake: ${currentAmount.toFixed(2)} (${profitPercentage.toFixed(2)}%)`;
                }
            } else {
                // Check if we've reached max consecutive losses
                if (i >= config.meta.maxConsecutiveLosses!) {
                    // Set emergency recovery flag and stop after this trade
                    this.computedSteps.push(this.createEmergencyRecoveryStep(stepIndex));
                    break;
                }

                // Rest of the recovery step calculation remains the same
                const amountForPercentage = cumulativeLoss > 0 ? cumulativeLoss : this.baseStake;
                const currentStepProfitPercentage = this.rewardCalculator.calculateProfitPercentage(
                    currentStepInput.contract_type,
                    amountForPercentage
                );

                const firstStepProfitPercentage = this.rewardCalculator.calculateProfitPercentage(
                    config.strategySteps[0].contract_type,
                    this.baseStake
                );

                currentAmount = cumulativeLoss +
                    (cumulativeLoss * (currentStepProfitPercentage / 100)) +
                    (this.baseStake * (firstStepProfitPercentage / 100));

                // Ensure we don't exceed max stake
                currentAmount = Math.min(currentAmount, Number(config.meta.maxStake));

                profitPercentage = this.rewardCalculator.calculateProfitPercentage(
                    currentStepInput.contract_type,
                    currentAmount
                );

                anticipatedProfit = currentAmount * (profitPercentage / 100);

                formula = `Recovery: ${cumulativeLoss.toFixed(2)} + ` +
                    `(${cumulativeLoss.toFixed(2)} × ${currentStepProfitPercentage.toFixed(2)}%) + ` +
                    `(${this.baseStake.toFixed(2)} × ${firstStepProfitPercentage.toFixed(2)}%) = ` +
                    `${currentAmount.toFixed(2)}`;

                // Apply risk management
                if (!config.isAggressive) {
                    const maxAllowed = this.baseStake * config.meta.maxRiskExposure!;
                    currentAmount = this.adjustForDynamicRisk(currentAmount, i);
                    anticipatedProfit = currentAmount * (profitPercentage / 100);
                    formula += ` (Capped at ${maxAllowed.toFixed(2)} due to risk management)`;
                }
            }

            const stepOutput = this.createStepOutput(stepIndex, currentAmount, formula);
            stepOutput.profitPercentage = profitPercentage as Percentage;
            stepOutput.anticipatedProfit = anticipatedProfit as NonNegativeNumber;
            this.computedSteps.push(stepOutput);

            if (i < config.meta.maxSequence! - 1) {
                cumulativeLoss += currentAmount;
            }
        }
    }

    private createEmergencyRecoveryStep(stepIndex: number): StrategyStepOutput {
        const config = this.getSingleStrategyConfig();
        const stepInput = config.strategySteps[stepIndex];

        // Use the first step's contract type as fallback
        const contractType = stepInput.contract_type ||
            (config.strategySteps[0]?.contract_type || ContractTypeEnum.DigitDiff);

        return {
            ...this.createStepOutput(stepIndex, config.meta.maxStake!, "EMERGENCY_RECOVERY"),
            profitPercentage: 0 as Percentage,
            anticipatedProfit: 0 as NonNegativeNumber,
            isEmergencyRecovery: true,
            stopAfterTradeLoss: true,
            contract_type: contractType
        };
    }

    private createStepOutput(stepIndex: number, amount: NonNegativeNumber | number, formula?: string): StrategyStepOutput {
        const config = this.getSingleStrategyConfig();
        const stepInput = config.strategySteps[stepIndex];

        let cleanedContractType: ContractType = stepInput.contract_type || ContractTypeEnum.DigitDiff;

        if (formula === "EMERGENCY_RECOVERY") {
            cleanedContractType = ContractTypeEnum.DigitDiff;
            stepInput.barrier = -1;
        }

        if (typeof cleanedContractType === 'string') {
            if (cleanedContractType.startsWith('DIGITUNDER_')) {
                cleanedContractType = ContractTypeEnum.DigitUnder;
            } else if (cleanedContractType.startsWith('DIGITOVER_')) {
                cleanedContractType = ContractTypeEnum.DigitOver;
            }
        }

        const contractParams = ContractParamsFactory.createParams(
            amount,
            stepInput.basis || config.meta.basis,
            cleanedContractType,
            stepInput.currency || config.meta.currency,
            stepInput.duration,
            stepInput.duration_unit,
            stepInput.symbol,
            stepInput.barrier ?? this.getDefaultBarrier(stepInput.contract_type)
        );

        // @ts-ignore
        return {
            ...contractParams,
            formula,
            profitPercentage: 0 as Percentage,
            anticipatedProfit: 0 as NonNegativeNumber,
            stepIndex,
            stepNumber: stepIndex + 1,
            amount: amount as NonNegativeNumber,
            basis: stepInput.basis || config.meta.basis,
            currency: stepInput.currency || config.meta.currency,
            contract_type: cleanedContractType
        };
    }

    private getDefaultBarrier(contractType: ContractType): string | number {
        // First clean the contract type
        let cleanedType = contractType;

        if (typeof cleanedType === 'string') {
            if (cleanedType.startsWith('DIGITUNDER_')) {
                cleanedType = 'DIGITUNDER';
            } else if (cleanedType.startsWith('DIGITOVER_')) {
                cleanedType = 'DIGITOVER';
            }
        }

        // Extract digit from contract types like DIGITUNDER_9
        const digitMatch = typeof contractType === 'string' ? contractType.match(/_(\d+)$/) : null;

        if (digitMatch) {
            return digitMatch[1];
        }

        switch (contractType) {
            case ContractTypeEnum.DigitEven:
                return ContractTypeEnum.DigitEven;
            case ContractTypeEnum.DigitOdd:
                return ContractTypeEnum.DigitOdd;
            case ContractTypeEnum.DigitDiff:
                return -1;
            case ContractTypeEnum.DigitUnder:
                return 5;
            case ContractTypeEnum.DigitUnder9:
                return 9;
            case ContractTypeEnum.DigitUnder8:
                return 8;
            case ContractTypeEnum.DigitUnder7:
                return 7;
            case ContractTypeEnum.DigitUnder6:
                return 6;
            case ContractTypeEnum.DigitUnder5:
                return 5;
            case ContractTypeEnum.DigitUnder4:
                return 4;
            case ContractTypeEnum.DigitUnder3:
                return 3;
            case ContractTypeEnum.DigitUnder2:
                return 2;
            case ContractTypeEnum.DigitUnder1:
                return 1;
            case ContractTypeEnum.DigitOver:
                return 5;
            case ContractTypeEnum.DigitOver8:
                return 8;
            case ContractTypeEnum.DigitOver7:
                return 7;
            case ContractTypeEnum.DigitOver6:
                return 6;
            case ContractTypeEnum.DigitOver5:
                return 5;
            case ContractTypeEnum.DigitOver4:
                return 4;
            case ContractTypeEnum.DigitOver3:
                return 3;
            case ContractTypeEnum.DigitOver2:
                return 2;
            case ContractTypeEnum.DigitOver1:
                return 1;
            case ContractTypeEnum.DigitOver0:
                return 0;
            default:
                return getRandomDigit();
        }
    }

    public getMetaInfo(config?: StrategyConfig): StrategyMeta {
        const strategyConfig = config || (this.strategyConfig as StrategyConfig);

        return strategyConfig.meta;

    }

    public getAllSteps(): StrategyStepOutput[] {
        return this.computedSteps;
    }

    public getStep(sequenceNumber: number): StrategyStepOutput {
        if (sequenceNumber < 0 || sequenceNumber >= this.computedSteps.length) {
            throw new Error(`Invalid sequence number: ${sequenceNumber}`);
        }
        return this.computedSteps[sequenceNumber];
    }

    public getNextStep(consecutiveLosses: number): StrategyStepOutput {
        if (consecutiveLosses >= this.strategyConfig.meta.maxConsecutiveLosses!) {
            throw new Error("Max consecutive losses reached");
        }

        const stepIndex = Math.min(consecutiveLosses, this.computedSteps.length - 1);
        return this.computedSteps[stepIndex];
    }

    public shouldEnterRecovery(totalLoss: number): boolean {
        return totalLoss > 0 &&
            totalLoss < this.strategyConfig.meta.baseStake * this.strategyConfig.meta.maxRiskExposure!;
    }

    public getStrategyConfig(): StrategyConfig {
        return this.strategyConfig as StrategyConfig;
    }

    public safeGetStep(sequenceNumber: number, strategyIndex?: number): StrategyStepOutput | { error: string } {
        try {
            if (strategyIndex !== undefined) {
                if (!Array.isArray(this.strategyConfig)) {
                    return { error: "Strategy index provided but parser is in single-strategy mode" };
                }
                const strategySteps = this.computedAllStrategies.get(strategyIndex);
                if (!strategySteps || sequenceNumber < 0 || sequenceNumber >= strategySteps.length) {
                    return { error: `Invalid sequence number ${sequenceNumber} for strategy ${strategyIndex}` };
                }
                return strategySteps[sequenceNumber];
            }
            return this.getStep(sequenceNumber);
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    public getAll() {
        return this.computedAllStrategies;
    }

    private getSingleStrategyConfig(): StrategyConfig {
        return this.strategyConfig;
    }

    public getFormattedOutput(): StrategyConfig {

        const config = this.getSingleStrategyConfig();
        const strategySteps = this.computedSteps;

        const configuration: StrategyConfig = {
            strategySteps: strategySteps.map((step, index) => ({
                ...step,
                profitPercentage: isPercentage(step.profitPercentage) ? step.profitPercentage : 0 as Percentage,
                anticipatedProfit: isNonNegativeNumber(step.anticipatedProfit) ? step.anticipatedProfit : 0 as NonNegativeNumber,
                amount: isNonNegativeNumber(step.amount) ? step.amount : 0 as NonNegativeNumber,
                stepNumber: index + 1
            })),
            strategyName: config.strategyName,
            isAggressive: config.isAggressive,
            id: config.id,
            title: config.title,
            description: config.description,
            version: config.version,
            publisher: config.publisher,
            timestamp: config.timestamp,
            signature: config.signature,
            meta: config.meta
        };

        return configuration;

    }

    public generateVisualization(): StrategyVisualization {
        return {
            chartData: this.computedSteps.map((step, i) => ({
                step: i + 1,
                amount: step.amount,
                potentialProfit: step.anticipatedProfit,
                riskPercentage: (step.amount / this.baseStake) * 100
            })),
            summary: {
                totalPotentialProfit: this.computedSteps.reduce((sum, step) => sum + step.anticipatedProfit, 0),
                maxDrawdown: this.computedSteps.reduce((sum, step) => sum + step.amount, 0)
            }
        };
    }


    public serialize(): string {
        return JSON.stringify({
            config: this.strategyConfig,
            computedSteps: this.computedSteps,
            baseStake: this.baseStake
        });
    }

    public static deserialize(json: string, botConfig: BotConfig): StrategyParser {
        const data = JSON.parse(json);
        const parser = new StrategyParser(data.config, data.baseStake, botConfig);
        parser.computedSteps = data.computedSteps;
        return parser;
    }

    public optimizeStrategy(
        optimizationCriteria: OptimizationCriteria
    ): StrategyStepOutput[] {
        this.validateOptimizationCriteria(optimizationCriteria);

        return this.computedSteps.map((step, index) => {
            const currentStepInput = this.strategyConfig.strategySteps[
                Math.min(index, this.strategyConfig.strategySteps.length - 1)
            ];

            // Create optimized step with all required properties
            const optimizedStep: StrategyStepOutput = {
                ...step,
                // Ensure these properties are always set
                contract_type: currentStepInput.contract_type,
                duration: currentStepInput.duration,
                duration_unit: currentStepInput.duration_unit,
                symbol: currentStepInput.symbol,
                basis: currentStepInput.basis || this.strategyConfig.meta.basis,
                currency: currentStepInput.currency || this.strategyConfig.meta.currency,
                barrier: step.barrier ?? this.getDefaultBarrier(currentStepInput.contract_type)
            };

            // Apply optimization rules
            this.applyOptimizationRules(optimizedStep, step, optimizationCriteria, index);

            // Recalculate profit values based on optimized amount
            this.recalculateProfitValues(optimizedStep, currentStepInput);

            return optimizedStep;
        });
    }

    private applyOptimizationRules(
        optimizedStep: StrategyStepOutput,
        originalStep: StrategyStepOutput,
        criteria: OptimizationCriteria,
        stepIndex: number
    ): void {
        // Apply max risk constraint
        if (criteria.maxRisk && originalStep.amount > criteria.maxRisk) {
            optimizedStep.amount = criteria.maxRisk as NonNegativeNumber;
            optimizedStep.formula = `${originalStep.formula} → Optimized to max risk ${criteria.maxRisk}`;
        }

        // Apply target profit adjustment (only for recovery strategySteps)
        if (criteria.targetProfit && stepIndex > 0) {
            const neededAmount = criteria.targetProfit / (originalStep.profitPercentage / 100);
            if (neededAmount < optimizedStep.amount) {
                optimizedStep.amount = neededAmount as NonNegativeNumber;
                optimizedStep.formula = `${originalStep.formula} → Optimized for target profit ${criteria.targetProfit}`;
            }
        }

        // Apply risk multiplier for recovery strategySteps
        if (criteria.riskMultiplier && stepIndex > 0) {
            const newAmount = originalStep.amount * criteria.riskMultiplier;
            optimizedStep.amount = newAmount as NonNegativeNumber;
            optimizedStep.formula = `${originalStep.formula} → Risk multiplied by ${criteria.riskMultiplier}x`;
        }

        // Handle conflict between maxRisk and targetProfit
        if (criteria.maxRisk && criteria.targetProfit) {
            const targetBasedAmount = criteria.targetProfit / (originalStep.profitPercentage / 100);
            if (targetBasedAmount > criteria.maxRisk) {
                optimizedStep.amount = criteria.maxRisk as NonNegativeNumber;
                optimizedStep.formula = `${originalStep.formula} → Risk-limited to ${criteria.maxRisk}`;
            }
        }
    }

    private recalculateProfitValues(
        optimizedStep: StrategyStepOutput,
        currentStepInput: StrategyStepInput
    ): void {
        optimizedStep.profitPercentage = this.rewardCalculator.calculateProfitPercentage(
            currentStepInput.contract_type,
            optimizedStep.amount
        ) as Percentage;

        optimizedStep.anticipatedProfit = (optimizedStep.amount *
            (optimizedStep.profitPercentage / 100)) as NonNegativeNumber;
    }

    private validateOptimizationCriteria(criteria: any) {
        if (criteria.maxRisk && criteria.maxRisk < this.baseStake) {
            throw new Error("Max risk cannot be less than base stake");
        }
        if (criteria.riskMultiplier && criteria.riskMultiplier < 1) {
            throw new Error("Risk multiplier must be >= 1");
        }
    }

    public optimizeWithPreset(preset: keyof typeof this.OPTIMIZATION_PRESETS) {
        return this.optimizeStrategy(this.OPTIMIZATION_PRESETS[preset]);
    }

    public analyzeOptimization(original: StrategyStepOutput[], optimized: StrategyStepOutput[]): OptimizationAnalysis {
        const originalRisk = original.reduce((sum, step) => sum + step.amount, 0);
        const optimizedRisk = optimized.reduce((sum, step) => sum + step.amount, 0);
        const originalPotential = original.reduce((sum, step) => sum + step.anticipatedProfit, 0);
        const optimizedPotential = optimized.reduce((sum, step) => sum + step.anticipatedProfit, 0);

        return {
            originalRisk,
            optimizedRisk,
            originalPotential,
            optimizedPotential,
            riskReduction: 1 - (optimizedRisk / originalRisk),
            potentialGain: (optimizedPotential / originalPotential) - 1
        };
    }

    /*

    const optimized = parser.optimizeStrategy({
        maxRisk: parser.baseStake * 5,  // 5x base stake
        targetProfit: parser.baseStake * 2,  // Aim for 2x profit
        riskMultiplier: 1.2  // 20% more aggressive on recovery
    });

    console.log("Optimized Steps:");
    optimized.forEach(step => {
        console.log(`Step ${step.stepNumber}:`);
        console.log(`- Amount: ${step.amount}`);
        console.log(`- Anticipated Profit: ${step.anticipatedProfit}`);
        console.log(`- Formula: ${step.formula}`);
    });

    */

}


export class StrategyError extends Error {
    constructor(
        public readonly code: 'INVALID_STRATEGY' | 'RISK_LIMIT_EXCEEDED' | 'CALCULATION_ERROR',
        message: string
    ) {
        super(message);
        this.name = 'StrategyError';
    }
}

//throw new StrategyError('RISK_LIMIT_EXCEEDED', `Amount ${amount} exceeds max risk exposure`);
