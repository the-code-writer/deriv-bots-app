import { ContractType, MarketType, ContractDurationUnitType, BasisType, CurrencyType, BasisTypeEnum, ContractTypeEnum, CurrenciesEnum } from './types';
import { TradeRewardStructures } from './trade-reward-structures';
import { ContractParamsFactory } from './contract-factory';
import { getRandomDigit } from '@/common/utils/snippets';

interface StrategyStepInput {
    amount?: number;
    basis?: BasisType;
    currency: CurrencyType;
    contractType: ContractType;
    contractDurationValue: number;
    contractDurationUnits: ContractDurationUnitType;
    symbol: MarketType;
    barrier?: string | number;
}

interface StrategyStepOutput {
    amount: number;
    basis: BasisType;
    currency: CurrencyType;
    contract_type: ContractType;
    duration: number;
    duration_unit: ContractDurationUnitType;
    symbol: MarketType;
    barrier?: string | number;
}

interface StrategyConfig {
    strategyName: string;
    strategySteps: StrategyStepInput[];
    isAggressive: boolean;
    baseStake: number;
    maxSequence: number;
    profitPercentage: number;
    lossRecoveryPercentage: number;
    anticipatedProfitPercentage: number;
    maxConsecutiveLosses: number;
    maxRiskExposure: number;
}

export class StrategyParser {
    private rewardCalculator: TradeRewardStructures;
    private baseStake: number;
    private strategyConfig: StrategyConfig;
    private computedSteps: StrategyStepOutput[] = [];

    constructor(strategyJson: any, baseStake: number) {
        this.rewardCalculator = new TradeRewardStructures();
        this.strategyConfig = this.validateAndCompleteStrategyJson(strategyJson);
        console.log("::::", this.strategyConfig);
        this.baseStake = this.strategyConfig.baseStake;
        this.computeAllSteps();
    }

    private validateAndCompleteStrategyJson(json: any): StrategyConfig {
        if (!json.strategies || json.strategies.length === 0) {
            throw new Error("Invalid strategy JSON: no strategies found");
        }

        const strategy = json.strategies[0];

        // Set defaults for required fields
        strategy.currency = strategy.currency || CurrenciesEnum.Default;
        strategy.basis = strategy.basis || BasisTypeEnum.Default;

        // Propagate strategy-level properties to each step
        strategy.strategySteps = strategy.strategySteps.map((step: any) => ({
            ...step,
            currency: step.currency || strategy.currency,
            basis: step.basis || strategy.basis
        }));

        // Auto-compute derived fields if not provided
        strategy.maxSequence = strategy.maxSequence || strategy.strategySteps.length;
        strategy.maxConsecutiveLosses = strategy.maxConsecutiveLosses || strategy.strategySteps.length - 1;

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

            if (i === 0) {
                currentAmount = this.baseStake;
                formula = `$${this.baseStake.toFixed(2)}`;
            } else {
                const rewardTiers = this.rewardCalculator.getRewardStructure(currentStepInput.contractType);
                const medianRewardPercentage = this.calculateMedianRewardPercentage(rewardTiers) / 100;

                const totalToRecover = cumulativeLoss * (1 + (this.strategyConfig.profitPercentage / 100));
                currentAmount = totalToRecover / medianRewardPercentage;

                if (!this.strategyConfig.isAggressive) {
                    const maxAllowed = this.baseStake * this.strategyConfig.maxRiskExposure;
                    currentAmount = Math.min(currentAmount, maxAllowed);
                }

                // Build the formula string
                const profitFactor = (this.strategyConfig.profitPercentage / 100).toFixed(2);
                const medianReward = medianRewardPercentage.toFixed(2);
                formula = `(${cumulativeLoss.toFixed(2)} * (1 + ${profitFactor})) / ${medianReward}`;

            }

            const stepOutput = this.createStepOutput(stepIndex, currentAmount, formula);
            this.computedSteps.push(stepOutput);
            cumulativeLoss += currentAmount;
        }
    }

    private calculateMedianRewardPercentage(rewardTiers: any[]): number {
        const percentages = rewardTiers.map(tier => tier.rewardPercentage).sort((a, b) => a - b);
        const mid = Math.floor(percentages.length / 2);
        return percentages.length % 2 !== 0 ? percentages[mid] : (percentages[mid - 1] + percentages[mid]) / 2;
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

        // Use contract factory to generate proper parameters
        const contractParams = ContractParamsFactory.createParams(
            amount,
            stepInput.basis as BasisType,
            cleanedContractType as ContractType, // Use the cleaned version
            stepInput.currency,
            stepInput.contractDurationValue,
            stepInput.contractDurationUnits,
            stepInput.symbol,
            stepInput.barrier || this.getDefaultBarrier(stepInput.contractType)
        );

        if (formula) {
            return {
                ...contractParams,
                formula: `$${amount.toFixed(2)} = ${formula}`
            } as StrategyStepOutput;
        }

        return {
            ...contractParams,
            formula: `$${amount.toFixed(2)}`
        } as StrategyStepOutput;

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

        console.log(">>>> CONTRACT TYPE", contractType)

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

    public getAllSteps(): StrategyStepOutput[] {
        return this.computedSteps;
    }

    public getStep(sequenceNumber: number): StrategyStepOutput {
        if (sequenceNumber < 0 || sequenceNumber >= this.computedSteps.length) {
            throw new Error(`Invalid sequence number: ${sequenceNumber}`);
        }
        return this.computedSteps[sequenceNumber];
    }

    public getStrategyConfig(): StrategyConfig {
        return this.strategyConfig;
    }
}