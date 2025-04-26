import { ContractType, MarketType, ContractDurationUnitType, BasisType, CurrencyType, BasisTypeEnum, ContractTypeEnum, CurrenciesEnum } from './types';
import { TradeRewardStructures } from './trade-reward-structures';
import { ContractParamsFactory } from './contract-factory';
import { getRandomDigit } from '@/common/utils/snippets';

type NonNegativeNumber = number & { __nonNegative: true };
type Percentage = number & { __percentage: true };

interface StrategyStepInput {
    amount?: NonNegativeNumber;
    basis?: BasisType;
    currency: CurrencyType;
    contractType: ContractType;
    contractDurationValue: number;
    contractDurationUnits: ContractDurationUnitType;
    symbol: MarketType;
    barrier?: string | number;
}

interface StrategyStepOutput {
    amount: NonNegativeNumber;
    basis: BasisType;
    currency: CurrencyType;
    contract_type: ContractType;
    duration: number;
    duration_unit: ContractDurationUnitType;
    symbol: MarketType;
    barrier?: string | number;
    formula?: string;
    profitPercentage: Percentage;
    anticipatedProfit: NonNegativeNumber;
    stepIndex?: number;
    stepNumber?: number;
}

interface StrategyConfig {
    strategyName: string;
    strategySteps: StrategyStepInput[];
    isAggressive: boolean;
    baseStake: NonNegativeNumber;
    minStake: NonNegativeNumber;
    maxStake: NonNegativeNumber;
    maxSequence: number;
    profitPercentage?: number;
    lossRecoveryPercentage?: number;
    anticipatedProfitPercentage?: number;
    maxConsecutiveLosses: number;
    maxRiskExposure: number;
    basis: BasisType;
    currency: CurrencyType;
    meta?: StrategyMeta;
}

interface StrategyMeta {
    title: string;
    description: string;
    version: string;
    publisher: string;
    timestamp: number;
    signature: string;
    id: string;
    riskProfile?: 'conservative' | 'moderate' | 'aggressive';
    recommendedBalance?: number;
}

interface StrategyMetrics {
    totalRiskExposure: number;
    maxSingleRisk: number;
    rewardToRiskRatios: number[];
    averageRewardToRiskRatio: number;
    maxRewardToRiskRatio: number;
    minRewardToRiskRatio: number;
    winProbability: number;
}

interface StrategyVisualization {
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

interface OptimizationPreset {
    maxRisk: number;
    riskMultiplier: number;
}

interface OptimizationAnalysis {
    originalRisk: number;
    optimizedRisk: number;
    originalPotential: number;
    optimizedPotential: number;
    riskReduction: number;
    potentialGain: number;
}

interface OptimizationCriteria {
    maxRisk?: number;
    targetProfit?: number;
    maxConsecutiveLosses?: number;
    riskMultiplier?: number;
}

export class StrategyParser {
    private rewardCalculator: TradeRewardStructures;
    private baseStake: number;
    private strategyConfig: StrategyConfig | StrategyConfig[];
    private computedSteps: StrategyStepOutput[] = [];
    private computedAllStrategies: Map<number, StrategyStepOutput[]> = new Map();

    public OPTIMIZATION_PRESETS: {
        conservative: OptimizationPreset;
        aggressive: OptimizationPreset;
    };

    constructor(strategyJson: any, strategyIndex: number | null = null, baseStake: number) {
        this.rewardCalculator = new TradeRewardStructures();
        this.strategyConfig = this.validateAndCompleteStrategyJson(strategyJson, strategyIndex);
        this.baseStake = baseStake || (Array.isArray(this.strategyConfig)
            ? this.strategyConfig[0].baseStake
            : this.strategyConfig.baseStake);

        if (Array.isArray(this.strategyConfig)) {
            this.computeAllStrategies();
        } else {
            this.computeAllSteps();
        }

        this.OPTIMIZATION_PRESETS = {
            conservative: {
                maxRisk: this.baseStake * 3,
                riskMultiplier: 1.1
            },
            aggressive: {
                maxRisk: this.baseStake * 10,
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
        const maxAllowed = this.baseStake * this.strategyConfig.maxRiskExposure;
        return Math.min(currentAmount * riskFactor, maxAllowed);
    }

    private validateAndCompleteStrategyJson(json: any, strategyIndex: number | null): StrategyConfig | StrategyConfig[] {
        if (!json.strategies || json.strategies.length === 0) {
            throw new Error("Invalid strategy JSON: no strategies found");
        }

        if (strategyIndex === null) {
            return json.strategies.map((strategy: any, index: number) =>
                this.processSingleStrategy(strategy, index));
        }

        if (strategyIndex < 0 || strategyIndex >= json.strategies.length) {
            throw new Error(`Invalid strategy index: ${strategyIndex}`);
        }

        return this.processSingleStrategy(json.strategies[strategyIndex], strategyIndex);
    }

    private processSingleStrategy(strategy: any, index: number): StrategyConfig {
        strategy.currency = strategy.currency || CurrenciesEnum.Default;
        strategy.basis = strategy.basis || BasisTypeEnum.Default;

        strategy.strategySteps = strategy.strategySteps.map((step: any) => ({
            ...step,
            currency: step.currency || strategy.currency,
            basis: step.basis || strategy.basis
        }));

        strategy.maxSequence = strategy.maxSequence || strategy.strategySteps.length;
        strategy.maxConsecutiveLosses = strategy.maxConsecutiveLosses || strategy.strategySteps.length - 1;
        strategy.profitPercentage = strategy.profitPercentage || 0;
        strategy.lossRecoveryPercentage = strategy.lossRecoveryPercentage || 0;
        strategy.anticipatedProfitPercentage = strategy.anticipatedProfitPercentage || 0;
        strategy.maxRiskExposure = strategy.maxRiskExposure || 15;

        return strategy;
    }

    private computeAllSteps(): void {
        let cumulativeLoss = 0;
        this.computedSteps = [];

        for (let i = 0; i < this.strategyConfig.maxSequence; i++) {
            const stepIndex = Math.min(i, this.strategyConfig.strategySteps.length - 1);
            const currentStepInput = this.strategyConfig.strategySteps[stepIndex];

            let currentAmount: number;
            let formula: string;
            let profitPercentage: number;
            let anticipatedProfit: number;

            if (i === 0) {
                // First step uses base stake
                currentAmount = this.baseStake;
                profitPercentage = this.rewardCalculator.calculateProfitPercentage(
                    currentStepInput.contractType,
                    currentAmount
                );
                anticipatedProfit = currentAmount * (profitPercentage / 100);
                formula = `Base Stake: ${currentAmount.toFixed(2)} (${profitPercentage.toFixed(2)}%)`;
            } else {
                // Calculate profit percentage based on cumulativeLoss (or baseStake if 0)
                const amountForPercentage = cumulativeLoss > 0 ? cumulativeLoss : this.baseStake;
                const currentStepProfitPercentage = this.rewardCalculator.calculateProfitPercentage(
                    currentStepInput.contractType,
                    amountForPercentage
                );

                const firstStepProfitPercentage = this.rewardCalculator.calculateProfitPercentage(
                    this.strategyConfig.strategySteps[0].contractType,
                    this.baseStake
                );

                // New formula: (TotalLoss + (TotalLoss*currentStepProfit%) + (BaseStake*firstStepProfit%)
                currentAmount = cumulativeLoss +
                    (cumulativeLoss * (currentStepProfitPercentage / 100)) +
                    (this.baseStake * (firstStepProfitPercentage / 100));

                // Get actual profit percentage for this amount
                profitPercentage = this.rewardCalculator.calculateProfitPercentage(
                    currentStepInput.contractType,
                    currentAmount
                );

                anticipatedProfit = currentAmount * (profitPercentage / 100);

                formula = `Recovery: ${cumulativeLoss.toFixed(2)} + ` +
                    `(${cumulativeLoss.toFixed(2)} × ${currentStepProfitPercentage.toFixed(2)}%) + ` +
                    `(${this.baseStake.toFixed(2)} × ${firstStepProfitPercentage.toFixed(2)}%) = ` +
                    `${currentAmount.toFixed(2)}`;

                // Apply risk management
                if (!this.strategyConfig.isAggressive) {
                    const maxAllowed = this.baseStake * this.strategyConfig.maxRiskExposure;
                    currentAmount = this.adjustForDynamicRisk(currentAmount, i);
                    anticipatedProfit = currentAmount * (profitPercentage / 100);
                    formula += ` (Capped at ${maxAllowed.toFixed(2)} due to risk management)`;
                }
            }

            const stepOutput = this.createStepOutput(stepIndex, currentAmount, formula);
            stepOutput.profitPercentage = profitPercentage;
            stepOutput.anticipatedProfit = anticipatedProfit;
            this.computedSteps.push(stepOutput);

            if (i < this.strategyConfig.maxSequence - 1) {
                cumulativeLoss += currentAmount;
            }
        }
    }

    private createStepOutput(stepIndex: number, amount: number, formula?: string): StrategyStepOutput {
        const stepInput = this.strategyConfig.strategySteps[stepIndex];

        // Clean up contract type by removing numeric suffixes
        let cleanedContractType = stepInput.contractType;
        if (typeof cleanedContractType === 'string') {
            if (cleanedContractType.startsWith('DIGITUNDER_')) {
                cleanedContractType = 'DIGITUNDER';
            } else if (cleanedContractType.startsWith('DIGITOVER_')) {
                cleanedContractType = 'DIGITOVER';
            }
        }

        const contractParams = ContractParamsFactory.createParams(
            amount,
            stepInput.basis as BasisType,
            cleanedContractType as ContractType,
            stepInput.currency,
            stepInput.contractDurationValue,
            stepInput.contractDurationUnits,
            stepInput.symbol,
            stepInput.barrier || this.getDefaultBarrier(stepInput.contractType)
        );

        return {
            ...contractParams,
            formula,
            profitPercentage: 0 as Percentage, // Will be set by computeAllSteps
            anticipatedProfit: 0 as NonNegativeNumber, // Will be set by computeAllSteps
            stepIndex: stepIndex,
            stepNumber: stepIndex + 1
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
                return getRandomDigit();
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

    private computeAllStrategies(): void {
        if (!Array.isArray(this.strategyConfig)) {
            return;
        }

        this.strategyConfig.forEach((strategy, index) => {
            const tempConfig = this.strategyConfig;
            this.strategyConfig = strategy;
            this.computeAllSteps();
            this.computedAllStrategies.set(index, [...this.computedSteps]);
            this.strategyConfig = tempConfig;
            this.computedSteps = [];
        });
    }

    private getMetaInfo(config?: StrategyConfig): StrategyMeta {
        const strategyConfig = config || (this.strategyConfig as StrategyConfig);
        const meta = strategyConfig.meta || {};

        return {
            title: meta.title || 'Untitled Strategy',
            description: meta.description || '',
            version: meta.version || '1.0.0',
            publisher: meta.publisher || 'Unknown',
            timestamp: meta.timestamp || Date.now(),
            signature: meta.signature || '',
            id: meta.id || '',
            riskProfile: strategyConfig.isAggressive ? 'aggressive' :
                (strategyConfig.maxRiskExposure < 10 ? 'conservative' : 'moderate'),
            recommendedBalance: this.calculateRecommendedBalance(strategyConfig)
        };
    }

    private calculateRecommendedBalance(config?: StrategyConfig): number {
        const strategyConfig = config || (this.strategyConfig as StrategyConfig);
        const steps = config
            ? this.computedAllStrategies.get(
                Array.isArray(this.strategyConfig)
                    ? (this.strategyConfig as StrategyConfig[]).indexOf(config)
                    : 0
            ) || []
            : this.computedSteps;

        const maxSteps = strategyConfig.maxSequence;
        const maxAmount = steps.reduce((max, step) => Math.max(max, step.amount), 0);
        return maxAmount * maxSteps * 1.5; // 1.5x buffer
    }

    public getAllSteps(strategyIndex?: number): StrategyStepOutput[] {
        if (strategyIndex !== undefined && this.computedAllStrategies.has(strategyIndex)) {
            return this.computedAllStrategies.get(strategyIndex) || [];
        }
        return this.computedSteps;
    }

    public getStep(sequenceNumber: number): StrategyStepOutput {
        if (sequenceNumber < 0 || sequenceNumber >= this.computedSteps.length) {
            throw new Error(`Invalid sequence number: ${sequenceNumber}`);
        }
        return this.computedSteps[sequenceNumber];
    }

    public getNextStep(consecutiveLosses: number): StrategyStepOutput {
        if (consecutiveLosses >= this.strategyConfig.maxConsecutiveLosses) {
            throw new Error("Max consecutive losses reached");
        }

        const stepIndex = Math.min(consecutiveLosses, this.computedSteps.length - 1);
        return this.computedSteps[stepIndex];
    }

    public shouldEnterRecovery(totalLoss: number): boolean {
        return totalLoss > 0 &&
            totalLoss < this.strategyConfig.baseStake * this.strategyConfig.maxRiskExposure;
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
                const steps = this.computedAllStrategies.get(strategyIndex);
                if (!steps || sequenceNumber < 0 || sequenceNumber >= steps.length) {
                    return { error: `Invalid sequence number ${sequenceNumber} for strategy ${strategyIndex}` };
                }
                return steps[sequenceNumber];
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

    public getFormattedOutput(strategyIndex?: number): {
        meta: StrategyMeta;
        configuration: Omit<StrategyConfig, 'strategySteps'>;
        steps: Array<StrategyStepOutput & { stepNumber: number }>;
    } {
        let config: StrategyConfig;
        let steps: StrategyStepOutput[];

        if (strategyIndex !== undefined && this.computedAllStrategies.has(strategyIndex)) {
            config = (this.strategyConfig as StrategyConfig[])[strategyIndex];
            steps = this.computedAllStrategies.get(strategyIndex) || [];
        } else {
            config = this.strategyConfig as StrategyConfig;
            steps = this.computedSteps;
        }

        return {
            meta: this.getMetaInfo(config),
            configuration: {
                strategyName: config.strategyName,
                isAggressive: config.isAggressive,
                baseStake: config.baseStake,
                maxSequence: config.maxSequence,
                profitPercentage: config.profitPercentage,
                lossRecoveryPercentage: config.lossRecoveryPercentage,
                anticipatedProfitPercentage: config.anticipatedProfitPercentage,
                maxConsecutiveLosses: config.maxConsecutiveLosses,
                maxRiskExposure: config.maxRiskExposure,
                meta: config.meta
            },
            steps: steps.map((step, index) => ({
                ...step,
                stepNumber: index + 1
            }))
        };
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

    public static deserialize(json: string): StrategyParser {
        const data = JSON.parse(json);
        const parser = new StrategyParser(data.config, null, data.baseStake);
        parser.computedSteps = data.computedSteps;
        return parser;
    }

    public optimizeStrategy(
        optimizationCriteria: {
            maxRisk?: number;
            targetProfit?: number;
            maxConsecutiveLosses?: number;
            riskMultiplier?: number;
        }
    ): StrategyStepOutput[] {
        return this.computedSteps.map((step, index) => {
            const currentStepInput = this.strategyConfig.strategySteps[
                Math.min(index, this.strategyConfig.strategySteps.length - 1)
            ];

            // Clone the step to avoid mutating the original
            const optimizedStep: StrategyStepOutput = { ...step };

            // Apply max risk constraint
            if (optimizationCriteria.maxRisk && step.amount > optimizationCriteria.maxRisk) {
                optimizedStep.amount = optimizationCriteria.maxRisk as NonNegativeNumber;
                optimizedStep.anticipatedProfit = (optimizationCriteria.maxRisk * (step.profitPercentage / 100)) as NonNegativeNumber;
                optimizedStep.formula = `${step.formula} → Optimized to max risk ${optimizationCriteria.maxRisk}`;
            }

            // Apply target profit adjustment
            if (optimizationCriteria.targetProfit && index > 0) {
                const neededAmount = optimizationCriteria.targetProfit / (step.profitPercentage / 100) as NonNegativeNumber;
                if (neededAmount < optimizedStep.amount) {
                    optimizedStep.amount = neededAmount;
                    optimizedStep.anticipatedProfit = optimizationCriteria.targetProfit as NonNegativeNumber;
                    optimizedStep.formula = `${step.formula} → Optimized for target profit ${optimizationCriteria.targetProfit}`;
                }
            }

            // Apply risk multiplier for recovery steps
            if (optimizationCriteria.riskMultiplier && index > 0) {
                const newAmount = step.amount * optimizationCriteria.riskMultiplier;
                optimizedStep.amount = newAmount as NonNegativeNumber;
                optimizedStep.anticipatedProfit = newAmount * (step.profitPercentage / 100) as NonNegativeNumber;
                optimizedStep.formula = `${step.formula} → Risk multiplied by ${optimizationCriteria.riskMultiplier}x`;
            }

            // Ensure all StrategyStepOutput properties are properly set
            return {
                ...optimizedStep,
                // These would normally be preserved from the spread, but we ensure they exist
                contract_type: currentStepInput.contractType,
                duration: currentStepInput.contractDurationValue,
                duration_unit: currentStepInput.contractDurationUnits,
                symbol: currentStepInput.symbol,
                basis: currentStepInput.basis || this.strategyConfig.basis,
                currency: currentStepInput.currency || this.strategyConfig.currency,
                barrier: optimizedStep.barrier ?? this.getDefaultBarrier(currentStepInput.contractType),
                // Recalculate formula if amounts changed
                formula: optimizedStep.formula || step.formula,
                // Recalculate profit percentage based on new amount if needed
                profitPercentage: this.rewardCalculator.calculateProfitPercentage(
                    currentStepInput.contractType,
                    optimizedStep.amount
                ),
                // Recalculate anticipated profit
                anticipatedProfit: optimizedStep.amount *
                    (this.rewardCalculator.calculateProfitPercentage(
                        currentStepInput.contractType,
                        optimizedStep.amount
                    ) / 100)
            };
        });
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
