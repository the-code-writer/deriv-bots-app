import TelegramBot from "node-telegram-bot-api";
import type { Message } from "node-telegram-bot-api";
// @ts-ignore
import sanitizeHtml from "sanitize-html";
import { CONSTANTS } from "@/common/utils/constants";
import { env } from "@/common/utils/envConfig";
import { ITradingProcessFlow } from "@/classes/telegram/TradingProcessFlowHandlers";
import { ITelegramBotCommandHandlers } from "@/classes/telegram/TelegramBotCommandHandlers";
import { IWorkerService } from "@/classes/telegram/WorkerService";
import { Encryption } from "@/classes/cryptography/EncryptionClass";
import { ISession, ISessionService } from "@/classes/sessions/SessionService";

import { pino } from "pino";
import { IKeyboardService } from './KeyboardService';
// Logger
const logger = pino({ name: "TelegramBotService" });

// Environment variables
const { APP_CRYPTOGRAPHIC_KEY } = env;

/**
 * Interface for Telegram bot service
 */
export interface ITelegramBotService {

    //public setupEventListeners(): void;
    handleMessage(msg: Message): Promise<void>;
    //private processSessionStep(chatId: number, text: string, session: Session): void;

}


/**
 * Telegram bot service
 */
export class TelegramBotService implements ITelegramBotService {

    private telegramBot: TelegramBot;
    private sessionService: ISessionService;
    private workerService: IWorkerService;
    private tradingProcessFlow: ITradingProcessFlow;
    private commandHandlers: ITelegramBotCommandHandlers;
    private keyboardService: IKeyboardService;

    constructor(
        telegramBot: TelegramBot,
        sessionService: ISessionService,
        workerService: IWorkerService,
        tradingProcessFlow: ITradingProcessFlow,
        commandHandlers: ITelegramBotCommandHandlers,
        keyboardService: IKeyboardService
    ) {
        this.telegramBot = telegramBot;
        this.sessionService = sessionService;
        this.workerService = workerService;
        this.tradingProcessFlow = tradingProcessFlow;
        this.commandHandlers = commandHandlers;
        this.keyboardService = keyboardService;
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
        this.telegramBot.on("polling_error", (error: any) => this.handlePollingError(error));
        this.telegramBot.on("message", (msg) => this.handleMessage(msg));
        logger.info("Bot Service started!");
    }


    /**
     * Handle polling errors
     * @param {Error} error - The error object
     * @private
     */
    private handlePollingError(error: Error): void {

        if (String(error.message).includes("ECONNRESET")) {
            // Handle ECONNRESET error
        }
        if (String(error.message).includes("ENOTFOUND")) {
            //logger.error(`Polling error: ${error.message}`);
        }
    }


    public async handleMessage(msg: Message): Promise<void> {
        const chatId = msg.chat.id;
        const firstname = msg.chat.first_name;
        const text = sanitizeHtml(msg.text || "", { allowedTags: [], allowedAttributes: {} });
        const session = await this.sessionService.getUserSessionByChatId(chatId);
        if (!session) {
            logger.error(`Session not found for chatId: ${chatId}`);  
            this.telegramBot.sendMessage(chatId, `Hey ***${firstname}!*** . Your session was not found or has expired. Creating a fresh one... 🚀`, { parse_mode: "Markdown" });
            return;
        }
        // Process session step
        await this.processSessionStep(chatId, text, session);
    }

    /**
     * Process the current step in the session
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @private
     */
    private async processSessionStep(chatId: number, text: string, sessionDocument: ISession): Promise<void> {
        const session = sessionDocument.session;
        logger.info(["# processSessionStep #", chatId, text, session.bot.tradingOptions.step])
        switch (session.bot.tradingOptions.step) {
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
            case CONSTANTS.SESSION_STEPS.SELECT_CONTRACT_TYPE:
                this.tradingProcessFlow.handleContractTypeSelection(chatId, text, session);
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
                //  1 on 1 AI session if text is not a command
                logger.info(["@@@@@@@@@@@@@@@@@@@@@@@@", chatId, text, session.bot.tradingOptions.step])
                break;
        }
    }

    public authorizeOauthData(sessionDocument: any, user:any): Promise<boolean> {

        return this.commandHandlers.authorizeOauthData(sessionDocument, user);

    }

}
