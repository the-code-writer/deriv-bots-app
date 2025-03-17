import { Worker } from "node:worker_threads";
import TelegramBot from "node-telegram-bot-api";
import type { KeyboardButton, Message, CallbackQuery } from "node-telegram-bot-api";
import { pino } from "pino";
// @ts-ignore
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

    //public setupEventListeners(): void;
    handleMessage(msg: Message): Promise<void>;
    //private processSessionStep(chatId: number, text: string, session: Session): void;

}

/**
 * Interface for trading process flow handlers
 */
interface ITradingProcessFlow {

    validateAndUpdateAmount(
        chatId: number,
        text: string,
        session: Session,
        field: keyof Session,
        nextStep: string,
        errorMessage: string,
        showNextKeyboard: () => void,
        showCurrentKeyboard: () => void
    ): void;

    /**
     * Handle the login account step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     */
    handleLoginAccount(chatId: number, text: string, session: Session): void;

    /**
     * Handle the account type selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     */
    handleAccountTypeSelection(chatId: number, text: string, session: Session): void;

    /**
     * Handle the trading type selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     */
    handleTradingTypeSelection(chatId: number, text: string, session: Session): void;

    /**
     * Handle the market selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     */
    handleMarketSelection(chatId: number, text: string, session: Session): void;

    /**
     * Handle the purchase type selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     */
    handlePurchaseTypeSelection(chatId: number, text: string, session: Session): void;

    /**
     * Handle the stake input step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     */
    handleStakeInput(chatId: number, text: string, session: Session): void;

    /**
     * Handle the take profit input step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     */
    handleTakeProfitInput(chatId: number, text: string, session: Session): void;

    /**
     * Handle the stop loss input step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     */
    handleStopLossInput(chatId: number, text: string, session: Session): void;

    /**
     * Handle the trade duration selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     */
    handleTradeDurationSelection(chatId: number, text: string, session: Session): void;

    /**
     * Handle the update frequency selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     */
    handleUpdateFrequencySelection(chatId: number, text: string, session: Session): void;

    /**
     * Handle the contract duration units selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     */
    handleUpdateContractDurationUnitsSelection(chatId: number, text: string, session: Session): void;

    /**
     * Handle the contract duration value selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     */
    handleUpdateContractDurationValueSelection(chatId: number, text: string, session: Session): void;

    /**
     * Handle the auto/manual trading selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     */
    handleAutoManualTrading(chatId: number, text: string, session: Session): void;

    /**
     * Handle the trade confirmation step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     */
    handleTradeConfirmation(chatId: number, text: string, session: Session): void;

    /**
     * Handle the trade manual step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     */
    handleTradeManual(chatId: number, text: string, session: Session): void;
}

/**
 * Interface for Telegram bot command handlers
 */
interface ITelegramBotCommandHandlers {

    /**
     * Handle the /confirm command
     * @param {Message} msg - The message object from Telegram
     */
    getChatSession(msg: Message): Promise<any>;

    /**
     * Handle the callback query
     * @param {CallbackQuery} callbackQuery - The call back function to execute
     */
    handleCallbackQuery(callbackQuery: CallbackQuery): void;

    /**
     * Handle the /start command
     * @param {Message} msg - The message object from Telegram
     */
    handleStartCommand(msg: Message): Promise<void>;

    /**
     * Handle the /confirm command
     * @param {Message} msg - The message object from Telegram
     */
    handleConfirmCommand(msg: Message): Promise<void>;

    /**
     * Handle the /cancel command
     * @param {Message} msg - The message object from Telegram
     */
    handleCancelCommand(msg: Message): Promise<void>;

    /**
     * Handle the /help command
     * @param {Message} msg - The message object from Telegram
     */
    handleHelpCommand(msg: Message): Promise<void>;

    /**
     * Handle the /resume command
     * @param {Message} msg - The message object from Telegram
     */
    handleResumeCommand(msg: Message): Promise<void>;

    /**
     * Handle the /pause command
     * @param {Message} msg - The message object from Telegram
     */
    handlePauseCommand(msg: Message): Promise<void>;

    /**
     * Handle the /stop command
     * @param {Message} msg - The message object from Telegram
     */
    handleStopCommand(msg: Message): Promise<void>;

    /**
     * Handle the /withdraw command
     * @param {Message} msg - The message object from Telegram
     */
    handleWithdrawCommand(msg: Message): Promise<void>;

    /**
     * Handle the /deposit command
     * @param {Message} msg - The message object from Telegram
     */
    handleDepositCommand(msg: Message): Promise<void>;

    /**
     * Handle the /wallet command
     * @param {Message} msg - The message object from Telegram
     */
    handleWalletCommand(msg: Message): Promise<void>;

    /**
     * Handle the /accounts command
     * @param {Message} msg - The message object from Telegram
     */
    handleAccountsCommand(msg: Message): Promise<void>;

    /**
     * Handle the /profile command
     * @param {Message} msg - The message object from Telegram
     */
    handleProfileCommand(msg: Message): Promise<void>;

    /**
     * Handle the /settings command
     * @param {Message} msg - The message object from Telegram
     */
    handleSettingsCommand(msg: Message): Promise<void>;

    /**
     * Handle the /logout command
     * @param {Message} msg - The message object from Telegram
     */
    handleLogoutCommand(msg: Message): Promise<void>;

    /**
     * Handle the /status command
     * @param {Message} msg - The message object from Telegram
     */
    handleStatusCommand(msg: Message): Promise<void>;

    /**
     * Handle the /history command
     * @param {Message} msg - The message object from Telegram
     */
    handleHistoryCommand(msg: Message): Promise<void>;

    /**
     * Handle the /balance command
     * @param {Message} msg - The message object from Telegram
     */
    handleBalanceCommand(msg: Message): Promise<void>;

    /**
     * Handle the /info command
     * @param {Message} msg - The message object from Telegram
     */
    handleInfoCommand(msg: Message): Promise<void>;

    /**
     * Handle the /support command
     * @param {Message} msg - The message object from Telegram
     */
    handleSupportCommand(msg: Message): Promise<void>;

    /**
     * Handle the /update command
     * @param {Message} msg - The message object from Telegram
     */
    handleUpdateCommand(msg: Message): Promise<void>;

    /**
     * Handle the /news command
     * @param {Message} msg - The message object from Telegram
     */
    handleNewsCommand(msg: Message): Promise<void>;

    /**
     * Handle the /alerts command
     * @param {Message} msg - The message object from Telegram
     */
    handleAlertsCommand(msg: Message): Promise<void>;

    /**
     * Handle the /risk-management command
     * @param {Message} msg - The message object from Telegram
     */
    handleRiskManagementCommand(msg: Message): Promise<void>;

    /**
     * Handle the /strategies command
     * @param {Message} msg - The message object from Telegram
     */
    handleStrategiesCommand(msg: Message): Promise<void>;

    /**
     * Handle the /faq command
     * @param {Message} msg - The message object from Telegram
     */
    handleFAQCommand(msg: Message): Promise<void>;

    /**
     * Handle the /telemetry command
     * @param {Message} msg - The message object from Telegram
     */
    handleTelemetryCommand(msg: Message): Promise<void>;

    /**
     * Handle the /profits command
     * @param {Message} msg - The message object from Telegram
     */
    handleProfitsCommand(msg: Message): Promise<void>;

    /**
     * Handle the /statement command
     * @param {Message} msg - The message object from Telegram
     */
    handleStatementCommand(msg: Message): Promise<void>;

    /**
     * Handle the /reset command
     * @param {Message} msg - The message object from Telegram
     */
    handleResetCommand(msg: Message): Promise<void>;

    /**
     * Handle the /pricing command
     * @param {Message} msg - The message object from Telegram
     */
    handlePricingCommand(msg: Message): Promise<void>;

    /**
     * Handle the /subscribe command
     * @param {Message} msg - The message object from Telegram
     */
    handleSubscribeCommand(msg: Message): Promise<void>;

    /**
     * Handle the /health-check command
     * @param {Message} msg - The message object from Telegram
     */
    handleHealthCheckCommand(msg: Message): Promise<void>;

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

    getLoginKeyboard(session: any): KeyboardButton[][] | string[][];

    getAccountTypeKeyboard(userAccounts: any): KeyboardButton[][] | string[][];

    getTradingTypeKeyboard(): KeyboardButton[][] | string[][];

    getMarketTypeKeyboard(tradingType: string): KeyboardButton[][] | string[][];

    getPurchaseTypeKeyboard(tradingType?: string): KeyboardButton[][] | string[][];

    getStakeInputKeyboard(): KeyboardButton[][] | string[][];

    getTakeProfitInputKeyboard(): KeyboardButton[][] | string[][];

    getNumericInputKeyboard(): KeyboardButton[][] | string[][];

    getStopLossInputKeyboard(): KeyboardButton[][] | string[][];

    getTradeDurationKeyboard(): KeyboardButton[][] | string[][];

    getUpdateFrequencyKeyboard(): KeyboardButton[][] | string[][];

    getDurationKeyboard(): KeyboardButton[][] | string[][];

    getContractDurationUnitsKeyboard(): KeyboardButton[][] | string[][];

    getContractDurationValueKeyboard(units: string): KeyboardButton[][] | string[][];

    getAutoManualTradingKeyboard(): KeyboardButton[][] | string[][];

    getTradeConfirmationKeyboard(): KeyboardButton[][] | string[][];

    getTradeManualKeyboard(): KeyboardButton[][] | string[][];

    /**
         * Show the market type keyboard
         * @param {number} chatId - The chat ID of the user
         * @param {any} userAccounts - The user accounts from Deriv
         * @private
         */
    showAccountTypeKeyboard(chatId: number, userAccounts: any): void;

    /**
         * Show the market type keyboard
         * @param;number} chatId - The chat ID of the user
         * @param;any} tradingType - The trading type
         * @private
         */
    showTradingTypeKeyboard(chatId: number, tradingType: any): void;

    /**
         * Show the market type keyboard
         * @param;number} chatId - The chat ID of the user
         * @param;any} tradingType - The trading type
         * @private
         */
    showMarketTypeKeyboard(chatId: number, tradingType: any): void;


    /**
     * Show the purchase type keyboard
     * @param;number} chatId - The chat ID of the user
     * @param;string} tradingType - The trading type
     * @private
     */
    showPurchaseTypeKeyboard(chatId: number, tradingType: string): void;


    /**
     * Show the base stake keyboard
     * @param {number} chatId - The chat ID of the user
     * @private
     */
    showStakeInputKeyboard(chatId: number): void;


    /**
     * Show the take profit threshold keyboard
     * @param;number} chatId - The chat ID of the user
     * @private
     */
    showTakeProfitInputKeyboard(chatId: number): void;


    /**
     * Show the stop loss threshold keyboard
     * @param;number} chatId - The chat ID of the user
     * @private
     */
    showStopLossInputKeyboard(chatId: number): void;


    /**
     * Show the trade duration keyboard
     * @param;number} chatId - The chat ID of the user
     * @private
     */
    showTradeDurationKeyboard(chatId: number): void;


    /**
     * Show the trade update frequency keyboard
     * @param;number} chatId - The chat ID of the user
     * @private
     */
    showUpdateFrequencyKeyboard(chatId: number): void;

    /**
     * Show the trade update frequency keyboard
     * @param;number} chatId - The chat ID of the user
     * @private
     */
    showContractDurationUnitsKeyboard(chatId: number, message: string): void;

    /**
     * Show the trade update frequency keyboard
     * @param;number} chatId - The chat ID of the user
     * @private
     */
    showContractDurationValueKeyboard(chatId: number, message: string): void;


    /**
     * Show the trade confirmation keyboard
     * @param;number} chatId - The chat ID of the user
     * @param;string} message - The confirmation message
     * @private
     */
    showAutoManualTradingKeyboard(chatId: number, message: string): void;

    /**
     * Show the trade confirmation keyboard
     * @param;number} chatId - The chat ID of the user
     * @param;string} message - The confirmation message
     * @private
     */
    showTradeConfirmationKeyboard(chatId: number, message: string): void;


    /**
     * Show the trade confirmation keyboard
     * @param;number} chatId - The chat ID of the user
     * @param;string} message - The confirmation message
     * @private
     */
    showTradeManualKeyboard(chatId: number, message: string): void;

}

/**
 * Telegram bot service
 */
class TelegramBotService implements ITelegramBotService {

    private telegramBot: TelegramBot;
    private sessionService: ISessionService;
    private tradingProcessFlow: ITradingProcessFlow;
    private commandHandlers: ITelegramBotCommandHandlers;

    constructor(
        telegramBot: TelegramBot,
        sessionService: ISessionService,
        tradingProcessFlow: ITradingProcessFlow,
        commandHandlers: ITelegramBotCommandHandlers
    ) {
        this.telegramBot = telegramBot;
        this.sessionService = sessionService;
        this.tradingProcessFlow = tradingProcessFlow;
        this.commandHandlers = commandHandlers;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.telegramBot.onText(/\/start/, (msg) => this.commandHandlers.handleStartCommand(msg));
        this.telegramBot.onText(/\/telemetry/, (msg) => this.commandHandlers.handleTelemetryCommand(msg));
        this.telegramBot.onText(/\/profits/, (msg) => this.commandHandlers.handleProfitsCommand(msg));
        this.telegramBot.onText(/\/statement/, (msg) => this.commandHandlers.handleStatementCommand(msg));
        this.telegramBot.onText(/\/reset/, (msg) => this.commandHandlers.handleResetCommand(msg));
        this.telegramBot.onText(/\/pricing/, (msg) => this.commandHandlers.handlePricingCommand(msg));
        this.telegramBot.onText(/\/subscribe/, (msg) => this.commandHandlers.handleSubscribeCommand(msg));
        this.telegramBot.onText(/\/health-check/, (msg) => this.commandHandlers.handleHealthCheckCommand(msg));
        this.telegramBot.onText(/\/help/, (msg) => this.commandHandlers.handleHelpCommand(msg));
        this.telegramBot.onText(/\/pause|\/stop/, (msg) => this.commandHandlers.handlePauseCommand(msg));
        this.telegramBot.onText(/\/resume/, (msg) => this.commandHandlers.handleResumeCommand(msg));
        this.telegramBot.onText(/\/withdraw/, (msg) => this.commandHandlers.handleWithdrawCommand(msg));
        this.telegramBot.onText(/\/deposit/, (msg) => this.commandHandlers.handleDepositCommand(msg));
        this.telegramBot.onText(/\/wallet/, (msg) => this.commandHandlers.handleWalletCommand(msg));
        this.telegramBot.onText(/\/accounts/, (msg) => this.commandHandlers.handleAccountsCommand(msg));
        this.telegramBot.onText(/\/profile/, (msg) => this.commandHandlers.handleProfileCommand(msg));
        this.telegramBot.onText(/\/settings/, (msg) => this.commandHandlers.handleSettingsCommand(msg));
        this.telegramBot.onText(/\/logout/, (msg) => this.commandHandlers.handleLogoutCommand(msg));
        this.telegramBot.onText(/\/cancel/, (msg) => this.commandHandlers.handleCancelCommand(msg));
        this.telegramBot.onText(/\/status/, (msg) => this.commandHandlers.handleStatusCommand(msg));
        this.telegramBot.onText(/\/history/, (msg) => this.commandHandlers.handleHistoryCommand(msg));
        this.telegramBot.onText(/\/balance/, (msg) => this.commandHandlers.handleBalanceCommand(msg));
        this.telegramBot.onText(/\/info/, (msg) => this.commandHandlers.handleInfoCommand(msg));
        this.telegramBot.onText(/\/support/, (msg) => this.commandHandlers.handleSupportCommand(msg));
        this.telegramBot.onText(/\/update/, (msg) => this.commandHandlers.handleUpdateCommand(msg));
        this.telegramBot.onText(/\/news/, (msg) => this.commandHandlers.handleNewsCommand(msg));
        this.telegramBot.onText(/\/alerts/, (msg) => this.commandHandlers.handleAlertsCommand(msg));
        this.telegramBot.onText(/\/risk-management/, (msg) => this.commandHandlers.handleRiskManagementCommand(msg));
        this.telegramBot.onText(/\/strategies/, (msg) => this.commandHandlers.handleStrategiesCommand(msg));
        this.telegramBot.onText(/\/faq/, (msg) => this.commandHandlers.handleFAQCommand(msg));
        this.telegramBot.on("callback_query", (callbackQuery) => this.commandHandlers.handleCallbackQuery(callbackQuery));
        this.telegramBot.on("message", (msg) => this.handleMessage(msg));
    }

    public async handleMessage(msg: Message): Promise<void> {
        const chatId = msg.chat.id;
        const firstname = msg.chat.id;
        const text = sanitizeHtml(msg.text || "", { allowedTags: [], allowedAttributes: {} });
        const session = await this.sessionService.getSession(chatId);
        if (!session) {
            this.telegramBot.sendMessage(chatId, `Hello ${firstname}, The session has not been found or has expired. Use ${CONSTANTS.COMMANDS.START} to begin.`);
            return;
        }
        // Process session step
        this.processSessionStep(chatId, text, session);
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
            case CONSTANTS.SESSION_STEPS.LOGIN_ACCOUNT:
                this.tradingProcessFlow.handleLoginAccount(chatId, text, session);
                break;
            case CONSTANTS.SESSION_STEPS.SELECT_ACCOUNT_TYPE:
                this.tradingProcessFlow.handleAccountTypeSelection(chatId, text, session);
                break;
            case CONSTANTS.SESSION_STEPS.SELECT_TRADING_TYPE:
                this.tradingProcessFlow.handleTradingTypeSelection(chatId, text, session);
                break;
            case CONSTANTS.SESSION_STEPS.SELECT_MARKET:
                this.tradingProcessFlow.handleMarketSelection(chatId, text, session);
                break;
            case CONSTANTS.SESSION_STEPS.SELECT_PURCHASE_TYPE:
                this.tradingProcessFlow.handlePurchaseTypeSelection(chatId, text, session);
                break;
            case CONSTANTS.SESSION_STEPS.ENTER_STAKE:
                this.tradingProcessFlow.handleStakeInput(chatId, text, session);
                break;
            case CONSTANTS.SESSION_STEPS.ENTER_TAKE_PROFIT:
                this.tradingProcessFlow.handleTakeProfitInput(chatId, text, session);
                break;
            case CONSTANTS.SESSION_STEPS.ENTER_STOP_LOSS:
                this.tradingProcessFlow.handleStopLossInput(chatId, text, session);
                break;
            case CONSTANTS.SESSION_STEPS.SELECT_TRADE_DURATION:
                this.tradingProcessFlow.handleTradeDurationSelection(chatId, text, session);
                break;
            case CONSTANTS.SESSION_STEPS.SELECT_UPDATE_FREQUENCY:
                this.tradingProcessFlow.handleUpdateFrequencySelection(chatId, text, session);
                break;
            case CONSTANTS.SESSION_STEPS.SELECT_TICKS_OR_MINUTES:
                this.tradingProcessFlow.handleUpdateContractDurationUnitsSelection(chatId, text, session);
                break;
            case CONSTANTS.SESSION_STEPS.SELECT_TICKS_OR_MINUTES_DURATION:
                this.tradingProcessFlow.handleUpdateContractDurationValueSelection(chatId, text, session);
                break;
            case CONSTANTS.SESSION_STEPS.SELECT_AUTO_OR_MANUAL:
                this.tradingProcessFlow.handleAutoManualTrading(chatId, text, session);
                break;
            case CONSTANTS.SESSION_STEPS.CONFIRM_TRADE:
                this.tradingProcessFlow.handleTradeConfirmation(chatId, text, session);
                break;
            case CONSTANTS.SESSION_STEPS.MANUAL_TRADE:
                this.tradingProcessFlow.handleTradeManual(chatId, text, session);
                break;
            default:
                this.tradingProcessFlow.handleLoginAccount(chatId, text, session);
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
        const session: Session = { chatId, step: "login_account", timestamp: Date.now() };
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

    private telegramBot: any;

    private sessionService: ISessionService;

    private keyboardService: IKeyboardService;

    private workerService: IWorkerService;

    constructor(telegramBot: any, sessionService: ISessionService, keyboardService: IKeyboardService, workerService: IWorkerService) {
        this.telegramBot = telegramBot;
        this.sessionService = sessionService;
        this.keyboardService = keyboardService;
        this.workerService = workerService;
    }

    /**
     * Validate and update the amount entered by the user
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @param {keyof Session} field - The field to update
     * @param {string} nextStep - The next step
     * @param {string} errorMessage - The error message to display
     * @param {Function} showNextKeyboard - Function to show the next keyboard
     * @param {Function} showCurrentKeyboard - Function to show the current keyboard
     * @private
     */

    public validateAndUpdateAmount(
        chatId: number,
        text: string,
        session: Session,
        field: keyof Session,
        nextStep: string,
        errorMessage: string,
        showNextKeyboard: () => void,
        showCurrentKeyboard: () => void
    ): void {
        if (text === "Automatic") {
            session[field] = this.getAutomaticStake(session.step, nextStep);
            session.step = nextStep;
            this.sessionService.updateSession(chatId, session);
            showNextKeyboard();
            return;
        }
        if (isCurrency(text)) {
            const amount = extractAmount(text);
            const value = parseFloat(`${amount}`);
            if (Number.isNaN(value) || value <= 0) {
                session[field] = 0;
                this.sessionService.updateSession(chatId, session);
                this.telegramBot.sendMessage(chatId, errorMessage);
                showCurrentKeyboard();
                return;
            } else {
                session[field] = value;
                session.step = nextStep;
                this.sessionService.updateSession(chatId, session);
                showNextKeyboard();
                return;
            }
        } else {
            session[field] = 0;
            this.sessionService.updateSession(chatId, session);
            this.telegramBot.sendMessage(chatId, errorMessage);
            showCurrentKeyboard();
            return;
        }
    }

    /**
     * Handle the login account step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public handleLoginAccount(chatId: number, text: string, session: Session): void {
        session.loginAccount = text;
        session.step = "select_account_type";
        this.sessionService.updateSession(chatId, session);
        this.keyboardService.showAccountTypeKeyboard(chatId, session.loginAccount);
    }

    /**
     * Handle the account type selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public handleAccountTypeSelection(chatId: number, text: string, session: Session): void {
        session.accountType = text;
        session.step = "select_trading_type";
        this.sessionService.updateSession(chatId, session);
        this.keyboardService.showTradingTypeKeyboard(chatId, session.accountType);
    }

    /**
     * Handle the trading type selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public handleTradingTypeSelection(chatId: number, text: string, session: Session): void {
        session.tradingType = text;
        session.step = "select_market";
        this.sessionService.updateSession(chatId, session);
        this.keyboardService.showMarketTypeKeyboard(chatId, session.tradingType);
    }

    /**
     * Handle the market selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public handleMarketSelection(chatId: number, text: string, session: Session): void {
        session.market = text;
        session.step = "select_purchase_type";
        this.sessionService.updateSession(chatId, session);
        this.keyboardService.showPurchaseTypeKeyboard(chatId, session.market);
    }

    /**
     * Handle the purchase type selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public handlePurchaseTypeSelection(chatId: number, text: string, session: Session): void {
        session.purchaseType = text;
        session.step = "enter_stake";
        this.sessionService.updateSession(chatId, session);
        this.keyboardService.showStakeInputKeyboard(chatId);
    }


    /**
     * Get the automatic stake value
     * @param {string} step - The current step
     * @param {string} nextStep - The next step
     * @returns {number} - The automatic stake value
     * @private
     */
    private getAutomaticStake(step: string, nextStep: string): number {
        return 1;
    }

    /**
     * Handle the stake input step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public handleStakeInput(chatId: number, text: string, session: Session): void {

        this.validateAndUpdateAmount(
            chatId,
            text,
            session,
            "stake",
            "enter_take_profit",
            "You have entered an invalid amount.",
            () => this.keyboardService.showTakeProfitInputKeyboard(chatId),
            () => this.keyboardService.showStakeInputKeyboard(chatId)
        );

    }

    /**
     * Handle the take profit input step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public handleTakeProfitInput(chatId: number, text: string, session: Session): void {

        this.validateAndUpdateAmount(
            chatId,
            text,
            session,
            "stake",
            "enter_stop_loss",
            "You have entered an invalid amount.",
            () => this.keyboardService.showStopLossInputKeyboard(chatId),
            () => this.keyboardService.showTakeProfitInputKeyboard(chatId)
        );

    }

    /**
     * Handle the stop loss input step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public handleStopLossInput(chatId: number, text: string, session: Session): void {

        this.validateAndUpdateAmount(
            chatId,
            text,
            session,
            "stake",
            "select_trade_duration",
            "You have entered an invalid amount.",
            () => this.keyboardService.showTradeDurationKeyboard(chatId),
            () => this.keyboardService.showStopLossInputKeyboard(chatId)
        );

    }

    /**
     * Handle the trade duration selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public handleTradeDurationSelection(chatId: number, text: string, session: Session): void {
        session.tradeDuration = text;
        session.step = "select_update_frequency";
        this.sessionService.updateSession(chatId, session);
        this.keyboardService.showUpdateFrequencyKeyboard(chatId);
    }

    /**
     * Handle the update frequency selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public handleUpdateFrequencySelection(chatId: number, text: string, session: Session): void {
        session.updateFrequency = text;
        session.step = "select_ticks_or_minutes";
        this.sessionService.updateSession(chatId, session);
        this.keyboardService.showContractDurationUnitsKeyboard(chatId, session.updateFrequency);
    }

    /**
     * Handle the contract duration units selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public handleUpdateContractDurationUnitsSelection(chatId: number, text: string, session: Session): void {
        session.contractDurationUnits = text;
        session.step = "select_ticks_or_minutes_duration";
        this.sessionService.updateSession(chatId, session);
        this.keyboardService.showContractDurationValueKeyboard(chatId, session.contractDurationUnits);
    }

    /**
     * Handle the contract duration value selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public handleUpdateContractDurationValueSelection(chatId: number, text: string, session: Session): void {
        session.contractDurationValue = text;
        session.step = "select_auto_or_manual";
        this.sessionService.updateSession(chatId, session);
        this.keyboardService.showAutoManualTradingKeyboard(chatId, session.contractDurationValue);
    }

    /**
     * Handle the auto/manual trading selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public handleAutoManualTrading(chatId: number, text: string, session: Session): void {
        session.tradingMode = text;
        session.step = "confirm_trade";
        this.sessionService.updateSession(chatId, session);
        this.keyboardService.showTradeConfirmationKeyboard(chatId, session.tradingMode);
    }

    /**
     * Handle the trade confirmation step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public handleTradeConfirmation(chatId: number, text: string, session: Session): void {
        if (text === CONSTANTS.COMMANDS.CONFIRM) {
            this.workerService.postMessageToDerivWorker("CONFIRM_TRADE", chatId, "", session);
        } else {
            this.telegramBot.sendMessage(chatId, `Trade not confirmed. Use ${CONSTANTS.COMMANDS.START} to begin again.`);
        }
    }

    /**
     * Handle the trade confirmation step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public handleTradeManual(chatId: number, text: string, session: Session): void {
        if (text === CONSTANTS.COMMANDS.CONFIRM) {
            this.workerService.postMessageToDerivWorker("CONFIRM_TRADE", chatId, "", session);
        } else {
            this.telegramBot.sendMessage(chatId, `Trade not confirmed. Use ${CONSTANTS.COMMANDS.START} to begin again.`);
        }
    }

}

/**
 * Telegram bot command handler class
 */
class TelegramBotCommandHandlers implements ITelegramBotCommandHandlers {

    private telegramBot: any;

    private sessionService: ISessionService;

    private keyboardService: IKeyboardService;

    private workerService: IWorkerService;

    constructor(telegramBot: any, sessionService: ISessionService, keyboardService: IKeyboardService, workerService: IWorkerService) {
        this.telegramBot = telegramBot;
        this.sessionService = sessionService;
        this.keyboardService = keyboardService;
        this.workerService = workerService;
    }

    /**
     * Handle the /confirm command
     * @param {Message} msg - The message object from Telegram
     */
    async getChatSession(msg: Message): Promise<any> {
        const chatId = msg.chat.id;
        const session = await this.sessionService.getSession(chatId);

        if (!session) {
            // If session is not found, throw an error
            this.telegramBot.sendMessage(chatId, `Session not found. Use ${CONSTANTS.COMMANDS.START} to begin.`, session);
            return { chatId: null, session: null };
        }

        return { chatId, session };

    }

    public handleCallbackQuery(callbackQuery: CallbackQuery): void {

        const chatId = callbackQuery.message?.chat.id;
        const data = callbackQuery.data;

        if (data === 'exec_login') {
            this.telegramBot.sendMessage(chatId!, `You are about to login using your Deriv Account.`);
        } else if (data === 'exec_cancel') {
            this.telegramBot.sendMessage(chatId!, 'You selected Option 2!');
        }

        this.telegramBot.answerCallbackQuery(callbackQuery.id);
    }


    /**
     * Handle the /start command
     * @param {Message} msg - The message object from Telegram
     */
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
        this.telegramBot.sendPhoto(chatId, imageUrl, { caption, parse_mode: "Markdown" });
        setTimeout(() => {
            this.telegramBot.sendMessage(chatId, 'Please login using your Deriv Account to proceed:', {
                reply_markup: { inline_keyboard: this.keyboardService.getLoginKeyboard(session.username) },
            });
        }, 3000);
    }

    /**
     * Handle the /confirm command
     * @param {Message} msg - The message object from Telegram
     */
    async handleConfirmCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Confirm the action (e.g., trade confirmation)
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.CONFIRM, chatId, "", session);
    }

    /**
     * Handle the /cancel command
     * @param {Message} msg - The message object from Telegram
     */
    async handleCancelCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Cancel the current action (e.g., cancel a trade)
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.CANCEL, chatId, "", session);
    }

    /**
     * Handle the /help command
     * @param {Message} msg - The message object from Telegram
     */
    async handleHelpCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Send help information to the user
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.HELP, chatId, "Here is some help information.", session);
    }

    /**
     * Handle the /resume command
     * @param {Message} msg - The message object from Telegram
     */
    async handleResumeCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Resume a paused action (e.g., resume trading)
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.RESUME, chatId, "", session);
    }

    /**
     * Handle the /pause command
     * @param {Message} msg - The message object from Telegram
     */
    async handlePauseCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Pause the current action (e.g., pause trading)
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.PAUSE, chatId, "", session);
    }

    /**
     * Handle the /stop command
     * @param {Message} msg - The message object from Telegram
     */
    async handleStopCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Stop the current action (e.g., stop trading)
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.STOP, chatId, "", session);
    }

    /**
     * Handle the /withdraw command
     * @param {Message} msg - The message object from Telegram
     */
    async handleWithdrawCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Withdraw amounts into your account
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.WITHDRAW, chatId, "", session);
    }

    /**
     * Handle the /deposit command
     * @param {Message} msg - The message object from Telegram
     */
    async handleDepositCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Deposit amounts into your account
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.DEPOSIT, chatId, "", session);
    }

    /**
     * Handle the /wallet command
     * @param {Message} msg - The message object from Telegram
     */
    async handleWalletCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display wallet information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.WALLET, chatId, "", session);
    }

    /**
     * Handle the /accounts command
     * @param {Message} msg - The message object from Telegram
     */
    async handleAccountsCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display account information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.ACCOUNTS, chatId, "", session);
    }

    /**
     * Handle the /profile command
     * @param {Message} msg - The message object from Telegram
     */
    async handleProfileCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display profile information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.PROFILE, chatId, "", session);
    }

    /**
     * Handle the /settings command
     * @param {Message} msg - The message object from Telegram
     */
    async handleSettingsCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display settings information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.SETTINGS, chatId, "", session);
    }

    /**
     * Handle the /logout command
     * @param {Message} msg - The message object from Telegram
     */
    async handleLogoutCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Logout the user
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.LOGOUT, chatId, "", session);
    }

    /**
     * Handle the /status command
     * @param {Message} msg - The message object from Telegram
     */
    async handleStatusCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display status information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.STATUS, chatId, "", session);
    }

    /**
     * Handle the /history command
     * @param {Message} msg - The message object from Telegram
     */
    async handleHistoryCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display history information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.HISTORY, chatId, "", session);
    }

    /**
     * Handle the /balance command
     * @param {Message} msg - The message object from Telegram
     */
    async handleBalanceCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display balance information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.BALANCE, chatId, "", session);
    }

    /**
     * Handle the /info command
     * @param {Message} msg - The message object from Telegram
     */
    async handleInfoCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.INFO, chatId, "", session);
    }

    /**
     * Handle the /support command
     * @param {Message} msg - The message object from Telegram
     */
    async handleSupportCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display support information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.SUPPORT, chatId, "", session);
    }

    /**
     * Handle the /update command
     * @param {Message} msg - The message object from Telegram
     */
    async handleUpdateCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Perform an update (e.g., update settings or data)
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.UPDATE, chatId, "", session);
    }

    /**
     * Handle the /news command
     * @param {Message} msg - The message object from Telegram
     */
    async handleNewsCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display news information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.NEWS, chatId, "", session);
    }

    /**
     * Handle the /alerts command
     * @param {Message} msg - The message object from Telegram
     */
    async handleAlertsCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display alerts information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.ALERTS, chatId, "", session);
    }

    /**
     * Handle the /risk-management command
     * @param {Message} msg - The message object from Telegram
     */
    async handleRiskManagementCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display risk management information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.RISK_MANAGEMENT, chatId, "", session);
    }

    /**
     * Handle the /strategies command
     * @param {Message} msg - The message object from Telegram
     */
    async handleStrategiesCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display strategies information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.STRATEGIES, chatId, "", session);
    }

    /**
     * Handle the /faq command
     * @param {Message} msg - The message object from Telegram
     */
    async handleFAQCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display FAQ information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.FAQ, chatId, "", session);
    }

    /**
     * Handle the /telemetry command
     * @param {Message} msg - The message object from Telegram
     */
    async handleTelemetryCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display telemetry information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.TELEMETRY, chatId, "", session);
    }

    /**
     * Handle the /profits command
     * @param {Message} msg - The message object from Telegram
     */
    async handleProfitsCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display profits information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.PROFITS, chatId, "", session);
    }

    /**
     * Handle the /statement command
     * @param {Message} msg - The message object from Telegram
     */
    async handleStatementCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display statement information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.STATEMENT, chatId, "", session);
    }

    /**
     * Handle the /reset command
     * @param {Message} msg - The message object from Telegram
     */
    async handleResetCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Reset the session or settings
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.RESET, chatId, "", session);
    }

    /**
     * Handle the /pricing command
     * @param {Message} msg - The message object from Telegram
     */
    async handlePricingCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Display pricing information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.PRICING, chatId, "", session);
    }

    /**
     * Handle the /subscribe command
     * @param {Message} msg - The message object from Telegram
     */
    async handleSubscribeCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Subscribe the user to a service
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.SUBSCRIBE, chatId, "", session);
    }

    /**
     * Handle the /health-check command
     * @param {Message} msg - The message object from Telegram
     */
    async handleHealthCheckCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // Perform a health check
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.HEALTH_CHECK, chatId, "", session);
    }
}

/**
 * Worker service
 */
class WorkerService implements IWorkerService {

    private workers: { [key: string]: Worker } = {};

    private telegramBot: any;

    constructor(telegramBot: any) {
        this.telegramBot = telegramBot;
    }

    setBot(telegramBot: any) {
        this.telegramBot = telegramBot;
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

    private telegramBot: any;

    constructor(telegramBot: any) {
        this.telegramBot = telegramBot;
    }

    setBot(bot: any) {
        this.telegramBot = bot;
    }


    getLoginKeyboard(session: any): KeyboardButton[][] | string[][] | any {

        const id: string = Encryption.encryptAES(session.id, APP_CRYPTOGRAPHIC_KEY);

        const username: string = Encryption.encryptAES(session.username, APP_CRYPTOGRAPHIC_KEY);

        const oauthURL: string = `${DERIV_APP_LOGIN_URL}?id=${id}&username=${username}`;

        return [
            [{ text: '🔒 LOGIN', url: oauthURL }],
            [{ text: '🚫 CANCEL', callback_data: 'exec_cancel' }],
        ];

    }

    getAccountTypeKeyboard(userAccounts: any): KeyboardButton[][] | string[][] {

        console.log(userAccounts, "");

        return [
            [],
        ];

    }

    getTradingTypeKeyboard(): KeyboardButton[][] | string[][] {
        return [
            [CONSTANTS.TRADING_TYPES.FOREX, CONSTANTS.TRADING_TYPES.DERIVATIVES],
            [CONSTANTS.TRADING_TYPES.CRYPTO, CONSTANTS.TRADING_TYPES.COMMODITIES],
        ];
    }

    getMarketTypeKeyboard(tradingType: string): KeyboardButton[][] | string[][] {
        // @ts-ignore
        return CONSTANTS.MARKETS[tradingType.replace(/[^a-zA-Z]/g, "").toUpperCase()];
    }

    getPurchaseTypeKeyboard(tradingType: string): KeyboardButton[][] | string[][] {

        let keyboard: KeyboardButton[][] | string[][] = [[""]];

        switch (tradingType.replace(/[^a-zA-Z]/g, "").toUpperCase()) {

            case CONSTANTS.TRADING_TYPES.DERIVATIVES: {

                keyboard = CONSTANTS.PURCHASE_TYPES.DERIVATIVES;
                break;

            }

            default: {

                keyboard = CONSTANTS.PURCHASE_TYPES.GENERAL;
                break;

            }

        }

        return keyboard;

    }

    getNumericInputKeyboard(): KeyboardButton[][] | string[][] {
        return CONSTANTS.NUMERIC_INPUT;
    }

    getStakeInputKeyboard(): KeyboardButton[][] | string[][] {
        return this.getNumericInputKeyboard();
    }

    getTakeProfitInputKeyboard(): KeyboardButton[][] | string[][] {
        return this.getNumericInputKeyboard();
    }

    getStopLossInputKeyboard(): KeyboardButton[][] | string[][] {
        return this.getNumericInputKeyboard();
    }

    getDurationKeyboard(): KeyboardButton[][] | string[][] {
        return CONSTANTS.DURATION;
    }

    getTradeDurationKeyboard(): KeyboardButton[][] | string[][] {
        return this.getDurationKeyboard();
    }

    getUpdateFrequencyKeyboard(): KeyboardButton[][] | string[][] {
        return this.getDurationKeyboard();
    }

    getContractDurationUnitsKeyboard(): KeyboardButton[][] | string[][] {
        return CONSTANTS.TRADE_DURATION_U;
    }

    getContractDurationValueKeyboard(units: string): KeyboardButton[][] | string[][] {

        let contractDurationValue: KeyboardButton[][] | string[][] = [[""]];

        switch (units.replace(/[^a-zA-Z]/g, "").toUpperCase()) {

            case CONSTANTS.TRADE_DURATION_U[0][0]: {

                contractDurationValue = CONSTANTS.TRADE_DURATION_T;
                break;

            }

            case CONSTANTS.TRADE_DURATION_U[0][1]: {

                contractDurationValue = CONSTANTS.TRADE_DURATION_M;
                break;

            }

            case CONSTANTS.TRADE_DURATION_U[0][2]: {

                contractDurationValue = CONSTANTS.TRADE_DURATION_H;
                break;

            }

            default: {

                contractDurationValue = CONSTANTS.TRADE_DURATION_T;
                break;

            }

        }

        return contractDurationValue;

    }

    getAutoManualTradingKeyboard(): KeyboardButton[][] | string[][] {
        return CONSTANTS.TRADE_MANUAL_OR_AUTO;
    }

    getTradeConfirmationKeyboard(): KeyboardButton[][] | string[][] {
        return CONSTANTS.TRADE_CONFIRM;
    }

    getTradeManualKeyboard(): KeyboardButton[][] | string[][] {
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
        keyboard: string[][] | KeyboardButton[][] | string[][],
        isOneTimeKeyboard: boolean = true,
        parseMode: string = "Markdown"
    ): void {
        this.telegramBot.sendMessage(chatId, message, {
            reply_markup: {
                keyboard: keyboard as KeyboardButton[][] | string[][],
                resize_keyboard: true,
                one_time_keyboard: isOneTimeKeyboard,
            },
            parse_mode: parseMode,
        });
    }


    /**
         * Show the account type keyboard
         * @param {number} chatId - The chat ID of the user
         * @param {any} userAccounts - The user accounts from deriv
         * @private
         */
    showAccountTypeKeyboard(chatId: number, userAccounts: any): void {
        this.sendKeyboard(chatId, "Select the desired account to trade with:", this.getAccountTypeKeyboard(userAccounts));
    }

    /**
         * Show the market type keyboard
         * @param;number} chatId - The chat ID of the user
         * @param;any} tradingType - The trading type
         * @private
         */
    showTradingTypeKeyboard(chatId: number): void {
        this.sendKeyboard(chatId, "Select the desired market:", this.getTradingTypeKeyboard());
    }

    /**
     * Show the market type keyboard
     * @param {number} chatId - The chat ID of the user
     * @param {any} tradingType - The trading type
     * @private
     */
    public showMarketTypeKeyboard(chatId: number, tradingType: any): void {
        this.sendKeyboard(chatId, "Select the desired market:", this.getMarketTypeKeyboard(tradingType));
    }

    /**
     * Show the purchase type keyboard
     * @param {number} chatId - The chat ID of the user
     * @param {string} tradingType - The trading type
     * @private
     */
    public showPurchaseTypeKeyboard(chatId: number, tradingType: string): void {
        this.sendKeyboard(chatId, "Select the purchase type:", this.getPurchaseTypeKeyboard(tradingType));
    }

    /**
     * Show the base stake keyboard
     * @param {number} chatId - The chat ID of the user
     * @private
     */
    public showStakeInputKeyboard(chatId: number): void {
        this.sendKeyboard(chatId, "Please enter the Base Stake or Investment amount (USD):", this.getNumericInputKeyboard());
    }

    /**
     * Show the take profit threshold keyboard
     * @param {number} chatId - The chat ID of the user
     * @private
     */
    public showTakeProfitInputKeyboard(chatId: number): void {
        this.sendKeyboard(chatId, "Please enter your Take Profit amount (USD):", this.getNumericInputKeyboard());
    }

    /**
     * Show the stop loss threshold keyboard
     * @param {number} chatId - The chat ID of the user
     * @private
     */
    public showStopLossInputKeyboard(chatId: number): void {
        this.sendKeyboard(chatId, "Please enter your Stop Loss amount (USD):", this.getNumericInputKeyboard());
    }

    /**
     * Show the trade duration keyboard
     * @param {number} chatId - The chat ID of the user
     * @private
     */
    public showTradeDurationKeyboard(chatId: number): void {
        this.sendKeyboard(chatId, "How long should this trade last?", this.getDurationKeyboard());
    }

    /**
     * Show the trade update frequency keyboard
     * @param {number} chatId - The chat ID of the user
     * @private
     */
    public showUpdateFrequencyKeyboard(chatId: number): void {
        this.sendKeyboard(chatId, "How long should you get the trade updates?", this.getDurationKeyboard());
    }


    /**
     * Show the trade update frequency keyboard
     * @param;number} chatId - The chat ID of the user
     * @private
     */
    showContractDurationUnitsKeyboard(chatId: number, message: string): void {
        this.sendKeyboard(chatId, "Select the units for the contract duration.", this.getContractDurationUnitsKeyboard());
    }

    /**
     * Show the trade update frequency keyboard
     * @param;number} chatId - The chat ID of the user
     * @private
     */
    showContractDurationValueKeyboard(chatId: number, units: string): void {
        this.sendKeyboard(chatId, `Select the contract duration in ${units}`, this.getContractDurationValueKeyboard(units));
    }


    /**
     * Show the trade confirmation keyboard
     * @param {number} chatId - The chat ID of the user
     * @param {string} message - The confirmation message
     * @private
     */
    public showTradeConfirmationKeyboard(chatId: number, message: string): void {
        this.sendKeyboard(chatId, message, this.getTradeConfirmationKeyboard());
    }

    /**
     * Show the trade confirmation keyboard
     * @param {number} chatId - The chat ID of the user
     * @param {string} message - The confirmation message
     * @private
     */
    public showAutoManualTradingKeyboard(chatId: number, message: string): void {
        this.sendKeyboard(chatId, message, this.getAutoManualTradingKeyboard());
    }

    /**
     * Show the trade confirmation keyboard
     * @param {number} chatId - The chat ID of the user
     * @param {string} message - The confirmation message
     * @private
     */
    public showTradeManualKeyboard(chatId: number, message: string): void {
        this.sendKeyboard(chatId, message, this.getTradeManualKeyboard());
    }



}

// Initialize services

const db = new MongoDBConnection();
const sessionService = new SessionService(db);
const telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const workerService = new WorkerService(telegramBot);
const keyboardService = new KeyboardService(telegramBot);
const commandHandlers = new TelegramBotCommandHandlers(telegramBot, sessionService, keyboardService, workerService);
const tradingProcessFlow = new TradingProcessFlowHandlers(telegramBot, sessionService, keyboardService, workerService);

// Start the bot
new TelegramBotService(telegramBot, sessionService, tradingProcessFlow, commandHandlers);
