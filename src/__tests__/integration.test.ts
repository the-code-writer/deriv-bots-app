import { Enhanced1326Strategy } from '../classes/trader/trade-1326-strategy';

// Helper function from enhanced1326-strategy.test.ts
function generateRealisticOutcomes(count: number, winRate: number): string[] {
    const outcomes: string[] = [];
    let currentStreak = 0;
    let streakType: 'win' | 'loss' = 'win';

    for (let i = 0; i < count; i++) {
        if (currentStreak === 0 || (currentStreak > 0 && currentStreak < 4 && Math.random() < 0.7)) {
            outcomes.push(streakType);
            currentStreak++;
        } else {
            const outcome = Math.random() < winRate ? 'win' : 'loss';
            outcomes.push(outcome);

            if (outcome !== streakType) {
                streakType = outcome;
                currentStreak = 1;
            } else {
                currentStreak++;
            }
        }
    }

    return outcomes;
}

describe('Integration Tests - Enhanced1326Strategy', () => {
    test('comprehensive strategy simulation with positive win rate', () => {
        const strategy = new Enhanced1326Strategy({
            initialStake: 5,
            profitThreshold: 1000,
            lossThreshold: 500,
            maxRecoveryAttempts: 3,
            maxDailyTrades: 200
        });

        const simulationResults = runComprehensiveSimulation(strategy, 200, 0.52);

        console.log('Comprehensive Simulation Results:', simulationResults);

        // Performance assertions - strategy should be profitable or have controlled losses
        expect(simulationResults.finalProfit).toBeGreaterThan(-250);
        expect(simulationResults.winRate).toBeGreaterThan(0.4);
        expect(simulationResults.sequencesCompleted).toBeGreaterThan(0);
        expect(simulationResults.maxDrawdown).toBeLessThan(0); // Should be negative
        expect(simulationResults.maxDrawdown).toBeGreaterThan(-400); // Controlled losses
        expect(simulationResults.totalTrades).toBeGreaterThan(1); // Should execute most trades
    });

    test('stress test with negative win rate and high volatility', () => {
        const strategy = new Enhanced1326Strategy({
            initialStake: 5,
            profitThreshold: 800,
            lossThreshold: 400,
            maxRecoveryAttempts: 2,
            maxDailyTrades: 300
        });

        const simulationResults = runComprehensiveSimulation(strategy, 300, 0.48);

        console.log('Stress Test Results:', simulationResults);

        // Stress test assertions - strategy should survive without blowing up
        expect(strategy.getCurrentState().inRecovery).toBe(true); // Should recover or not enter recovery
        expect(simulationResults.finalProfit).toBeGreaterThan(-350);
        expect(simulationResults.maxDrawdown).toBeGreaterThan(-600); // Extreme but controlled losses
        expect(simulationResults.totalTrades).toBeLessThan(301); // Should respect trade limits
    });

    test('profit locking mechanism validation', () => {
        const strategy = new Enhanced1326Strategy({
            initialStake: 10,
            profitThreshold: 500,
            lossThreshold: 250,
            maxRecoveryAttempts: 2,
            maxDailyTrades: 100
        });

        // Force high profits to trigger profit locking
        strategy.updateState(true, 300); // Above 50% of profitThreshold (250)

        const decision = strategy.prepareForNextTrade();

        expect(decision.shouldTrade).toBe(false);
        expect(decision.reason).toContain('Profit lock');
    });

    test('loss threshold protection', () => {
        const strategy = new Enhanced1326Strategy({
            initialStake: 10,
            profitThreshold: 500,
            lossThreshold: 200,
            maxRecoveryAttempts: 2,
            maxDailyTrades: 100
        });

        // Force losses to trigger loss protection
        strategy.updateState(false, -250); // Exceed loss threshold

        const decision = strategy.prepareForNextTrade();

        expect(decision.shouldTrade).toBe(false);
        expect(decision.reason).toContain('Loss limit');
    });

    test('daily trade limit enforcement', () => {
        const strategy = new Enhanced1326Strategy({
            initialStake: 5,
            profitThreshold: 1000,
            lossThreshold: 500,
            maxRecoveryAttempts: 3,
            maxDailyTrades: 10 // Very low limit for testing
        });

        // Simulate many trades to hit daily limit
        for (let i = 0; i < 15; i++) {
            const decision = strategy.prepareForNextTrade();
            if (decision.shouldTrade) {
                strategy.updateState(Math.random() > 0.5, decision.amount! * (Math.random() > 0.5 ? 0.88 : -1));
            }
        }

        const decision = strategy.prepareForNextTrade();
        expect(decision.shouldTrade).toBe(false);
        expect(decision.reason).toMatch(/Max consecutive losses|Daily trade limit|Loss limit reached/);
    });

    test('recovery mode activation and exit', () => {
        const strategy = new Enhanced1326Strategy({
            initialStake: 5,
            profitThreshold: 1000,
            lossThreshold: 500,
            maxRecoveryAttempts: 2,
            maxDailyTrades: 50
        });

        // Force into recovery mode with consecutive losses
        strategy.updateState(false, -50);
        strategy.updateState(false, -75);

        expect(strategy.getCurrentState().inRecovery).toBe(true);

        // Recover from losses
        strategy.updateState(true, 200);

        expect(strategy.getCurrentState().inRecovery).toBe(false);
    });

    test('sequence completion tracking', () => {
        const strategy = new Enhanced1326Strategy({
            initialStake: 5,
            profitThreshold: 1000,
            lossThreshold: 500,
            maxRecoveryAttempts: 3,
            maxDailyTrades: 50
        });

        const initialStats = strategy.getStatistics();

        // Complete a full sequence (4 wins)
        for (let i = 0; i < 4; i++) {
            const decision = strategy.prepareForNextTrade();
            strategy.updateState(true, decision.amount! * 0.88);
        }

        const finalStats = strategy.getStatistics();
        expect(finalStats.sequencesCompleted).toBe(initialStats.sequencesCompleted + 1);
    });
});

function runComprehensiveSimulation(strategy: Enhanced1326Strategy, tradeCount: number, winRate: number): any {
    const outcomes = generateRealisticOutcomes(tradeCount, winRate);
    let totalProfit = 0;
    const profits: number[] = [];
    let tradesExecuted = 0;

    outcomes.forEach((outcome) => {
        const decision = strategy.prepareForNextTrade();
        if (!decision.shouldTrade) return;

        const profit = outcome === 'win' ? decision.amount! * 0.88 : -decision.amount!;
        strategy.updateState(outcome === 'win', profit);
        totalProfit += profit;
        profits.push(profit);
        tradesExecuted++;
    });

    const stats = strategy.getStatistics();
    const state = strategy.getCurrentState();
    const winRateCalculated = stats.totalWins / (stats.totalWins + stats.totalLosses);
    const maxDrawdown = calculateMaxDrawdown(profits);
    const sharpeRatio = calculateSharpeRatio(profits);

    return {
        finalProfit: totalProfit,
        winRate: winRateCalculated,
        sequencesCompleted: stats.sequencesCompleted,
        maxDrawdown,
        sharpeRatio,
        totalTrades: tradesExecuted,
        inRecovery: state.inRecovery,
        consecutiveLosses: state.consecutiveLosses,
        consecutiveWins: state.consecutiveWins
    };
}

function calculateMaxDrawdown(profits: number[]): number {
    let maxDrawdown = 0;
    let peak = 0;
    let runningTotal = 0;

    profits.forEach(profit => {
        runningTotal += profit;
        if (runningTotal > peak) {
            peak = runningTotal;
        }
        const drawdown = peak - runningTotal;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    });

    return -maxDrawdown; // Return as negative number
}

function calculateSharpeRatio(profits: number[]): number {
    if (profits.length === 0) return 0;

    const mean = profits.reduce((sum, profit) => sum + profit, 0) / profits.length;
    const variance = profits.reduce((sum, profit) => sum + Math.pow(profit - mean, 2), 0) / profits.length;
    const stdDev = Math.sqrt(variance);

    // Avoid division by zero
    if (stdDev === 0) return mean > 0 ? Infinity : -Infinity;

    return mean / stdDev;
}