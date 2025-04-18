// deriv-trading-bot.ts - Main trading bot class
/**
 * @file Main Deriv API trading bot class with comprehensive trading functionality
 * @module DerivTradingBot
 */

import { pino } from "pino";
import { BotConfig, ITradeData, MarketType, PurchaseType, TradingType, TradingSessionDataType, TradingTypeEnum, MarketTypeEnum, PurchaseTypeEnum, BotSessionDataType, Step, TradingModeTypeEnum, TradeDurationUnitsOptimizedEnum, AccountType, IPreviousTradeResult } from './types';
import { TradeManager } from './trade-manager';
import { parentPort } from 'worker_threads';
import { env } from "@/common/utils/envConfig";
import { convertTimeStringToSeconds } from '@/common/utils/snippets';
import { formatDuration, sanitizeAccountType, sanitizeTradingType, sanitizeMarketType, sanitizePurchaseType, sanitizeAmount, sanitizeTradingMode, sanitizeString } from '@/common/utils/snippets';
import { TradeData } from "../deriv/TradingDataClass";
import { sanitizeContractDurationUnit } from '../../common/utils/snippets';
import { DerivUserAccount } from "./deriv-user-account";

const DerivAPI = require("@deriv/deriv-api/dist/DerivAPI");

const {
    DERIV_APP_ENDPOINT_DOMAIN,
    DERIV_APP_ENDPOINT_APP_ID,
    DERIV_APP_ENDPOINT_LANG,
} = env;

const logger = pino({ name: "DerivTradingBot" });
/**
 * Main Deriv trading bot class implementing core trading functionality
 */
export class DerivTradingBot {

    // Configuration and state properties
    private tradeManager!: TradeManager;
    private accountType!: AccountType;
    private tradingType!: TradingType;
    private defaultMarket!: MarketType;
    private currentPurchaseType!: PurchaseType;
    private originalPurchaseType!: PurchaseType;
    private isTrading!: boolean;
    private baseStake!: number;
    private takeProfit!: number;
    private stopLoss!: number;
    private tradeStartedAt!: number;
    private tradeDuration!: number;
    private updateFrequency!: number;
    private contractDurationUnits!: "t" | "s" | "m" | "h" | "d";
    private contractDurationValue!: number;
    private tradingMode!: string;
    private cachedSession: any;
    private tradeDurationTimeoutId: NodeJS.Timeout | null = null;
    private updateFrequencyIntervalId: NodeJS.Timeout | null = null;
    private consecutiveLosses: number = 0;
    private maxConsecutiveLosses: number = env.MAX_CONSECUTIVE_LOSSES || 5;
    private totalProfit: number = 0;
    private totalLost: number = 0;
    private totalGained: number = 0;
    private totalStake: number = 0;
    private totalPayout: number = 0;
    private totalNumberOfRuns: number = 0;
    private winningTrades: number = 0;
    private losingTrades: number = 0;
    private userAccountToken: string = "";
    private userAccount: any;
    private userBalance: number = 0;
    private previousTradeResultData: IPreviousTradeResult = {} as IPreviousTradeResult;
    private auditTrail: Array<any> = [];

    private botConfig: BotConfig;

    /**
     * Constructs a new DerivTradingBot instance
     * @param {BotConfig} config - Configuration object for the trading bot
     */

    constructor(config: BotConfig = {}) {
        // Save the config for future use
        this.botConfig = config;

        // Call the resetState function to initialize all properties
        this.resetState();

    }

    /**
     * Constructs a new DerivTradingBot instance
     * @param {BotConfig} config - Configuration object for the trading bot
     */
    resetState(config: BotConfig = {}) {

        const mergedConfig: BotConfig = { ...this.botConfig, ...config };

        this.tradeManager = new TradeManager(config);
        this.tradingType = mergedConfig.tradingType || TradingTypeEnum.Derivatives;
        this.defaultMarket = mergedConfig.defaultMarket || MarketTypeEnum.R_100;
        this.currentPurchaseType = PurchaseTypeEnum.Call;
        this.originalPurchaseType = PurchaseTypeEnum.Call;
        this.isTrading = false;
        this.baseStake = 1;
        this.takeProfit = mergedConfig.takeProfit || 10;
        this.stopLoss = mergedConfig.stopLoss || 5;
        this.tradeStartedAt = 0;
        this.tradeDuration = 0;
        this.updateFrequency = 0;
        this.contractDurationUnits = (mergedConfig.contractDurationUnits || TradeDurationUnitsOptimizedEnum.Ticks) as "t" | "s" | "m" | "h" | "d";
        this.contractDurationValue = mergedConfig.contractDurationValue || 1;
        this.tradingMode = mergedConfig.tradingMode || TradingModeTypeEnum.Manual;
        this.cachedSession = null;
        this.userAccountToken = "";
        this.consecutiveLosses = 0;
        this.maxConsecutiveLosses = env.MAX_CONSECUTIVE_LOSSES || 5;
        this.totalProfit = 0;
        this.totalLost = 0;
        this.totalNumberOfRuns = 0;
        this.winningTrades = 0;
        this.losingTrades = 0;

        // Clear any remaining intervals or timeouts
        if (this.tradeDurationTimeoutId) {
            clearTimeout(this.tradeDurationTimeoutId);
            this.tradeDurationTimeoutId = null;
        }
        if (this.updateFrequencyIntervalId) {
            clearInterval(this.updateFrequencyIntervalId);
            this.updateFrequencyIntervalId = null;
        }

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
        session: BotSessionDataType,
        retryAfterError: boolean = false,
        userAccountToken: string = ""
    ): Promise<void> {

        try {

            // Validate input parameters
            const validParams: boolean = this.validateSessionParameters(session);

            if (!validParams) {
                return;
            }

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
            const sessionData: TradingSessionDataType = await this.initializeTradingSession(session);

            this.userAccountToken = userAccountToken; 

            if (sessionData) {

                const connectingText: string = "🟡 Establishing connection to Deriv server...";

                logger.warn(connectingText);

                const connectedText: string = "🟢 Connection to Deriv server established!";

                const connectingFailedText: string = "🔴 Connection to Deriv server failed!";

                parentPort?.postMessage({ action: "sendTelegramMessage", text: connectingText, meta: {} });

                const api = new DerivAPI({ endpoint: DERIV_APP_ENDPOINT_DOMAIN, app_id: DERIV_APP_ENDPOINT_APP_ID, lang: DERIV_APP_ENDPOINT_LANG });

                const ping = await api.basic.ping();

                if (ping) {

                    /*
                    const bal = new Balance(api);

                    bal.onUpdate().subscribe((balance: any) => console.log(balance))
                    */

                    this.userAccount = await DerivUserAccount.getUserAccount(api, userAccountToken);

                    if(this.userAccount){

                        this.previousTradeResultData.currency = this.userAccount.currency;
                        this.previousTradeResultData.userAccount = this.userAccount;
                        this.previousTradeResultData.userAccountToken = userAccountToken;

                    }

                    logger.info(connectedText);

                    parentPort?.postMessage({ action: "sendTelegramMessage", text: connectedText, meta: {} });

                    // Start the main trading loop
                    this.isTrading = true;

                    await this.executeTradeSequence();

                } else {

                    logger.error(connectingFailedText);

                    parentPort?.postMessage({ action: "sendTelegramMessage", text: connectingFailedText, meta: {} });

                }

            }

        } catch (error: any) {
            console.log("ERROR : startTrading", error);
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
    private validateSessionParameters(session: BotSessionDataType): boolean {

        // Destructure session parameters for easier access
        const { step, accountType, tradingType, market, purchaseType, stake, takeProfit, stopLoss, tradeDuration, updateFrequency, contractDurationUnits, contractDurationValue, tradingMode } = session;

        // Validate session parameters
        const errorObject = {
            name: "INVALID_PARAMETERS",
            message: "Invalid Parameters",
            code: 500
        };

        if (!step) {
            errorObject.message = "Session Step cannot be empty.";
            this.handleErrorExemption(errorObject, session);
            return false;
        }

        if (!accountType) {
            errorObject.message = "Account Type cannot be empty.";
            this.handleErrorExemption(errorObject, session);
            return false;
        }

        if (!tradingType) {
            errorObject.message = "Trading Type cannot be empty.";
            this.handleErrorExemption(errorObject, session);
            return false;
        }

        if (!market) {
            errorObject.message = "Market cannot be empty.";
            this.handleErrorExemption(errorObject, session);
            return false;
        }

        if (!purchaseType) {
            errorObject.message = "Purchase Type cannot be empty.";
            this.handleErrorExemption(errorObject, session);
            return false;
        }

        if (parseFloat(String(stake)) <= 0) {
            errorObject.message = "Stake must be a positive number.";
            this.handleErrorExemption(errorObject, session);
            return false;
        }

        if (parseFloat(String(takeProfit)) <= 0) {
            errorObject.message = "Take Profit must be a positive number.";
            this.handleErrorExemption(errorObject, session);
            return false;
        }

        if (parseFloat(String(stopLoss)) <= 0) {
            errorObject.message = "Stop Loss must be a positive number.";
            this.handleErrorExemption(errorObject, session);
            return false;
        }

        if (!tradeDuration) {
            errorObject.message = "Trade duration must be set.";
            this.handleErrorExemption(errorObject, session);
            return false;
        }

        if (!updateFrequency) {
            errorObject.message = "Update frequency must be set.";
            this.handleErrorExemption(errorObject, session);
            return false;
        }

        if (!contractDurationUnits) {
            errorObject.message = "Contract Duration Units must be set.";
            this.handleErrorExemption(errorObject, session);
            return false;
        }


        if (!contractDurationValue) {
            errorObject.message = "Contract Duration must be set.";
            this.handleErrorExemption(errorObject, session);
            return false;
        }


        if (!tradingMode) {
            errorObject.message = "Trading Mode must be set.";
            this.handleErrorExemption(errorObject, session);
            return false;
        }

        return true;

    }

    /**
     * Initializes the trading session with timers and configuration
     * @param {object} session - Trading session configuration
     */
    private async initializeTradingSession(
        session: BotSessionDataType
    ): Promise<TradingSessionDataType> {

        console.log("SESSION RAW", session);

        const sessionData: TradingSessionDataType = {
            step: session.step as Step,
            accountType: sanitizeAccountType(session.accountType),
            tradingType: sanitizeTradingType(session.tradingType),
            market: sanitizeMarketType(session.market),
            purchaseType: sanitizePurchaseType(session.purchaseType),
            stake: sanitizeAmount(session.stake, { mode: "currency" }) as number,
            takeProfit: sanitizeAmount(session.takeProfit, { mode: "currency" }) as number,
            stopLoss: sanitizeAmount(session.stopLoss, { mode: "currency" }) as number,
            tradeDuration:  convertTimeStringToSeconds(session.tradeDuration) - Date.now(),
            updateFrequency:  convertTimeStringToSeconds(session.updateFrequency) - Date.now(),
            contractDurationUnits: sanitizeContractDurationUnit(session.contractDurationUnits),
            contractDurationValue: parseInt(sanitizeString(session.contractDurationValue)),
            tradingMode: sanitizeTradingMode(session.tradingMode),
        }

        console.log("SESSION CLN", sessionData);

        // Set initial configuration
        this.accountType = sessionData.accountType;
        this.tradingType = sessionData.tradingType;
        this.defaultMarket = sessionData.market;
        this.originalPurchaseType = sessionData.purchaseType;
        this.currentPurchaseType = sessionData.purchaseType;
        this.baseStake = sessionData.stake;
        this.takeProfit = sessionData.takeProfit;
        this.stopLoss = sessionData.stopLoss;
        this.tradeStartedAt = Date.now() / 1000;

        // Parse duration strings to seconds
        this.tradeDuration = sessionData.tradeDuration;
        this.updateFrequency = sessionData.updateFrequency;

        // Contract duration
        this.contractDurationUnits = sessionData.contractDurationUnits;
        this.contractDurationValue = sessionData.contractDurationValue;

        // Setup trade duration timeout
        this.tradeDurationTimeoutId = setTimeout(() => {
            this.stopTrading(`Trade duration limit reached: ${session.tradeDuration}`);
        }, this.tradeDuration);

        // Setup telemetry updates
        this.updateFrequencyIntervalId = setInterval(() => {
            this.generateTelemetry();
        }, this.updateFrequency);

        this.tradingMode = sessionData.tradingMode;

        const config: BotConfig = {
            accountType: this.accountType,
            tradingType: this.tradingType,
            market: this.defaultMarket,
            defaultMarket: this.defaultMarket,
            purchaseType: this.originalPurchaseType,
            baseStake: this.baseStake,
            stake: this.baseStake,
            takeProfit: this.takeProfit,
            stopLoss: this.stopLoss,
            tradeDuration: this.tradeDuration,
            updateFrequency: this.updateFrequency,
            contractDurationUnits: this.contractDurationUnits,
            contractDurationValue: this.contractDurationValue,
            tradingMode: this.tradingMode,
            userAccountToken: this.userAccountToken,
            maxStake: 0.35,
            minStake: 5000,
            maxRecoveryTrades: 4,
        };

        this.tradeManager = new TradeManager(config);

        this.previousTradeResultData = {
            baseStake: this.baseStake,
            buy: this.baseStake,
            bid: this.baseStake,
            sell: this.baseStake,
            status: 'won',
            profitSign: 1,
            profit: 0,
            resultIsWin: true,
            tradeResult: {},
            userAccount: {},
            userAccountToken: this.userAccountToken,
            basis: "stake",
            market: this.defaultMarket,
            purchaseType: this.originalPurchaseType,
            currency: "USD", // TODO
            contractDuration: this.contractDurationValue,
            contractDurationUnit: this.contractDurationUnits,
        }

        // Notify start of trading
        parentPort?.postMessage({
            action: "sendTelegramMessage",
            text: "🟢 Trading session started successfully",
            meta: { sessionData }
        });

        return sessionData;

    }

    /**
 * Calculates the delay before next trade attempt with intelligent backoff
 */
    private calculateNextTradeDelay(resultIsWin: boolean): number {

        let delay = 1000;

        if (resultIsWin) {

            return delay;

        } else {

            // Base delay with jitter (3s ± 2s)
            delay = delay * 3 + Math.ceil(Math.random() * 2000);

            // Exponential backoff for consecutive losses
            if (this.consecutiveLosses > 0) {

                delay *= Math.pow(1.5, this.consecutiveLosses);

                if (delay > 10000) {
                    delay = Math.min(delay * (this.consecutiveLosses + 1), 10000); // Up to 10 seconds max
                }

            }

            // Cap maximum delay at 15 seconds
            return Math.min(delay, 15000);

        }

    }

    private nextTradeTimer: NodeJS.Timeout | null = null;

    /**
     * Main trade execution flow without while loops
     */
    private async executeTradeSequence(): Promise<void> {

        if (!this.isTrading) return;

        try {

            const response: ITradeData | undefined = await this.tradeManager.executeTrade(this.previousTradeResultData);

            const tradeResult: TradeData = TradeData.parseTradeData(response);

            const resultIsWin: boolean = await this.processTradeResult(tradeResult);

            if (this.shouldStopTrading(tradeResult)) {
                await this.stopTrading(this.getStopReason(tradeResult));
                return;
            }

            // Schedule next trade
            await this.scheduleNextTrade(resultIsWin);

        } catch (error) {

            logger.error('Trade execution failed', error);

            console.log(error);

        }

    }

    /**
     * Schedules the next trade with calculated delay
     */
    private async scheduleNextTrade(resultIsWin: boolean): Promise<void> {

        if (!this.isTrading) return;

        const delay = this.calculateNextTradeDelay(resultIsWin);

        await this.sleep(delay);

        this.executeTradeSequence();

    }

    // Sleep function (private)
    private async sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }


    /**
     * Processes trade results and updates statistics
     * @param {TradeData} tradeResult - Result of the completed trade
     */
    private async processTradeResult(tradeResult: TradeData): Promise<boolean> {

        this.totalNumberOfRuns++;

        const resultIsWin: boolean = tradeResult.profit_is_win;

        const investment: number = tradeResult.buy_price_value;

        const profit: number = tradeResult.profit_value * tradeResult.profit_sign;

        const profitAfterSale: number = resultIsWin ? profit : -investment;

        const tradeValid: boolean = profit === profitAfterSale;

        this.totalProfit += profit;
        this.totalStake += tradeResult.buy_price_value;
        this.totalPayout += tradeResult.sell_price_value;

        if (resultIsWin) {
            this.winningTrades++;
            this.consecutiveLosses = 0;
            this.totalGained += profit;
        } else {
            this.losingTrades++;
            this.consecutiveLosses++;
            this.totalLost += investment;
        }

        /*

            TradeData {
            _symbol_short: 'R_50',
            _symbol_full: 'Volatility 50 Index',
            _start_time: 1744987811,
            _expiry_time: 1744987814,
            _purchase_time: 1744987811,
            _entry_spot_value: 163.1496,
            _entry_spot_time: 1744987812,
            _exit_spot_value: 163.1425,
            _exit_spot_time: 1744987816.209,
            _ask_price_currency: 'USD',
            _ask_price_value: 10,
            _buy_price_currency: 'USD',
            _buy_price_value: 10,
            _buy_transaction: 556109537128,
            _bid_price_currency: 'USD',
            _bid_price_value: 0,
            _sell_price_currency: 'USD',
            _sell_price_value: 0,
            _sell_spot: 163.1425,
            _sell_spot_time: 1744987814,
            _sell_transaction: 556109545748,
            _payout: 18.8,
            _payout_currency: 'USD',
            _profit_value: 10,
            _profit_currency: 'USD',
            _profit_percentage: -100,
            _profit_is_win: false,
            _profit_sign: -1,
            _status: 'lost',
            _longcode: 'Win payout if Volatility 50 Index after 1 tick is strictly higher than entry spot.',
            _proposal_id: 'e25311d8-a515-2374-2317-a1172aea3b89',
            _balance_currency: 'USD',
            _balance_value: '0',
            _audit_details: [
                {
                epoch: 1744987808,
                tick: 163.188,
                tick_display_value: '163.1880'
                },
                {
                epoch: 1744987810,
                tick: 163.184,
                tick_display_value: '163.1840'
                },
                { epoch: 1744987811, flag: 'highlight_time', name: 'Start Time' },
                {
                epoch: 1744987812,
                flag: 'highlight_tick',
                name: 'Entry Spot',
                tick: 163.1496,
                tick_display_value: '163.1496'
                },
                {
                epoch: 1744987814,
                flag: 'highlight_tick',
                name: 'End Time and Exit Spot',
                tick: 163.1425,
                tick_display_value: '163.1425'
                },
                {
                epoch: 1744987816,
                tick: 163.1762,
                tick_display_value: '163.1762'
                }
            ],
            _ticks: t {
                raw: { epoch: 1744987812, quote: 163.1496 },
                time: t { _data: [Object] },
                quote: t { pip: 0.0001, _data: [Object] },
                ask: t { pip: 0.0001, _data: [Object] },
                bid: t { pip: 0.0001, _data: [Object] },
                _data: {}
            }
            }

        */


        // Log trade details
        logger.warn("*******************************************************************************************");
        logger.info(`DEAL: ${tradeResult.longcode}`);
        logger.info(`SPOT: ${tradeResult.entry_spot_value} -> ${tradeResult.exit_spot_value}`);
        logger.info(`BUY : ${tradeResult.buy_price_currency} ${tradeResult.buy_price_value}`);
        logger.info(`BID : ${tradeResult.bid_price_currency} ${tradeResult.bid_price_value}`);
        logger.info(`SELL: ${tradeResult.sell_price_currency} ${tradeResult.sell_price_value} :: Status : ${tradeResult.status}`);
        logger.info(`${resultIsWin ? 'WON' : 'LOST'} : ${tradeResult.profit_currency} ${tradeResult.profit_value * tradeResult.profit_sign} :: IS_WIN : ${resultIsWin}`);
        logger.info(`VALIDITY: ${tradeValid} :*: PROFIT: ${[profit]} :*: IS_WIN : ${[resultIsWin]}`);
        logger.warn("*******************************************************************************************");

        const previousTradeResultData: any = {
            baseStake: this.baseStake,
            buy: tradeResult.buy_price_value,
            bid: tradeResult.bid_price_value,
            sell: tradeResult.sell_price_value,
            status: tradeResult.status,
            profitSign: tradeResult.profit_sign,
            profit: tradeResult.profit_value,
            resultIsWin: resultIsWin,
            tradeResult: tradeResult
        };

        this.saveData(
            `run_${this.totalNumberOfRuns}`,
            {
            run: this.totalNumberOfRuns,
            stake: tradeResult.buy_price_value,
            profit: tradeResult.profit_value * tradeResult.profit_sign
        })

        this.previousTradeResultData = {...this.previousTradeResultData,...previousTradeResultData};

        // Update strategy based on results
        this.tradeManager.updateStrategy(this.previousTradeResultData);

        return resultIsWin;

    }

    /**
     * Determines if trading should stop based on current conditions
     * @param {TradeData} tradeResult - Latest trade result
     * @returns {boolean} True if trading should stop
     */
    private shouldStopTrading(tradeResult: TradeData): boolean {
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
     * @param {TradeData} tradeResult - Latest trade result
     * @returns {string} Reason for stopping
     */
    private getStopReason(tradeResult: TradeData): string {
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
     * Stops the trading process and cleans up resources
     * @param {string} message - Reason for stopping
     * @param {boolean} generateStatistics - Whether to generate final statistics
     */
    async stopTrading(message: string, generateStatistics: boolean = true): Promise<void> {
        try {

            this.isTrading = false;

            // Generate final statistics if requested
            if (generateStatistics) {
                await this.generateTelemetry();
                await this.generateTradingSummary();
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
            this.resetState();

        } catch (error) {
            logger.error('Error stopping trading', error);
            throw error;
        }
    }


    async saveData(key: string, data: any) {
        this.auditTrail.push({
            key: key,
            data: data
        })
    }


    /**
     * Generates comprehensive telemetry data about the trading session
     */
    private async generateTelemetry(): Promise<void> {
        // Retrieve account and balance information
        const accountId = this.userAccount.loginid || "N/A";
        const currency = this.userAccount.currency || "USD";
        const totalBalance = parseFloat(`${this.userBalance}`).toFixed(2);

        // Calculate total profit, payout, and stake
        const totalProfit = this.totalProfit;
        const totalPayout = this.totalPayout;
        const totalStake = this.totalStake;

        // Calculate win rate and average profit per run
        const winRate = (this.winningTrades / this.totalNumberOfRuns) * 100;
        const averageProfitPerRun = totalProfit / this.totalNumberOfRuns;

        // Format start time, stop time, and duration
        const startTime = new Date(this.tradeStartedAt * 1000);
        const stopTime = new Date(); // Current time as stop time
        const durationSeconds = Math.floor((Date.now() / 1000) - this.tradeStartedAt);
        const duration = `${Math.floor(durationSeconds / 3600)}h ${Math.floor((durationSeconds % 3600) / 60)}m ${durationSeconds % 60}s`;

        // Format start and stop times into two lines (date and time)
        const startDate = startTime.toLocaleDateString();
        const startTimeFormatted = startTime.toLocaleTimeString();
        const stopDate = stopTime.toLocaleDateString();
        const stopTimeFormatted = stopTime.toLocaleTimeString();

        // Create the telemetry table
        const telemetryTable = `

    =========================
    Trading Telemetry Summary
    =========================

    Account:        ${accountId.padEnd(20)} 
    Currency:       ${currency.padEnd(20)} 

    Wins:           ${this.winningTrades.toString().padEnd(20)} 
    Losses:         ${this.losingTrades.toString().padEnd(20)} 
    Runs:           ${this.totalNumberOfRuns.toString().padEnd(20)} 
         
    Total Payout:   $${totalPayout.toFixed(2).padEnd(20)} 
    Total Stake:    $${totalStake.toFixed(2).padEnd(20)} 
    Total Profit:   $${totalProfit.toFixed(2).padEnd(20)} 
    Avg Profit/Run: $${averageProfitPerRun.toFixed(2).padEnd(20)} 
    Total Balance:  $${totalBalance.padEnd(20)} 

    Win Rate %:     ${winRate.toFixed(2)}%${" ".padEnd(17)} 

    Start Date:     ${startDate.padEnd(20)} 
    Start Time:     ${startTimeFormatted.padEnd(20)} 

    Stop Date:      ${stopDate.padEnd(20)} 
    Stop Time:      ${stopTimeFormatted.padEnd(20)} 

    Duration:       ${duration.padEnd(20)} 

  `;

        // Log the telemetry table
        console.log(telemetryTable);

        parentPort?.postMessage({ action: "generateTelemetry", text: telemetryTable, meta: { user: this.userAccount, audit: {}} });
    }

    /**
     * Generates a final trading summary report
     */
    private async generateTradingSummary(): Promise<void> {
        
        // Calculate total profit
        const totalProfit = this.auditTrail.reduce((sum: number, trade: any) => sum + trade.data.profit, 0);

        // Define the table headers
        const header = `
+-----+---------+----------+
| Run |  Stake  |  Profit  |
+-----+---------+----------+`;

        // Define the table rows
        const rows = this.auditTrail
            .map((trade: any) => {
                const run = String(trade.data.run).padStart(3); // Right-aligned, 3 characters
                const stake = `$${trade.data.stake.toFixed(2)}`.padStart(7); // Right-aligned, 7 characters
                const profit = `${trade.data.profit >= 0 ? "+" : "-"}${Math.abs(trade.data.profit).toFixed(2)}`.padStart(8); // Right-aligned, 8 characters
                return `| ${run} | ${stake} | ${profit} |`;
            })
            .join("\n");

        // Define the total profit row
        const totalRow = `+-----+---------+----------+
| TOTAL PROFIT  | ${totalProfit >= 0 ? "+" : "-"}${Math.abs(totalProfit).toFixed(2).padStart(7)} |
+-----+---------+----------+
   `;

        // Combine the table
        const tradeSummary = `${header}\n${rows}\n${totalRow}`;

        // Log the trade summary
        console.log(tradeSummary);

        //generateSummary
        parentPort?.postMessage({ action: "generateTradingSummary", message: "Generating trading summary, please wait...", meta: { user: this.userAccount, audit: this.auditTrail } });

    }

    /**
     * Handles trading errors with appropriate recovery or shutdown
     * @param {Error} error - The error that occurred
     * @param {object} session - Current trading session
     */
    private async handleTradingError(error: any, session: any): Promise<void> {

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
            await this.startTrading(session, true, this.userAccountToken);

        } else {
            // Non-recoverable error - stop trading
            await this.stopTrading(`Fatal error: ${error.message}`, false);

            parentPort?.postMessage({
                action: "sendTelegramMessage",
                text: `⚠️ Non-recoverable error: ${error.message}. Stopping trades...`,
                meta: { error: error.message }
            });

        }
    }


    handleErrorExemption(error: any, session: any): void {

        console.log("HANDLE_PURCHASE_ERROR", error);

        try {

            const code: string = error.code;
            const message: string = error.message;
            const name: string = error.name;

            this.handleTradingError({ name, code, message }, session)

        } catch (error) {

            console.log("UN_HANDLE_PURCHASE_ERROR !!!!!!", error);

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

}