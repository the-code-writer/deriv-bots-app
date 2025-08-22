// real-call-multiplicative-strategy.example.ts (FIXED)
import { DerivTradingBot } from "../classes/trader/deriv-trading-bot";
import { pino } from "pino";
import { CallMultiplicativeRecoveryStrategy } from '../classes/trader/trade-call-multiplicative-strategy';

const logger = pino({ name: "CallMultiplicativeTradingBot" });

// Enhanced trading bot with CALL strategy
class CallMultiplicativeTradingBot extends DerivTradingBot {
    private callStrategy: CallMultiplicativeRecoveryStrategy;

    constructor(config: any) {
        super(config);
        this.callStrategy = new CallMultiplicativeRecoveryStrategy({
            initialStake: config.baseStake || 5,
            profitThreshold: config.takeProfit || 1000,
            lossThreshold: config.stopLoss || 500,
            market: config.market || 'R_100'
        });
    }

    async executeTrade() {
        const decision = this.callStrategy.prepareForNextTrade();

        if (!decision.shouldTrade) {
            logger.warn(`Trade skipped: ${decision.reason}`);
            return null;
        }

        try {
            const tradeResult = await this.placeTrade({
                amount: decision.amount!,
                contract_type: decision.contractType!,
                symbol: decision.market!,
                duration: decision.duration!,
                duration_unit: decision.durationType!
            });

            // Update strategy with result
            this.callStrategy.updateState(
                tradeResult.status === 'won',
                tradeResult.profit_value
            );

            return tradeResult;
        } catch (error) {
            logger.error('Trade execution failed', error);
            throw error;
        }
    }

    getStrategyMetrics() {
        return {
            ...this.callStrategy.getPerformanceMetrics(),
            ...this.callStrategy.analyzePerformance()
        };
    }

    // Add a proper start method that matches your base class
    async startTrading() {
        logger.info('Starting CALL multiplicative recovery strategy trading');

        try {
            // Run multiple trades or implement your trading loop
            for (let i = 0; i < 10; i++) { // Limit to 10 trades for example
                const result = await this.executeTrade();
                if (!result) break; // Stop if trade was skipped

                logger.info(`Trade ${i + 1} completed: ${result.status}`);

                // Add delay between trades if needed
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            logger.info('Trading session completed');
        } catch (error) {
            console.error('Trading session failed', error);
            //logger.error('Trading session failed', error);
            throw error;
        }
    }
}

// Usage
const botConfig = {
    baseStake: 5,
    takeProfit: 1000,
    stopLoss: 500,
    market: 'R_100'
};

const tradingBot = new CallMultiplicativeTradingBot(botConfig);

// Start trading session using the correct method name
tradingBot.startTrading()
    .then(() => logger.info('Trading session completed successfully'))
    .catch(error => logger.error('Trading session failed', error));