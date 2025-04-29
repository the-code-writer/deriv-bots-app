import { DerivTradingBot } from "./deriv-trading-bot";
import { pino } from "pino";
import { BotConfig } from './types'; 

const logger = pino({ name: "DerivTradingBot" });
// Usage example
const botConfig: BotConfig = {};

const tradingBot = new DerivTradingBot(botConfig);

const tradingSession = {
    "step": "TRADE_CONFIRMATION",
    "accountType": "VRTC1605087 ( USD )",
    "tradingType": "Derivatives 📊",
    "market": "Volatility 50 📈",
    "contractType": "Rise ⬆️",
    "stake": 3.48,
    "takeProfit": "USD5,000.34",
    "stopLoss": 10000,
    "tradeDuration": "2000sec ⏱️",
    "updateFrequency": "50sec ⏱️",
    "contractDurationUnits": "Ticks ⏱️",
    "contractDurationValue": "8Tick ⏱️",
    "tradingMode": "📈 Manual Trading"
};

// @ts-ignore
tradingBot.startTrading(tradingSession, false, 'a1-28VUaap8ZFN3G4lMgf5P3S3IPtUQl') //DEMO
//tradingBot.startTrading(tradingSession, false, 'a1-j54R1Jof4ucqqnB2E8OeyIWoO3dIn') //USD
    .then(() => logger.info('Trading completed successfully'))
    .catch(error => logger.error('Trading failed', error));