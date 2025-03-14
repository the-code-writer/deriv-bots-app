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
 * Interface for trading process flow handlers
 */
interface ITradingProcessFlow {
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
}

/**
 * Interface for Telegram bot command handlers
 */
interface ITelegramBotCommandHandlers {
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
    handleFaqCommand(msg: Message): Promise<void>;

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
        this.bot.onText(/\/telemetry/, (msg) => this.handleTelemetryCommand(msg));
        this.bot.onText(/\/profits/, (msg) => this.handleProfitsCommand(msg));
        this.bot.onText(/\/statement/, (msg) => this.handleStatementCommand(msg));
        this.bot.onText(/\/reset/, (msg) => this.handleResetCommand(msg));
        this.bot.onText(/\/pricing/, (msg) => this.handlePricingCommand(msg));
        this.bot.onText(/\/subscribe/, (msg) => this.handleSubscribeCommand(msg));
        this.bot.onText(/\/health-check/, (msg) => this.handleHealthCheckCommand(msg));
        this.bot.onText(/\/help/, (msg) => this.handleHelpCommand(msg));
        this.bot.onText(/\/pause|\/stop/, (msg) => this.handlePauseCommand(msg));
        this.bot.onText(/\/resume/, (msg) => this.handleResumeCommand(msg));
        this.bot.onText(/\/withdraw/, (msg) => this.handleWithdrawCommand(msg));
        this.bot.onText(/\/deposit/, (msg) => this.handleDepositCommand(msg));
        this.bot.onText(/\/wallet/, (msg) => this.handleWalletCommand(msg));
        this.bot.onText(/\/accounts/, (msg) => this.handleAccountsCommand(msg));
        this.bot.onText(/\/profile/, (msg) => this.handleProfileCommand(msg));
        this.bot.onText(/\/settings/, (msg) => this.handleSettingsCommand(msg));
        this.bot.onText(/\/logout/, (msg) => this.handleLogoutCommand(msg));
        this.bot.onText(/\/cancel/, (msg) => this.handleCancelCommand(msg));
        this.bot.onText(/\/status/, (msg) => this.handleStatusCommand(msg));
        this.bot.onText(/\/history/, (msg) => this.handleHistoryCommand(msg));
        this.bot.onText(/\/balance/, (msg) => this.handleBalanceCommand(msg));
        this.bot.onText(/\/info/, (msg) => this.handleInfoCommand(msg));
        this.bot.onText(/\/support/, (msg) => this.handleSupportCommand(msg));
        this.bot.onText(/\/update/, (msg) => this.handleUpdateCommand(msg));
        this.bot.onText(/\/news/, (msg) => this.handleNewsCommand(msg));
        this.bot.onText(/\/alerts/, (msg) => this.handleAlertsCommand(msg));
        this.bot.onText(/\/risk-management/, (msg) => this.handleRiskManagementCommand(msg));
        this.bot.onText(/\/strategies/, (msg) => this.handleStrategiesCommand(msg));
        this.bot.onText(/\/faq/, (msg) => this.handleFAQCommand(msg));
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
            default:
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
        await this.sessionService.updateSession(chatId, session);
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
    
    private sessionService:any;

    private keyboardService: any;

    constructor() { }
    
    setBot(telegramBot: any) {
        this.telegramBot = telegramBot;
    }

    setSessionService(sessionService: any) {
        this.sessionService = sessionService;
    }

    setKeyboardService(keyboardService: any) {
        this.keyboardService = keyboardService;
    }

    /**
 * Handle the login account step
 * @param {number} chatId - The chat ID of the user
 * @param {string} text - The text of the message
 * @param {Session} session - The current session
 * @private
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
     * @private
     */
    private handleAccountTypeSelection(chatId: number, text: string, session: Session): void {
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
     * @private
     */
    private handleTradingTypeSelection(chatId: number, text: string, session: Session): void {
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
     * @private
     */
    private handleMarketSelection(chatId: number, text: string, session: Session): void {
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
     * @private
     */
    private handlePurchaseTypeSelection(chatId: number, text: string, session: Session): void {
        session.purchaseType = text;
        session.step = "enter_stake";
        this.sessionService.updateSession(chatId, session);
        this.keyboardService.showStakeInputKeyboard(chatId, session.purchaseType);
    }

    /**
     * Handle the stake input step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @private
     */
    private handleStakeInput(chatId: number, text: string, session: Session): void {
        session.stake = parseFloat(text);
        session.step = "enter_take_profit";
        this.sessionService.updateSession(chatId, session);
        this.keyboardService.showTakeProfitInputKeyboard(chatId, session.stake);
    }

    /**
     * Handle the take profit input step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @private
     */
    private handleTakeProfitInput(chatId: number, text: string, session: Session): void {
        session.takeProfit = parseFloat(text);
        session.step = "enter_stop_loss";
        this.sessionService.updateSession(chatId, session);
        this.keyboardService.showStopLossInputKeyboard(chatId, session.takeProfit);
    }

    /**
     * Handle the stop loss input step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @private
     */
    private handleStopLossInput(chatId: number, text: string, session: Session): void {
        session.stopLoss = parseFloat(text);
        session.step = "select_trade_duration";
        this.sessionService.updateSession(chatId, session);
        this.keyboardService.showTradeDurationKeyboard(chatId, session.stopLoss);
    }

    /**
     * Handle the trade duration selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @private
     */
    private handleTradeDurationSelection(chatId: number, text: string, session: Session): void {
        session.tradeDuration = text;
        session.step = "select_update_frequency";
        this.sessionService.updateSession(chatId, session);
        this.keyboardService.showUpdateFrequencyKeyboard(chatId, session.tradeDuration);
    }

    /**
     * Handle the update frequency selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @private
     */
    private handleUpdateFrequencySelection(chatId: number, text: string, session: Session): void {
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
     * @private
     */
    private handleUpdateContractDurationUnitsSelection(chatId: number, text: string, session: Session): void {
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
     * @private
     */
    private handleUpdateContractDurationValueSelection(chatId: number, text: string, session: Session): void {
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
     * @private
     */
    private handleAutoManualTrading(chatId: number, text: string, session: Session): void {
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
     * @private
     */
    private handleTradeConfirmation(chatId: number, text: string, session: Session): void {
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
    private sessionService: ISessionService;
    private workerService: IWorkerService;

    constructor(sessionService: ISessionService, workerService: IWorkerService) {
        this.sessionService = sessionService;
        this.workerService = workerService;
    }

    /**
     * Handle the /start command
     * @param {Message} msg - The message object from Telegram
     */
    async handleStartCommand(msg: Message): Promise<void> {
        const chatId = msg.chat.id;
        const session = await this.sessionService.getSession(chatId);

        if (!session) {
            // If session is not found, initialize a new session
            await this.sessionService.initializeSession(chatId);
            this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.START, chatId, "", session);
        } else {
            // If session exists, send a welcome message
            this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.START, chatId, "Welcome back!", session);
        }
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
            this.bot.sendMessage(chatId, `Session not found. Use ${CONSTANTS.COMMANDS.START} to begin.`, session);
            return {chatId: null, session: null};
        }

        return { chatId, session };

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
    async handleFaqCommand(msg: Message): Promise<void> {

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

        if(!chatId || !session){
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

        const id:string = Encryption.encryptAES(session.id, APP_CRYPTOGRAPHIC_KEY);

        const username:string = Encryption.encryptAES(session.username, APP_CRYPTOGRAPHIC_KEY);

        const oauthURL:string = `${DERIV_APP_LOGIN_URL}?id=${id}&username=${username}`;

        return [
            [{ text: '🔒 LOGIN', url:  oauthURL}],
            [{ text: '🚫 CANCEL', callback_data: 'exec_cancel' }],
        ];

    }

    getAccountTypeKeyboard(userAccounts:any): KeyboardButton[][] | string [][] {
        //TODO ; generate it from the user
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