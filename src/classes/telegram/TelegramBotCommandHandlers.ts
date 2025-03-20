import type { Message, CallbackQuery } from "node-telegram-bot-api";
import { pino } from "pino";
import { CONSTANTS } from "@/common/utils/constants";
import { env } from "@/common/utils/envConfig";
import { ISessionService, Session } from "@/classes/telegram/SessionService";
import { IKeyboardService } from "@/classes/telegram/KeyboardService";
import { IWorkerService } from "@/classes/telegram/WorkerService";

// Logger
const logger = pino({ name: "TelegramBotCommandHandlers" });

// Environment variables
const { APP_CRYPTOGRAPHIC_KEY, TELEGRAM_BOT_TOKEN, IMAGE_BANNER, DERIV_APP_LOGIN_URL } = env;


/**
 * Interface for Telegram bot command handlers
 */
export interface ITelegramBotCommandHandlers {

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
 * Telegram bot command handler class
 */
export class TelegramBotCommandHandlers implements ITelegramBotCommandHandlers {

    private telegramBot: any;

    private sessionService: ISessionService;

    private keyboardService: IKeyboardService;

    private workerService: IWorkerService;

    constructor(telegramBot: any, sessionService: ISessionService, keyboardService: IKeyboardService, workerService: IWorkerService) {
        this.telegramBot = telegramBot;
        this.sessionService = sessionService;
        this.keyboardService = keyboardService;
        this.workerService = workerService;
        logger.info("Command Handlers started!");
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

        logger.info("SESSION");

        logger.info(session);

        await this.sessionService.updateSessionWithChatId(chatId, session);

        const imageUrl = IMAGE_BANNER;
        const caption = `*Hi ${session.accounts.telegram.first_name}*\n\nThe Future of Trading Is Here! 🌟`;
        this.telegramBot.sendPhoto(chatId, imageUrl, { caption, parse_mode: "Markdown" });
        setTimeout(() => {
            this.telegramBot.sendMessage(chatId, 'Please login using your Deriv Account to proceed:', {
                reply_markup: { inline_keyboard: this.keyboardService.getLoginKeyboard(session) },
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
