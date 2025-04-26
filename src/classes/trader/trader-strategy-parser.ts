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
    profitPercentage?: Percentage;
    anticipatedProfit?: NonNegativeNumber;
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
    meta?: {
        title?: string;
        description?: string;
        version?: string;
        publisher?: string;
        timestamp?: number;
        signature?: string;
        id?: string;
        [key: string]: any;
    };
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

export class StrategyParser {
    private rewardCalculator: TradeRewardStructures;
    private baseStake: number;
    private strategyConfig: StrategyConfig | StrategyConfig[];
    private computedSteps: StrategyStepOutput[] = [];
    private computedAllStrategies: Map<number, StrategyStepOutput[]> = new Map();

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
                    currentAmount = Math.min(currentAmount, maxAllowed);
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
            stepNumber: stepIndex+1
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
}