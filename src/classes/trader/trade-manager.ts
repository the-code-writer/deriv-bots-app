// trade-manager.ts - Trade management and strategy execution
/**
 * @file Manages trade execution and strategy adaptation
 * @module TradeManager
 */

import { pino } from "pino";
import { BotConfig, ContractParams, ITradeData, PurchaseType } from './types';
import { ContractParamsFactory } from './contract-factory';
import { ProfitCalculator } from './profit-calculator';
import { env } from "@/common/utils/envConfig";
import { TradeStrategy, DigitDiffStrategy, DigitEvenStrategy, DigitOddStrategy, CallStrategy, PutStrategy } from "./trade-strategies";

const logger = pino({ name: "TradeManager" });

const DerivAPI = require("@deriv/deriv-api/dist/DerivAPI");

/**
 * Manages trade execution and strategy adaptation
 */
export class TradeManager {
    // Configuration properties
    private readonly baseStake: number;
    private readonly minStake: number;
    private readonly maxStake: number;
    private readonly contractDuration: number;
    private readonly contractDurationUnit: string;
    private currency: string;

    // State properties
    private currentStake: number;
    private profitPercentage: number = 0;
    private currentStrategy: TradeStrategy;
    private profitCalculator: ProfitCalculator;
    private contractParamsFactory: ContractParamsFactory;
    private api: any = null;
    private account: any = null;

    /**
     * Constructs a new TradeManager instance
     * @param {BotConfig} config - Configuration object for the trade manager
     */
    constructor(config: BotConfig) {
        this.baseStake = config.baseStake || 1;
        this.currentStake = this.baseStake;
        this.minStake = config.minStake || 0.35;
        this.maxStake = config.maxStake || 5;
        this.contractDuration = config.contractDuration || 1;
        this.contractDurationUnit = config.contractDurationUnit || 't';
        this.currency = 'USD'; // Default, can be overridden by account

        this.profitCalculator = new ProfitCalculator();
        this.contractParamsFactory = new ContractParamsFactory();
        this.currentStrategy = new DigitDiffStrategy(1); // Default strategy
    }

    /**
     * Initializes the trade manager with API connection
     * @param {string} token - User account token
     * @returns {Promise<void>}
     */
    async initialize(token: string): Promise<void> {
        try {
            this.api = new DerivAPI({
                endpoint: env.DERIV_APP_ENDPOINT_DOMAIN,
                app_id: env.DERIV_APP_ENDPOINT_APP_ID,
                lang: env.DERIV_APP_ENDPOINT_LANG
            });

            this.account = await this.api.account(token);
            const balance = await this.account.balance();
            this.currency = balance.currency || 'USD';

            logger.info('TradeManager initialized successfully');
        } catch (error:any) {
            logger.error('Failed to initialize TradeManager', error);
            throw new Error(`TradeManager initialization failed: ${error.message}`);
        }
    }

    /**
     * Executes a trade based on the specified purchase type
     * @param {PurchaseType} purchaseType - Type of trade to execute
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async executeTrade(purchaseType: PurchaseType): Promise<ITradeData> {
        if (false) {
            throw new Error('TradeManager not initialized');
        }

        try {
            // Select appropriate strategy
            this.selectStrategy(purchaseType);

            // Execute the trade using current strategy
            const tradeResult = await this.currentStrategy.execute(
                this.currentStake,
                this.currency,
                this.contractDuration,
                this.contractDurationUnit,
                this.getMarketSymbol()
            );

            // Validate and process trade result
            return this.processTradeResult(tradeResult);
        } catch (error:any) {
            logger.error('Trade execution failed', error);
            throw new Error(`Trade execution failed: ${error.message}`);
        }
    }

    /**
     * Updates trading strategy based on previous results
     * @param {boolean} wasSuccessful - Whether the previous trade was successful
     */
    updateStrategy(wasSuccessful: boolean): void {
        if (wasSuccessful) {
            // Reset to original strategy after success
            this.currentStrategy = this.createStrategy(this.currentStrategy.getStrategyType());
            this.currentStake = this.baseStake; // Reset stake to base
        } else {
            // Implement intelligent strategy adaptation
            this.adaptStrategyAfterLoss();
        }

        logger.debug(`Strategy updated to: ${this.currentStrategy.getStrategyType()}`);
    }

    /**
     * Gets the current profit percentage for the active strategy
     * @returns {number} Current profit percentage
     */
    getCurrentProfitPercentage(): number {
        return this.profitPercentage;
    }

    /**
     * Gets the current stake amount
     * @returns {number} Current stake amount
     */
    getCurrentStake(): number {
        return this.currentStake;
    }

    /**
     * Safely disconnects from the Deriv API
     * @returns {Promise<void>}
     */
    async disconnect(): Promise<void> {
        try {
            if (this.api) {
                await this.api.disconnect();
            }
            this.api = null;
            this.account = null;
            logger.info('TradeManager disconnected successfully');
        } catch (error) {
            logger.error('Error disconnecting TradeManager', error);
        }
    }

    /**
     * Selects the appropriate trading strategy
     * @param {PurchaseType} purchaseType - Type of trade strategy
     * @private
     */
    private selectStrategy(purchaseType: PurchaseType): void {
        this.currentStrategy = this.createStrategy(purchaseType);
        this.profitPercentage = this.profitCalculator.calculateProfitPercentage(
            purchaseType,
            this.currentStake
        );
    }

    /**
     * Creates a strategy instance based on type
     * @param {PurchaseType} strategyType - Type of strategy to create
     * @returns {TradeStrategy} Strategy instance
     * @private
     */
    private createStrategy(strategyType: PurchaseType): TradeStrategy {
        switch (strategyType) {
            case 'DIGITDIFF':
                return new DigitDiffStrategy(this.getRandomDigit());
            case 'EVEN':
                return new DigitEvenStrategy();
            case 'ODD':
                return new DigitOddStrategy();
            case 'CALL':
                return new CallStrategy();
            case 'PUT':
                return new PutStrategy();
            default:
                logger.warn(`Unknown strategy type: ${strategyType}, using DIGITDIFF as fallback`);
                return new DigitDiffStrategy(this.getRandomDigit());
        }
    }

    /**
     * Adapts strategy after a losing trade
     * @private
     */
    private adaptStrategyAfterLoss(): void {
        // Implement intelligent strategy rotation
        const strategies: PurchaseType[] = ['DIGITDIFF', 'EVEN', 'ODD', 'CALL', 'PUT'];
        const currentIndex = strategies.indexOf(this.currentStrategy.getStrategyType());
        const nextIndex = (currentIndex + 1) % strategies.length;

        this.currentStrategy = this.createStrategy(strategies[nextIndex]);

        // Calculate new profit percentage
        this.profitPercentage = this.profitCalculator.calculateProfitPercentage(
            this.currentStrategy.getStrategyType(),
            this.currentStake
        );
    }

    /**
     * Processes and validates trade results
     * @param {ITradeData} tradeResult - Raw trade result
     * @returns {ITradeData} Processed trade result
     * @private
     */
    private processTradeResult(tradeResult: ITradeData): ITradeData {
        if (!this.isValidTradeResult(tradeResult)) {
            throw new Error('Invalid trade result received');
        }

        // Calculate actual profit percentage
        const actualProfitPercentage = (tradeResult.profit_value / tradeResult.buy_price_value) * 100;
        const expectedProfitPercentage = this.profitPercentage;

        // Log performance variance
        if (Math.abs(actualProfitPercentage - expectedProfitPercentage) > 5) {
            logger.warn(`Significant profit variance: Expected ${expectedProfitPercentage}%, got ${actualProfitPercentage.toFixed(2)}%`);
        }

        return tradeResult;
    }

    /**
     * Validates trade result structure and values
     * @param {ITradeData} tradeResult - Trade result to validate
     * @returns {boolean} True if valid
     * @private
     */
    private isValidTradeResult(tradeResult: ITradeData): boolean {
        const requiredFields = [
            'symbol_short', 'symbol_full', 'buy_price_value',
            'sell_price_value', 'profit_value', 'profit_is_win'
        ];

        // @ts-ignore
        return requiredFields.every(field => tradeResult[field] !== undefined);
    }

    /**
     * Gets the current market symbol
     * @returns {string} Market symbol
     * @private
     */
    private getMarketSymbol(): string {
        // In a real implementation, this would map to the configured market
        return 'R_100'; // Default market
    }

    /**
     * Generates a random digit (0-9)
     * @returns {number} Random digit
     * @private
     */
    private getRandomDigit(): number {
        return Math.floor(Math.random() * 10);
    }

    /**
     * Calculates the next stake amount based on trade results
     * @param {boolean} wasSuccessful - Whether the trade was successful
     * @param {number} profit - Profit amount from the trade
     * @returns {number} New stake amount
     */
    calculateNextStake(wasSuccessful: boolean, profit: number): number {
        if (wasSuccessful) {
            return this.baseStake; // Reset to base after win
        }

        // Martingale-like progression with limits
        let nextStake = this.profitCalculator.getTradingAmount(
            wasSuccessful,
            profit,
            this.baseStake,
            this.profitPercentage
        );

        // Apply stake limits
        return Math.min(Math.max(nextStake, this.minStake), this.maxStake);
    }
}