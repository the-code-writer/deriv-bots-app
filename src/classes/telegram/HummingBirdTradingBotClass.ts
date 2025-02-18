import TelegramBot from "node-telegram-bot-api";
import Datastore from "nedb";
import { Worker } from "worker_threads";
import fs from "fs";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

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

    constructor() {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
            throw new Error("Telegram bot token is not defined in environment variables.");
        }
        this.bot = new TelegramBot(token, { polling: true });
        this.sessionsDB = new Datastore({ filename: "sessions.db", autoload: true });

        this.initializeBot();
    }

    private initializeBot(): void {
        this.bot.onText(/\/start/, (msg: string) => this.handleStartCommand(msg));
        this.bot.onText(/\/stats/, (msg: string) => this.handleStatisticsCommand(msg));
        this.bot.onText(/\/pause/, (msg: string) => this.handlePauseCommand(msg));
        this.bot.onText(/\/cancel/, (msg: string) => this.handleCancelCommand(msg));
        this.bot.on("message", (msg:string) => this.handleMessage(msg));
        this.bot.on("polling_error", (error:any) => this.handlePollingError(error));

        setInterval(() => this.cleanupInactiveSessions(), 60 * 1000);
    }

    private handleStartCommand(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        const session: Session = { chatId, step: "select_trading_type", timestamp: Date.now() };

        this.sessionsDB.update({ chatId }, session, { upsert: true }, (err:any) => {
            if (err) {
                console.error(`Error initializing session: ${err}`);
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
                console.error(`Error gettings statistics: ${err}`);
                return;
            }
            this.bot.sendMessage(chatId, "Bot statistics");
        });
    }

    private handlePauseCommand(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        this.sessionsDB.remove({ chatId }, {}, (err: any) => {
            if (err) {
                console.error(`Error pausing trade: ${err}`);
                return;
            }
            this.bot.sendMessage(chatId, "Your trades have been paused. Use /resume to continue again.");
        });
    }

    private handleCancelCommand(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        this.sessionsDB.remove({ chatId }, {}, (err:any) => {
            if (err) {
                console.error(`Error removing session: ${err}`);
                return;
            }
            this.bot.sendMessage(chatId, "Your session has been reset. Use /start to begin again.");
        });
    }

    private handleMessage(msg: TelegramBot.Message): void {
        const chatId = msg.chat.id;
        const text = msg.text;

        this.sessionsDB.findOne({ chatId }, (err: Error | null, session: Session) => {
            if (err || !session) {
                this.bot.sendMessage(chatId, "Session not found. Use /start to begin.");
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
        this.sendKeyboard(chatId, "Please enter the base stake or investment:", this.getNumericInputKeyboard());
    }

    private handleStakeInput(chatId: number, text: string, session: Session): void {
        if (text === "Cancel") {
            // Clear the current input
            session.currentInput = "";
            this.updateSession(chatId, session);
            this.bot.sendMessage(chatId, "Input cleared. Please enter the stake again.");
            return;
        }

        if (text === "Enter") {
            // Confirm the input
            if (!session.currentInput || session.currentInput.length === 0) {
                this.bot.sendMessage(chatId, "No input detected. Please enter a valid number.");
                return;
            }

            const stake = parseFloat(session.currentInput);
            if (isNaN(stake)) {
                this.bot.sendMessage(chatId, "Invalid input. Please enter a valid number.");
                return;
            }

            session.stake = stake;
            session.currentInput = ""; // Reset current input
            session.step = "enter_take_profit";
            this.updateSession(chatId, session);

            this.sendKeyboard(
                chatId,
                "Please enter the take profit threshold:",
                this.getNumericInputKeyboard()
            );
            return;
        }

        // Append the digit or decimal to the current input
        session.currentInput = (session.currentInput || "") + text;
        this.updateSession(chatId, session);

        // Show the current input to the user
        this.bot.sendMessage(chatId, `Current input: ${session.currentInput}`);
    }

    private handleTakeProfitInput(chatId: number, text: string, session: Session): void {
        if (text === "C") {
            session.step = "enter_stake";
            this.updateSession(chatId, session);
            this.bot.sendMessage(chatId, "Take profit input cleared. Please re-enter the stake.");
            return;
        }

        const takeProfit = parseFloat(text);
        if (isNaN(takeProfit) || takeProfit <= 0) {
            this.bot.sendMessage(chatId, "Invalid take profit amount. Please enter a valid number.");
            return;
        }

        session.takeProfit = takeProfit;
        session.step = "enter_stop_loss";
        this.updateSession(chatId, session);
        this.sendKeyboard(chatId, "Please enter the stop loss threshold:", this.getNumericInputKeyboard());
    }

    private handleStopLossInput(chatId: number, text: string, session: Session): void {
        if (text === "C") {
            session.step = "enter_take_profit";
            this.updateSession(chatId, session);
            this.bot.sendMessage(chatId, "Stop loss input cleared. Please re-enter the take profit.");
            return;
        }

        const stopLoss = parseFloat(text);
        if (isNaN(stopLoss) || stopLoss <= 0) {
            this.bot.sendMessage(chatId, "Invalid stop loss amount. Please enter a valid number.");
            return;
        }

        session.stopLoss = stopLoss;
        session.step = "select_trade_duration";
        this.updateSession(chatId, session);
        this.sendKeyboard(chatId, "How long should this trade last?", this.getDurationKeyboard());
    }

    private handleTradeDurationSelection(chatId: number, text: string, session: Session): void {
        session.tradeDuration = text;
        session.step = "select_update_frequency";
        this.updateSession(chatId, session);
        this.sendKeyboard(chatId, "How frequent should you get updates?", this.getDurationKeyboard());
    }

    private handleUpdateFrequencySelection(chatId: number, text: string, session: Session): void {
        session.updateFrequency = text;
        session.step = "confirm_trade";
        this.updateSession(chatId, session);

        const confirmationMessage = `
      Please confirm your trade:
      - Market: ${session.market}
      - Purchase Type: ${session.purchaseType}
      - Stake: ${session.stake}
      - Take Profit: ${session.takeProfit}
      - Stop Loss: ${session.stopLoss}
      - Duration: ${session.tradeDuration}
      - Update Frequency: ${session.updateFrequency}

      Type /confirm to proceed or /cancel to reset.
    `;

        this.bot.sendMessage(chatId, confirmationMessage);
    }

    private handleTradeConfirmation(chatId: number, text: string, session: Session): void {
        if (text === "/confirm") {
            const worker = new Worker("./tradeWorker.js", { workerData: { session } });

            worker.on("message", (message) => {
                this.bot.sendMessage(chatId, message);
            });

            worker.on("error", (error) => {
                console.error(`Worker error: ${error.message}`);
                this.bot.sendMessage(chatId, `Failed to place trade. Please try again later.`);
            });

            worker.on("exit", (code) => {
                if (code !== 0) {
                    console.error(`Worker stopped with exit code ${code}`);
                }
            });
        } else {
            this.bot.sendMessage(chatId, "Trade not confirmed. Use /start to begin again.");
        }
    }

    private sendKeyboard(chatId: number, message: string, keyboard: string[][]): void {
        this.bot.sendMessage(chatId, message, {
            reply_markup: {
                keyboard: keyboard,
                resize_keyboard: true,
                one_time_keyboard: true,
            },
        });
    }

    private updateSession(chatId: number, session: Session): void {
        this.sessionsDB.update({ chatId }, session, {}, (err:any) => {
            if (err) console.error(`Error updating session: ${err}`);
        });
    }

    private handlePollingError(error: Error): void {
        console.error(`Polling error: ${error.message}`);
    }

    private cleanupInactiveSessions(): void {
        const now = Date.now();
        this.sessionsDB.find({}, (err: Error | null, sessions: Session[]) => {
            if (err) return;

            sessions.forEach((session) => {
                if (now - (session.timestamp || 0) > 30 * 60 * 1000) {
                    this.sessionsDB.remove({ chatId: session.chatId }, {}, (err:any) => {
                        if (err) console.error(`Error removing inactive session: ${err}`);
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
                    ["AUD/JPY (Australian Dollar / Japanese Yen) 🇦🇺"],
                    ["AUD/USD (Australian Dollar / US Dollar) 🇦🇺"],
                    ["EUR/AUD (Euro / Australian Dollar) 🇪🇺"],
                    ["EUR/CAD (Euro / Canadian Dollar) 🇪🇺"],
                    ["EUR/CHF (Euro / Swiss Franc) 🇪🇺"],
                    ["EUR/GBP (Euro / British Pound) 🇪🇺"],
                    ["EUR/JPY (Euro / Japanese Yen) 🇪🇺"],
                    ["EUR/USD (Euro / US Dollar) 🇪🇺"],
                    ["GBP/AUD (British Pound / Australian Dollar) 🇬🇧"],
                    ["GBP/JPY (British Pound / Japanese Yen) 🇬🇧"],
                    ["GBP/USD (British Pound / US Dollar) 🇬🇧"],
                    ["USD/CAD (US Dollar / Canadian Dollar) 🇺🇸"],
                    ["USD/CHF (US Dollar / Swiss Franc) 🇺🇸"],
                    ["USD/JPY (US Dollar / Japanese Yen) 🇺🇸"],
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
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
            [".", "0", ".00"],
            ["Cancel", "Enter"],
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
}

export default HummingBirdTradingBot;