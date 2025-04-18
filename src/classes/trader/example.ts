import { DerivTradingBot } from "./deriv-trading-bot";
import { pino } from "pino";
import { BotConfig } from './types';
import { parsePurchaseType } from "@/common/utils/snippets";

const logger = pino({ name: "DerivTradingBot" });
// Usage example
const botConfig: BotConfig = {
    tradingType: "Derivatives 📊",
    defaultMarket: "R_100",
    baseStake: 1,
    maxStake: 5,
    minStake: 0.35,
    maxRecoveryTrades: 5,
    takeProfit: 10,
    stopLoss: 5,
    contractDuration: 1,
    contractDurationUnit: "t",
};

const tradingBot = new DerivTradingBot(botConfig);

const tradingSession = {
    "step": "TRADE_CONFIRMATION",
    "accountType": "VRTC1605087 ( USD )",
    "tradingType": "Derivatives 📊",
    "market": "Volatility 50 📈",
    "purchaseType": "Rise ⬆️",
    "stake": 10,
    "takeProfit": "USD5,000.34",
    "stopLoss": 10000,
    "tradeDuration": "1min ⏱️",
    "updateFrequency": "10sec ⏱️",
    "contractDurationUnits": "Ticks ⏱️",
    "contractDurationValue": "1Tick ⏱️",
    "tradingMode": "📈 Manual Trading"
};

// @ts-ignore
tradingBot.startTrading(tradingSession, false, 'a1-28VUaap8ZFN3G4lMgf5P3S3IPtUQl')
    .then(() => logger.info('Trading completed successfully'))
    .catch(error => logger.error('Trading failed', error));