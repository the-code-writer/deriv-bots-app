// trade-strategies.ts - Trade strategy implementations
/**
 * @file Contains all trade strategy implementations for the Deriv trading bot
 * @module TradeStrategies
 */
import { pino } from "pino";
import { ContractParams, ITradeData, PurchaseType } from './types';
import { TradeExecutor } from './trade-executor';
const logger = pino({ name: "TradeStrategy" });

/**
 * Abstract base class for all trading strategies
 */
export abstract class TradeStrategy {
    protected executor: TradeExecutor;
    protected strategyType: PurchaseType = "DIGITDIFF";

    constructor() {
        this.executor = new TradeExecutor();
    }

    /**
     * Executes the trade strategy
     * @param {number} stake - Trade stake amount
     * @param {string} currency - Currency for the trade
     * @param {number} duration - Trade duration
     * @param {string} durationUnit - Trade duration unit (s, m, h, d, t)
     * @param {string} market - Market symbol
     * @returns {Promise<ITradeData>} Trade execution result
     */
    abstract execute(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string,
        userAccountToken: string
    ): Promise<ITradeData>;

    /**
     * Gets the strategy type
     * @returns {PurchaseType} The strategy type identifier
     */
    getStrategyType(): PurchaseType {
        return this.strategyType;
    }

    /**
     * Validates trade parameters before execution
     * @param {number} stake - Trade stake amount
     * @param {string} currency - Trade currency
     * @param {string} market - Market symbol
     * @throws {Error} If parameters are invalid
     */
    protected validateParameters(
        stake: number,
        currency: string,
        market: string
    ): void {
        if (stake <= 0) throw new Error('Stake must be positive');
        if (!currency) throw new Error('Currency must be specified');
        if (!market) throw new Error('Market must be specified');
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
     */
    async execute(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string,
        userAccountToken: string
    ): Promise<ITradeData> {
        this.validateParameters(stake, currency, market);

        const params: ContractParams = {
            amount: stake,
            basis: 'stake',
            contract_type: 'DIGITDIFF',
            currency,
            duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: this.predictedDigit.toString()
        };

        logger.debug(`Executing DIGITDIFF strategy with digit ${this.predictedDigit}`);
        return this.executor.purchaseContract(params, userAccountToken);
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
     */
    async execute(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string,
        userAccountToken: string
    ): Promise<ITradeData> {
        this.validateParameters(stake, currency, market);

        const params: ContractParams = {
            amount: stake,
            basis: 'stake',
            contract_type: 'EVEN',
            currency,
            duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: 'EVEN'
        };

        logger.debug('Executing EVEN strategy');
        return this.executor.purchaseContract(params, userAccountToken);
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
     */
    async execute(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string,
        userAccountToken: string
    ): Promise<ITradeData> {
        this.validateParameters(stake, currency, market);

        const params: ContractParams = {
            amount: stake,
            basis: 'stake',
            contract_type: 'ODD',
            currency,
            duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: 'ODD'
        };

        logger.debug('Executing ODD strategy');
        return this.executor.purchaseContract(params, userAccountToken);
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
     */
    async execute(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string,
        userAccountToken: string
    ): Promise<ITradeData> {
        this.validateParameters(stake, currency, market);

        const params: ContractParams = {
            amount: stake,
            basis: 'stake',
            contract_type: 'CALL',
            currency,
            duration,
            duration_unit: durationUnit,
            symbol: market
        };

        logger.debug('Executing CALL strategy');
        return this.executor.purchaseContract(params, userAccountToken);
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
     */
    async execute(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string,
        userAccountToken: string
    ): Promise<ITradeData> {
        this.validateParameters(stake, currency, market);

        const params: ContractParams = {
            amount: stake,
            basis: 'stake',
            contract_type: 'PUT',
            currency,
            duration,
            duration_unit: durationUnit,
            symbol: market
        };

        logger.debug('Executing PUT strategy');
        return this.executor.purchaseContract(params, userAccountToken);
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
     */
    async execute(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string,
        userAccountToken: string
    ): Promise<ITradeData> {
        this.validateParameters(stake, currency, market);

        const params: ContractParams = {
            amount: stake,
            basis: 'stake',
            contract_type: 'DIGITUNDER',
            currency,
            duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: this.barrier.toString()
        };

        logger.debug(`Executing DIGITUNDER strategy with barrier ${this.barrier}`);
        return this.executor.purchaseContract(params, userAccountToken);
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
     */
    async execute(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string,
        userAccountToken: string
    ): Promise<ITradeData> {
        this.validateParameters(stake, currency, market);

        const params: ContractParams = {
            amount: stake,
            basis: 'stake',
            contract_type: 'DIGITOVER',
            currency,
            duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: this.barrier.toString()
        };

        logger.debug(`Executing DIGITOVER strategy with barrier ${this.barrier}`);
        return this.executor.purchaseContract(params, userAccountToken);
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