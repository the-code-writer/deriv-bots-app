import type { KeyboardButton } from "node-telegram-bot-api";
import { pino } from "pino";
import { CONSTANTS } from "@/common/utils/constants";
import { env } from "@/common/utils/envConfig";
import { Encryption } from "@/classes/cryptography/EncryptionClass";

// Logger
const logger = pino({ name: "KeyboardService" });

// Environment variables
const { APP_CRYPTOGRAPHIC_KEY, DERIV_APP_LOGIN_URL } = env;


/**
 * Interface for keyboard service
 */
export interface IKeyboardService {

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
 * Keyboard service
 */
export class KeyboardService implements IKeyboardService {

    private telegramBot: any;

    constructor(telegramBot: any) {
        this.telegramBot = telegramBot;
        logger.info("Keyboard Service started!");
    }

    getLoginKeyboard(session: any): KeyboardButton[][] | string[][] | any {

        logger.warn(`getLoginKeyboard::OAUTH_SESSION`);

        const id: string = parseInt(session.accounts.telegram.id).toString();

        const username: string = session.accounts.telegram.username;

        logger.warn({id, username});

        const encid: string = Encryption.encryptAES(id, APP_CRYPTOGRAPHIC_KEY);

        const encuser: string = Encryption.encryptAES(username, APP_CRYPTOGRAPHIC_KEY);

        logger.warn({ encid, encuser });

        const oauthURL: string = `${DERIV_APP_LOGIN_URL}?encid=${encid}&encuser=${encuser}`;

        logger.warn(`OAUTH_URL ${oauthURL}`);

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
