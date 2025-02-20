import TelegramBot from "node-telegram-bot-api";
import Datastore from "nedb";
import { Worker } from "worker_threads";
import { env } from "@/common/utils/envConfig";
import { extractAmount, formatToMoney, isCurrency } from "@/common/utils/snippets";
import { pino } from "pino";

const logger = pino({ name: "TelegramBot" });

const { TELEGRAM_BOT_TOKEN, TELEGRAM_SESSION_DB } = env;

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
    private bot: TelegramBot;
    private sessionsDB: Datastore;

    private collectedDigits: string = '';

    constructor() {
        logger.info("Initializing...");
        if (!TELEGRAM_BOT_TOKEN) {
            throw new Error("Telegram bot token is not defined in environment variables.");
        }
        this.bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
        this.sessionsDB = new Datastore({ filename: `./src/db/sessions/${TELEGRAM_SESSION_DB}`, autoload: true });
        this.initializeBot();

        
    }

    private initializeBot(): void {
        this.bot.onText(/\/start/, (msg: TelegramBot.Message) => this.handleStartCommand(msg));
        this.bot.onText(/\/stats/, (msg: TelegramBot.Message) => this.handleStatisticsCommand(msg));
        this.bot.onText(/\/pause/, (msg: TelegramBot.Message) => this.handlePauseCommand(msg));
        this.bot.onText(/\/cancel/, (msg: TelegramBot.Message) => this.handleCancelCommand(msg));
        this.bot.on("message", (msg: TelegramBot.Message) => this.handleMessage(msg));
        this.bot.on("polling_error", (error: any) => this.handlePollingError(error));

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

            const imageUrl = "https://img.freepik.com/free-vector/flying-hummingbird-realistic-concept-with-beautiful-flower-vector-illustration_1284-70314.jpg?t=st=1739800827~exp=1739804427~hmac=fb68c8e1106d840eb2110c473dcd11fe1351953897247fab783c0ac1c2596dac&w=1024";
            const caption = `
🚀 *The Future of Trading!* 🚀

🌟 *Why Choose Us?* 🌟

- *Advanced Algorithms*: Our bots use cutting-edge technology to maximize your profits.

- *24/7 Support*: We're here to help you anytime, anywhere.

- *Secure & Reliable*: Your data and investments are safe with us.

📈 *Start Trading Today!* 📈
      `;

            this.bot.sendPhoto(chatId, imageUrl, { caption: caption, parse_mode: "Markdown" });
            this.sendKeyboard(chatId, "Please select the type of trading:", this.getTradingTypeKeyboard());
        });
    }

    private handleStatisticsCommand(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        this.sessionsDB.remove({ chatId }, {}, (err: any) => {
            if (err) {
                logger.error(`Error gettings statistics: ${err}`);
                return;
            }
            this.bot.sendMessage(chatId, "Bot statistics");
        });
    }

    private handlePauseCommand(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        this.sessionsDB.remove({ chatId }, {}, (err: any) => {
            if (err) {
                logger.error(`Error pausing trade: ${err}`);
                return;
            }
            this.bot.sendMessage(chatId, "Your trades have been paused. Use /resume to continue again.");
        });
    }

    private handleCancelCommand(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        this.sessionsDB.remove({ chatId }, {}, (err: any) => {
            if (err) {
                logger.error(`Error removing session: ${err}`);
                return;
            }
            this.bot.sendMessage(chatId, "Your session has been reset. Use /start to begin again.");
        });
    }

    private handleMessage(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        const text: string = msg.text || '';

        this.sessionsDB.findOne({ chatId }, (err: Error | null, session: Session) => {
            if (err || !session) {
                this.bot.sendMessage(chatId, "Session not found. Use /start to begin.");
                logger.error(`Session not found. Use /start to begin: ChaitID:${chatId}`);
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
        this.sendKeyboard(chatId, "Select the desired market:", this.getMarketKeyboard(text));
    }

    private handleMarketSelection(chatId: number, text: string, session: Session): void {
        session.market = text;
        session.step = "select_purchase_type";
        this.updateSession(chatId, session);
        this.sendKeyboard(chatId, "Select the purchase type:", this.getPurchaseTypeKeyboard(session.tradingType));
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
        this.bot.sendMessage(chatId, `An error occurred. Please try again later: ${message}`);
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
                this.bot.sendMessage(chatId, errorMessage);
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
            this.bot.sendMessage(chatId, errorMessage);
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
      ⚠️ Please confirm your trade:

      🔹 Market: ${session.market}

      🔹 Purchase Type: ${session.purchaseType}
      🔹 Stake: ${formatToMoney(session.stake)}
      🔹 Take Profit: ${formatToMoney(session.takeProfit)}
      🔹 Stop Loss: ${formatToMoney(session.stopLoss)}

      🔹 Duration: ${session.tradeDuration}
      🔹 Update Frequency: ${session.updateFrequency}

      Type /confirm to proceed or /cancel to reset.
    `;

        this.showTradeConfirmKeyboard(chatId, confirmationMessage);

    }

    private handleTradeConfirmation(chatId: number, text: string, session: Session): void {
        if (text === "/confirm" || text === "✅ Confirm Trade") {
            const worker = new Worker("./src/classes/deriv/tradeWorker.js", { workerData: { session } });

            worker.on("message", (message) => {
                this.bot.sendMessage(chatId, message);
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
            this.bot.sendMessage(chatId, "Trade not confirmed. Use /start to begin again.");
        }
    }

    private sendKeyboard(chatId: number, message: string, keyboard: string[][] | KeyboardButton[][] | KeyboardButton[] | KeyboardButton, isOneTimeKeyboard: boolean = true): void {
        this.bot.sendMessage(chatId, message, {
            reply_markup: {
                keyboard: keyboard,
                resize_keyboard: true,
                one_time_keyboard: isOneTimeKeyboard,
            },
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

    private getTradingTypeKeyboard(): string[][] {
        return [
            ["Forex 🌍", "Derivatives 📊"],
            ["Crypto ₿", "Commodities 🛢️"],
        ];
    }

    private getMarketKeyboard(tradingType: string): string[][] {
        switch (tradingType) {
            case "Forex 🌍":
                return [
                    ["AUD/JPY 🇦🇺🇯🇵", "AUD/USD 🇦🇺🇺🇸"],
                    ["EUR/AUD 🇪🇺🇦🇺", "EUR/CAD 🇪🇺🇨🇦"],
                    ["EUR/CHF 🇪🇺🇨🇭", "EUR/GBP 🇪🇺🇬🇧"],
                    ["EUR/JPY 🇪🇺🇯🇵", "EUR/USD 🇪🇺🇺🇸"],
                    ["GBP/AUD 🇬🇧🇦🇺", "GBP/JPY 🇬🇧🇯🇵"],
                    ["GBP/USD 🇬🇧🇺🇸", "USD/CAD 🇺🇸🇨🇦"],
                    ["USD/CHF 🇺🇸🇨🇭", "USD/JPY 🇺🇸🇯🇵"]
                ];
            case "Derivatives 📊":
                return [
                    ["Volatility 10 📈", "Volatility 10(1s) 📈"],
                    ["Volatility 25 📈", "Volatility 25(1s) 📈"],
                    ["Volatility 50 📈", "Volatility 50(1s) 📈"],
                    ["Volatility 75 📈", "Volatility 75(1s) 📈"],
                    ["Volatility 100 📈", "Volatility 100(1s) 📈"],
                ];
            case "Crypto ₿":
                return [["BTC/USD 💵 ₿", "ETH/USD 💵 Ξ"]];
            case "Commodities 🛢️":
                return [
                    ["Gold/USD 💵 🥇", "Palladium/USD 💵 🛢️"],
                    ["Platinum/USD 💵 ⚪", "Silver/USD 💵 🥈"],
                ];
            default:
                return [];
        }
    }

    private getPurchaseTypeKeyboard(tradingType?: string): string[][] {
        if (tradingType === "Forex 🌍" || tradingType === "Crypto ₿" || tradingType === "Commodities 🛢️") {
            return [["Auto Rise/Fall ⬆️⬇️", "Rise ⬆️", "Fall ⬇️"]];
        } else if (tradingType === "Derivatives 📊") {
            return [
                ["Auto ⬆️⬇️", "Rise ⬆️", "Fall ⬇️"],
                ["Digits Auto 🎲", "Digits Evens 1️⃣", "Digits Odds 0️⃣"],
                ["Digits ⬇️9️⃣", "Digits ⬇️8️⃣"],
                ["Digits ⬇️7️⃣", "Digits ⬇️6️⃣"],
                ["Digits ⬆️0️⃣", "Digits ⬆️1️⃣"],
                ["Digits ⬆️2️⃣", "Digits ⬆️3️⃣"],
                ["Digit NOT Last 🔚", "Digit NOT Random 🎲"],
            ];
        }
        return [];
    }

    private getNumericInputKeyboard(): string[][] {
        return [
            ["$0.35", "$0.50", "$0.75"],
            ["$1.00", "$2.00", "$5.00"],
            ["$10.00", "$15.00", "$20.00"],
            ["$25.00", "$50.00", "$75.00"],
            ["$100.00", "$200.00", "$500.00"],
            ["$750.00", "$1,000.00", "$2,000.00"],
            ["$2,500.00", "Automatic", "$5,000.00"],
        ];
    }

    private getDurationKeyboard(): string[][] {
        return [
            ["1min ⏱️", "2min ⏱️", "5min ⏱️", "10min ⏱️"],
            ["15min ⏱️", "30min ⏱️", "1hr ⏱️", "2hrs ⏱️"],
            ["4hrs ⏱️", "8hrs ⏱️", "12hrs ⏱️", "18hrs ⏱️"],
            ["24hrs ⏱️"],
        ];
    }
    private getTradeConfirmKeyboard(): string[][] {
        return [
            ["✅ Confirm Trade", "❌ Cancel Trade"],
        ];
    }

}

export default HummingBirdTradingBot;