// trade-strategies.ts - Trade strategy implementations
/**
 * @file Contains all trade strategy implementations for the Deriv trading bot
 * @module TradeStrategies
 */
import { pino } from "pino";
import { ContractParams, ITradeData, PurchaseType } from './types';
import { TradeExecutor } from './trade-executor';
import { ProfitCalculator } from "./profit-calculator";
const logger = pino({ name: "TradeStrategy" });

/**
 * Abstract base class for all trading strategies
 */
export abstract class TradeStrategy {

    private profitCalculator: ProfitCalculator;
    protected executor: TradeExecutor;
    protected strategyType: PurchaseType = "CALL";
    protected currency: string = "USD";
    protected contractDuration: number | string = 1;
    protected contractDurationUnit: string = "t";
    protected market: string = "R_100";
    protected previousTradeResultData: any = {};
    protected userAccountToken: string = "";

    constructor() {
        this.profitCalculator = new ProfitCalculator();
        this.executor = new TradeExecutor();
        this.previousTradeResultData = {};
    }

    /**
     * Executes the trade strategy
     * @returns {Promise<ITradeData>} Trade execution result
     */
    abstract execute(): Promise<ITradeData>;

    /**
     * Gets the strategy type
     * @returns {PurchaseType} The strategy type identifier
     */
    getStrategyType(): PurchaseType {
        return this.strategyType;
    }

    /**
     * Gets the strategy type
     * @returns {PurchaseType} The strategy type identifier
     */
    resetStrategyType(): PurchaseType {
        return this.strategyType;
    }

    /**
     * Gets the strategy type
     * @returns {PurchaseType} The strategy type identifier
     */
    updateParams(market: any, strategyType: any, currency: any, contractDuration: any, contractDurationUnit: any, previousTradeResultData:any, userAccountToken:string): void {

        this.market = market;
        this.strategyType = strategyType;
        this.currency = currency;
        this.contractDuration = contractDuration;
        this.contractDurationUnit = contractDurationUnit;
        this.previousTradeResultData = previousTradeResultData;
        this.userAccountToken = userAccountToken;

    }

    /**
     * Validates trade parameters before execution
     * @param {number} stake - Trade stake amount
     * @param {string} currency - Trade currency
     * @param {string} market - Market symbol
     * @throws {Error} If parameters are invalid
     */
    protected validateParameters(
        params:any
    ): void {

        console.log("PARAMS", params);
                     
        if (params.amount <= 0) throw new Error('Stake must be positive');
        if (!params.basis) throw new Error('Basis must be set');
        if (!params.currency) throw new Error('Currency must be specified');
        if (!params.duration) throw new Error('Duration must be specified');
        if (!params.duration_unit) throw new Error('Duration units must be specified');
        if (!params.symbol) throw new Error('Market must be specified');

    }

    protected getDefaultParams(contractType: any, amount: number, barrier?: number | string) {

        const contractParameters: ContractParams = {
            amount: amount,
            basis: "stake",
            contract_type: contractType,
            currency: this.currency || "USD",
            duration: this.contractDuration,
            duration_unit: this.contractDurationUnit,
            symbol: this.market,
        };

        if (barrier) {
            contractParameters.barrier = barrier;
        }

        return contractParameters;

    }

    protected getContractNextStake(): number {
        
        this.previousTradeResultData = {
            baseStake: 1,
            buy: 1,
            bid: 1,
            sell: 1,
            status: 'won',
            profitSign: 1,
            profit: 0,
            resultIsWin: true,
            tradeResult: {}
        };

        if (this.previousTradeResultData && this.previousTradeResultData.resultIswin) {
            return this.previousTradeResultData.baseStake; // Reset to base after win
        }

        // Martingale-like progression with limits
        let nextStake = this.profitCalculator.getTradingAmount(
            this.previousTradeResultData.resultIswin,
            this.previousTradeResultData.profit,
            this.previousTradeResultData.baseStake,
            this.profitPercentage
        );

        // Apply stake limits
        return nextStake;

    }

}

/**
 * Digit Difference trading strategy
 */
export class DigitDiffStrategy extends TradeStrategy {

    private predictedDigit: number;

    /**
     * Creates a new DigitDiffStrategy instance
     * @param {number} predictedDigit - The digit to predict (0-9)
     */
    constructor(predictedDigit: number) {
        super();
        this.strategyType = 'DIGITDIFF';
        this.predictedDigit = this.validateDigit(predictedDigit);
    }

    /**
     * Executes a DIGITDIFF trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {

        const stake: number = this.getContractNextStake();

        logger.warn(`Executing DIGITDIFF strategy with digit ${this.predictedDigit}`);

        const params: ContractParams = this.getDefaultParams(this.strategyType, stake, this.predictedDigit.toString());

        this.validateParameters(params);

        return this.executor.purchaseContract(params, this.userAccountToken);

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
}

/**
 * Digit Even trading strategy
 */
export class DigitEvenStrategy extends TradeStrategy {
    constructor() {
        super();
        this.strategyType = 'EVEN';
    }

    /**
     * Executes a EVEN trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {

        const stake: number = this.getContractNextStake();

        logger.warn('Executing EVEN strategy');
        
        const params: ContractParams = this.getDefaultParams(this.strategyType, stake);

        this.validateParameters(params);

        return this.executor.purchaseContract(params, this.userAccountToken);
    }
}

/**
 * Digit Odd trading strategy
 */
export class DigitOddStrategy extends TradeStrategy {
    constructor() {
        super();
        this.strategyType = 'ODD';
    }

    /**
     * Executes a ODD trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {

        const stake: number = this.getContractNextStake();

        logger.warn('Executing ODD strategy');

        const params: ContractParams = this.getDefaultParams(this.strategyType, stake);

        this.validateParameters(params);

        return this.executor.purchaseContract(params, this.userAccountToken);
    }
}

/**
 * Call trading strategy
 */
export class CallStrategy extends TradeStrategy {
    constructor() {
        super();
        this.strategyType = 'CALL';
    }

    /**
     * Executes a CALL trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {

        const stake: number = this.getContractNextStake();

        logger.warn('Executing CALL strategy');

        const params: ContractParams = this.getDefaultParams(this.strategyType, stake);

        this.validateParameters(params);

        return this.executor.purchaseContract(params, this.userAccountToken);
    }
}

/**
 * Put trading strategy
 */
export class PutStrategy extends TradeStrategy {
    constructor() {
        super();
        this.strategyType = 'PUT';
    }

    /**
     * Executes a PUT trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {

        const stake: number = this.getContractNextStake();

        logger.warn('Executing PUT strategy');

        const params: ContractParams = this.getDefaultParams(this.strategyType, stake);

        this.validateParameters(params);
        return this.executor.purchaseContract(params, this.userAccountToken);
    }
}



/**
 * Digit Under trading strategy
 */
export class DigitUnderStrategy extends TradeStrategy {
    private barrier: number;

    /**
     * Creates a new DigitUnderStrategy instance
     * @param {number} barrier - The barrier value (0-9)
     */
    constructor(barrier: number) {
        super();
        this.strategyType = 'DIGITUNDER';
        this.barrier = this.validateBarrier(barrier);
    }

    /**
     * Executes a DIGITUNDER trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {

        const stake: number = this.getContractNextStake();

        logger.warn(`Executing DIGITUNDER strategy with barrier ${this.barrier}`);

        const params: ContractParams = this.getDefaultParams(this.strategyType, stake, this.barrier.toString());

        this.validateParameters(params);

        return this.executor.purchaseContract(params, this.userAccountToken);
    }

    /**
     * Validates and normalizes the barrier value
     * @param {number} barrier - The barrier to validate (0-9)
     * @returns {number} Validated barrier (0-9)
     * @throws {Error} If barrier is invalid
     */
    private validateBarrier(barrier: number): number {
        const validBarrier = Math.round(barrier);
        if (validBarrier < 0 || validBarrier > 9) {
            throw new Error('Barrier must be between 0-9');
        }
        return validBarrier;
    }
}

/**
 * Digit Over trading strategy
 */
export class DigitOverStrategy extends TradeStrategy {
    private barrier: number;

    /**
     * Creates a new DigitOverStrategy instance
     * @param {number} barrier - The barrier value (0-9)
     */
    constructor(barrier: number) {
        super();
        this.strategyType = 'DIGITOVER';
        this.barrier = this.validateBarrier(barrier);
    }

    /**
     * Executes a DIGITOVER trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {

        const stake: number = this.getContractNextStake();

        logger.warn(`Executing DIGITOVER strategy with barrier ${this.barrier}`);

        const params: ContractParams = this.getDefaultParams(this.strategyType, stake, this.barrier.toString());

        this.validateParameters(params);
        return this.executor.purchaseContract(params, this.userAccountToken);
    }

    /**
     * Validates and normalizes the barrier value
     * @param {number} barrier - The barrier to validate (0-9)
     * @returns {number} Validated barrier (0-9)
     * @throws {Error} If barrier is invalid
     */
    private validateBarrier(barrier: number): number {
        const validBarrier = Math.round(barrier);
        if (validBarrier < 0 || validBarrier > 9) {
            throw new Error('Barrier must be between 0-9');
        }
        return validBarrier;
    }
}