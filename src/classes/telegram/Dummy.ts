import { Worker } from "node:worker_threads";
import TelegramBot from "node-telegram-bot-api";
import type { KeyboardButton, Message, CallbackQuery } from "node-telegram-bot-api";
import { pino } from "pino";
import sanitizeHtml from "sanitize-html";
import { CONSTANTS } from "@/common/utils/constants";
import { env } from "@/common/utils/envConfig";
import { extractAmount, formatToMoney, isCurrency } from "@/common/utils/snippets";
import { MongoDBConnection } from '@/classes/databases/mongodb/MongoDBClass';
import { Encryption } from "../cryptography/EncryptionClass";

// Logger
const logger = pino({ name: "TelegramBot" });

// Environment variables
const { APP_CRYPTOGRAPHIC_KEY, TELEGRAM_BOT_TOKEN, IMAGE_BANNER, DERIV_APP_LOGIN_URL } = env;

/**
 * Interface representing a user session
 */
interface Session {
    chatId: number;
    username?: any;
    step: string;
    currentInput?: string;
    tradingType?: string;
    market?: string;
    purchaseType?: string;
    stake?: number;
    takeProfit?: number;
    stopLoss?: number;
    tradeDuration?: string;
    updateFrequency?: string;
    timestamp?: number;
    [key: string]: any;
}

/**
 * Interface for Telegram bot service
 */
interface ITelegramBotService {
    handleStartCommand(msg: Message): Promise<void>;
    handleStatisticsCommand(msg: Message): Promise<void>;
    handlePauseCommand(msg: Message): Promise<void>;
    handleCancelCommand(msg: Message): Promise<void>;
    handleMessage(msg: Message): Promise<void>;
    handleCallbackQuery(callbackQuery: CallbackQuery): void;
}

/**
 * Interface for session service
 */
interface ITradingProcessFlow {
    initializeSession(chatId: number): void;
    updateSession(chatId: number, session: Session): Promise<void>;
    cleanupInactiveSessions(): Promise<void>;
    getSession(chatId: number): Promise<Session | null>;
}

/**
 * Interface for session service
 */
interface ISessionService {
    initializeSession(chatId: number): void;
    updateSession(chatId: number, session: Session): Promise<void>;
    cleanupInactiveSessions(): Promise<void>;
    getSession(chatId: number): Promise<Session | null>;
}

/**
 * Interface for worker service
 */
interface IWorkerService {
    postMessageToDerivWorker(action: string, chatId: number, text: string, session: Session, data?: any): void;
    handleWorkerMessage(chatId: number, message: any): void;
}

/**
 * Interface for keyboard service
 */
interface IKeyboardService {
    getLoginKeyboard(session: any): KeyboardButton[][] | string [][];
    getTradingTypeKeyboard(): KeyboardButton[][] | string [][];
    getMarketKeyboard(tradingType: string): KeyboardButton[][] | string [][];
    getPurchaseTypeKeyboard(tradingType?: string): KeyboardButton[][] | string [][];
    getNumericInputKeyboard(): KeyboardButton[][] | string [][];
    getDurationKeyboard(): KeyboardButton[][] | string [][];
    getTradeConfirmKeyboard(): KeyboardButton[][] | string [][];
}

/**
 * Telegram bot service
 */
class TelegramBotService implements ITelegramBotService {
    private bot: TelegramBot;
    private sessionService: ISessionService;
    private workerService: IWorkerService;
    private keyboardService: IKeyboardService;
    private tradingProcessFlow: ITradingProcessFlow;

    constructor(
        bot: TelegramBot,
        sessionService: ISessionService,
        workerService: IWorkerService,
        keyboardService: IKeyboardService,
        tradingProcessFlow: ITradingProcessFlow
    ) {
        this.bot = bot;
        this.sessionService = sessionService;
        this.workerService = workerService;
        this.keyboardService = keyboardService;
        this.tradingProcessFlow = tradingProcessFlow;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.bot.onText(/\/start/, (msg) => this.handleStartCommand(msg));
        this.bot.onText(/\/telemetry/, (msg) => this.handleStatisticsCommand(msg));
        this.bot.onText(/\/profits/, (msg) => this.handleStatisticsCommand(msg));
        this.bot.onText(/\/statement/, (msg) => this.handleStatisticsCommand(msg));
        this.bot.onText(/\/reset/, (msg) => this.handleStatisticsCommand(msg));
        this.bot.onText(/\/pricing/, (msg) => this.handleStatisticsCommand(msg));
        this.bot.onText(/\/subscribe/, (msg) => this.handleStatisticsCommand(msg));
        this.bot.onText(/\/health-check/, (msg) => this.handleStatisticsCommand(msg));
        this.bot.onText(/\/help/, (msg) => this.handleStatisticsCommand(msg));
        this.bot.onText(/\/resume/, (msg) => this.handlePauseCommand(msg));
        this.bot.onText(/\/withdraw/, (msg) => this.handlePauseCommand(msg));
        this.bot.onText(/\/deposit/, (msg) => this.handlePauseCommand(msg));
        this.bot.onText(/\/wallet/, (msg) => this.handlePauseCommand(msg));
        this.bot.onText(/\/accounts/, (msg) => this.handlePauseCommand(msg));
        this.bot.onText(/\/profile/, (msg) => this.handlePauseCommand(msg));
        this.bot.onText(/\/settings/, (msg) => this.handlePauseCommand(msg));
        this.bot.onText(/\/logout/, (msg) => this.handlePauseCommand(msg));
        this.bot.onText(/\/pause/, (msg) => this.handlePauseCommand(msg));
        this.bot.onText(/\/stop/, (msg) => this.handlePauseCommand(msg));
        this.bot.onText(/\/cancel/, (msg) => this.handleCancelCommand(msg));
        this.bot.on("message", (msg) => this.handleMessage(msg));
        this.bot.on("callback_query", (callbackQuery) => this.handleCallbackQuery(callbackQuery));
    }

    async handleStartCommand(msg: Message): Promise<void> {
        const chatId = msg.chat.id;
        const session: Session = {
            chatId,
            step: "login_account",
            timestamp: Date.now(),
            accounts: {
                telegram: msg.from,
                deriv: {}
            }
        };

        await this.sessionService.updateSession(chatId, session);

        const imageUrl = IMAGE_BANNER;
        const caption = `*Hi ${session.accounts.telegram.first_name}*\n\nThe Future of Trading Is Here! 🌟`;
        this.bot.sendPhoto(chatId, imageUrl, { caption, parse_mode: "Markdown" });
        setTimeout(() => {
            this.bot.sendMessage(chatId, 'Please login using your Deriv Account to proceed:', {
                reply_markup: { inline_keyboard: this.keyboardService.getLoginKeyboard(session.username) },
            });
        }, 3000);
    }

    async handleStatisticsCommand(msg: Message): Promise<void> {
        const chatId = msg.chat.id;
        const session = await this.sessionService.getSession(chatId);

        if (!session) {
            this.bot.sendMessage(chatId, `Session not found. Use ${CONSTANTS.COMMANDS.START} to begin.`);
            return;
        }

        // Generate and send statement
        this.workerService.postMessageToDerivWorker("GENERATE_STATEMENT", chatId, "", session);
    }

    async handlePauseCommand(msg: Message): Promise<void> {
        const chatId = msg.chat.id;
        await this.sessionService.cleanupInactiveSessions();
        this.bot.sendMessage(chatId, `Your trades have been paused. Use ${CONSTANTS.COMMANDS.RESUME} to continue again.`);
    }

    async handleCancelCommand(msg: Message): Promise<void> {
        const chatId = msg.chat.id;
        await this.sessionService.cleanupInactiveSessions();
        this.bot.sendMessage(chatId, `Your session has been reset. Use ${CONSTANTS.COMMANDS.START} to begin again.`);
    }

    async handleMessage(msg: Message): Promise<void> {
        const chatId = msg.chat.id;
        const text = sanitizeHtml(msg.text || "", { allowedTags: [], allowedAttributes: {} });

        const session = await this.sessionService.getSession(chatId);
        if (!session) {
            this.bot.sendMessage(chatId, `Session not found. Use ${CONSTANTS.COMMANDS.START} to begin.`);
            return;
        }

        // Process session step
        this.processSessionStep(chatId, text, session);
    }

    handleCallbackQuery(callbackQuery: CallbackQuery): void {

        const chatId = callbackQuery.message?.chat.id;
        const data = callbackQuery.data;

        if (data === 'exec_login') {
            this.bot.sendMessage(chatId!, `You are about to login using your Deriv Account.`);
        } else if (data === 'exec_cancel') {
            this.bot.sendMessage(chatId!, 'You selected Option 2!');
        }

        this.bot.answerCallbackQuery(callbackQuery.id);
    }

    /**
     * Process the current step in the session
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @private
     */
    private processSessionStep(chatId: number, text: string, session: Session): void {
        switch (session.step) {
            case "login_account":
                this.handleLoginAccount(chatId, text, session);
                break;
            case "select_account_type":
                this.handleAccountTypeSelection(chatId, text, session);
                break;
            case "select_trading_type":
                this.handleTradingTypeSelection(chatId, text, session);
                break;
            case "select_market":
                this.handleMarketSelection(chatId, text, session);
                break;
            case "select_purchase_type":
                this.handlePurchaseTypeSelection(chatId, text, session);
                break;
            case "enter_stake":
                this.handleStakeInput(chatId, text, session);
                break;
            case "enter_take_profit":
                this.handleTakeProfitInput(chatId, text, session);
                break;
            case "enter_stop_loss":
                this.handleStopLossInput(chatId, text, session);
                break;
            case "select_trade_duration":
                this.handleTradeDurationSelection(chatId, text, session);
                break;
            case "select_update_frequency":
                this.handleUpdateFrequencySelection(chatId, text, session);
                break;
            case "select_ticks_or_minutes":
                this.handleUpdateContractDurationUnitsSelection(chatId, text, session);
                break;
            case "select_ticks_or_minutes_duration":
                this.handleUpdateContractDurationValueSelection(chatId, text, session);
                break;
            case "select_auto_or_manual":
                this.handleAutoManualTrading(chatId, text, session);
                break;
            case "confirm_trade":
                this.handleTradeConfirmation(chatId, text, session);
                break;
        }
    }


}

/**
 * Session service
 */
class SessionService implements ISessionService {
    private db: MongoDBConnection;

    constructor(db: MongoDBConnection) {
        this.db = db;
    }

    async initializeSession(chatId: number): Promise<void> {
        const session: Session = { chatId, step: "select_trading_type", timestamp: Date.now() };
        await this.updateSession(chatId, session);
    }

    async updateSession(chatId: number, session: Session): Promise<void> {
        await this.db.updateItems('tg_sessions', [{ field: 'chatId', operator: 'eq', value: chatId }], { $set: session });
    }

    async cleanupInactiveSessions(): Promise<void> {
        const now = Date.now();
        const sessions = await this.db.getAllItems('tg_sessions', []); //TODO : toArray()

        for (const session of sessions) {
            if (now - (session.timestamp || 0) > 30 * 60 * 1000) {
                await this.db.deleteItem('tg_sessions', [{ field: 'chatId', operator: 'eq', value: session.chatId }]);
            }
        }
    }

    async getSession(chatId: number): Promise<Session | null> {
        return await this.db.getItem('tg_sessions', [{ field: 'chatId', operator: 'eq', value: chatId }]);
    }
}

/**
 * Session service
 */
class TradingProcessFlowHandlers implements ITradingProcessFlow {
    
    private telegramBot:any;
    
    constructor() { }
    
    setBot(bot: any) {
        this.telegramBot = bot;
    }
    
    /**
     * Handle the login account step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @private
     */
    private handleLoginAccount(chatId: number, text: string, session: Session): void {
        session.loginAccount = text;
        session.step = "select_trading_type";
        this.updateSession(chatId, session);
        this.showMarketTypeKeyboard(chatId, session.tradingType);
    }

    /**
     * Handle the trading type selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @private
     */
    private handleTradingTypeSelection(chatId: number, text: string, session: Session): void {
        session.tradingType = text;
        session.step = "select_market";
        this.updateSession(chatId, session);
        this.showMarketTypeKeyboard(chatId, session.tradingType);
    }

    /**
     * Handle the market selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @private
     */
    private handleMarketSelection(chatId: number, text: string, session: Session): void {
        session.market = text;
        session.step = "select_purchase_type";
        this.updateSession(chatId, session);
        this.showPurchaseTypeKeyboard(chatId, session.tradingType);
    }

    /**
     * Handle the purchase type selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @private
     */
    private handlePurchaseTypeSelection(chatId: number, text: string, session: Session): void {
        session.purchaseType = text;
        session.step = "enter_stake";
        this.updateSession(chatId, session);
        this.showBaseStakeKeyboard(chatId);
    }

    
}

/**
 * Worker service
 */
class WorkerService implements IWorkerService {

    private workers: { [key: string]: Worker } = {};

    private telegramBot:any;
    
    constructor() { }
    
    setBot(bot: any) {
        this.telegramBot = bot;
    }
    
    postMessageToDerivWorker(action: string, chatId: number, text: string, session: Session, data?: any): void {
        const workerID = `WKR_${chatId}`;

        if (this.workers[workerID]) {
            this.workers[workerID].postMessage({ action, text, meta: { chatId, text, session, data } });
        } else {
            this.workers[workerID] = new Worker("./src/classes/deriv/tradeWorker.js", {
                workerData: { action, text, meta: { chatId, text, session } },
            });

            this.workers[workerID].on("message", (message) => this.handleWorkerMessage(chatId, message));
            this.workers[workerID].on("error", (error) => this.handleWorkerError(chatId, error));
            this.workers[workerID].on("exit", (code) => this.handleWorkerExit(chatId, code));
        }
    }

    handleWorkerMessage(chatId: number, message: any): void {
        // Handle worker messages
    }

    private handleWorkerError(chatId: number, error: Error): void {
        logger.error(`Worker error: ${error.message}`);
        delete this.workers[`WKR_${chatId}`];
    }

    private handleWorkerExit(chatId: number, code: number): void {
        if (code !== 0) {
            logger.error(`Worker stopped with exit code ${code}`);
            delete this.workers[`WKR_${chatId}`];
        }
    }
}

/**
 * Keyboard service
 */
class KeyboardService implements IKeyboardService {

    private telegramBot:any;
    
    constructor() { }
    
    setBot(bot: any) {
        this.telegramBot = bot;
    }
    

    getLoginKeyboard(session: any): KeyboardButton[][] | string [][] | any {

        //TODO : secure the id and username by tmp encrypt

        const id:string = Encryption.encryptAES(session.id, APP_CRYPTOGRAPHIC_KEY);

        const username:string = Encryption.encryptAES(session.username, APP_CRYPTOGRAPHIC_KEY);

        const oauthURL:string = `${DERIV_APP_LOGIN_URL}?id=${id}&username=${username}`;

        return [
            [{ text: '🔒 LOGIN', url:  oauthURL}],
            [{ text: '🚫 CANCEL', callback_data: 'exec_cancel' }],
        ];

    }

    getTradingTypeKeyboard(): KeyboardButton[][] | string [][] {
        return [
            [CONSTANTS.TRADING_TYPES.FOREX, CONSTANTS.TRADING_TYPES.DERIVATIVES],
            [CONSTANTS.TRADING_TYPES.CRYPTO, CONSTANTS.TRADING_TYPES.COMMODITIES],
        ];
    }

    getMarketKeyboard(tradingType: string): KeyboardButton[][] | string [][] {
        // @ts-ignore
        return CONSTANTS.MARKETS[tradingType.replace(/[^a-zA-Z]/g, "").toUpperCase()];
    }

    getPurchaseTypeKeyboard(tradingType?: string): KeyboardButton[][] | string [][] {
        return tradingType === CONSTANTS.TRADING_TYPES.DERIVATIVES
            ? CONSTANTS.PURCHASE_TYPES.DERIVATIVES
            : CONSTANTS.PURCHASE_TYPES.GENERAL;
    }

    getNumericInputKeyboard(): KeyboardButton[][] | string [][] {
        return CONSTANTS.NUMERIC_INPUT;
    }

    getDurationKeyboard(): KeyboardButton[][] | string [][] {
        return CONSTANTS.DURATION;
    }

    getTradeManualAutoKeyboard(): KeyboardButton[][] | string [][] {
        return CONSTANTS.TRADE_MANUAL_OR_AUTO;
    }

    getTradeConfirmKeyboard(): KeyboardButton[][] | string [][] {
        return CONSTANTS.TRADE_CONFIRM;
    }

    getTradeManualKeyboard(): KeyboardButton[][] | string [][] {
        return CONSTANTS.TRADE_MANUAL;
    }

    
    /**
     * Send a keyboard to the user
     * @param {number} chatId - The chat ID of the user
     * @param {string} message - The message to send
     * @param {string[][] | KeyboardButton[][] | string [][]} keyboard - The keyboard to send
     * @param {boolean} isOneTimeKeyboard - Whether the keyboard is one-time
     * @private
     */
    private sendKeyboard(
        chatId: number,
        message: string,
        keyboard: string[][] | KeyboardButton[][] | string [][],
        isOneTimeKeyboard: boolean = true,
        parseMode: string = "Markdown"
    ): void {
        this.telegramBot.sendMessage(chatId, message, {
            reply_markup: {
                keyboard: keyboard as KeyboardButton[][] | string [][],
                resize_keyboard: true,
                one_time_keyboard: isOneTimeKeyboard,
            },
            parse_mode: parseMode,
        });
    }

    
    /**
     * Show the market type keyboard
     * @param {number} chatId - The chat ID of the user
     * @param {any} tradingType - The trading type
     * @private
     */
    public showMarketTypeKeyboard(chatId: number, tradingType: any): void {
        this.sendKeyboard(chatId, "Select the desired market:", this.getMarketKeyboard(tradingType));
    }

    /**
     * Show the purchase type keyboard
     * @param {number} chatId - The chat ID of the user
     * @param {string | undefined} tradingType - The trading type
     * @private
     */
    public showPurchaseTypeKeyboard(chatId: number, tradingType: string | undefined): void {
        this.sendKeyboard(chatId, "Select the purchase type:", this.getPurchaseTypeKeyboard(tradingType));
    }

    /**
     * Show the base stake keyboard
     * @param {number} chatId - The chat ID of the user
     * @private
     */
    public showBaseStakeKeyboard(chatId: number): void {
        this.sendKeyboard(chatId, "Please enter the Base Stake or Investment amount (USD):", this.getNumericInputKeyboard(), true);
    }

    /**
     * Show the take profit threshold keyboard
     * @param {number} chatId - The chat ID of the user
     * @private
     */
    public showTakeProfitThresholdKeyboard(chatId: number): void {
        this.sendKeyboard(chatId, "Please enter your Take Profit amount (USD):", this.getNumericInputKeyboard(), true);
    }

    /**
     * Show the stop loss threshold keyboard
     * @param {number} chatId - The chat ID of the user
     * @private
     */
    public showStopLossThresholdKeyboard(chatId: number): void {
        this.sendKeyboard(chatId, "Please enter your Stop Loss amount (USD):", this.getNumericInputKeyboard(), true);
    }

    /**
     * Show the trade duration keyboard
     * @param {number} chatId - The chat ID of the user
     * @private
     */
    public showTradeDurationKeyboard(chatId: number): void {
        this.sendKeyboard(chatId, "How long should this trade last?", this.getDurationKeyboard(), true);
    }

    /**
     * Show the trade update frequency keyboard
     * @param {number} chatId - The chat ID of the user
     * @private
     */
    public showTradeUpdateFrequencyKeyboard(chatId: number): void {
        this.sendKeyboard(chatId, "How long should you get the trade updates?", this.getDurationKeyboard(), true);
    }

    /**
     * Show the trade confirmation keyboard
     * @param {number} chatId - The chat ID of the user
     * @param {string} message - The confirmation message
     * @private
     */
    public showTradeConfirmKeyboard(chatId: number, message: string): void {
        this.sendKeyboard(chatId, message, this.getTradeConfirmKeyboard(), true);
    }

    /**
     * Show the trade confirmation keyboard
     * @param {number} chatId - The chat ID of the user
     * @param {string} message - The confirmation message
     * @private
     */
    public showTradeManualKeyboard(chatId: number, message: string): void {
        this.sendKeyboard(chatId, message, this.getTradeManualKeyboard(), true);
    }

}

// Initialize services
const db = new MongoDBConnection();
const sessionService = new SessionService(db);
const workerService = new WorkerService();
const keyboardService = new KeyboardService();
const tradingProcessFlow = new TradingProcessFlowHandlers();
const telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

keyboardService.setBot(telegramBot);
workerService.setBot(telegramBot);
tradingProcessFlow.setBot(telegramBot);

// Start the bot
const bot = new TelegramBotService(telegramBot, sessionService, workerService, keyboardService, tradingProcessFlow);