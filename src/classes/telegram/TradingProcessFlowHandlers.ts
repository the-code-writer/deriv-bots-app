import { pino } from "pino";
import { CONSTANTS } from "@/common/utils/constants";
import { env } from "@/common/utils/envConfig";
import { extractAmount, isCurrency } from "@/common/utils/snippets";;
import { ISessionService, Session } from "@/classes/telegram/SessionService";
import { IKeyboardService } from "@/classes/telegram/KeyboardService";
import { IWorkerService } from "@/classes/telegram/WorkerService";

// Logger
const logger = pino({ name: "TradingProcessFlowHandlers" });

// Environment variables
const { APP_CRYPTOGRAPHIC_KEY } = env;


/**
 * Interface for trading process flow handlers
 */
export interface ITradingProcessFlow {

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
 * Session service
 */
export class TradingProcessFlowHandlers implements ITradingProcessFlow {

    private telegramBot: any;

    private sessionService: ISessionService;

    private keyboardService: IKeyboardService;

    private workerService: IWorkerService;

    constructor(telegramBot: any, sessionService: ISessionService, keyboardService: IKeyboardService, workerService: IWorkerService) {
        this.telegramBot = telegramBot;
        this.sessionService = sessionService;
        this.keyboardService = keyboardService;
        this.workerService = workerService;
        logger.info("Trading Process Flow started!");
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

    public async validateAndUpdateAmount(
        chatId: number,
        text: string,
        session: Session,
        field: keyof Session,
        nextStep: string,
        errorMessage: string,
        showNextKeyboard: () => void,
        showCurrentKeyboard: () => void
    ): Promise<void> {
        if (text === "Automatic") {
            session.bot.tradingOptions[field] = this.getAutomaticStake(session.bot.tradingOptions.step, nextStep);
            session.bot.tradingOptions.step = nextStep;
            await this.sessionService.updateSessionWithChatId(chatId, session);
            showNextKeyboard();
            return;
        }
        if (isCurrency(text)) {
            const amount = extractAmount(text);
            const value = parseFloat(`${amount}`);
            if (Number.isNaN(value) || value <= 0) {
                session.bot.tradingOptions[field] = 0;
                await this.sessionService.updateSessionWithChatId(chatId, session);
                this.telegramBot.sendMessage(chatId, errorMessage);
                showCurrentKeyboard();
                return;
            } else {
                session.bot.tradingOptions[field] = value;
                session.bot.tradingOptions.step = nextStep;
                await this.sessionService.updateSessionWithChatId(chatId, session);
                showNextKeyboard();
                return;
            }
        } else {
            session.bot.tradingOptions[field] = 0;
            await this.sessionService.updateSessionWithChatId(chatId, session);
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
    public async handleLoginAccount(chatId: number, text: string, session: Session): Promise<void> {
        session.bot.tradingOptions.step = CONSTANTS.SESSION_STEPS.SELECT_ACCOUNT_TYPE;
        await this.sessionService.updateSessionWithChatId(chatId, session);
        this.keyboardService.showAccountTypeKeyboard(chatId, session.bot.accounts.deriv.accountList);
    }

    /**
     * Handle the account type selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public async handleAccountTypeSelection(chatId: number, text: string, session: Session): Promise<any> {
        session.bot.tradingOptions.accountType = text;
        session.bot.tradingOptions.step = CONSTANTS.SESSION_STEPS.SELECT_TRADING_TYPE;
        await this.sessionService.updateSessionWithChatId(chatId, session);
        const parsedAccountNumber: string = String(text.split(" ")[0]).trim();
        const accountDta: any = { selectedAccount: text, accountNumber: parsedAccountNumber, accountList: session.bot.accounts.deriv.accountList };
        this.workerService.postMessageToDerivWorker("LOGIN_DERIV_ACCOUNT", chatId, session.bot.tradingOptions.accountType, session, accountDta)
    }

    /**
     * Handle the trading type selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public async handleTradingTypeSelection(chatId: number, text: string, session: Session): Promise<void> {
        session.bot.tradingOptions.tradingType = text;
        session.bot.tradingOptions.step = CONSTANTS.SESSION_STEPS.SELECT_MARKET;
        await this.sessionService.updateSessionWithChatId(chatId, session);
        this.keyboardService.showMarketTypeKeyboard(chatId, session.bot.tradingOptions.tradingType);
    }

    /**
     * Handle the market selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public async handleMarketSelection(chatId: number, text: string, session: Session): Promise<void> {
        session.bot.tradingOptions.market = text;
        session.bot.tradingOptions.step = CONSTANTS.SESSION_STEPS.SELECT_PURCHASE_TYPE;
        await this.sessionService.updateSessionWithChatId(chatId, session);
        this.keyboardService.showPurchaseTypeKeyboard(chatId, session.bot.tradingOptions.market);
    }

    /**
     * Handle the purchase type selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public async handlePurchaseTypeSelection(chatId: number, text: string, session: Session): Promise<void> {
        session.bot.tradingOptions.purchaseType = text;
        session.bot.tradingOptions.step = CONSTANTS.SESSION_STEPS.ENTER_STAKE;
        await this.sessionService.updateSessionWithChatId(chatId, session);
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
    public async handleStakeInput(chatId: number, text: string, session: Session): Promise<void> {

        this.validateAndUpdateAmount(
            chatId,
            text,
            session,
            "stake",
            CONSTANTS.SESSION_STEPS.ENTER_TAKE_PROFIT,
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
    public async handleTakeProfitInput(chatId: number, text: string, session: Session): Promise<void> {

        this.validateAndUpdateAmount(
            chatId,
            text,
            session,
            "takeProfit",
            CONSTANTS.SESSION_STEPS.ENTER_STOP_LOSS,
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
    public async handleStopLossInput(chatId: number, text: string, session: Session): Promise<void> {

        this.validateAndUpdateAmount(
            chatId,
            text,
            session,
            "stopLoss",
            CONSTANTS.SESSION_STEPS.SELECT_TRADE_DURATION,
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
    public async handleTradeDurationSelection(chatId: number, text: string, session: Session): Promise<void> {
        session.bot.tradingOptions.tradeDuration = text;
        session.bot.tradingOptions.step = CONSTANTS.SESSION_STEPS.SELECT_UPDATE_FREQUENCY;
        await this.sessionService.updateSessionWithChatId(chatId, session);
        this.keyboardService.showUpdateFrequencyKeyboard(chatId);
    }

    /**
     * Handle the update frequency selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public async handleUpdateFrequencySelection(chatId: number, text: string, session: Session): Promise<void> {
        session.bot.tradingOptions.updateFrequency = text;
        session.bot.tradingOptions.step = CONSTANTS.SESSION_STEPS.SELECT_TICKS_OR_MINUTES;
        await this.sessionService.updateSessionWithChatId(chatId, session);
        this.keyboardService.showContractDurationUnitsKeyboard(chatId, session.bot.tradingOptions.updateFrequency);
    }

    /**
     * Handle the contract duration units selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public async handleUpdateContractDurationUnitsSelection(chatId: number, text: string, session: Session): Promise<void> {
        session.bot.tradingOptions.contractDurationUnits = text;
        session.bot.tradingOptions.step = CONSTANTS.SESSION_STEPS.SELECT_TICKS_OR_MINUTES_DURATION;
        await this.sessionService.updateSessionWithChatId(chatId, session);
        this.keyboardService.showContractDurationValueKeyboard(chatId, session.bot.tradingOptions.contractDurationUnits);
    }

    /**
     * Handle the contract duration value selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public async handleUpdateContractDurationValueSelection(chatId: number, text: string, session: Session): Promise<void> {
        session.bot.tradingOptions.contractDurationValue = text;
        session.bot.tradingOptions.step = CONSTANTS.SESSION_STEPS.SELECT_AUTO_OR_MANUAL;
        await this.sessionService.updateSessionWithChatId(chatId, session);
        this.keyboardService.showAutoManualTradingKeyboard(chatId, session.bot.tradingOptions.contractDurationValue);
    }

    /**
     * Handle the auto/manual trading selection step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public async handleAutoManualTrading(chatId: number, text: string, session: Session): Promise<void> {
        console.log("::::::: >>>>>>>> handleAutoManualTrading >>>>>>>> ::::::::::", [chatId, text, session])
        console.log("::::::: >>>>>>>> CONSTANTS.SESSION_STEPS.CONFIRM_TRADE >>>>>>>> ::::::::::", CONSTANTS.SESSION_STEPS.CONFIRM_TRADE)
        session.bot.tradingOptions.tradingMode = text;
        session.bot.tradingOptions.step = CONSTANTS.SESSION_STEPS.CONFIRM_TRADE;
        await this.sessionService.updateSessionWithChatId(chatId, session);
        this.keyboardService.showTradeConfirmationKeyboard(chatId, session.bot.tradingOptions.tradingMode);
    }

    /**
     * Handle the trade confirmation step
     * @param {number} chatId - The chat ID of the user
     * @param {string} text - The text of the message
     * @param {Session} session - The current session
     * @public
     */
    public async handleTradeConfirmation(chatId: number, text: string, session: Session): Promise<void> {
        console.log("::::::: >>>>>>>> handleTradeConfirmation >>>>>>>> ::::::::::", [chatId, text, session])
        console.log("::::::: >>>>>>>> CONSTANTS.COMMANDS.CONFIRM >>>>>>>> ::::::::::", [(text === CONSTANTS.COMMANDS.CONFIRM), CONSTANTS.COMMANDS.CONFIRM, text])
        console.log("::::::: >>>>>>>> CONSTANTS.SESSION_STEPS.CONFIRM_TRADE >>>>>>>> ::::::::::", CONSTANTS.SESSION_STEPS.CONFIRM_TRADE)
        if (text === CONSTANTS.COMMANDS.CONFIRM) {
            this.workerService.postMessageToDerivWorker(CONSTANTS.SESSION_STEPS.CONFIRM_TRADE, chatId, "", session);
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
    public async handleTradeManual(chatId: number, text: string, session: Session): Promise<void> {
        console.log("::::::: >>>>>>>> handleTradeManual >>>>>>>> ::::::::::", [chatId, text, session])
        console.log("::::::: >>>>>>>> CONSTANTS.COMMANDS.CONFIRM >>>>>>>> ::::::::::", [(text === CONSTANTS.COMMANDS.CONFIRM), CONSTANTS.COMMANDS.CONFIRM, text])
        console.log("::::::: >>>>>>>> CONSTANTS.SESSION_STEPS.CONFIRM_TRADE >>>>>>>> ::::::::::", CONSTANTS.SESSION_STEPS.CONFIRM_TRADE)
        if (text === CONSTANTS.COMMANDS.CONFIRM) {
            this.workerService.postMessageToDerivWorker(CONSTANTS.SESSION_STEPS.CONFIRM_TRADE, chatId, "", session);
        } else {
            this.telegramBot.sendMessage(chatId, `Trade not confirmed. Use ${CONSTANTS.COMMANDS.START} to begin again.`);
        }
    }

}
