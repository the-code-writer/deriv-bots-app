import { StrategyParser } from './trader-strategy-parser';

try {

    const strategyName: string = "CALLE";

    const strategyJson = require(`./strategies/NDTXStrategy${strategyName}.json`);

    // Example with single strategy
    const parser = new StrategyParser(strategyJson, 0, 0.35);

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

try {

    const strategyName: string = "CALLE";

    const strategyJson = require(`./strategies/NDTXStrategy${strategyName}.json`);

    // Example with all strategies
    console.log("\n\n=== Processing All Strategies ===");
    const multiParser = new StrategyParser(strategyJson, null, 0.35);

    const strategyCount = Array.isArray(multiParser.strategyConfig)
        ? multiParser.strategyConfig.length
        : 1;

    console.log(`Processing ${strategyCount} strategies:`);

    console.log("Strategies:", multiParser.getAll())

    for (let i = 0; i < strategyCount; i++) {
        const strategy = multiParser.getFormattedOutput(i);
        console.log(`\nStrategy ${i + 1}: ${strategy.configuration.strategyName}`);

        console.log("First step:");
        const firstStep = strategy.steps[0];
        console.log(`- Type: ${firstStep.contract_type}`);
        console.log(`- Amount: ${firstStep.amount.toFixed(2)}`);
        console.log(`- Expected Profit: ${firstStep.anticipatedProfit.toFixed(2)}`);

        if (strategy.steps.length > 1) {
            console.log("First recovery step:");
            const recoveryStep = strategy.steps[1];
            console.log(`- Amount: ${recoveryStep.amount.toFixed(2)}`);
            console.log(`- Needed to recover: ${(recoveryStep.amount - recoveryStep.anticipatedProfit).toFixed(2)}`);
        }
    }
} catch (error) {
    console.error("Error processing multiple strategies:", error);
}