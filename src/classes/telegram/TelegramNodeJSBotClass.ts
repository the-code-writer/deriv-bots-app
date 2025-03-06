import { Worker } from "node:worker_threads";

import Datastore from "nedb";
import TelegramBot from "node-telegram-bot-api";
import type { KeyboardButton } from "node-telegram-bot-api";
import { pino } from "pino";

import jsan from "jsan";

import { CONSTANTS } from "@/common/utils/constants";
import { env } from "@/common/utils/envConfig";
import {
    extractAmount,
    formatToMoney,
    isCurrency,
} from "@/common/utils/snippets";

const logger = pino({ name: "TelegramBot" });

const { TELEGRAM_BOT_TOKEN, TELEGRAM_SESSION_DB, IMAGE_BANNER } = env;

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

class TelegramNodeJSBot {
    private telegramBot: TelegramBot;
    private sessionsDB: Datastore;
    private workersOBJ: any;
    constructor() {
        logger.info("Initializing...");
        if (!TELEGRAM_BOT_TOKEN) {
            throw new Error(
                "Telegram bot token is not defined in environment variables."
            );
        }
        this.telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
        this.sessionsDB = new Datastore({
            filename: `./src/db/sessions/${TELEGRAM_SESSION_DB}`,
            autoload: true,
        });
        this.workersOBJ = {};
        this.init();
    }

    private init(): void {
        this.telegramBot.onText(/\/start/, (msg: TelegramBot.Message) =>
            this.handleStartCommand(msg)
        );
        this.telegramBot.onText(/\/stats/, (msg: TelegramBot.Message) =>
            this.handleStatisticsCommand(msg)
        );
        this.telegramBot.onText(/\/pause/, (msg: TelegramBot.Message) =>
            this.handlePauseCommand(msg)
        );
        this.telegramBot.onText(/\/cancel/, (msg: TelegramBot.Message) =>
            this.handleCancelCommand(msg)
        );
        this.telegramBot.on("message", (msg: TelegramBot.Message) =>
            this.handleMessage(msg)
        );
        this.telegramBot.on("polling_error", (error: any) =>
            this.handlePollingError(error)
        );

        setInterval(() => this.cleanupInactiveSessions(), 60 * 1000);

        logger.info("TelegramBot initialized");
    }

    private initializeSession(chatId: number): void {
        this.telegramBot.sendMessage(
            chatId,
            "Initialising session ..."
        );
    }

    private handleStartCommand(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        const session: Session = {
            chatId,
            step: "select_trading_type",
            timestamp: Date.now(),
        };
        session.username = msg.from;
        this.sessionsDB.update(
            { chatId },
            session,
            { upsert: true },
            (err: any) => {
                if (err) {
                    logger.error(`Error initializing session: ${err}`);
                    return;
                }

                const imageUrl = IMAGE_BANNER;
                const caption = `


*Hi ${session.username.first_name}*

*The Future of Trading Is Here! 🌟*

- *Advanced Algorithms*: Our bots use cutting-edge technology to maximize your profits.

- *24/7 Support*: We're here to help you anytime, anywhere.

- *Secure & Reliable*: Your data and investments are safe with us.

*Start Trading Today!*

🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀

`;

                this.telegramBot.sendPhoto(chatId, imageUrl, {
                    caption: caption,
                    parse_mode: "Markdown",
                });
                this.sendKeyboard(
                    chatId,
                    "Please select the type of trading:",
                    this.getTradingTypeKeyboard()
                );
            }
        );
    }

    private handleStatisticsCommand(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        this.sessionsDB.findOne(
            { chatId },
            (err: Error | null, session: Session) => {
                if (err || !session) {
                    this.handleError(chatId, `Session not found. Use ${CONSTANTS.COMMANDS.START} to begin.`);
                    return;
                } else {
                    this.generateStatement(chatId, session);
                }
            }
        );
    }

    private handlePauseCommand(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        this.sessionsDB.remove({ chatId }, {}, (err: any) => {
            if (err) {
                this.handleError(chatId, `Error pausing trade: ${err}`);
                return;
            }
            this.telegramBot.sendMessage(
                chatId,
                `Your trades have been paused. Use ${CONSTANTS.COMMANDS.RESUME} to continue again.`
            );
        });
    }

    private handleCancelCommand(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        this.sessionsDB.remove({ chatId }, {}, (err: any) => {
            if (err) {
                logger.error(`Error removing session: ${err}`);
                this.handleError(chatId, `Error removing session: ${err}`);
                return;
            }
            this.handleError(
                chatId,
                `Your session has been reset. Use ${CONSTANTS.COMMANDS.START} to begin again.`
            );
        });
    }

    private handleMessage(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        const text: string = msg.text || "";

        this.sessionsDB.findOne(
            { chatId },
            (err: Error | null, session: Session) => {
                if (err || !session) {
                    if (text === CONSTANTS.COMMANDS.START) {
                        this.initializeSession(chatId);
                    } else {
                        this.handleError(chatId, `Session not found. Use ${CONSTANTS.COMMANDS.START} to begin.`);
                    }
                    return;
                }

                switch (session.step) {
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
                        this.handleUpdateFrequencySelection(chatId, text, session);
                        break;
                    case "select_ticks_or_minutes_duration":
                        this.handleUpdateFrequencySelection(chatId, text, session);
                        break;
                    case "select_auoto_or_manual":
                        this.handleUpdateFrequencySelection(chatId, text, session);
                        break;
                    case "confirm_trade":
                        this.handleTradeConfirmation(chatId, text, session);
                        break;
                }
            }
        );
    }

    private handleTradingTypeSelection(
        chatId: number,
        text: string,
        session: Session
    ): void {
        session.tradingType = text;
        session.step = "select_market";
        this.updateSession(chatId, session);
        this.showMarketTypeKeyboard(chatId, session.tradingType);
    }

    private handleMarketSelection(
        chatId: number,
        text: string,
        session: Session
    ): void {
        session.market = text;
        session.step = "select_purchase_type";
        this.updateSession(chatId, session);
        this.showPurchaseTypeKeyboard(chatId, session.tradingType);
    }

    private handlePurchaseTypeSelection(
        chatId: number,
        text: string,
        session: Session
    ): void {
        session.purchaseType = text;
        session.step = "enter_stake";
        this.updateSession(chatId, session);
        this.showBaseStakeKeyboard(chatId);
    }

    private getAutomaticStake(step: string, nextStep: string): number {
        return 1;
    }

    private showMarketTypeKeyboard(chatId: number, tradingType: any): void {
        this.sendKeyboard(
            chatId,
            "Select the desired market:",
            this.getMarketKeyboard(tradingType)
        );
    }

    private showPurchaseTypeKeyboard(
        chatId: number,
        tradingType: string | undefined
    ): void {
        this.sendKeyboard(
            chatId,
            "Select the purchase type:",
            this.getPurchaseTypeKeyboard(tradingType)
        );
    }

    private showBaseStakeKeyboard(chatId: number): void {
        this.sendKeyboard(
            chatId,
            "Please enter the Base Stake or Investment amount (USD):",
            this.getNumericInputKeyboard(),
            true
        );
    }

    private showTakeProfitThresholdKeyboard(chatId: number): void {
        this.sendKeyboard(
            chatId,
            "Please enter your Take Profit amount (USD):",
            this.getNumericInputKeyboard(),
            true
        );
    }

    private showStopLossThresholdKeyboard(chatId: number): void {
        this.sendKeyboard(
            chatId,
            "Please enter your Stop Loss amount (USD):",
            this.getNumericInputKeyboard(),
            true
        );
    }

    private showTradeDurationKeyboard(chatId: number): void {
        this.sendKeyboard(
            chatId,
            "How long should this trade last?",
            this.getDurationKeyboard(),
            true
        );
    }

    private showTradeUpdateFrequencyKeyboard(chatId: number): void {
        this.sendKeyboard(
            chatId,
            "How long should you get the trade updates?",
            this.getDurationKeyboard(),
            true
        );
    }

    private showTradeConfirmKeyboard(chatId: number, message: string): void {
        this.sendKeyboard(chatId, message, this.getTradeConfirmKeyboard(), true);
    }

    private handleError(chatId: number, message: string): void {
        this.telegramBot.sendMessage(
            chatId,
            `An error occurred :: ${message}`
        );
        logger.error(`Error: ${message}: ChatID:${chatId}`);
    }

    private validateAndUpdateAmount(
        chatId: number,
        text: string,
        session: Session,
        field: keyof Session,
        nextStep: string,
        errorMessage: string,
        showNextKeyboard: any,
        showCurrentKeyboard: any
    ): void {
        if (text === "Automatic") {
            session[field] = this.getAutomaticStake(session.step, nextStep);
            session.step = nextStep;
            this.updateSession(chatId, session);
            showNextKeyboard();
            return;
        }
        if (isCurrency(text)) {
            const amount = extractAmount(text);
            const value = parseFloat(`${amount}`);
            if (Number.isNaN(value) || value <= 0) {
                session[field] = 0;
                this.updateSession(chatId, session);
                this.telegramBot.sendMessage(chatId, errorMessage);
                showCurrentKeyboard();
                return;
            } else {
                session[field] = value;
                session.step = nextStep;
                this.updateSession(chatId, session);
                showNextKeyboard();
                return;
            }
        } else {
            session[field] = 0;
            this.updateSession(chatId, session);
            this.telegramBot.sendMessage(chatId, errorMessage);
            showCurrentKeyboard();
            return;
        }
    }

    private handleStakeInput(
        chatId: number,
        text: string,
        session: Session
    ): void {
        this.validateAndUpdateAmount(
            chatId,
            text,
            session,
            "stake",
            "enter_take_profit",
            "You have entered an invalid amount.",
            () => this.showTakeProfitThresholdKeyboard(chatId),
            () => this.showBaseStakeKeyboard(chatId)
        );
    }

    private handleTakeProfitInput(
        chatId: number,
        text: string,
        session: Session
    ): void {
        this.validateAndUpdateAmount(
            chatId,
            text,
            session,
            "takeProfit",
            "enter_stop_loss",
            "You have entered an invalid amount.",
            () => this.showStopLossThresholdKeyboard(chatId),
            () => this.showTakeProfitThresholdKeyboard(chatId)
        );
    }

    private handleStopLossInput(
        chatId: number,
        text: string,
        session: Session
    ): void {
        this.validateAndUpdateAmount(
            chatId,
            text,
            session,
            "stopLoss",
            "select_trade_duration",
            "You have entered an invalid amount.",
            () => this.showTradeDurationKeyboard(chatId),
            () => this.showStopLossThresholdKeyboard(chatId)
        );
    }

    private handleTradeDurationSelection(
        chatId: number,
        text: string,
        session: Session
    ): void {
        session.tradeDuration = text;
        session.step = "select_update_frequency";
        this.updateSession(chatId, session);
        this.showTradeUpdateFrequencyKeyboard(chatId);
    }

    private handleUpdateFrequencySelection(
        chatId: number,
        text: string,
        session: Session
    ): void {
        session.updateFrequency = text;
        session.step = "confirm_trade";
        this.updateSession(chatId, session);

        const confirmationMessage = `
⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
      
*Please confirm your trade:*

      🔹 *Market:* ${session.market}

      🔹 *Purchase Type:* ${session.purchaseType}
      🔹 *Stake:* ${formatToMoney(session.stake)}
      🔹 *Take Profit:* ${formatToMoney(session.takeProfit)}
      🔹 *Stop Loss:* ${formatToMoney(session.stopLoss)}

      🔹 *Duration:* ${session.tradeDuration}
      🔹 *Update Frequency:* ${session.updateFrequency}
      
*Please Note:* The products offered on Deriv via this bot are complex derivative products that carry a significant risk of potential loss. CFDs are complex instruments with a high risk of losing money rapidly due to leverage. You should consider whether you understand how these products work and whether you can afford to take the high risk of losing your money.

Respond by typing

  ${CONSTANTS.COMMANDS.CONFIRM} to proceed
  ${CONSTANTS.COMMANDS.CANCEL} to reset.

©2025 DerivBots. All rights reserved.

https://derivbots.app
 
`;

        this.showTradeConfirmKeyboard(chatId, confirmationMessage);
    }

    private handleTradeConfirmation(
        chatId: number,
        text: string,
        session: Session
    ): void {

        const workerID: string = `WKR_${chatId}`;

        if (text === CONSTANTS.COMMANDS.CONFIRM || text === CONSTANTS.TRADE_CONFIRM[0][0]) {

            if (workerID in this.workersOBJ) {

                this.workersOBJ[workerID].postMessage(
                    {
                        action: "CONFIRM_TRADE",
                        text: text,
                        meta:
                        {
                            chatId,
                            text,
                            session
                        }
                    }
                )

            } else {

                this.workersOBJ[workerID] = new Worker("./src/classes/deriv/tradeWorker.js", {
                    workerData: {
                        action: "INIT_TRADE",
                        text: text,
                        meta:
                        {
                            chatId,
                            text,
                            session
                        }
                    },
                });

                this.workersOBJ[workerID].on("message", (message: any) => {
                    this.handleWorkerMessage(chatId, message);
                });

                this.workersOBJ[workerID].on("error", (error: any) => {
                    const errorMessage: string = `Worker error: ${error.message}`;
                    delete this.workersOBJ[workerID];
                    this.handleError(chatId, errorMessage);
                });

                this.workersOBJ[workerID].on("exit", (code: number) => {
                    if (code !== 0) {
                        const errorMessage: string = `Trade Worker stopped with exit code ${code}`;
                        delete this.workersOBJ[workerID];
                        this.handleError(chatId, errorMessage);
                    }
                });

            }

        } else {

            this.telegramBot.sendMessage(
                chatId,
                `Trade not confirmed. Use ${CONSTANTS.COMMANDS.START} to begin again.`
            );

        }
    }

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
            this.handleError(
                chatId,
                "Could not generate your statement. Please try again later."
            );
        }
    }

    private handleWorkerMessage(chatId:number, message:any): any {

        console.log("WORKER_MESSAGE::", message);

        switch(message.action){

            case "sendTelegramMessage" : {
                if(message.text !== ""){
                    this.telegramBot.sendMessage(chatId, message.text);
                }
                break;
            }

            default : { 
                console.log("UNHANDLED_WORKER_MESSAGE::");
                break;
            }
        }

    }

    private sendKeyboard(
        chatId: number,
        message: string,
        keyboard: string[][] | KeyboardButton[][],
        isOneTimeKeyboard = true
    ): void {
        this.telegramBot.sendMessage(chatId, message, {
            reply_markup: {
                keyboard: keyboard as KeyboardButton[][],
                resize_keyboard: true,
                one_time_keyboard: isOneTimeKeyboard,
            },
            parse_mode: "Markdown",
        });
    }

    private updateSession(chatId: number, session: Session): void {
        this.sessionsDB.update({ chatId }, session, {}, (err: any) => {
            if (err) logger.error(`Error updating session: ${err}`);
        });
    }

    private handlePollingError(error: Error): void {
        logger.error(`Polling error: ${error.message}`);
        if (String(error.message).includes("ECONNRESET")) {

        }
    }

    private cleanupInactiveSessions(): void {
        const now = Date.now();
        this.sessionsDB.find({}, (err: Error | null, sessions: Session[]) => {
            if (err) return;

            sessions.forEach((session) => {
                if (now - (session.timestamp || 0) > 30 * 60 * 1000) {
                    this.sessionsDB.remove({ chatId: session.chatId }, {}, (err: any) => {
                        if (err) logger.error(`Error removing inactive session: ${err}`);
                    });
                }
            });
        });
    }

    private getTradingTypeKeyboard(): string[][] | KeyboardButton[][] {
        return [
            [CONSTANTS.TRADING_TYPES.FOREX, CONSTANTS.TRADING_TYPES.DERIVATIVES],
            [CONSTANTS.TRADING_TYPES.CRYPTO, CONSTANTS.TRADING_TYPES.COMMODITIES],
        ];
    }

    private getMarketKeyboard(
        tradingType: keyof typeof CONSTANTS.MARKETS
    ): string[][] | KeyboardButton[][] {
        tradingType = tradingType
            .replace(/[^a-zA-Z]/g, "")
            .toUpperCase() as keyof typeof CONSTANTS.MARKETS;
        //console.log("TRADING TYPE", tradingType);
        return CONSTANTS.MARKETS[tradingType];
    }

    private getPurchaseTypeKeyboard(tradingType?: string): string[][] | KeyboardButton[][] {
        return tradingType === CONSTANTS.TRADING_TYPES.DERIVATIVES
            ? CONSTANTS.PURCHASE_TYPES.DERIVATIVES
            : CONSTANTS.PURCHASE_TYPES.GENERAL;
    }

    private getNumericInputKeyboard(): string[][] | KeyboardButton[][] {
        return CONSTANTS.NUMERIC_INPUT;
    }

    private getDurationKeyboard(): string[][] | KeyboardButton[][] {
        return CONSTANTS.DURATION;
    }

    private getTradeConfirmKeyboard(): string[][] | KeyboardButton[][] {
        return CONSTANTS.TRADE_CONFIRM;
    }
}

export default TelegramNodeJSBot;
