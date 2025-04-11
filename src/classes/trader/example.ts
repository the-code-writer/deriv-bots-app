import { DerivTradingBot } from "./deriv-trading-bot";
import { pino } from "pino";
import { BotConfig } from './types';

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
    market: "R_100",
    purchaseType: "CALL",
    stake: 1,
    takeProfit: 10,
    stopLoss: 5,
    tradeDuration: "1h",
    updateFrequency: "1m",
};

// @ts-ignore
tradingBot.startTrading(tradingSession)
    .then(() => logger.info('Trading completed successfully'))
    .catch(error => logger.error('Trading failed', error));