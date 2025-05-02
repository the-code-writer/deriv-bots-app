// deriv-trading-bot.ts - Main trading bot class
/**
 * @file Main Deriv API trading bot class with comprehensive trading functionality
 * @module DerivTradingBot
 */

import { pino } from "pino";
import { BotConfig, ITradeData, MarketType, ContractType, TradingType, TradingSessionDataType, TradingTypeEnum, MarketTypeEnum, ContractTypeEnum, BotSessionDataType, Step, TradingModeTypeEnum, TradeDurationUnitsOptimizedEnum, AccountType, IPreviousTradeResult, ContractDurationUnitType, TradingModeType, StatusTypeEnum, BasisTypeEnum, CurrenciesEnum, ContractDurationUnitTypeEnum, UserAccount } from './types';
import { TradeManager } from './trade-manager';
import { parentPort } from 'worker_threads';
import { env } from "@/common/utils/envConfig";
import { convertTimeStringToSeconds } from '@/common/utils/snippets';
import { sanitizeContractDurationUnit, sanitizeAccountType, sanitizeTradingType, sanitizeMarketType, sanitizeContractType, sanitizeAmount, sanitizeTradingMode, sanitizeString } from '@/common/utils/snippets';
import { DerivUserAccount, IDerivUserAccount } from "../user/UserDerivAccount";
import { roundToTwoDecimals } from '../../common/utils/snippets';
import { TradeStorageService } from "./trade-storage-service";
import { defaultEventManager } from "@/common/utils/eventBus";

import WebSocket from 'ws';

// Polyfill WebSocket for Node.js environment
if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = WebSocket as any;
}

const DerivAPI = require("@deriv/deriv-api/dist/DerivAPI");

const logger = pino({ name: "DerivTradingBot" });

const moment = require('moment');
/**
 * Main Deriv trading bot class implementing core trading functionality
 */
export class DerivTradingBot {

    // Configuration and state properties
    private tradeManager!: TradeManager;
    private accountType!: AccountType;
    private tradingType!: TradingType;
    private market!: MarketType;
    private contractType!: ContractType;
    private isTrading!: boolean;
    private stopTradingNow: boolean = false;
    private baseStake!: number;
    private takeProfit!: number;
    private stopLoss!: number;
    private tradeStartedAt!: number;
    private tradeDuration!: NodeJS.Timeout | number | null | undefined;
    private updateFrequency!: NodeJS.Timeout | number | null | undefined;
    private contractDurationUnits!: ContractDurationUnitType;
    private contractDurationValue!: number;
    private tradingMode!: TradingModeType;
    private cachedSession!: BotSessionDataType;
    private tradeDurationTimeoutId: NodeJS.Timeout | number | null | undefined = null;
    private updateFrequencyIntervalId: NodeJS.Timeout | number | null | undefined = null;
    private consecutiveLosses: number = 0;
    private maxConsecutiveLosses: number = env.MAX_CONSECUTIVE_LOSSES || 5;
    private maxRecoveryTrades: number = env.MAX_RECOVERY_TRADES || 5;
    private maxStake: number = env.MAX_STAKE || 5;
    private minStake: number = env.MIN_STAKE || 5;
    private totalProfit: number = 0;
    private totalLost: number = 0;
    private totalGained: number = 0;
    private totalStake: number = 0;
    private totalPayout: number = 0;
    private totalNumberOfRuns: number = 0;
    private winningTrades: number = 0;
    private losingTrades: number = 0;
    private userAccountToken: string = "";
    private userAccount: IDerivUserAccount = {} as IDerivUserAccount;
    private userBalance: number = 0;
    private auditTrail: Array<any> = [];

    private lastTradeSummary: string = "";

    private botConfig: BotConfig;

    private tradeStorageService: TradeStorageService;

    private eventStopTrading: any;

    /**
     * Constructs a new DerivTradingBot instance
     * @param {BotConfig} config - Configuration object for the trading bot
     */

    constructor(config: BotConfig = {}) {
        // Save the config for future use
        this.botConfig = config;

        this.tradeStorageService = new TradeStorageService();

        // Call the resetState function to initialize all properties
        this.resetState();

        this.eventStopTrading = defaultEventManager.on('STOP_TRADING', (data: any) => {

            this.stopTrading(data.reason, true, data);

        });

    }

    /**
     * Constructs a new DerivTradingBot instance
     * @param {BotConfig} config - Configuration object for the trading bot
     */
    async resetState(config: BotConfig = {}) {


        const mergedConfig: BotConfig = { ...this.botConfig, ...config };

        this.tradeManager = {} as TradeManager;
        this.accountType = {} as AccountType;
        this.tradeStorageService.init();
        this.tradingType = mergedConfig.tradingType || TradingTypeEnum.Default;
        this.market = mergedConfig.market || MarketTypeEnum.Default;
        this.contractType = mergedConfig.contractType || ContractTypeEnum.Default;
        this.isTrading = false;
        this.stopTradingNow = false;
        this.baseStake = mergedConfig.baseStake || 1;
        this.takeProfit = mergedConfig.takeProfit || 10;
        this.stopLoss = mergedConfig.stopLoss || 2;
        this.tradeStartedAt = 0;
        this.tradeDuration = 0;
        this.updateFrequency = 0;
        this.contractDurationUnits = (mergedConfig.contractDurationUnits || TradeDurationUnitsOptimizedEnum.Ticks) as ContractDurationUnitType;
        this.contractDurationValue = mergedConfig.contractDurationValue || 1;
        this.tradingMode = mergedConfig.tradingMode || TradingModeTypeEnum.Manual;
        this.cachedSession = {} as BotSessionDataType;
        // this.tradeDurationTimeoutId = null;
        // this.updateFrequencyIntervalId = null;
        this.consecutiveLosses = 0;
        this.maxConsecutiveLosses = env.MAX_CONSECUTIVE_LOSSES || 5;
        this.maxRecoveryTrades = env.MAX_RECOVERY_TRADES || 5;
        this.maxStake = env.MAX_STAKE || 5;
        this.minStake = env.MIN_STAKE || 5;
        this.totalProfit = 0;
        this.totalLost = 0;
        this.totalGained = 0;
        this.totalStake = 0;
        this.totalPayout = 0;
        this.totalNumberOfRuns = 0;
        this.winningTrades = 0;
        this.losingTrades = 0;
        this.userAccountToken = "";
        this.userAccount = {} as IDerivUserAccount;
        this.userBalance = 0;
        this.auditTrail = [];

        this.lastTradeSummary = "";

        // Clear any remaining intervals or timeouts
        if (this.tradeDurationTimeoutId) {
            clearTimeout(this.tradeDurationTimeoutId);
            this.tradeDurationTimeoutId = null;
        }
        if (this.updateFrequencyIntervalId) {
            clearInterval(this.updateFrequencyIntervalId);
            this.updateFrequencyIntervalId = null;
        }

        //this.eventStopTrading = null;

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

        // Reset state whenever we start a trading session

        this.resetState();

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
            const sessionData: TradingSessionDataType = await this.initializeTradingSession(session, userAccountToken);

            this.userAccountToken = userAccountToken;

            if (sessionData) {

                const connectingText: string = "🟡 Connecting to Deriv server...";

                logger.warn(connectingText);

                parentPort?.postMessage({ action: "sendTelegramMessage", text: connectingText, meta: {} });

                const api = new DerivAPI({ endpoint: env.DERIV_APP_ENDPOINT_DOMAIN, app_id: env.DERIV_APP_ENDPOINT_APP_ID, lang: env.DERIV_APP_ENDPOINT_LANG });

                const ping = await api.basic.ping();

                if (ping) {

                    /*

                    const bal = new Balance(api);

                    bal.onUpdate().subscribe((balance: any) => console.log(balance))

                    */

                    console.error([this.userAccountToken , userAccountToken])

                    if (userAccountToken === "") {
                        parentPort?.postMessage({ action: "revertStepShowAccountTypeKeyboard", text: "User account token is missing. Please select the account to use in order to resu,e your session.", meta: { cachedSession: this.cachedSession } });
                    }

                    this.userAccount = await DerivUserAccount.getUserAccount(api, userAccountToken) as IDerivUserAccount;

                    if (this.userAccount) {

                        this.userAccountToken = userAccountToken;

                    }

                    const connectedText: string = "🟢 Deriv connection established!";

                    logger.info(connectedText);

                    parentPort?.postMessage({ action: "sendTelegramMessage", text: connectedText, meta: {} });

                    // Start the main trading loop
                    this.isTrading = true;

                    await this.executeTradeSequence();

                } else {

                    const connectingFailedText: string = "🔴 Deriv connection failed!";

                    logger.error(connectingFailedText);

                    parentPort?.postMessage({ action: "sendTelegramMessage", text: connectingFailedText, meta: {} });

                }

            }

        } catch (error: any) {

            console.error("ERROR : startTrading :", error);

            logger.error('Failed to start trading', error);

            await this.handleTradingError(error, session);

        }
    }

    /**
     * Starts the trading process with comprehensive error handling and validation
     * @param {object} callbackFunction - Trading session configuration
     * @param {string} userAccountToken - User account token for authentication
     * @returns {Promise<void>} Promise that resolves when trading completes
     * @throws {Error} If invalid parameters are provided or trading cannot start
     */
    async setAccount(
        callbackFunction: any,
        userAccountToken: string
    ): Promise<void> {

        try {

            const api = new DerivAPI({ endpoint: env.DERIV_APP_ENDPOINT_DOMAIN, app_id: env.DERIV_APP_ENDPOINT_APP_ID, lang: env.DERIV_APP_ENDPOINT_LANG });

            const ping = await api.basic.ping();

            if (ping) {

                const account: any = await DerivUserAccount.getUserAccount(api, userAccountToken || this.userAccountToken);

                callbackFunction({ error: null, account });

            } else {

                callbackFunction({ error: { code: 500, message: "Invalid ping data received" }, metadata: { ping }, account: null });

            }
        } catch (error: any) {

            callbackFunction({ error, metadata: null, account: null });

        }

    }

    /**
     * Starts the trading process with comprehensive error handling and validation
     * @param {object} callbackFunction - Trading session configuration
     * @param {string} userAccountToken - User account token for authentication
     * @returns {Promise<void>} Promise that resolves when trading completes
     * @throws {Error} If invalid parameters are provided or trading cannot start
     */
    async getAccountBalance(
        callbackFunction: any,
        userAccountToken: string
    ): Promise<void> {

        try {

            const api = new DerivAPI({ endpoint: env.DERIV_APP_ENDPOINT_DOMAIN, app_id: env.DERIV_APP_ENDPOINT_APP_ID, lang: env.DERIV_APP_ENDPOINT_LANG });

            const ping = await api.basic.ping();

            if (ping) {

                const balance = await DerivUserAccount.getUserBalance(api, userAccountToken || this.userAccountToken);

                callbackFunction({ error: null, balance });

            } else {

                callbackFunction({ error: { code: 500, message: "Invalid ping data received" }, metadata: { ping }, balance: null });

            }
        } catch (error: any) {

            callbackFunction({ error, metadata: null, balance: null });

        }

    }

    public getAccountToken(accounts: any, key: string, value: string) {

        // Iterate through the object
        for (const index in accounts) {

            const entry = accounts[index];

            // Check if the key is 'acct' or 'cur' and if the value matches
            if ((key === "acct" && entry.acct === value) || (key === "cur" && entry.cur === value) || (key === "token" && entry.token === value)) {
                return entry; // Return the matching entry
            }
        }

        // Return null if no match is found
        return null;
    }

    /**
     * Validates trading session parameters
     * @param {object} session - Trading session configuration
     * @throws {Error} If any parameter is invalid
     */
    private validateSessionParameters(session: BotSessionDataType): boolean {

        // Destructure session parameters for easier access
        const { step, accountType, tradingType, market, contractType, stake, takeProfit, stopLoss, tradeDuration, updateFrequency, contractDurationUnits, contractDurationValue, tradingMode } = session;

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

        if (!contractType) {
            errorObject.message = "Contract Type cannot be empty.";
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
        session: BotSessionDataType,
        userAccountToken: string
    ): Promise<TradingSessionDataType> {

        console.log("SESSION RAW", session);

        const sessionData: TradingSessionDataType = {
            step: session.step as Step,
            accountType: sanitizeAccountType(session.accountType),
            tradingType: sanitizeTradingType(session.tradingType),
            market: sanitizeMarketType(session.market),
            contractType: sanitizeContractType(session.contractType),
            stake: sanitizeAmount(session.stake, { mode: "currency" }) as number,
            takeProfit: sanitizeAmount(session.takeProfit, { mode: "currency" }) as number,
            stopLoss: sanitizeAmount(session.stopLoss, { mode: "currency" }) as number,
            tradeDuration: convertTimeStringToSeconds(session.tradeDuration) - Date.now(),
            updateFrequency: convertTimeStringToSeconds(session.updateFrequency) - Date.now(),
            contractDurationUnits: sanitizeContractDurationUnit(session.contractDurationUnits),
            contractDurationValue: parseInt(sanitizeString(session.contractDurationValue)),
            tradingMode: sanitizeTradingMode(session.tradingMode),
        }

        console.log("SESSION CLN", sessionData);

        // Set initial configuration
        this.accountType = sessionData.accountType;
        this.tradingType = sessionData.tradingType;
        this.market = sessionData.market;
        this.contractType = sessionData.contractType;
        this.baseStake = sessionData.stake;
        this.takeProfit = sessionData.takeProfit;
        this.stopLoss = sessionData.stopLoss;
        this.tradeStartedAt = Date.now(); // TODO: is this supposed to be divided by / 1000;


        logger.error(this.tradeStartedAt)
        console.error(new Date(this.tradeStartedAt))
        logger.error(this.tradeStartedAt)


        // Parse duration strings to seconds
        this.tradeDuration = sessionData.tradeDuration * 1000; // Convert to milliseconds
        this.updateFrequency = sessionData.updateFrequency * 1000; // Convert to milliseconds

        // Contract duration
        this.contractDurationUnits = sessionData.contractDurationUnits;
        this.contractDurationValue = sessionData.contractDurationValue;

        // Setup trade duration timeout
        this.tradeDurationTimeoutId = setTimeout(() => {
            const pendingRecovery: boolean = this.tradeManager.checkPendingRecovery();
            if (pendingRecovery) {
                this.stopTradingNow = true;
            } else {
                this.stopTrading(`Trade duration limit reached: ${session.tradeDuration}`, true, {});
            }
        }, this.tradeDuration);

        // Setup telemetry updates
        this.updateFrequencyIntervalId = setInterval(() => {
            this.generateTradingSummary();
        }, this.updateFrequency);

        this.tradingMode = sessionData.tradingMode;

        const config: BotConfig = {
            accountType: this.accountType,
            tradingType: this.tradingType,
            market: this.market,
            contractType: this.contractType,
            isTrading: this.isTrading,
            baseStake: this.baseStake,
            takeProfit: this.takeProfit,
            stopLoss: this.stopLoss,
            tradeStartedAt: this.tradeStartedAt,
            tradeDuration: this.tradeDuration,
            updateFrequency: this.updateFrequency,
            contractDurationUnits: this.contractDurationUnits,
            contractDurationValue: this.contractDurationValue,
            tradingMode: this.tradingMode,
            sessionData: sessionData,
            consecutiveLosses: this.consecutiveLosses,
            maxConsecutiveLosses: this.maxConsecutiveLosses,
            maxRecoveryTrades: this.maxRecoveryTrades,
            maxStake: this.maxStake,
            minStake: this.minStake,
            userAccountToken: userAccountToken
        };

        this.tradeManager = new TradeManager(config);

        // Notify start of trading
        parentPort?.postMessage({
            action: "sendTelegramMessage",
            text: "🟢 Trading session started!",
            meta: { sessionData }
        });

        return sessionData;

    }

    /**
     * Main trade execution flow without while loops
     */
    private async executeTradeSequence(): Promise<void> {

        if (!this.isTrading) return;

        try {

            const tradeResult: ITradeData | undefined = await this.tradeManager.executeTrade() as ITradeData;

            await this.processTradeResult(tradeResult);

            if (this.shouldStopTrading(tradeResult)) {
                await this.stopTrading(this.getStopReason(tradeResult));
                return;
            }

            // Next trade in a loop until halted by internal mechanisms
            await this.executeTradeSequence();

        } catch (error) {

            logger.error('Trade execution failed', error);

            console.log(error);

        }

    }

    /**
     * Processes trade results and updates statistics
     * @param {ITradeData} tradeResult - Result of the completed trade
     */
    private async processTradeResult(tradeResult: ITradeData): Promise<void> {

        if (tradeResult && Object.hasOwn(tradeResult, "profit_is_win")) {

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
                this.totalLost = this.totalLost - profit;
            } else {
                this.losingTrades++;
                this.consecutiveLosses++;
                this.totalLost += investment;
            }

            // Log trade data
            this.logTradeResult(tradeResult, resultIsWin, tradeValid, profit);

            await this.saveData(
                `R00${this.totalNumberOfRuns}`,
                {
                    audit: {
                        run: this.totalNumberOfRuns,
                        stake: tradeResult.buy_price_value,
                        profit: tradeResult.profit_value * tradeResult.profit_sign
                    },
                    tradeResult
                }
            );

            if (this.stopTradingNow) {

                this.stopTrading(`Stopping trading now enforced.`, true, {});

                this.stopTradingNow = false;

            }

        } else {

            console.error({
                title: "*************** PROFIT_IS_WIN_NOT_A_PROPERTY *****************",
                data: tradeResult
            })

            process.exit(0);

        }

    }

    private logTradeResult(tradeResult: ITradeData, resultIsWin: boolean, tradeValid: boolean, profit: number): void {

        this.lastTradeSummary = `

${tradeResult.longcode}\n

Entry Spot    : ${tradeResult.entry_spot_value}
Exit Spot     : ${tradeResult.exit_spot_value}

Status        : ${resultIsWin ? '🔹  WON' : '🔸  LOST'}
Buy           : ${tradeResult.buy_price_currency} ${roundToTwoDecimals(tradeResult.buy_price_value, true)}
Sell          : ${tradeResult.sell_price_currency} ${roundToTwoDecimals(tradeResult.sell_price_value, true)}
Profit        : ${tradeResult.sell_price_currency} ${roundToTwoDecimals(profit, true)}

Total Profit  : ${tradeResult.sell_price_currency} ${roundToTwoDecimals(this.totalProfit, true)}

${moment(tradeResult.sell_spot_time * 1000).format('MMMM Do YYYY, h:mm:ss a')}

${tradeResult.proposal_id}

`;

        this.generateTelemetry();


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
        return "Manual stop";
    }

    /**
     * Stops the trading process and cleans up resources
     * @param {string} message - Reason for stopping
     * @param {boolean} generateStatistics - Whether to generate final statistics
     */
    async stopTrading(message: string, generateStatistics: boolean = true, meta: any = {}): Promise<void> {

        if (!this.isTrading) {
            return;
        }

        logger.error({
            title: "STOP_TRADING",
            message,
            meta
        })

        try {

            this.isTrading = false;

            // Generate final statistics if requested
            if (generateStatistics) {
                await this.generateTradingSummary();
            }

            // Notify stop
            parentPort?.postMessage({
                action: "sendTelegramMessage",
                text: `⛔️ Trading stopped!\n\n${message}`,
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


    async saveData(key: string, data: any): Promise<void> {

        this.auditTrail.push({
            key: key,
            data: data.audit
        });

        this.tradeStorageService.insertTrade(data.tradeResult);

    }


    /**
     * Generates comprehensive telemetry data about the trading session
     */
    private async generateTelemetry(): Promise<void> {

        logger.info(this.lastTradeSummary);

        parentPort?.postMessage({ action: "lastTradeSummary", text: "```"+this.lastTradeSummary+"```", meta: { user: this.userAccount, audit: {} } });

    }

    /**
     * Generates a final trading summary report
     */
    private async generateTradingSummary(): Promise<void> {

        if (this.userAccount && this.totalStake > 0) {

            // Retrieve account and balance information
            const accountId = this.userAccount.loginid || "N/A";
            const currency = this.userAccount.currency || "USD";
            const totalBalance = parseFloat(`${this.userBalance}`).toFixed(2);

            // Calculate total profit, payout, and stake
            let totalProfit = this.totalProfit;
            const totalPayout = this.totalPayout;
            const totalStake = this.totalStake;

            // Calculate win rate and average profit per run
            const winRate = (this.winningTrades / this.totalNumberOfRuns) * 100;
            const averageProfitPerRun = totalProfit / this.totalNumberOfRuns;

            // Format start time, stop time, and duration
            const startTime = new Date(this.tradeStartedAt);
            const stopTime = new Date(); // Current time as stop time
            const durationSeconds = (stopTime.getTime() - startTime.getTime()) / 1000;
            const duration = `${Math.floor(durationSeconds / 3600)}h ${Math.floor((durationSeconds % 3600) / 60)}m ${Math.floor(durationSeconds % 60)}s`;

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
         
Total Payout:   ${currency} ${totalPayout.toFixed(2).padEnd(20)} 
Total Stake:    ${currency} ${totalStake.toFixed(2).padEnd(20)} 
Total Profit:   ${currency} ${totalProfit.toFixed(2).padEnd(20)} 
Avg Profit/Run: ${currency} ${averageProfitPerRun.toFixed(2).padEnd(20)} 
Total Balance:  ${currency} ${totalBalance.padEnd(20)} 

Base Stake:     ${currency} 1.00
Maximum Stake:  ${currency} 15.98

Win Rate %:     ${winRate.toFixed(2)}%${" ".padEnd(17)} 

Start Date:     ${startDate.padEnd(20)} 
Start Time:     ${startTimeFormatted.padEnd(20)} 

Stop Date:      ${stopDate.padEnd(20)} 
Stop Time:      ${stopTimeFormatted.padEnd(20)} 

Duration:       ${duration.padEnd(20)}

Session ID:     this.tradingSessionID
`;

            // Calculate total profit
            totalProfit = this.auditTrail.reduce((sum: number, trade: any) => sum + trade.data.profit, 0);

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
            const tradeSummary = `${telemetryTable}\n${header}\n${rows}\n${totalRow}`;

            // Log the trade summary
            console.log(tradeSummary);

            //generateSummary
            parentPort?.postMessage({ action: "generateTradingSummary", text: "Generating trading summary, please wait...", meta: { user: this.userAccount, audit: this.auditTrail } });

            parentPort?.postMessage({ action: "lastTradeSummary", text: "```" + tradeSummary + "```", meta: { user: this.userAccount, audit: {} } });

        }

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
            const backoffTime = this.calculateBackoffTime();

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

        console.log("HANDLE_CONTRACT_PURCHASE_ERROR", error);

        try {

            const code: string = error.code;
            const message: string = error.message;
            const name: string = error.name;

            this.handleTradingError({ name, code, message }, session)

        } catch (error) {

            console.log("UN_HANDLE_CONTRACT_PURCHASE_ERROR !!!!!!", error);

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
    private calculateBackoffTime(attempt: number = 1): number {
        const baseDelay = 1000; // 1 second base
        const maxDelay = 30000; // 30 seconds max
        return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    }

}