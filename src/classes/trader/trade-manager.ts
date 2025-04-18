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
import { parsePurchaseType } from "@/common/utils/snippets";

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
    private market: string | undefined;
    private purchaseType: string | undefined;
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

        this.market = config.market;
        this.purchaseType = config.purchaseType;
        this.baseStake = config.baseStake || 1;
        this.currentStake = this.baseStake || 1;
        this.minStake = config.minStake || 0.35;
        this.maxStake = config.maxStake || 5;
        this.contractDuration = config.contractDurationValue || 1;
        this.contractDurationUnit = config.contractDurationUnits || 't';
        this.currency = 'USD'; // Default, can be overridden by account

        this.profitCalculator = new ProfitCalculator();
        this.contractParamsFactory = new ContractParamsFactory();
        this.currentStrategy = new DigitDiffStrategy(1); // Default strategy
    }

    /**
     * Executes a trade based on the specified purchase type
     * @param {PurchaseType} purchaseType - Type of trade to execute
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async executeTrade(previousTradeResultData: any): Promise<ITradeData | undefined> {
 
        if (!previousTradeResultData) {
            throw new Error('TradeManager not initialized : Missing previousTradeResultData');
        }

        try {

            // Select appropriate strategy
            this.selectStrategy(previousTradeResultData);

            this.currentStrategy.updateParams(previousTradeResultData);

            // Execute the trade using current strategy
            const response = await this.currentStrategy.execute();

            // Validate and process trade result
            return this.processTradeResult(response);

        } catch (error: any) {
            logger.error('Trade execution failed', error);
            console.log("#EEE#", error)
            //throw new Error(`Trade execution failed: ${error.message}`);
        }
    }

    /**
     * Updates trading strategy based on previous results
     * @param {boolean} wasSuccessful - Whether the previous trade was successful
     */
    updateStrategy(tradeResult: any): void {
        if (tradeResult.resultIsWin) {
            // Reset to original strategy after success
            this.currentStrategy.resetStrategyType();
            this.currentStake = this.baseStake; // Reset stake to base
        } else {
            // Implement intelligent strategy adaptation
            this.adaptStrategyAfterLoss(tradeResult);
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
     * @param {any} previousTradeResultData - Type of trade strategy
     * @private
     */
    private selectStrategy(previousTradeResultData: any): void {

        this.currentStrategy = this.createStrategy(previousTradeResultData);

        this.profitPercentage = this.profitCalculator.calculateProfitPercentage(
            previousTradeResultData.purchaseType,
            this.currentStake
        );

    }

    /**
     * Creates a strategy instance based on type
     * @param {any} previousTradeResultData - Type of strategy to create
     * @returns {TradeStrategy} Strategy instance
     * @private
     */
    private createStrategy(previousTradeResultData: any): TradeStrategy {

        switch (previousTradeResultData.purchaseType) {
            case 'DIGITDIFF':
                return new DigitDiffStrategy(previousTradeResultData);
            case 'EVEN':
                return new DigitEvenStrategy(previousTradeResultData);
            case 'ODD':
                return new DigitOddStrategy(previousTradeResultData);
            case 'CALL':
                return new CallStrategy(previousTradeResultData);
            case 'PUT':
                return new PutStrategy(previousTradeResultData);
            default:
                logger.warn(`Unknown strategy type: ${previousTradeResultData.purchaseType}, using DIGITDIFF as fallback`);
                return new DigitDiffStrategy(this.getRandomDigit());
        }
    }

    /**
     * Adapts strategy after a losing trade
     * @private
     */
    private adaptStrategyAfterLoss(tradeResult: any): void {
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
     * Generates a random digit (0-9)
     * @returns {number} Random digit
     * @private
     */
    private getRandomDigit(): number {
        return Math.floor(Math.random() * 10);
    }

}