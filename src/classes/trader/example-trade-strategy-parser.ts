import { StrategyParser, StrategyStepOutput } from './trader-strategy-parser';
import { BotConfig } from './types';

try {
    const strategyName: string = "DIGITUNDER";
    const strategyJson = require(`./strategies/${strategyName}.json`);

    // Example with single strategy - simplified constructor call
    const parser = new StrategyParser(strategyJson, 0.38, {} as BotConfig);

    const formattedOutput = parser.getFormattedOutput();

    console.error(formattedOutput)

    console.log("Strategy Configuration:");
    console.log(`- Name: ${formattedOutput.strategyName}`);
    console.log(`- Base Stake: ${formattedOutput.meta.baseStake}`);
    //console.log(`- Risk Profile: ${formattedOutput.riskProfile}`);

    console.log("\nStrategy Steps with Profit Calculations:");
    // @ts-ignore
    formattedOutput.strategySteps.forEach((step: StrategyStepOutput) => {
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
    if (formattedOutput.strategySteps.length > 1) {
        const recoveryStep:StrategyStepOutput = formattedOutput.strategySteps[1] as StrategyStepOutput;
        console.log("\nFirst Recovery Step Details:");
        console.log(`Amount needed to recover: ${recoveryStep.amount.toFixed(2)}`);
        console.log(`Expected profit from recovery: ${recoveryStep.anticipatedProfit.toFixed(2)}`);
        console.log(`Profit Percentage: ${recoveryStep.profitPercentage.toFixed(2)}%`);
    }

    // Alternative way to access the modified strategy JSON
    // Assuming the parser stores the modified strategy in a property called 'strategy'
    if ('strategy' in parser) {
        console.log("\nFinal Strategy Configuration:");
        console.log(JSON.stringify(parser.strategy, null, 2));
    } else if ('strategyJson' in parser) {
        console.log("\nFinal Strategy Configuration:");
        console.log(JSON.stringify(parser.strategyJson, null, 2));
    } else {
        console.log("\nReconstructed Strategy Configuration:");
        console.log(JSON.stringify(formattedOutput, null, 2));
    }

} catch (error) {
    console.error("Error processing strategy:", error);
}