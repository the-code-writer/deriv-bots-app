import { Enhanced1326Strategy } from "../classes/trader/trade-1326-strategy";

// Create a new strategy instance with comprehensive configuration
const strategy = new Enhanced1326Strategy({
  initialStake: 5,
  profitThreshold: 1000,
  lossThreshold: 500,
  maxRecoveryAttempts: 3,
  maxDailyTrades: 50,
  recoveryMode: 'neutral',
  enableSequenceProtection: true,
  initialBarrier: 5,
  market: '1HZ100V',
  enableAutoAdjust: true,
  maxVolatility: 0.6,
  minTrendStrength: 0.4
});

// Enhanced simulation with realistic market conditions
const simulateRealisticTrading = async (tradeCount: number, winRate: number = 0.52) => {
  console.log(`🚀 Starting trading simulation (${tradeCount} trades, ${winRate * 100}% win rate)`);
  console.log('='.repeat(60));

  let totalProfit = 0;
  let tradesExecuted = 0;
  let wins = 0;
  let losses = 0;

  for (let i = 0; i < tradeCount; i++) {
    // Get trade decision from strategy
    const decision = strategy.prepareForNextTrade();

    if (!decision.shouldTrade) {
      console.log(`⏸️  Trade ${i + 1}: Strategy paused - ${decision.reason}`);

      // Handle different pause scenarios
      if (decision.reason?.includes('Profit')) {
        console.log('💰 Profit target reached! Resetting strategy...');
        strategy.resetStrategy();
        continue;
      } else if (decision.reason?.includes('Loss')) {
        console.log('⚠️  Loss limit reached! Stopping simulation.');
        break;
      } else if (decision.reason?.includes('Daily')) {
        console.log('📅 Daily trade limit reached. Continuing tomorrow...');
        // Simulate day change by resetting daily counters
        (strategy as any).state.tradesToday = 0;
        (strategy as any).dailyProfitLoss = 0;
        continue;
      }

      console.log('---------------------');
      continue;
    }

    tradesExecuted++;

    // Simulate realistic trade outcome with some randomness
    const randomFactor = Math.random();
    const isWin = randomFactor < winRate;
    const profitMultiplier = isWin ? 0.88 : -1; // 12% broker fee on wins
    const profit = decision.amount! * profitMultiplier;

    // Update strategy state
    strategy.updateState(isWin, profit);

    // Track statistics
    totalProfit += profit;
    if (isWin) wins++; else losses++;

    // Display trade details
    console.log(`📊 Trade ${i + 1}:`);
    console.log(`   Amount: $${decision.amount}`);
    console.log(`   Prediction: ${decision.prediction}`);
    console.log(`   Outcome: ${isWin ? 'WIN ✅' : 'LOSS ❌'}`);
    console.log(`   Profit: $${profit.toFixed(2)}`);
    console.log(`   Sequence: ${decision.metadata?.sequence} (Position: ${decision.metadata?.sequencePosition + 1})`);
    console.log(`   Recovery: ${decision.metadata?.inRecovery ? 'YES 🔄' : 'NO'}`);
    console.log(`   Total P&L: $${totalProfit.toFixed(2)}`);
    console.log('---------------------');

    // Add some delay for realism (optional)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Display final results
  console.log('\n🎯 SIMULATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Trades executed: ${tradesExecuted}/${tradeCount}`);
  console.log(`Win rate: ${((wins / tradesExecuted) * 100).toFixed(1)}% (${wins} wins, ${losses} losses)`);
  console.log(`Final profit: $${totalProfit.toFixed(2)}`);

  const stats = strategy.getStatistics();
  console.log(`Sequences completed: ${stats.sequencesCompleted}`);
  console.log(`Max win streak: ${stats.maxWinStreak}`);
  console.log(`Max loss streak: ${stats.maxLossStreak}`);

  const state = strategy.getCurrentState();
  console.log(`Current sequence position: ${state.sequencePosition + 1}/4`);
  console.log(`In recovery: ${state.inRecovery ? 'YES' : 'NO'}`);

  // Performance metrics
  const metrics = strategy.getEnhancedMetrics();
  console.log(`Overall win rate: ${(metrics.winRate * 100).toFixed(1)}%`);

  // Risk assessment
  if (totalProfit > 0) {
    console.log('💪 Strategy was PROFITABLE!');
  } else if (totalProfit > -100) {
    console.log('⚠️  Strategy had controlled losses');
  } else {
    console.log('❌ Strategy exceeded acceptable loss limits');
  }
};

// Advanced simulation with market conditions changing over time
const simulateDynamicMarket = () => {
  console.log('🌐 Starting dynamic market simulation');

  // Phase 1: Normal market (52% win rate)
  console.log('\n📈 Phase 1: Normal market conditions');
  simulateRealisticTrading(50, 0.52);

  // Phase 2: Volatile market (45% win rate)
  console.log('\n🌪️ Phase 2: High volatility market');
  simulateRealisticTrading(30, 0.45);

  // Phase 3: Bull market (60% win rate)
  console.log('\n🚀 Phase 3: Bull market conditions');
  simulateRealisticTrading(40, 0.60);

  // Display comprehensive analytics
  const analytics = strategy.getEnhancedMetrics();
  console.log('\n📊 COMPREHENSIVE ANALYTICS');
  console.log('='.repeat(60));
  console.log('Sequence History:', analytics.sequenceHistory.length, 'sequences tracked');
  console.log('Daily Performance:', analytics.dailyPerformance);
  console.log('Recovery Success Rate:', analytics.recoverySuccessRate);

  const performance = strategy.analyzeSequencePerformance();
  console.log('Sequence Win Rate:', (performance.winRate * 100).toFixed(1) + '%');
  console.log('Average Sequence Profit:', performance.avgProfit.toFixed(2));
};

// Run different simulation scenarios
console.log('🤖 ENHANCED 1-3-2-6 TRADING STRATEGY SIMULATION');
console.log('='.repeat(60));

// Choose simulation mode:
// simulateRealisticTrading(100, 0.52); // Basic simulation
simulateDynamicMarket(); // Advanced dynamic market simulation

// Example of manual strategy control
console.log('\n🎮 Manual Strategy Control Examples:');
console.log('Current state:', strategy.getCurrentState());
console.log('Statistics:', strategy.getStatistics());

// Reset strategy for new session
strategy.resetStrategy();
console.log('Strategy reset for new trading session');

// Pause and resume example
strategy.pauseStrategy();
console.log('Strategy paused');
strategy.resumeStrategy();
console.log('Strategy resumed');

// Dynamic configuration update
strategy.updateConfig({ profitThreshold: 800, initialStake: 6 });
console.log('Configuration updated dynamically');