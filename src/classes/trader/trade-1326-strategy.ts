/**
 * 1-3-2-6 Trading Strategy Implementation
 * 
 * This strategy implements a progressive betting system that follows a 1-3-2-6 sequence
 * after wins and implements a stop-loss mechanism after losses.
 */

import { getRandomDigit } from "@/common/utils/snippets";
import { ContractDurationUnitTypeEnum, ContractTypeEnum, DurationValuesEnum, TradeDurationUnitsEnum } from "./types";

// ==================== Type Definitions ====================

/** Possible trade outcomes */
export type TradeOutcome = 'win' | 'loss';

/** Notification types for the strategy */
type NotificationType = 'info' | 'success' | 'error' | 'warn';

/** Configuration for the strategy */
interface StrategyConfig {
    profitThreshold: number;
    lossThreshold: number;
    initialStake: number;
    initialPrediction: number;
    market: string;
}

/** Current state of the strategy */
interface StrategyState {
    currentUnits: number;
    totalProfit: number;
    lastPrediction: number;
    sequencePosition: number;
    tradeCount: number;
    consecutiveLosses: number;
}

// ==================== Constants ====================

/** Default configuration values */
const DEFAULT_CONFIG: StrategyConfig = {
    profitThreshold: 1000,
    lossThreshold: 950,
    initialStake: 4,
    initialPrediction: getRandomDigit(),
    market: '1HZ100V',
};

/** The 1-3-2-6 sequence multipliers */
const SEQUENCE_MULTIPLIERS = [1, 3, 2, 6, 4, 10];

// ==================== Strategy Class ====================

export class OneThreeTwoSixStrategy {

    private config: StrategyConfig = {} as StrategyConfig;
    private state: StrategyState = {} as StrategyState;
    private isInitialized: boolean = false;

    constructor(config: Partial<StrategyConfig> = {}) {
        // Merge provided config with defaults
        this.config = { ...DEFAULT_CONFIG, ...config };

        this.reset();

        // Initialize state
        this.state.lastPrediction = this.config.initialPrediction;

        this.isInitialized = true;

    }

    // ==================== Public Methods ====================

    /**
     * Executes the strategy's trade logic
     * @param lastTradeOutcome Outcome of the last trade (win/loss)
     * @param lastTradeProfit Profit from the last trade
     * @returns Trade decision including amount and prediction
     */
    public executeTrade(lastTradeOutcome?: boolean, lastTradeProfit?: number): TradeDecision {

        if (!this.isInitialized) {
            throw new Error('Strategy not initialized');
        }

        // Update state based on last trade if provided
        if (lastTradeOutcome && lastTradeProfit !== undefined) {
            this.updateStateAfterTrade(lastTradeOutcome, lastTradeProfit);
        }

        // Check if we should continue trading based on thresholds
        if (!this.shouldContinueTrading()) {
            this.sendNotification(
                this.state.totalProfit >= this.config.profitThreshold ? 'success' : 'error',
                this.getThresholdMessage()
            );
            return { shouldTrade: false, reason: this.getThresholdMessage() };
        }

        return {
            shouldTrade: true,
            amount: this.getCurrentStake(),
            prediction: getRandomDigit(),
            contractType: ContractTypeEnum.DigitDiff,
            market: this.config.market,
            duration: 1, // 1 tick duration
            durationType: ContractDurationUnitTypeEnum.Default
        };
    }

    /**
     * Resets the strategy to its initial state
     */
    public reset(): void {
        this.state = {
            currentUnits: 1,
            totalProfit: 0,
            lastPrediction: getRandomDigit(),
            sequencePosition: 0,
            tradeCount: 0,
            consecutiveLosses: 0
        };
    }

    // ==================== Core Logic Methods ====================

    /**
     * Updates the strategy state after a trade
     * @param outcome Outcome of the trade (win/loss)
     * @param profit Profit from the trade
     */
    private updateStateAfterTrade(outcome: boolean, profit: number): void {

        this.state.totalProfit += profit;

        this.state.tradeCount++;

        if (outcome) {
            this.handleWin();
        } else {
            this.handleLoss();
        }

        /*
        // Send periodic profit update
        if (this.state.tradeCount % 5 === 0) {
            this.sendNotification('info', `Total Profit: ${this.state.totalProfit.toFixed(2)}`);
        }
        */

        this.state.lastPrediction = getRandomDigit();

    }

    /**
     * Handles the strategy logic after a winning trade
     */
    private handleWin(): void {

        // Progress through the 1-3-2-6 sequence
        this.state.sequencePosition = (this.state.sequencePosition + 1) % SEQUENCE_MULTIPLIERS.length;

        this.state.currentUnits = SEQUENCE_MULTIPLIERS[this.state.sequencePosition];

        // If we completed a full sequence (1-3-2-6), reset to start
        if (this.state.sequencePosition === 0) {

            this.sendNotification('success', '1-3-2-6 sequence completed, resetting to initial stake');

        }

        this.state.consecutiveLosses = 0;

    }

    /**
     * Handles the strategy logic after a losing trade
     */
    private handleLoss(): void {

        // After a loss, multiply stake by 12.75x (recovery mechanism)
        this.state.currentUnits *= 12.75;

        this.state.consecutiveLosses++;

        if (this.state.consecutiveLosses === 2) {
            
            this.state.sequencePosition = 0; // Reset sequence position
            this.state.consecutiveLosses = 0;

        }

    }

    /**
     * Determines if the strategy should continue trading based on thresholds
     * @returns boolean indicating whether to continue trading
     */
    private shouldContinueTrading(): boolean {

        return (
            this.state.totalProfit < this.config.profitThreshold &&
            this.state.totalProfit > -this.config.lossThreshold &&
            this.state.consecutiveLosses < 2
        );

    }

    /**
     * Gets the current stake amount based on initial stake and current units
     * @returns Current stake amount
     */
    private getCurrentStake(): number {

        return this.config.initialStake * this.state.currentUnits;

    }

    // ==================== Helper Methods ====================

    /**
     * Gets the appropriate threshold message based on current profit
     * @returns Message string
     */
    private getThresholdMessage(): string {
        if (this.state.totalProfit >= this.config.profitThreshold) {
            return `Profit threshold reached. Total Profit: ${this.state.totalProfit.toFixed(2)}`;
        } else {
            return `Loss threshold reached. Total Loss: ${Math.abs(this.state.totalProfit).toFixed(2)}`;
        }
    }

    /**
     * Sends a notification (placeholder implementation)
     * @param type Type of notification
     * @param message Notification message
     */
    private sendNotification(type: NotificationType, message: string): void {
        // In a real implementation, this would send notifications to the user
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

// ==================== Supporting Types ====================

/** Decision made by the strategy about trading */
interface TradeDecision {
    shouldTrade: boolean;
    reason?: string;
    amount?: number;
    prediction?: number;
    contractType?: string;
    duration?: number;
    durationType?: string;
    market?: any;
}

// ==================== Example Usage ====================
