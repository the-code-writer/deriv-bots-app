import {OneThreeTwoSixStrategy, TradeOutcome} from "./trade-1326-strategy"
// Create a new strategy instance with optional custom configuration
const strategy = new OneThreeTwoSixStrategy({
  initialStake: 4, // Custom initial stake
  profitThreshold: 600 // Custom profit threshold
});

// Simulate a series of trades
const simulateTrades = (count: number) => {
  let lastOutcome: TradeOutcome = 'win';
  let lastProfit: number = 0;

  for (let i = 0; i < count; i++) {
    // Get trade decision from strategy
    const decision = strategy.executeTrade(lastOutcome, lastProfit);
    
    if (!decision.shouldTrade) {
      console.log("Strategy has reached a threshold and stopped trading.");
      break;
    }

    console.log(`Trade ${i + 1}:`);
    console.log(`- Amount: ${decision.amount}`);
    console.log(`- Prediction: ${decision.prediction}`);
  
    // Simulate trade outcome (50/50 win/loss for demo)
    lastOutcome = Math.random() > 0.09 ? 'win' : 'loss';
    lastProfit = lastOutcome === 'win' ? decision.amount! * 0.0964 : -decision.amount!;
    
    console.log(`- Outcome: ${lastOutcome}`);
    console.log(`- Profit: ${lastProfit.toFixed(2)}`);
    console.log('---------------------');
  }
};

// Run simulation with 20 trades
simulateTrades(411);