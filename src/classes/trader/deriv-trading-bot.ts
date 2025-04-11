// deriv-trading-bot.ts - Main trading bot class
/**
 * @file Main Deriv API trading bot class with comprehensive trading functionality
 * @module DerivTradingBot
 */

import { pino } from "pino";
import { BotConfig, ITradeData, MarketType, PurchaseType, TradingType } from './types';
import { TradeManager } from './trade-manager';
import { parentPort } from 'worker_threads';
import { env } from "@/common/utils/envConfig";

const logger = pino({ name: "DerivTradingBot" });
/**
 * Main Deriv trading bot class implementing core trading functionality
 */
export class DerivTradingBot {
    // Configuration and state properties
    private tradeManager: TradeManager;
    private tradingType: TradingType;
    private defaultMarket: MarketType;
    private isTrading: boolean;
    private takeProfit: number;
    private stopLoss: number;
    private tradeStartedAt: number;
    private tradeDuration: number;
    private updateFrequency: number;
    private currentPurchaseType: PurchaseType;
    private originalPurchaseType: PurchaseType;
    private cachedSession: any;
    private tradeDurationTimeoutId: NodeJS.Timeout | null = null;
    private updateFrequencyIntervalId: NodeJS.Timeout | null = null;
    private consecutiveLosses: number = 0;
    private maxConsecutiveLosses: number = env.MAX_RECOVERY_TRADES_X2 || 5;
    private totalProfit: number = 0;
    private totalTrades: number = 0;
    private winningTrades: number = 0;
    private losingTrades: number = 0;

    /**
     * Constructs a new DerivTradingBot instance
     * @param {BotConfig} config - Configuration object for the trading bot
     */
    constructor(config: BotConfig = {}) {
        this.tradeManager = new TradeManager(config);
        this.tradingType = config.tradingType || "Derivatives 📊";
        this.defaultMarket = config.defaultMarket || "R_100";
        this.isTrading = false;
        this.takeProfit = config.takeProfit || 10;
        this.stopLoss = config.stopLoss || 5;
        this.tradeStartedAt = 0;
        this.tradeDuration = 0;
        this.updateFrequency = 0;
        this.currentPurchaseType = "CALL";
        this.originalPurchaseType = "CALL";
        this.cachedSession = null;
    }

    /**
     * Starts the trading process with comprehensive error handling and validation
     * @param {object} session - Trading session configuration
     * @param {boolean} retryAfterError - Flag indicating if this is a retry after error
     * @param {string} userAccountToken - User account token for authentication
     * @returns {Promise<void>} Promise that resolves when trading completes
     * @throws {Error} If invalid parameters are provided or trading cannot start
     */
    async startTrading(
        session: {
            market: MarketType;
            purchaseType: PurchaseType;
            stake: number;
            takeProfit: number;
            stopLoss: number;
            tradeDuration: string;
            updateFrequency: string;
        },
        retryAfterError: boolean = false,
        userAccountToken: string = ""
    ): Promise<void> {
        try {
            // Validate input parameters
            this.validateSessionParameters(session);

            // Use cached session if retrying after error
            if (retryAfterError) {
                if (!this.cachedSession) {
                    throw new Error("No cached session available for retry");
                }
                session = this.cachedSession;
            } else {
                this.cachedSession = session;
            }

            // Initialize trading session
            await this.initializeTradingSession(session, userAccountToken);

            // Start the main trading loop
            this.isTrading = true;
            await this.executeTradingLoop(session.purchaseType);

        } catch (error:any) {
            logger.error('Failed to start trading', error);
            await this.handleTradingError(error, session);
            throw error;
        }
    }

    /**
     * Validates trading session parameters
     * @param {object} session - Trading session configuration
     * @throws {Error} If any parameter is invalid
     */
    private validateSessionParameters(session: {
        market: MarketType;
        purchaseType: PurchaseType;
        stake: number;
        takeProfit: number;
        stopLoss: number;
        tradeDuration: string;
        updateFrequency: string;
    }): void {
        if (!session.market) throw new Error("Market must be specified");
        if (!session.purchaseType) throw new Error("Purchase type must be specified");
        if (session.stake <= 0) throw new Error("Stake must be positive");
        if (session.takeProfit <= 0) throw new Error("Take profit must be positive");
        if (session.stopLoss <= 0) throw new Error("Stop loss must be positive");
        if (!session.tradeDuration) throw new Error("Trade duration must be specified");
        if (!session.updateFrequency) throw new Error("Update frequency must be specified");
    }

    /**
     * Initializes the trading session with timers and configuration
     * @param {object} session - Trading session configuration
     * @param {string} userAccountToken - User account token
     */
    private async initializeTradingSession(
        session: {
            market: MarketType;
            purchaseType: PurchaseType;
            stake: number;
            takeProfit: number;
            stopLoss: number;
            tradeDuration: string;
            updateFrequency: string;
        },
        userAccountToken: string
    ): Promise<void> {
        // Set initial configuration
        this.defaultMarket = session.market;
        this.originalPurchaseType = session.purchaseType;
        this.currentPurchaseType = session.purchaseType;
        this.takeProfit = session.takeProfit;
        this.stopLoss = session.stopLoss;
        this.tradeStartedAt = Date.now() / 1000;

        // Parse duration strings to seconds
        this.tradeDuration = this.parseDurationToSeconds(session.tradeDuration);
        this.updateFrequency = this.parseDurationToSeconds(session.updateFrequency);

        // Setup trade duration timeout
        this.tradeDurationTimeoutId = setTimeout(() => {
            this.stopTrading(`Trade duration limit reached: ${session.tradeDuration}`);
        }, this.tradeDuration * 1000);

        // Setup telemetry updates
        this.updateFrequencyIntervalId = setInterval(() => {
            this.generateTelemetry();
        }, this.updateFrequency * 1000);

        // Notify start of trading
        parentPort?.postMessage({
            action: "sendTelegramMessage",
            text: "🟢 Trading session started successfully",
            meta: { session }
        });
    }

    /**
     * Executes the main trading loop with intelligent trade execution
     * @param {PurchaseType} purchaseType - Type of trade to execute
     */
    private async executeTradingLoop(purchaseType: PurchaseType): Promise<void> {
        while (this.isTrading) {
            try {
                // Execute trade with current strategy
                const tradeResult = await this.tradeManager.executeTrade(purchaseType);
                this.totalTrades++;

                // Process trade result
                await this.processTradeResult(tradeResult);

                // Check for stop conditions
                if (this.shouldStopTrading(tradeResult)) {
                    await this.stopTrading(this.getStopReason(tradeResult));
                    break;
                }

                // Intelligent delay between trades based on market conditions
                await this.adjustTradeDelay(tradeResult);

            } catch (error) {
                logger.error('Error in trading loop', error);
                this.consecutiveLosses++;

                // Stop trading if too many consecutive errors
                if (this.consecutiveLosses >= this.maxConsecutiveLosses) {
                    await this.stopTrading("Maximum consecutive errors reached");
                    break;
                }

                // Exponential backoff for error recovery
                const delay = Math.min(1000 * Math.pow(2, this.consecutiveLosses), 30000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Processes trade results and updates statistics
     * @param {ITradeData} tradeResult - Result of the completed trade
     */
    private async processTradeResult(tradeResult: ITradeData): Promise<void> {
        const profit = tradeResult.profit_value * tradeResult.profit_sign;
        this.totalProfit += profit;

        if (tradeResult.profit_is_win) {
            this.winningTrades++;
            this.consecutiveLosses = 0;
        } else {
            this.losingTrades++;
            this.consecutiveLosses++;
        }

        // Log trade details
        logger.info(`Trade completed - ${tradeResult.profit_is_win ? 'WIN' : 'LOSS'}`);
        logger.debug('Trade details:', tradeResult);

        // Update strategy based on results
        this.tradeManager.updateStrategy(tradeResult.profit_is_win);
    }

    /**
     * Determines if trading should stop based on current conditions
     * @param {ITradeData} tradeResult - Latest trade result
     * @returns {boolean} True if trading should stop
     */
    private shouldStopTrading(tradeResult: ITradeData): boolean {
        // Check take profit
        if (this.totalProfit >= this.takeProfit) return true;

        // Check stop loss
        if (this.totalProfit <= -this.stopLoss) return true;

        // Check max consecutive losses
        if (this.consecutiveLosses >= this.maxConsecutiveLosses) return true;

        return false;
    }

    /**
     * Gets the reason for stopping trading
     * @param {ITradeData} tradeResult - Latest trade result
     * @returns {string} Reason for stopping
     */
    private getStopReason(tradeResult: ITradeData): string {
        if (this.totalProfit >= this.takeProfit) {
            return `Take profit reached (${this.totalProfit.toFixed(2)})`;
        }
        if (this.totalProfit <= -this.stopLoss) {
            return `Stop loss triggered (${this.totalProfit.toFixed(2)})`;
        }
        if (this.consecutiveLosses >= this.maxConsecutiveLosses) {
            return `Max consecutive losses (${this.consecutiveLosses})`;
        }
        return "Manual stop";
    }

    /**
     * Adjusts delay between trades based on market conditions
     * @param {ITradeData} tradeResult - Latest trade result
     */
    private async adjustTradeDelay(tradeResult: ITradeData): Promise<void> {
        // Base delay
        let delay = 3000; // 3 seconds default

        // Increase delay after losses
        if (!tradeResult.profit_is_win) {
            delay = Math.min(delay * (this.consecutiveLosses + 1), 10000); // Up to 10 seconds max
        }

        // Additional random variance to avoid patterns
        delay += Math.random() * 2000; // Add up to 2 seconds random delay

        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Stops the trading process and cleans up resources
     * @param {string} message - Reason for stopping
     * @param {boolean} generateStatistics - Whether to generate final statistics
     */
    async stopTrading(message: string, generateStatistics: boolean = true): Promise<void> {
        try {
            // Set trading flag to false
            this.isTrading = false;

            // Clear timers
            if (this.tradeDurationTimeoutId) clearTimeout(this.tradeDurationTimeoutId);
            if (this.updateFrequencyIntervalId) clearInterval(this.updateFrequencyIntervalId);

            // Generate final statistics if requested
            if (generateStatistics) {
                this.generateTelemetry();
                this.generateTradingSummary();
            }

            // Notify stop
            parentPort?.postMessage({
                action: "sendTelegramMessage",
                text: `🔴 Trading stopped: ${message}`,
                meta: {
                    duration: (Date.now() / 1000 - this.tradeStartedAt).toFixed(0) + 's',
                    profit: this.totalProfit.toFixed(2)
                }
            });

            // Clean up resources
            await this.cleanupResources();

        } catch (error) {
            logger.error('Error stopping trading', error);
            throw error;
        }
    }

    /**
     * Generates comprehensive telemetry data about the trading session
     */
    private generateTelemetry(): void {
        const currentTime = Date.now() / 1000;
        const duration = currentTime - this.tradeStartedAt;
        const winRate = this.totalTrades > 0 ? (this.winningTrades / this.totalTrades) * 100 : 0;
        const avgProfitPerTrade = this.totalTrades > 0 ? this.totalProfit / this.totalTrades : 0;

        const telemetryData = {
            timestamp: new Date().toISOString(),
            duration: this.formatDuration(duration),
            totalTrades: this.totalTrades,
            winningTrades: this.winningTrades,
            losingTrades: this.losingTrades,
            consecutiveLosses: this.consecutiveLosses,
            winRate: winRate.toFixed(2) + '%',
            totalProfit: this.totalProfit.toFixed(2),
            avgProfitPerTrade: avgProfitPerTrade.toFixed(2),
            currentStrategy: this.currentPurchaseType,
            takeProfit: this.takeProfit,
            stopLoss: this.stopLoss,
            market: this.defaultMarket
        };

        // Log telemetry
        logger.info('Telemetry update:', telemetryData);

        // Send telemetry to parent process
        parentPort?.postMessage({
            action: "telemetryUpdate",
            data: telemetryData
        });
    }

    /**
     * Generates a final trading summary report
     */
    private generateTradingSummary(): void {
        const duration = (Date.now() / 1000 - this.tradeStartedAt);
        const winRate = this.totalTrades > 0 ? (this.winningTrades / this.totalTrades) * 100 : 0;
        const profitPerHour = duration > 0 ? (this.totalProfit / (duration / 3600)) : 0;

        const summary = `
      ======================
      TRADING SESSION SUMMARY
      ======================
      Duration:        ${this.formatDuration(duration)}
      Total Trades:    ${this.totalTrades}
      Winning Trades:  ${this.winningTrades} (${winRate.toFixed(2)}%)
      Losing Trades:   ${this.losingTrades}
      Max Consecutive Losses: ${this.consecutiveLosses}
      ----------------------
      Total Profit:    ${this.totalProfit.toFixed(2)}
      Avg Profit/Trade: ${(this.totalTrades > 0 ? (this.totalProfit / this.totalTrades).toFixed(2) : 0)}
      Profit/Hour:     ${profitPerHour.toFixed(2)}
      ======================
    `;

        logger.info(summary);
        parentPort?.postMessage({
            action: "tradingSummary",
            summary: summary
        });
    }

    /**
     * Cleans up resources and resets state
     */
    private async cleanupResources(): Promise<void> {
        // Clear any remaining intervals or timeouts
        if (this.tradeDurationTimeoutId) {
            clearTimeout(this.tradeDurationTimeoutId);
            this.tradeDurationTimeoutId = null;
        }
        if (this.updateFrequencyIntervalId) {
            clearInterval(this.updateFrequencyIntervalId);
            this.updateFrequencyIntervalId = null;
        }

        // Reset trading state
        this.isTrading = false;
        this.consecutiveLosses = 0;
        this.cachedSession = null;
    }

    /**
     * Handles trading errors with appropriate recovery or shutdown
     * @param {Error} error - The error that occurred
     * @param {object} session - Current trading session
     */
    private async handleTradingError(error: Error, session: any): Promise<void> {
        logger.error('Trading error occurred:', error);

        // Classify error type
        const isRecoverable = this.isRecoverableError(error);

        if (isRecoverable) {
            // Implement intelligent backoff strategy
            const backoffTime = this.calculateBackoffTime(this.consecutiveLosses);

            parentPort?.postMessage({
                action: "sendTelegramMessage",
                text: `⚠️ Recoverable error: ${error.message}. Retrying in ${backoffTime}ms...`,
                meta: { error: error.message }
            });

            await new Promise(resolve => setTimeout(resolve, backoffTime));

            // Retry with cached session
            await this.startTrading(session, true);
        } else {
            // Non-recoverable error - stop trading
            await this.stopTrading(`Fatal error: ${error.message}`, false);
        }
    }

    /**
     * Determines if an error is recoverable
     * @param {Error} error - The error to evaluate
     * @returns {boolean} True if the error is recoverable
     */
    private isRecoverableError(error: Error): boolean {
        const recoverableErrors = [
            'NetworkError',
            'TimeoutError',
            'TemporaryServiceError'
        ];

        return recoverableErrors.some(e => error.name.includes(e));
    }

    /**
     * Calculates exponential backoff time
     * @param {number} attempt - Current attempt number
     * @returns {number} Backoff time in milliseconds
     */
    private calculateBackoffTime(attempt: number): number {
        const baseDelay = 1000; // 1 second base
        const maxDelay = 30000; // 30 seconds max
        return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    }

    /**
     * Parses duration string to seconds
     * @param {string} duration - Duration string (e.g., "1h30m")
     * @returns {number} Duration in seconds
     */
    private parseDurationToSeconds(duration: string): number {
        // Implementation would parse strings like "1h30m" to seconds
        return 3600; // Placeholder - actual implementation would parse the string
    }

    /**
     * Formats duration in seconds to human-readable string
     * @param {number} seconds - Duration in seconds
     * @returns {string} Formatted duration string
     */
    private formatDuration(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hours}h ${minutes}m ${secs}s`;
    }
}