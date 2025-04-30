import { StrategyParser } from './trader-strategy-parser';

try {
    const strategyName: string = "CALLE";
    const strategyJson = require(`./strategies/${strategyName}.json`);

    // Example with single strategy - simplified constructor call
    const parser = new StrategyParser(strategyJson, 0.35, {});

    const formattedOutput = parser.getFormattedOutput();

    console.log("Strategy Configuration:");
    console.log(`- Name: ${formattedOutput.configuration.strategyName}`);
    console.log(`- Base Stake: ${formattedOutput.configuration.baseStake}`);
    console.log(`- Risk Profile: ${formattedOutput.meta.riskProfile}`);

    console.log("\nStrategy Steps with Profit Calculations:");
    formattedOutput.steps.forEach(step => {
        console.log(`\nStep ${step.stepNumber}:`);
        console.log(`- Amount: ${step.currency} ${step.amount.toFixed(2)}`);
        console.log(`- Contract: ${step.contract_type}`);
        console.log(`- Profit Percentage: ${step.profitPercentage.toFixed(2)}%`);
        console.log(`- Anticipated Profit: ${step.currency} ${step.anticipatedProfit.toFixed(2)}`);
        console.log(`- Market: ${step.symbol}`);
        console.log(`- Duration: ${step.duration}${step.duration_unit}`);
        if (step.barrier) console.log(`- Barrier: ${step.barrier}`);
        if (step.formula) console.log(`- Calculation: ${step.formula}`);
        console.log(`- Step Index: ${step.stepIndex}`);
        console.log(`- Step Number: ${step.stepNumber}`);
    });

    // Example of getting recovery step details
    if (formattedOutput.steps.length > 1) {
        const recoveryStep = formattedOutput.steps[1];
        console.log("\nFirst Recovery Step Details:");
        console.log(`Amount needed to recover: ${recoveryStep.amount.toFixed(2)}`);
        console.log(`Expected profit from recovery: ${recoveryStep.anticipatedProfit.toFixed(2)}`);
        console.log(`Profit Percentage: ${recoveryStep.profitPercentage.toFixed(2)}%`);
    }

} catch (error) {
    console.error("Error processing strategy:", error);
}