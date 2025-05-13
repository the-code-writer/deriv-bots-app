import { DerivTradingBot } from "./deriv-trading-bot";
import { pino } from "pino";
import { BotConfig } from './types'; 

const logger = pino({ name: "DerivTradingBot" });
// Usage example
const botConfig: BotConfig = {} as BotConfig;

const tradingBot = new DerivTradingBot(botConfig);

const tradingSession = {
    "step": "TRADE_CONFIRMATION",
    "accountType": "VRTC1605087 ( USD )",
    "tradingType": "Derivatives 📊",
    "market": "Volatility 75(1s) 📈",
    "contractType": "Strategy 1️⃣3️⃣2️⃣6️⃣", //"Digits ⬇️6️⃣", "Rise ⬆️", //Digit NOT Random 🎲
    "stake": 1,
    "takeProfit": "USD580",
    "stopLoss": 650,
    "tradeDuration": "28min ⏱️",
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
tradingBot.startTrading(tradingSession, false, 'a1-28VUaap8ZFN3G4lMgf5P3S3IPtUQl', sessionID, sessionNumber) //DEMO
//tradingBot.startTrading(tradingSession, false, 'a1-j54R1Jof4ucqqnB2E8OeyIWoO3dIn') //USD
    .then(() => logger.info('Trading completed successfully'))
    .catch(error => logger.error('Trading failed', error));