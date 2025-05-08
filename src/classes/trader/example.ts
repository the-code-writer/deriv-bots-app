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
    "contractType": "Digits ⬇️6️⃣", //"Rise ⬆️", //Digit NOT Random 🎲
    "stake": 1,
    "takeProfit": "USD15,000.34",
    "stopLoss": 10000,
    "tradeDuration": "24hrs ⏱️",
    "updateFrequency": "15min ⏱️",
    "contractDurationUnits": "Ticks ⏱️",
    "contractDurationValue": "1Tick ⏱️",
    "tradingMode": "📈 Manual Trading"
};

const sessionNumber = "N:X0016:00283";

const sessionID = "0xEC34...8BA2";

// @ts-ignore
tradingBot.startTrading(tradingSession, false, 'a1-28VUaap8ZFN3G4lMgf5P3S3IPtUQl', sessionID, sessionNumber) //DEMO
//tradingBot.startTrading(tradingSession, false, 'a1-j54R1Jof4ucqqnB2E8OeyIWoO3dIn') //USD
    .then(() => logger.info('Trading completed successfully'))
    .catch(error => logger.error('Trading failed', error));