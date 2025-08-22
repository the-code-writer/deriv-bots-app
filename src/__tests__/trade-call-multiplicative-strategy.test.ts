import { CallMultiplicativeRecoveryStrategy, PAYOUT_RATE } from '../classes/trader/trade-call-multiplicative-strategy';
// trade-call-multiplicative-strategy.test.ts

const configs: any = {
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

describe('CallMultiplicativeRecoveryStrategy', () => {
    let strategy: CallMultiplicativeRecoveryStrategy;

    beforeEach(() => {
        strategy = new CallMultiplicativeRecoveryStrategy(configs);
    });

    describe('Initialization', () => {
        test('should initialize with correct default values', () => {
            const state = strategy.getCurrentState();
            const stats = strategy.getStatistics();

            expect(state.currentStake).toBe(configs.initialStake);
            expect(state.inRecovery).toBe(false);
            expect(state.totalProfit).toBe(0);
            expect(stats.totalWins).toBe(0);
            expect(stats.totalLosses).toBe(0);
        });

        test('should validate configuration', () => {
            expect(() => new CallMultiplicativeRecoveryStrategy({ initialStake: -1 })).toThrow();
            expect(() => new CallMultiplicativeRecoveryStrategy({ profitThreshold: 0 })).toThrow();
            expect(() => new CallMultiplicativeRecoveryStrategy({ maxStakeMultiplier: 0.5 })).toThrow();
        });
    });

    describe('Basic Trading', () => {
        test('should always trade CALL contracts', () => {
            const decision = strategy.prepareForNextTrade();
            expect(decision.shouldTrade).toBe(true);
            expect(decision.contractType).toBe('CALLE');
            expect(decision.prediction).toBe('CALLE');
        });

        test('should use initial stake for first trade', () => {
            const decision = strategy.prepareForNextTrade();
            expect(decision.amount).toBe(configs.initialStake);
        });

        test('should reset to initial stake after win', () => {
            // First trade
            const decision1 = strategy.prepareForNextTrade();
            strategy.updateState(true, decision1.amount! * PAYOUT_RATE);

            // Second trade should reset to initial stake
            const decision2 = strategy.prepareForNextTrade(true, decision1.amount! * PAYOUT_RATE);
            expect(decision2.amount).toBe(configs.initialStake);
        });
    });

    describe('Recovery Mechanism', () => {
        test('should enter recovery mode after loss', () => {
            // First loss
            const decision1 = strategy.prepareForNextTrade();
            strategy.updateState(false, -decision1.amount!);

            const state = strategy.getCurrentState();
            expect(state.inRecovery).toBe(true);
            expect(state.recoveryAttempts).toBe(1);
        });

        test('should calculate recovery stake correctly', () => {
            // Simulate a loss
            strategy.updateState(false, -10);

            const recoveryStake = (strategy as any).calculateRecoveryStake();
            expect(recoveryStake).toBeGreaterThan(configs.initialStake);
            expect(recoveryStake).toBeLessThanOrEqual(40); // 5 * 8 = 40 max
        });

        test('should exit recovery after successful win', () => {
            // Enter recovery
            strategy.updateState(false, -10);

            // Win that covers the loss
            strategy.updateState(true, 15);

            const state = strategy.getCurrentState();
            expect(state.inRecovery).toBe(false);
            expect(state.currentStake).toBe(configs.initialStake); // Reset to initial
        });
    });

    describe('Risk Management', () => {
        test('should stop trading at loss threshold', () => {
            strategy.updateState(false, -600); // Exceed threshold

            const decision = strategy.prepareForNextTrade();
            expect(decision.shouldTrade).toBe(false);
            expect(decision.reason).toMatch(/Loss limit|Strategy is inactive/);
        });

        test('should respect daily trade limit', () => {
            // Set daily limit reached
            strategy.setTradesToday(configs.maxDailyTrades);
            const decision = strategy.prepareForNextTrade();
            expect(decision.shouldTrade).toBe(false);
            expect(decision.reason).toContain('Daily trade limit');
        });

        test('should stop after max recovery attempts', () => {
            // Set max recovery attempts
            strategy.setRecoveryAttempts(5);
            const decision = strategy.prepareForNextTrade();
            expect(decision.shouldTrade).toBe(false);
            expect(decision.reason).toContain('Max recovery attempts');
        });
    });

    describe('Stake Validation', () => {
        test('should validate stake within safe bounds', () => {
            const validateStake = (strategy as any).validateStake.bind(strategy);

            // Below minimum
            expect(validateStake(0.1)).toBe(configs.initialStake); // Minimum stake
            // Within range
            expect(validateStake(5)).toBe(5);
            // Above maximum (5 * 8 = 40)
            expect(validateStake(50)).toBe(10);
        });

        test('should adjust stake based on volatility', () => {
            // Add some history to influence volatility calculation
            strategy.setRecoveryHistory([
                { profit: 20 }, { profit: -15 }, { profit: 10 }, { profit: -8 }
            ]);
            const adjustedStake = strategy.getVolatilityAdjustedStake(50);
            expect(adjustedStake).toBeLessThan(50);
        });
    });

    describe('Performance Tracking', () => {
        test('should track recovery statistics', () => {
            // Simulate recovery cycle
            strategy.updateState(false, -1); // Loss -> enter recovery
            strategy.updateState(true, 5);   // Win -> exit recovery
            //console.log("RECOVERY", strategy)
            //process.exit(1)
            const stats = strategy.getStatistics();
            expect(stats.totalRecoveryAttempts).toBeGreaterThanOrEqual(1);
            expect(stats.successfulRecoveries).toBe(1);
        });

        test('should analyze performance correctly', () => {
            // Add some trade history
            strategy.updateState(true, 4.4);  // Win
            strategy.updateState(false, -5);  // Loss
            strategy.updateState(true, 8.8);  // Win

            const analysis = strategy.analyzePerformance();
            expect(analysis.winRate).toBe(2 / 3);
            expect(analysis.avgProfit).toBeCloseTo((4.4 - 5 + 8.8) / 3, 1);
        });
    });

    describe('Edge Cases', () => {
        test('should handle invalid profit values', () => {
            expect(() => strategy.updateState(true, NaN)).toThrow();
            expect(() => strategy.updateState(true, Infinity)).toThrow();
        });

        test('should handle extreme market conditions', () => {
            // Simulate high volatility
            strategy.setRecoveryHistory(Array(10).fill({ profit: -20 }));
            const decision = strategy.prepareForNextTrade();
            expect(decision.shouldTrade).toBe(false);
        });

        test('should reset correctly', () => {
            // Make some trades
            strategy.updateState(true, 10);
            strategy.updateState(false, -15);

            strategy.resetStrategy();

            const state = strategy.getCurrentState();
            expect(state.totalProfit).toBe(0);
            expect(state.currentStake).toBe(configs.initialStake);
            expect(state.inRecovery).toBe(false);
        });
    });

    describe('Realistic Simulation', () => {
        test('should handle realistic trading scenario', () => {
            const outcomes = generateRealisticOutcomes(100, 0.55);
            let totalProfit = 0;

            outcomes.forEach((outcome, index) => {
                const decision = strategy.prepareForNextTrade();
                if (!decision.shouldTrade) {
                    if (decision.reason?.includes('reset')) {
                        strategy.resetStrategy();
                    }
                    return;
                }

                const profit = outcome === 'win' ? decision.amount! * PAYOUT_RATE : -decision.amount!;
                strategy.updateState(outcome === 'win', profit);
                totalProfit += profit;
            });

            const finalProfit = strategy.getCurrentState().totalProfit;
            console.log(`Simulation results - Final profit: ${finalProfit.toFixed(2)}`);

            // Should maintain controlled losses
            expect(finalProfit).toBeGreaterThan(-200);
        });
    });
});

// Helper function
function generateRealisticOutcomes(count: number, winRate: number): string[] {
    const outcomes: string[] = [];
    for (let i = 0; i < count; i++) {
        outcomes.push(Math.random() < winRate ? 'win' : 'loss');
    }
    return outcomes;
}