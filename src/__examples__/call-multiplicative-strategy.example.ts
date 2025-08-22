import { CallMultiplicativeRecoveryStrategy, PAYOUT_RATE } from '../classes/trader/trade-call-multiplicative-strategy';
// call-multiplicative-strategy.example.ts (FIXED - No top-level await)
// Create strategy instance
const configs:any = {
    profitThreshold: 100,
    lossThreshold: 50,
    initialStake: 1,
    market: 'R_100',
    maxRecoveryAttempts: 3,
    maxDailyTrades: 100,
    enableRecovery: true,
    maxStakeMultiplier: 10,
    enableAutoAdjust: true,
    maxVolatility: 0.6,
    minWinRate: 0.4,
    minTrendStrength: 0.4,
    recoveryMode: 'standard'
}
const strategy = new CallMultiplicativeRecoveryStrategy(configs);
// Simulation function with error handling
const simulateTrading = async (tradeCount: number, winRate: number = 0.52) => {

    console.log('🚀 CALL Multiplicative Recovery Strategy Simulation');
    console.log('='.repeat(60));

    let totalProfit = 0;
    let tradesExecuted = 0;

    for (let i = 0; i < tradeCount; i++) {
        const randomNumber = Math.random();
        console.log('-'.repeat(60));
        console.error(`randomNumber:`, { i, tradeCount, winRate, randomNumber });
        try {
            const decision = strategy.prepareForNextTrade();
            console.log(`🤔 DECISION: `, decision);
            if (!decision.shouldTrade) {
                console.log(`⏸️  PAUSED: ${decision.reason}`);
                continue;
            }

            tradesExecuted++;
            const isWin = randomNumber > winRate;
            const profit = isWin ? decision.amount! * PAYOUT_RATE : -decision.amount!;

            strategy.updateState(isWin, profit);
            totalProfit += profit;

            console.log(` TRADE ${i + 1}: ${isWin ? '🟢 WIN' : '🔴 LOSS'} | ` +
                `Stake: $${decision.amount} | ` +
                `Profit: $${profit.toFixed(2)} | ` +
                `Total: $${totalProfit.toFixed(2)}`);
        } catch (error) {
            console.error(`Error in trade ${i + 1}:`, error);
            break;
        }
    }

    // Display results
    console.log('\n📊 FINAL RESULTS');
    console.log('='.repeat(60));
    console.log(`Trades executed: ${tradesExecuted}`);
    console.log(`Final profit: $${totalProfit.toFixed(2)}`);

    const stats = strategy.getStatistics();
    console.log(`Win rate: ${((stats.totalWins / (stats.totalWins + stats.totalLosses)) * 100).toFixed(1)}%`);
    console.log(`Recovery success: ${stats.successfulRecoveries}/${stats.totalRecoveryAttempts}`);

    const performance = strategy.analyzePerformance();
    console.log(`Average profit: $${performance.avgProfit.toFixed(2)}`);
    console.log(`Volatility: ${(1-(performance.avgProfit / (configs.initialStake*PAYOUT_RATE))).toFixed(2)}`);
    console.log(`Recovery success rate: ${(performance.recoverySuccessRate * 100).toFixed(1)}%`);
};

// Wrap the async call in an IIFE (Immediately Invoked Function Expression)
(async () => {
    try {
        console.error('Simulation started:', [100, 0.05]);
        await simulateTrading(100, 0.05);
    } catch (error) {
        console.error('Simulation failed:', error);
    }
})();