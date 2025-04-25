import { StrategyParser } from './trader-strategy-parser';
const strategyJson = require("./strategies/StrategyGeneric001.json");
const parser = new StrategyParser(strategyJson, 1.0); // Base stake of $1
const allSteps = parser.getAllSteps();

console.log("Strategy Steps with Calculated Amounts:");
allSteps.forEach((step, index) => {
    console.log(`\nStep ${index + 1}:`);
    console.log(`- Amount: ${step.currency} ${step.amount.toFixed(2)}`);
    console.log(`- Contract: ${step.contract_type}`);
    console.log(`- Market: ${step.symbol}`);
    console.log(`- Duration: ${step.duration}${step.duration_unit}`);
    console.log(`- Barrier: ${step.barrier}`);
    console.log(`- Basis: ${step.basis}`);
    console.log(`- Formular: ${step.formula}`);
});

console.log("\nStrategy Configuration:");
console.log(`Max Sequence: ${parser.getStrategyConfig().maxSequence}`);
console.log(`Max Consecutive Losses: ${parser.getStrategyConfig().maxConsecutiveLosses}`);