import { DerivTradingBot } from "../classes/trader/deriv-trading-bot";
import { pino } from "pino";
import { BotConfig } from '../classes/trader/types'; 

const logger = pino({ name: "DerivTradingBot" });
// Usage example
const botConfig: BotConfig = {} as BotConfig;

const tradingBot = new DerivTradingBot(botConfig);

const tradingSession = {
    "step": "TRADE_CONFIRMATION",
    "accountType": "VRTC1605087 ( USD )",
    "tradingType": "Derivatives 📊",
    "market": "Volatility 75(1s) 📈",
    "contractType": "Rise ⬆️", //"Digits ⬇️6️⃣",//, "Strategy 1️⃣3️⃣2️⃣6️⃣", , //Digit NOT Random 🎲
    "stake": 1,
    "takeProfit": "USD500",
    "stopLoss": 500,
    "tradeDuration": "40min ⏱️",
    "updateFrequency": "10sec ⏱️",
    "contractDurationUnits": "Ticks ⏱️",
    "contractDurationValue": "1Tick ⏱️",
    "tradingMode": "📈 Manual Trading"
};

const sessionNumber = "N:X0016:00283";

const sessionID = "0xEC34...8BA2";

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // You can log it, send to monitoring, or even shut down the app safely.
});

// @ts-ignore
tradingBot.startTrading(tradingSession, false, 'a1-lcUQX53IXwGccuqPv19wemArcWyeb', sessionID, sessionNumber) //DEMO
//tradingBot.startTrading(tradingSession, false, 'a1-wSuCNWZXyFuKsI7JClwwKgDEVTCYq') //USD
    .then(() => logger.info('Trading completed successfully'))
    .catch(error => logger.error('Trading failed', error));