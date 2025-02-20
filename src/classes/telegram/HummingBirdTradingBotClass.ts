import TelegramBot, { KeyboardButton } from "node-telegram-bot-api";

import Datastore from "nedb";
import { Worker } from "worker_threads";
import { env } from "@/common/utils/envConfig";
import { extractAmount, formatToMoney, isCurrency } from "@/common/utils/snippets";
import { pino } from "pino";

const logger = pino({ name: "TelegramBot" });

const { TELEGRAM_BOT_TOKEN, TELEGRAM_SESSION_DB, IMAGE_BANNER } = env;

const LABELS = {
    TRADING_TYPES: {
        FOREX: "Forex 🌍",
        DERIVATIVES: "Derivatives 📊",
        CRYPTO: "Crypto ₿",
        COMMODITIES: "Commodities 🛢️",
    },
    MARKETS: {
        FOREX: [
            ["AUD/JPY 🇦🇺🇯🇵", "AUD/USD 🇦🇺🇺🇸"],
            ["EUR/AUD 🇪🇺🇦🇺", "EUR/CAD 🇪🇺🇨🇦"],
            ["EUR/CHF 🇪🇺🇨🇭", "EUR/GBP 🇪🇺🇬🇧"],
            ["EUR/JPY 🇪🇺🇯🇵", "EUR/USD 🇪🇺🇺🇸"],
            ["GBP/AUD 🇬🇧🇦🇺", "GBP/JPY 🇬🇧🇯🇵"],
            ["GBP/USD 🇬🇧🇺🇸", "USD/CAD 🇺🇸🇨🇦"],
            ["USD/CHF 🇺🇸🇨🇭", "USD/JPY 🇺🇸🇯🇵"],
        ],
        DERIVATIVES: [
            ["Volatility 10 📈", "Volatility 10(1s) 📈"],
            ["Volatility 25 📈", "Volatility 25(1s) 📈"],
            ["Volatility 50 📈", "Volatility 50(1s) 📈"],
            ["Volatility 75 📈", "Volatility 75(1s) 📈"],
            ["Volatility 100 📈", "Volatility 100(1s) 📈"],
        ],
        CRYPTO: [["BTC/USD 💵 ₿", "ETH/USD 💵 Ξ"]],
        COMMODITIES: [["Gold/USD 💵 🥇", "Palladium/USD 💵 🛢️"], ["Platinum/USD 💵 ⚪", "Silver/USD 💵 🥈"]],
    },
    PURCHASE_TYPES: {
        GENERAL: [["Auto Rise/Fall ⬆️⬇️", "Rise ⬆️", "Fall ⬇️"]],
        DERIVATIVES: [
            ["Auto ⬆️⬇️", "Rise ⬆️", "Fall ⬇️"],
            ["Digits Auto 🎲", "Digits Evens 1️⃣", "Digits Odds 0️⃣"],
            ["Digits ⬇️9️⃣", "Digits ⬇️8️⃣"],
            ["Digits ⬇️7️⃣", "Digits ⬇️6️⃣"],
            ["Digits ⬆️0️⃣", "Digits ⬆️1️⃣"],
            ["Digits ⬆️2️⃣", "Digits ⬆️3️⃣"],
            ["Digit NOT Last 🔚", "Digit NOT Random 🎲"],
        ],
    },
    NUMERIC_INPUT: [
        ["$0.35", "$0.50", "$0.75"],
        ["$1.00", "$2.00", "$5.00"],
        ["$10.00", "$15.00", "$20.00"],
        ["$25.00", "$50.00", "$75.00"],
        ["$100.00", "$200.00", "$500.00"],
        ["$750.00", "$1,000.00", "$2,000.00"],
        ["$2,500.00", "Automatic", "$5,000.00"],
    ],
    DURATION: [
        ["1min ⏱️", "2min ⏱️", "5min ⏱️", "10min ⏱️"],
        ["15min ⏱️", "30min ⏱️", "1hr ⏱️", "2hrs ⏱️"],
        ["4hrs ⏱️", "8hrs ⏱️", "12hrs ⏱️", "18hrs ⏱️"],
        ["24hrs ⏱️"],
    ],
    TRADE_CONFIRM: [["✅ Confirm Trade", "❌ Cancel Trade"]],
};

interface Session {
    chatId: number;
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
}

class HummingBirdTradingBot {

    private telegramBot: TelegramBot;
    private sessionsDB: Datastore;

    constructor() {
        logger.info("Initializing...");
        if (!TELEGRAM_BOT_TOKEN) {
            throw new Error("Telegram bot token is not defined in environment variables.");
        }
        this.telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
        this.sessionsDB = new Datastore({ filename: `./src/db/sessions/${TELEGRAM_SESSION_DB}`, autoload: true });
        this.initializeBot();

        
    }

    private initializeBot(): void {
        this.telegramBot.onText(/\/start/, (msg: TelegramBot.Message) => this.handleStartCommand(msg));
        this.telegramBot.onText(/\/stats/, (msg: TelegramBot.Message) => this.handleStatisticsCommand(msg));
        this.telegramBot.onText(/\/pause/, (msg: TelegramBot.Message) => this.handlePauseCommand(msg));
        this.telegramBot.onText(/\/cancel/, (msg: TelegramBot.Message) => this.handleCancelCommand(msg));
        this.telegramBot.on("message", (msg: TelegramBot.Message) => this.handleMessage(msg));
        this.telegramBot.on("polling_error", (error: any) => this.handlePollingError(error));

        setInterval(() => this.cleanupInactiveSessions(), 60 * 1000);

        logger.info("TelegramBot initialized");
    }

    private handleStartCommand(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        const session: Session = { chatId, step: "select_trading_type", timestamp: Date.now() };

        this.sessionsDB.update({ chatId }, session, { upsert: true }, (err: any) => {
            if (err) {
                logger.error(`Error initializing session: ${err}`);
                return;
            }

            const imageUrl = IMAGE_BANNER;
            const caption = `
🚀 *The Future of Trading!* 🚀

🌟 *Why Choose Us?* 🌟

- *Advanced Algorithms*: Our bots use cutting-edge technology to maximize your profits.

- *24/7 Support*: We're here to help you anytime, anywhere.

- *Secure & Reliable*: Your data and investments are safe with us.

📈 *Start Trading Today!* 📈
      `;

            this.telegramBot.sendPhoto(chatId, imageUrl, { caption: caption, parse_mode: "Markdown" });
            this.sendKeyboard(chatId, "Please select the type of trading:", this.getTradingTypeKeyboard());
        });
    }

    private handleStatisticsCommand(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        const documentPath:string = `./src/docs/pdf/demo.pdf`;
        this.telegramBot.sendDocument(chatId, documentPath);
    }

    private handlePauseCommand(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        this.sessionsDB.remove({ chatId }, {}, (err: any) => {
            if (err) {
                this.handleError(chatId, `Error pausing trade: ${err}`);
                return;
            }
            this.telegramBot.sendMessage(chatId, "Your trades have been paused. Use /resume to continue again.");
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
            this.handleError(chatId, `Your session has been reset. Use /start to begin again.`);
        });
    }

    private handleMessage(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        const text: string = msg.text || '';

        this.sessionsDB.findOne({ chatId }, (err: Error | null, session: Session) => {
            if (err || !session) {
                this.handleError(chatId, `Session not found. Use /start to begin.`);
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
                case "confirm_trade":
                    this.handleTradeConfirmation(chatId, text, session);
                    break;
            }
        });
    }

    private handleTradingTypeSelection(chatId: number, text: string, session: Session): void {
        session.tradingType = text;
        session.step = "select_market";
        this.updateSession(chatId, session);
        this.showMarketTypeKeyboard(chatId, session.tradingType);
    }

    private handleMarketSelection(chatId: number, text: string, session: Session): void {
        session.market = text;
        session.step = "select_purchase_type";
        this.updateSession(chatId, session);
        this.showPurchaseTypeKeyboard(chatId, session.tradingType);
    }

    private handlePurchaseTypeSelection(chatId: number, text: string, session: Session): void {
        session.purchaseType = text;
        session.step = "enter_stake";
        this.updateSession(chatId, session);
        this.showBaseStakeKeyboard(chatId);
    }


    private getAutomaticStake(): number {

        return 1;

    }

    private showMarketTypeKeyboard(chatId: number, tradingType: any ): void {

        this.sendKeyboard(chatId, "Select the desired market:", this.getMarketKeyboard(tradingType));

    }

    private showPurchaseTypeKeyboard(chatId: number, tradingType: string | undefined): void {

        this.sendKeyboard(chatId, "Select the purchase type:", this.getPurchaseTypeKeyboard(tradingType));

    }

    private showBaseStakeKeyboard(chatId: number): void {

        this.sendKeyboard(chatId, "Please enter the Base Stake or Investment amount (USD):", this.getNumericInputKeyboard(), true);

    }

    private showTakeProfitThresholdKeyboard(chatId: number): void {

        this.sendKeyboard(chatId, "Please enter your Take Profit amount (USD):", this.getNumericInputKeyboard(), true);

    }

    private showStopLossThresholdKeyboard(chatId: number): void {

        this.sendKeyboard(chatId, "Please enter your Stop Loss amount (USD):", this.getNumericInputKeyboard(), true);

    }

    private showTradeDurationKeyboard(chatId: number): void {

        this.sendKeyboard(chatId, "How long should this trade last?", this.getDurationKeyboard(), true);

    }

    private showTradeUpdateFrequencyKeyboard(chatId: number): void {

        this.sendKeyboard(chatId, "How long should you get the trade updates?", this.getDurationKeyboard(), true);

    }

    private showTradeConfirmKeyboard(chatId: number, message: string): void {

        this.sendKeyboard(chatId, message, this.getTradeConfirmKeyboard(), true);

    }

    private handleError(chatId: number, message: string): void {
        this.telegramBot.sendMessage(chatId, `An error occurred. Please try again later: ${message}`);
        logger.error(`Error: ${message}: ChaitID:${chatId}`);
    }

    private validateAndUpdateAmount(chatId: number, text: string, session: Session, field: keyof Session, nextStep: string, errorMessage: string, showNextKeyboard: any, showCurrentKeyboard: any): void {
        if (text === "Automatic") {
            session[field] = this.getAutomaticStake(session.step);
            session.step = nextStep;
            this.updateSession(chatId, session);
            showNextKeyboard();
            return;
        }
        if (isCurrency(text)) {
            const amount = extractAmount(text);
            const value = parseFloat(`${amount}`);
            if (isNaN(value) || value <= 0) {
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

    private handleStakeInput(chatId: number, text: string, session: Session): void {

        this.validateAndUpdateAmount(chatId, text, session, 'stake', 'enter_take_profit', 'You have entered an invalid amount.', () => this.showTakeProfitThresholdKeyboard(chatId), () => this.showBaseStakeKeyboard(chatId));

    }

    private handleTakeProfitInput(chatId: number, text: string, session: Session): void {

        this.validateAndUpdateAmount(chatId, text, session, 'takeProfit', 'enter_stop_loss', 'You have entered an invalid amount.', () => this.showStopLossThresholdKeyboard(chatId), () => this.showTakeProfitThresholdKeyboard(chatId));

    }

    private handleStopLossInput(chatId: number, text: string, session: Session): void {

        this.validateAndUpdateAmount(chatId, text, session, 'stopLoss', 'select_trade_duration', 'You have entered an invalid amount.', () => this.showTradeDurationKeyboard(chatId), () => this.showStopLossThresholdKeyboard(chatId));

    }

    private handleTradeDurationSelection(chatId: number, text: string, session: Session): void {
        session.tradeDuration = text;
        session.step = "select_update_frequency";
        this.updateSession(chatId, session);
        this.showTradeUpdateFrequencyKeyboard(chatId);
    }

    private handleUpdateFrequencySelection(chatId: number, text: string, session: Session): void {
        session.updateFrequency = text;
        session.step = "confirm_trade";
        this.updateSession(chatId, session);

        const confirmationMessage = `
      ⚠️ *Please confirm your trade:*

      🔹 *Market:* ${session.market}

      🔹 *Purchase Type:* ${session.purchaseType}
      🔹 *Stake:* ${formatToMoney(session.stake)}
      🔹 *Take Profit:* ${formatToMoney(session.takeProfit)}
      🔹 *Stop Loss:* ${formatToMoney(session.stopLoss)}

      🔹 *Duration:* ${session.tradeDuration}
      🔹 *Update Frequency:* ${session.updateFrequency}
      
      Type /confirm to proceed or /cancel to reset.
    `;

        this.showTradeConfirmKeyboard(chatId, confirmationMessage);

    }

    private handleTradeConfirmation(chatId: number, text: string, session: Session): void {
        if (text === "/confirm" || text === "✅ Confirm Trade") {
            const worker = new Worker("./src/classes/deriv/tradeWorker.js", { workerData: { session } });

            worker.on("message", (message) => {
                this.telegramBot.sendMessage(chatId, message);
            });

            worker.on("error", (error) => {
                const errorMessage: string = `Worker error: ${error.message}`;
                this.handleError(chatId, errorMessage);
            });

            worker.on("exit", (code) => {
                if (code !== 0) {
                    const errorMessage: string = `Trade Worker stopped with exit code ${code}`;
                    this.handleError(chatId, errorMessage);
                }
            });
        } else {
            this.telegramBot.sendMessage(chatId, "Trade not confirmed. Use /start to begin again.");
        }
    }

    private sendKeyboard(chatId: number, message: string, keyboard: KeyboardButton[][], isOneTimeKeyboard: boolean = true): void {
        this.telegramBot.sendMessage(chatId, message, {
            reply_markup: {
                keyboard: keyboard,
                resize_keyboard: true,
                one_time_keyboard: isOneTimeKeyboard,
            },
            parse_mode: "Markdown"
        });
    }

    private updateSession(chatId: number, session: Session): void {
        this.sessionsDB.update({ chatId }, session, {}, (err: any) => {
            if (err) logger.error(`Error updating session: ${err}`);
        });
    }

    private handlePollingError(error: Error): void {
        logger.error(`Polling error: ${error.message}`);
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

    private getTradingTypeKeyboard(): KeyboardButton[][] {
        return [
            [LABELS.TRADING_TYPES.FOREX, LABELS.TRADING_TYPES.DERIVATIVES],
            [LABELS.TRADING_TYPES.CRYPTO, LABELS.TRADING_TYPES.COMMODITIES],
        ];
    }

    private getMarketKeyboard(tradingType: keyof typeof LABELS.MARKETS): KeyboardButton[][] {
        return LABELS.MARKETS[tradingType] as KeyboardButton[][];
    }

    private getPurchaseTypeKeyboard(tradingType?: string): KeyboardButton[][] {
        return tradingType === LABELS.TRADING_TYPES.DERIVATIVES ? LABELS.PURCHASE_TYPES.DERIVATIVES : LABELS.PURCHASE_TYPES.GENERAL;
    }

    private getNumericInputKeyboard(): KeyboardButton[][] {
        return LABELS.NUMERIC_INPUT;
    }

    private getDurationKeyboard(): KeyboardButton[][] {
        return LABELS.DURATION;
    }

    private getTradeConfirmKeyboard(): KeyboardButton[][] {
        return LABELS.TRADE_CONFIRM;
    }


}

export default HummingBirdTradingBot;