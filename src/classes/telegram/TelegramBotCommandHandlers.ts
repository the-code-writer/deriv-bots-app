import type { Message, CallbackQuery } from "node-telegram-bot-api";
import { pino } from "pino";
import { CONSTANTS } from "@/common/utils/constants";
import { env } from "@/common/utils/envConfig";
import { ISessionService, Session } from "@/classes/telegram/SessionService";
import { IKeyboardService } from "@/classes/telegram/KeyboardService";
import { IWorkerService } from "@/classes/telegram/WorkerService";
import { IUserService } from "../user/UserInterfaces";

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

    private userService: IUserService;

    constructor(telegramBot: any, sessionService: ISessionService, keyboardService: IKeyboardService, workerService: IWorkerService, userService:IUserService) {
        this.telegramBot = telegramBot;
        this.sessionService = sessionService;
        this.keyboardService = keyboardService;
        this.workerService = workerService;
        this.userService = userService;
        logger.info("Command Handlers started!");
    }

    /**
     * Handle the /confirm command
     * @param {Message} chatId - The message object from Telegram
     */
    async getUserChatSession(chatId: number): Promise<any> {

        const session = await this.sessionService.getUserSessionByChatId(chatId);

        return session;

    }

    /**
     * Handle the /confirm command
     * @param {Message} msg - The message object from Telegram
     */
    async getChatSession(msg: Message): Promise<any> {

        const chatId = msg.chat.id;

        const session = await this.getUserChatSession(chatId);

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
        } else {
            
        }

        this.telegramBot.answerCallbackQuery(callbackQuery.id);
    }


    /**
     * Handle the /start command
     * @param {Message} msg - The message object from Telegram
     */
    async handleStartCommand(msg: Message): Promise<void> {

        const chatId = msg.chat.id;

        let session = await this.getUserChatSession(chatId);

        console.log(":::: BOT_SESSION_FROM_DB :::: 000", session);

        if(!session){
                
            session = await this.sessionService.createSession(chatId, msg.from);

        }
        
        console.log(":::: BOT_SESSION_FROM_DB :::: 111", session);

        const user = await this.userService.getUserByChat(chatId);

        console.log(":::: USER_ACCOUNT_FROM_DB :::: 222", user); 

        if(!user){

            this.telegramBot.sendMessage(chatId, `Link your Deriv account to start. Please note, you will be taken to an external Url to authorize this Telegram Bot (Nduta.X) on your Deriv Account.`, {
                reply_markup: { inline_keyboard: this.keyboardService.getLoginKeyboard(session.session.bot) },
            });

        } else {

            await bot.authorizeOauthData(sessionData);
            
        }

        return;

    }

    /**
     * Handle the /confirm command
     * @param {Message} msg - The message object from Telegram
     */
    async handleConfirmCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {

            // send the message that the session has expired

            // TODO: this.isSessionValid(session)

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

        //this.showCommandMenuHelp();

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

        // User enters amount to withdraw, less than the balance to a paymnt method specified in the menu

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

        // Deposit via api

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

        // wallet details

        // /wallet create

        // /wallet close

        // /wallet withdraw

        // /wallet deposit

        // /wallet balance

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

        // /accounts use

        // /accounts list

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

        // /profile details

        // /profie PDF

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

        // /settings

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

        // /logout

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

        // /status

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

        // /history PDF

        // /history summary

        // /history 3 weeks, 1hr, 2days, last year

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

        // /balance

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

        // /info or /about

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

        // /support chat

        // /support bot

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

        // /update

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

        // /news list

        // /news 4

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

        // /alerts

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

        // /risks

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

        // /strategies

        // /strategies 5

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

        // /faq

        // /faq 8

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

        // /telemetry

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

        // /profits

        // /profits table

        // /profits PDF

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

        // /statement

        // /statement PDF

        // Display statement information
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.STATEMENT, chatId, "", session);
    }

    
        /**
         * Generate a statement for the user
         * @param {number} chatId - The chat ID of the user
         * @param {Session} session - The current session
         * @private

        private generateStatement(chatId: number, session: Session): void {
            if (chatId && session) {
                const worker = new Worker("./src/classes/deriv/statementWorker.mjs", {
                    workerData: { session },
                });
    
                worker.on("message", (result) => {
                    this.telegramBot.sendMessage(chatId, result);
                    if (result.status === "success") {
                        this.telegramBot.sendMessage(chatId, "Your statement is ready!");
                        this.telegramBot.sendDocument(chatId, result.filename);
                    } else {
                        this.handleError(chatId, result.message);
                    }
                });
    
                worker.on("error", (error) => {
                    const errorMessage: string = `Worker error: ${error.message}`;
                    this.handleError(chatId, errorMessage);
                });
    
                worker.on("exit", (code) => {
                    if (code !== 0) {
                        const errorMessage: string = `Statement Worker stopped with exit code ${code}`;
                        this.handleError(chatId, errorMessage);
                    }
                });
            } else {
                this.handleError(chatId, "Could not generate your statement. Please try again later.");
            }
        }

                 */
    

    /**
     * Handle the /reset command
     * @param {Message} msg - The message object from Telegram
     */
    async handleResetCommand(msg: Message): Promise<void> {

        const { chatId, session } = await this.getChatSession(msg);

        if (!chatId || !session) {
            return;
        }

        // /reset

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

        // /pricing



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

        // /subscribe list

        // /subscribe free | basic | pro | premium

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

        // /health 

        // Perform a health check
        this.workerService.postMessageToDerivWorker(CONSTANTS.COMMANDS.HEALTH_CHECK, chatId, "", session);
    }
    
}
