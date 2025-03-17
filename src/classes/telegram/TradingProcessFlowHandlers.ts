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
