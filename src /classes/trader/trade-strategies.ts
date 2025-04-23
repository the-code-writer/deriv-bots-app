// trade-strategies.ts - Trade strategy implementations
/**
 * @file Contains all trade strategy implementations for the Deriv trading bot
 * @module TradeStrategies
 */
import { pino } from "pino";
import {
    ContractParams,
    ITradeData,
    ContractType,
    IPreviousTradeResult,
    MarketType,
    ContractTypeEnum,
    ContractDurationUnitType,
    MarketTypeEnum,
    BasisType,
    CurrencyType,
    BasisTypeEnum,
    CurrenciesEnum,
    ContractDurationUnitTypeEnum,
    StatusTypeEnum
} from './types';
import { TradeExecutor } from './trade-executor';
import { VolatilityRiskManager } from './trade-risk-manager';
import { TradeRewardStructures } from "./trade-reward-structures";
import { ContractParamsFactory } from './contract-factory';

const logger = pino({
    name: "TradeStrategy",
    level: process.env.LOG_LEVEL || "info",
    serializers: {
        error: pino.stdSerializers.err
    }
});

/**
 * Interface for strategy configuration
 */
interface IStrategyConfig {
    strategyName: string;
    strategySteps: {
        amount: number;
        symbol: MarketType;
        contractType: ContractType;
        contractDurationValue: number;
        contractDurationUnits: ContractDurationUnitType;
        barrier?: number;
        delay?: number;
    }[];
    maxSequence?: number;
    profitPercentage?: number;
    lossRecoveryPercentage?: number;
    maxConsecutiveLosses?: number;
    maxRiskExposure?: number;
}

/**
 * Abstract base class for all trading strategies
 */
export abstract class TradeStrategy {

    protected executor: TradeExecutor;
    protected market: MarketType = MarketTypeEnum.Default
    protected contractType: ContractType = ContractTypeEnum.Default;
    protected basis: BasisType = BasisTypeEnum.Default;
    protected currency: CurrencyType = CurrenciesEnum.Default;
    protected baseStake: number = 1;
    protected contractDurationValue: number = 1;
    protected contractDurationUnits: ContractDurationUnitType = ContractDurationUnitTypeEnum.Default;
    protected userAccountToken: string = "";
    protected previousTradeResultData: IPreviousTradeResult = {} as IPreviousTradeResult;

    protected tradeRewardStructures: TradeRewardStructures;

    // @ts-ignore
    protected volatilityRiskManager: VolatilityRiskManager;

    protected contractFactory: typeof ContractParamsFactory;

    protected strategies: any = [];

    protected predictedDigit: number = 0;

    protected barrier: number | string = 0;

    constructor() {

        this.executor = new TradeExecutor();

        this.tradeRewardStructures = new TradeRewardStructures();

        this.contractFactory = ContractParamsFactory;

    }

    /**
     * Executes the trade strategy
     * @abstract
     * @returns {Promise<ITradeData>} Trade execution result
     */
    abstract execute(): Promise<ITradeData>;

    public initializeVolatilityRiskManager(): void {

        const parsedStrategies: any = this.parseStrategies(this.strategies);

        this.volatilityRiskManager = new VolatilityRiskManager(
            this.baseStake, // baseStake ($1)
            this.market, // market V75
            this.currency, // currency
            this.contractType, // contractType
            this.contractDurationValue, // contractDurationValue
            this.contractDurationUnits, // contractDurationUnits (ticks)
            parsedStrategies, // Custom recovery strategies
        );

    }

    /**
     * Parses and validates strategy configurations
     * @param {IStrategyConfig[]} strategies - Array of strategy configurations
     * @returns {IStrategyConfig[]} Validated and normalized strategies
     * @throws {Error} If any strategy is invalid
     */
    private parseStrategies(strategies: IStrategyConfig[]): IStrategyConfig[] {
        if (!strategies || strategies.length === 0) {
            return this.getDefaultStrategy();
        }

        return strategies.map(strategy => {
            if (!strategy.strategyName) {
                throw new Error('Strategy name is required');
            }

            if (!strategy.strategySteps || strategy.strategySteps.length === 0) {
                throw new Error('Strategy steps are required');
            }

            return {
                strategyName: strategy.strategyName,
                strategySteps: strategy.strategySteps.map(step => ({
                    amount: step.amount > 0 ? step.amount : this.baseStake,
                    symbol: step.symbol || this.market,
                    contractType: step.contractType || this.contractType,
                    contractDurationValue: step.contractDurationValue || this.contractDurationValue,
                    contractDurationUnits: step.contractDurationUnits || this.contractDurationUnits,
                    barrier: step.barrier,
                    delay: step.delay
                })),
                maxSequence: strategy.maxSequence || strategy.strategySteps.length,
                profitPercentage: strategy.profitPercentage || 80,
                lossRecoveryPercentage: strategy.lossRecoveryPercentage || 100,
                maxConsecutiveLosses: strategy.maxConsecutiveLosses || 5,
                maxRiskExposure: strategy.maxRiskExposure || 10
            };
        });
    }

    /**
     * Gets default strategy configuration
     * @returns {IStrategyConfig[]} Default strategy configuration
     */
    private getDefaultStrategy(): IStrategyConfig[] {
        return [{
            strategyName: "DefaultRecovery",
            strategySteps: [{
                amount: this.baseStake,
                symbol: this.market,
                contractType: this.contractType,
                contractDurationValue: this.contractDurationValue,
                contractDurationUnits: this.contractDurationUnits
            }],
            maxSequence: 1,
            profitPercentage: 50,
            lossRecoveryPercentage: 80,
            maxConsecutiveLosses: 3,
            maxRiskExposure: 5
        }];
    }

    /**
     * Validates trade parameters before execution
     * @param {ContractParams} params - Trade parameters to validate
     * @throws {Error} If parameters are invalid
     */
    protected validateParameters(params: ContractParams): void {
        if (!params) {
            throw new Error('Trade parameters are required');
        }

        if (Number(params.amount) <= 0) {
            throw new Error('Stake amount must be positive');
        }

        if (!params.basis) {
            throw new Error('Basis type must be specified');
        }

        if (!params.currency) {
            throw new Error('Currency must be specified');
        }

        if (!params.duration) {
            throw new Error('Duration must be specified');
        }

        if (!params.duration_unit) {
            throw new Error('Duration units must be specified');
        }

        if (!params.symbol) {
            throw new Error('Market symbol must be specified');
        }

        // Additional validation based on purchase type
        this.validateContractTypeSpecificParams(params);

    }

    /**
     * Validates parameters specific to each purchase type
     * @param {ContractParams} params - Trade parameters
     * @protected
     */
    protected validateContractTypeSpecificParams(params: ContractParams): void {
        switch (this.contractType) {
            case ContractTypeEnum.DigitDiff:
            case ContractTypeEnum.DigitUnder:
            case ContractTypeEnum.DigitOver:
                if (params.barrier === undefined) {
                    throw new Error('Barrier is required for digit-based trades');
                }
                this.validateDigit(Number(params.barrier));
                break;
        }
    }

    /**
     * Sets the predicted digit for digit-based strategies
     * @param {number} predictedDigit - The digit to predict (0-9)
     */
    setPrediction(predictedDigit: number): void {
        this.predictedDigit = this.validateDigit(predictedDigit);
    }

    /**
     * Sets the barrier value for barrier-based strategies
     * @param {number|string} barrier - The barrier value
     */
    setBarrier(barrier: number | string): void {
        this.barrier = this.validateBarrier(barrier);
    }

    /**
     * Validates and normalizes the predicted digit
     * @param {number} digit - The digit to validate (0-9)
     * @returns {number} Validated digit (0-9)
     * @throws {Error} If digit is invalid
     */
    private validateDigit(digit: number): number {
        const validDigit = Math.round(digit);
        if (validDigit < 0 || validDigit > 9) {
            throw new Error('Predicted digit must be between 0-9');
        }
        return validDigit;
    }

    /**
     * Validates and normalizes the barrier value
     * @param {number|string} barrier - The barrier to validate
     * @returns {number|string} Validated barrier
     * @throws {Error} If barrier is invalid
     */
    private validateBarrier(barrier: number | string): number | string {
        if (typeof barrier === "string") {
            if (barrier !== ContractTypeEnum.DigitEven && barrier !== ContractTypeEnum.DigitOdd) {
                return ContractTypeEnum.DigitEven;
            }
            return barrier;
        }

        const validBarrier = Math.round(barrier);
        if (validBarrier < 0 || validBarrier > 9) {
            throw new Error('Barrier must be between 0-9');
        }
        return validBarrier;
    }

    /**
     * Performs pre-contract purchase checks
     * @param {ContractType} contractType - The purchase type
     * @protected
     */
    protected async preContractPurchaseChecks(contractType: ContractType): Promise<void> {
        // Check if we're in safety mode
        if (this.volatilityRiskManager && this.volatilityRiskManager.getCurrentState().inSafetyMode) {
            throw new Error('Cannot execute trade while in safety mode');
        }

        // Additional checks can be added here
    }

    /**
     * Gets parameters for the next contract using the factory
     * @param {ContractType} contractType - The purchase type
     * @returns {ContractParams} Parameters for the next contract
     * @protected
     */
    protected getNextContractParams(contractType: ContractType): ContractParams {
        // Get parameters from risk manager if available
        if (this.volatilityRiskManager) {
            const nextParams = this.volatilityRiskManager.getNextTradeParams();
            
            return this.createParamsFromFactory(
                contractType,
                nextParams.amount,
                nextParams.barrier
            );
        }

        // Fallback to basic parameters using factory
        return this.createParamsFromFactory(
            contractType,
            this.baseStake
        );
    }

    /**
     * Creates contract parameters using the factory
     * @private
     */
    private createParamsFromFactory(
        contractType: ContractType,
        amount: number,
        barrier?: number | string
    ): ContractParams {
        const commonParams = {
            amount,
            currency: this.currency,
            duration: this.contractDurationValue,
            durationUnit: this.contractDurationUnits,
            market: this.market,
            basis: this.basis
        };

        switch (contractType) {
            case ContractTypeEnum.DigitDiff:
                return this.contractFactory.createDigitDiffParams({
                    ...commonParams,
                    predictedDigit: barrier as number ?? this.predictedDigit
                });

            case ContractTypeEnum.DigitOver:
                return this.contractFactory.createDigitOverParams({
                    ...commonParams,
                    predictedDigit: barrier as number ?? (this.barrier as number)
                });

            case ContractTypeEnum.DigitUnder:
                return this.contractFactory.createDigitUnderParams({
                    ...commonParams,
                    predictedDigit: barrier as number ?? (this.barrier as number)
                });

            case ContractTypeEnum.DigitEven:
                return this.contractFactory.createDigitEvenParams({
                    ...commonParams,
                    barrier: ContractTypeEnum.DigitEven
                });

            case ContractTypeEnum.DigitOdd:
                return this.contractFactory.createDigitOddParams({
                    ...commonParams,
                    barrier: ContractTypeEnum.DigitOdd
                });

            case ContractTypeEnum.Call:
            case ContractTypeEnum.Put:
            default:
                return {
                    ...commonParams,
                    contract_type: contractType,
                    symbol: this.market
                };
        }
    }

}

/**
 * Digit Difference trading strategy
 */
export class DigitDiffStrategy extends TradeStrategy {

    /**
     * Creates a new DigitDiffStrategy instance
     * @param {number} predictedDigit - The digit to predict (0-9)
     */
    constructor(contractStrategies: any) {

        super();
        // Set the purchase type of the strategy
        this.contractType = ContractTypeEnum.DigitDiff;

        this.strategies = contractStrategies;

        this.initializeVolatilityRiskManager();

    }

    /**
     * Executes a DIGITDIFF trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {
        try {
            await this.preContractPurchaseChecks(this.contractType);

            logger.info({
                action: 'executing_strategy',
                strategy: 'DIGITDIFF',
                predictedDigit: this.predictedDigit
            });

            const params = this.getNextContractParams(this.contractType);
            params.barrier = this.predictedDigit;

            this.validateParameters(params);

            const result = await this.executor.purchaseContract(params, this.userAccountToken);

            // Update risk manager with trade result
            if (this.volatilityRiskManager) {
                this.volatilityRiskManager.processTradeResult({
                    ...this.previousTradeResultData,
                    resultIsWin: result.status === StatusTypeEnum.Won
                });
            }

            return result;
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITDIFF',
                message: 'Error executing DIGITDIFF strategy'
            });
            throw error;
        }
    }

}

/**
 * Digit Even trading strategy
 */
export class DigitEvenStrategy extends TradeStrategy {

    constructor(contractStrategies: any) {

        super();
        // Set the purchase type of the strategy
        this.contractType = ContractTypeEnum.DigitEven;

        this.strategies = contractStrategies;

        this.initializeVolatilityRiskManager();

    }

    /**
     * Executes a EVEN trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {
        try {
            await this.preContractPurchaseChecks(this.contractType);

            logger.info({
                action: 'executing_strategy',
                strategy: 'EVEN'
            });

            const params = this.getNextContractParams(this.contractType);
            this.validateParameters(params);

            const result = await this.executor.purchaseContract(params, this.userAccountToken);

            // Update risk manager with trade result
            if (this.volatilityRiskManager) {
                this.volatilityRiskManager.processTradeResult({
                    ...this.previousTradeResultData,
                    resultIsWin: result.status === StatusTypeEnum.Won
                });
            }

            return result;
        } catch (error) {
            logger.error({
                error,
                strategy: 'EVEN',
                message: 'Error executing EVEN strategy'
            });
            throw error;
        }
    }

}

/**
 * Digit Odd trading strategy
 */
export class DigitOddStrategy extends TradeStrategy {

    constructor(contractStrategies: any) {
        super();
        // Set the purchase type of the strategy
        this.contractType = ContractTypeEnum.DigitOdd;

        this.strategies = contractStrategies;

        this.initializeVolatilityRiskManager();

    }

    /**
     * Executes a ODD trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {
        try {
            await this.preContractPurchaseChecks(this.contractType);

            logger.info({
                action: 'executing_strategy',
                strategy: 'ODD'
            });

            const params = this.getNextContractParams(this.contractType);
            this.validateParameters(params);

            const result = await this.executor.purchaseContract(params, this.userAccountToken);

            // Update risk manager with trade result
            if (this.volatilityRiskManager) {
                this.volatilityRiskManager.processTradeResult({
                    ...this.previousTradeResultData,
                    resultIsWin: result.status === StatusTypeEnum.Won
                });
            }

            return result;
        } catch (error) {
            logger.error({
                error,
                strategy: 'ODD',
                message: 'Error executing ODD strategy'
            });
            throw error;
        }
    }

}

/**
 * Call trading strategy
 */
export class CallStrategy extends TradeStrategy {

    constructor(contractStrategies: any) {
        super();
        // Set the purchase type of the strategy
        this.contractType = ContractTypeEnum.Call;

        this.strategies = contractStrategies;

        this.initializeVolatilityRiskManager();

    }

    /**
     * Executes a CALL trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {
        try {
            await this.preContractPurchaseChecks(this.contractType);

            logger.info({
                action: 'executing_strategy',
                strategy: 'CALL'
            });

            const params = this.getNextContractParams(this.contractType);
            this.validateParameters(params);

            const result = await this.executor.purchaseContract(params, this.userAccountToken);

            // Update risk manager with trade result
            if (this.volatilityRiskManager) {
                this.volatilityRiskManager.processTradeResult({
                    ...this.previousTradeResultData,
                    resultIsWin: result.status === StatusTypeEnum.Won
                });
            }

            return result;
        } catch (error) {
            logger.error({
                error,
                strategy: 'CALL',
                message: 'Error executing CALL strategy'
            });
            throw error;
        }
    }

}

/**
 * Put trading strategy
 */
export class PutStrategy extends TradeStrategy {

    constructor(contractStrategies: any) {
        super();
        // Set the purchase type of the strategy
        this.contractType = ContractTypeEnum.Put;

        this.strategies = contractStrategies;

        this.initializeVolatilityRiskManager();

    }

    /**
     * Executes a PUT trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {
        try {
            await this.preContractPurchaseChecks(this.contractType);

            logger.info({
                action: 'executing_strategy',
                strategy: 'PUT'
            });

            const params = this.getNextContractParams(this.contractType);
            this.validateParameters(params);

            const result = await this.executor.purchaseContract(params, this.userAccountToken);

            // Update risk manager with trade result
            if (this.volatilityRiskManager) {
                this.volatilityRiskManager.processTradeResult({
                    ...this.previousTradeResultData,
                    resultIsWin: result.status === StatusTypeEnum.Won
                });
            }

            return result;
        } catch (error) {
            logger.error({
                error,
                strategy: 'PUT',
                message: 'Error executing PUT strategy'
            });
            throw error;
        }
    }

}



/**
 * Digit Under trading strategy
 */
export class DigitUnderStrategy extends TradeStrategy {

    /**
     * Creates a new DigitUnderStrategy instance
     * @param {number} barrier - The barrier value (0-9)
     */
    constructor(contractStrategies: any) {
        super();
        // Set the purchase type of the strategy
        this.contractType = ContractTypeEnum.DigitUnder;

        this.strategies = contractStrategies;

        this.initializeVolatilityRiskManager();

    }

    /**
     * Executes a DIGITUNDER trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {
        try {
            await this.preContractPurchaseChecks(this.contractType);

            logger.info({
                action: 'executing_strategy',
                strategy: 'DIGITUNDER',
                barrier: this.barrier
            });

            const params = this.getNextContractParams(this.contractType);
            params.barrier = this.barrier as number;

            this.validateParameters(params);

            const result = await this.executor.purchaseContract(params, this.userAccountToken);

            // Update risk manager with trade result
            if (this.volatilityRiskManager) {
                this.volatilityRiskManager.processTradeResult({
                    ...this.previousTradeResultData,
                    resultIsWin: result.status === StatusTypeEnum.Won
                });
            }

            return result;
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITUNDER',
                message: 'Error executing DIGITUNDER strategy'
            });
            throw error;
        }
    }

}

/**
 * Digit Over trading strategy
 */
export class DigitOverStrategy extends TradeStrategy {

    /**
     * Creates a new DigitOverStrategy instance
     * @param {number} barrier - The barrier value (0-9)
     */
    constructor(contractStrategies: any) {
        super();
        // Set the purchase type of the strategy
        this.contractType = ContractTypeEnum.DigitOver;

        this.strategies = contractStrategies;

        this.initializeVolatilityRiskManager();

    }

    /**
     * Executes a DIGITOVER trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {
        try {
            await this.preContractPurchaseChecks(this.contractType);

            logger.info({
                action: 'executing_strategy',
                strategy: 'DIGITOVER',
                barrier: this.barrier
            });

            const params = this.getNextContractParams(this.contractType);
            params.barrier = this.barrier as number;

            this.validateParameters(params);

            const result = await this.executor.purchaseContract(params, this.userAccountToken);

            // Update risk manager with trade result
            if (this.volatilityRiskManager) {
                this.volatilityRiskManager.processTradeResult({
                    ...this.previousTradeResultData,
                    resultIsWin: result.status === StatusTypeEnum.Won
                });
            }

            return result;
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITOVER',
                message: 'Error executing DIGITOVER strategy'
            });
            throw error;
        }
    }

}