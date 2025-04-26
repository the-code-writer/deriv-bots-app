// trade-strategies.ts - Trade strategy implementations
/**
 * @file Contains all trade strategy implementations for the Deriv trading bot
 * @module TradeStrategies
 */
import { pino } from "pino";
import {
    ContractParams,
    ITradeData,
    ContractType,
    IPreviousTradeResult,
    MarketType,
    ContractTypeEnum,
    ContractDurationUnitType,
    MarketTypeEnum,
    BasisType,
    CurrencyType,
    BasisTypeEnum,
    CurrenciesEnum,
    ContractDurationUnitTypeEnum,
    StatusTypeEnum
} from './types';
import { TradeExecutor } from './trade-executor';
import { VolatilityRiskManager } from './trade-risk-manager';
import { TradeRewardStructures } from "./trade-reward-structures";
import { ContractParamsFactory } from './contract-factory';
import { IDerivUserAccount } from "./deriv-user-account";
import { StrategyParser } from './trader-strategy-parser';

const logger = pino({
    name: "TradeStrategy",
    level: process.env.LOG_LEVEL || "info",
    serializers: {
        error: pino.stdSerializers.err
    }
});

/**
 * Interface for strategy configuration
 */
interface IStrategyConfig {
    strategyName: string;
    strategySteps: {
        amount: number;
        symbol: MarketType;
        contractType: ContractType;
        contractDurationValue: number;
        contractDurationUnits: ContractDurationUnitType;
        barrier?: number;
        delay?: number;
    }[];
    isAggressive: boolean;
    maxSequence?: number;
    profitPercentage?: number;
    anticipatedProfitPercentage?: number;
    lossRecoveryPercentage?: number;
    maxConsecutiveLosses?: number;
    maxRiskExposure?: number;
}

/**
 * Abstract base class for all trading strategies
 */
export abstract class TradeStrategy {

    protected executor: TradeExecutor;
    protected market: MarketType = MarketTypeEnum.Default
    protected contractType: ContractType = ContractTypeEnum.Default;
    protected basis: BasisType = BasisTypeEnum.Default;
    protected currency: CurrencyType = CurrenciesEnum.Default;
    protected baseStake: number = 1;
    protected contractDurationValue: number = 1;
    protected contractDurationUnits: ContractDurationUnitType = ContractDurationUnitTypeEnum.Default;
    protected userAccountToken: string = "";
    protected previousTradeResultData: IPreviousTradeResult = {} as IPreviousTradeResult;

    protected tradeRewardStructures: TradeRewardStructures;

    // @ts-ignore
    protected volatilityRiskManager: VolatilityRiskManager;

    protected contractFactory: typeof ContractParamsFactory;

    protected strategyParser: StrategyParser;

    protected strategyTemplate: any = [];

    protected predictedDigit: number = 0;

    protected barrier: number | string = 0;

    constructor() {

        this.executor = new TradeExecutor();

        this.tradeRewardStructures = new TradeRewardStructures();

        this.contractFactory = ContractParamsFactory;

        // Initialize strategy parser
        const strategyJson = require("./strategies/StrategyGeneric001.json");
        this.strategyParser = new StrategyParser(strategyJson, this.baseStake);

    }

    /**
     * Executes the trade strategy
     * @abstract
     * @returns {Promise<ITradeData>} Trade execution result
     */
    abstract execute(): Promise<ITradeData>;

    public initializeVolatilityRiskManager(): void {

        // When initializing your risk manager:
        const circuitBreakerConfig = {
            maxAbsoluteLoss: 1000, // $1000 max loss
            maxDailyLoss: 500,     // $500 daily loss
            maxConsecutiveLosses: 5,
            maxBalancePercentageLoss: 0.2, // 20% of balance
            rapidLossTimeWindow: 300000,   // 5 minute window
            rapidLossThreshold: 3,         // 3 losses in 5 minutes
            cooldownPeriod: 1800000        // 30 minute cooldown
        };

        this.volatilityRiskManager = new VolatilityRiskManager(
            this.baseStake, // baseStake ($1)
            this.market, // market V75
            this.currency, // currency
            this.contractType, // contractType
            this.contractDurationValue, // contractDurationValue
            this.contractDurationUnits, // contractDurationUnits (ticks)
            this.strategyParser, // Pass the strategy parser
            circuitBreakerConfig
        );

    }

    protected handleTradeResult(params: any, result: any) {

        // Update risk manager with trade result
        if (this.volatilityRiskManager) {
            this.volatilityRiskManager.processTradeResult({
                ...this.previousTradeResultData,
                resultIsWin: result.status === StatusTypeEnum.Won
            });
        }

        if (result.status === StatusTypeEnum.Blocked) {
            // Handle blocked trade
            console.log(`Trade blocked due to: ${result.message}`);
            // Check cooldown timer
            if (result.metadata?.cooldownRemaining > 0) {
                console.log(`Wait ${result.metadata.cooldownRemaining}ms before retrying`);
            }
        }

        // Handle loss results
        if (result.status === StatusTypeEnum.Lost) {

            // The recordAndCheckLoss() call inside execute() will:
            // 1. Record the loss amount
            // 2. Check for rapid loss pattern
            // 3. Enter safety mode if threshold reached
            this.recordAndCheckLoss(params.amount);

            // Check if we should continue after rapid loss detection
            const rapidLossState = this.volatilityRiskManager?.getRapidLossState();
            if (rapidLossState?.lastDetectedTime) {
                const cooldownRemaining = rapidLossState.lastDetectedTime +
                    (this.volatilityRiskManager.getRapidLossConfig().coolDownMs || 0) - Date.now();

                if (cooldownRemaining > 0) {
                    logger.info(`In rapid loss cooldown: ${cooldownRemaining}ms remaining`);
                    return this.getSafetyExitResult();
                }
            }
        }

        // Check rapid loss status before executing trades
        if (this.volatilityRiskManager) {
            const rapidLossState = this.volatilityRiskManager?.getRapidLossState();

            if (rapidLossState.eventCount > 0) {
                logger.warn(`Rapid loss detected ${rapidLossState.eventCount} times today`);

                // Implement additional protective measures
                if (rapidLossState.eventCount > 3) {
                    // strategy.reduceBaseStake(0.5); // Cut stake by 50%
                }
            }
        }

    }

    /**
     * Gets safety exit parameters
     * @private
     */
    private getSafetyExitResult(reason?: string): any {
        const state = this.volatilityRiskManager?.getCircuitBreakerState();
        return {
            status: 'blocked',
            message: `Trade blocked: ${reason}`,
            timestamp: Date.now(),
            metadata: {
                circuitBreakerState: state,
                cooldownRemaining: state?.lastTriggered
                    ? (state.lastTriggered + this.volatilityRiskManager!.getCircuitBreakerConfig().cooldownPeriod) - Date.now()
                    : 0
            }
        };
    }


    /**
         * Records a loss and checks rapid loss conditions
         * @param amount - Loss amount
         * @protected
         */
    protected recordAndCheckLoss(amount: number): void {
        if (!this.volatilityRiskManager) {
            logger.warn('VolatilityRiskManager not initialized - skipping loss recording');
            return;
        }

        // Record the loss
        this.volatilityRiskManager.recordLoss(amount);
        this.volatilityRiskManager.recordRapidLoss(amount);

        // Check rapid loss conditions
        const rapidLossDetected = this.volatilityRiskManager.checkRapidLosses(amount);

        if (rapidLossDetected) {
            const state = this.volatilityRiskManager.getRapidLossState();
            logger.warn({
                event: 'RAPID_LOSS_DETECTED',
                lossesCount: state.recentLossTimestamps.length,
                totalAmount: state.recentLossAmounts.reduce((a, b) => a + b, 0),
                message: 'Rapid loss threshold exceeded'
            });

            // Optional: Automatically enter safety mode
            this.enterSafetyMode('rapid_loss_detected');
        }
    }

    /**
     * Enters safety mode with cooldown period
     * @param reason - Reason for entering safety mode
     * @protected
     */
    protected enterSafetyMode(reason: string): void {
        if (this.volatilityRiskManager) {
            this.volatilityRiskManager.enterSafetyMode(reason);
        }
        // Additional safety mode actions can be added here
    }

    /**
    * Checks all circuit breakers before executing a trade
    * @protected
    */
    protected checkCircuitBreakers(): { shouldBlock: boolean; reason?: string } {
        if (!this.volatilityRiskManager) {
            logger.debug('Risk manager not available - skipping circuit breaker check');
            return { shouldBlock: false };
        }

        const account = this.getCurrentAccount();
        const shouldBlock = this.volatilityRiskManager.checkCircuitBreakers(account);

        if (shouldBlock) {
            const state = this.volatilityRiskManager.getCircuitBreakerState();
            return {
                shouldBlock: true,
                reason: state.lastReason || 'circuit_breaker_triggered'
            };
        }

        return { shouldBlock: false };
    }

    /**
    * Checks all circuit breakers before executing a trade
    * @protected
    */
    protected checkCircuitBreakersOnFailure(): void {
        // Handle errors and check circuit breakers again on failure
        if (this.volatilityRiskManager) {
            if (this.volatilityRiskManager.checkCircuitBreakers(this.getCurrentAccount())) {
                this.enterSafetyMode('post_trade_circuit_breaker');
            }
        }
    }

    /**
     * Gets current account state
     * @private
     */
    private getCurrentAccount(): IDerivUserAccount {
        return {
            balance: 1000,
            email: "",
            country: "",
            currency: "USD",
            loginid: "",
            user_id: "",
            fullname: ""
        };
    }

    /**
     * Generates martingale-style steps based on reward structure
     * @private
     */
    private generateMartingaleSteps(
        baseAmount: number,
        market: MarketType,
        contractType: ContractType,
        durationValue: number,
        durationUnits: ContractDurationUnitType,
        rewardStructure: { minStake: number; maxStake: number; rewardPercentage: number }[],
        stepCount: number = 4 // Default to 4 steps
    ): Array<{
        amount: number;
        symbol: MarketType;
        contractType: ContractType;
        contractDurationValue: number;
        contractDurationUnits: ContractDurationUnitType;
    }> {
        const steps: any[] = [];
        let currentAmount = baseAmount;

        // Find the optimal stake range from reward structure
        const optimalRange = rewardStructure.find(tier =>
            currentAmount >= tier.minStake && currentAmount <= tier.maxStake
        ) || rewardStructure[rewardStructure.length - 1];

        // Calculate base multiplier based on reward percentage
        // Higher reward % = less aggressive martingale (since win covers more losses)
        const baseMultiplier = 2 - (optimalRange.rewardPercentage / 100);

        for (let i = 0; i < stepCount; i++) {
            // Adjust amount to stay within reward structure tiers
            let adjustedAmount = currentAmount;
            const matchingTier = rewardStructure.find(tier =>
                adjustedAmount >= tier.minStake && adjustedAmount <= tier.maxStake
            );

            if (!matchingTier) {
                // If amount exceeds all tiers, use the max tier's max stake
                adjustedAmount = rewardStructure[rewardStructure.length - 1].maxStake;
            }

            steps.push({
                amount: adjustedAmount,
                symbol: market,
                contractType: contractType,
                contractDurationValue: durationValue,
                contractDurationUnits: durationUnits
            });

            // Martingale progression - next amount is current * multiplier
            currentAmount *= baseMultiplier;
        }

        return steps;
    }

    /**
     * Calculates average profit percentage from reward structure
     * @private
     */
    private calculateAverageProfitPercentage(
        rewardStructure: { minStake: number; maxStake: number; rewardPercentage: number }[]
    ): number {
        if (!rewardStructure || rewardStructure.length === 0) {
            return 80; // Default fallback
        }

        const total = rewardStructure.reduce((sum, tier) => sum + tier.rewardPercentage, 0);
        return total / rewardStructure.length;
    }

    /**
     * Validates trade parameters before execution
     * @param {ContractParams} params - Trade parameters to validate
     * @throws {Error} If parameters are invalid
     */
    protected validateParameters(params: ContractParams): void {

        console.log("::: validateParameters :::", params)

        if (!params) {
            throw new Error('Trade parameters are required');
        }

        if (Number(params.amount) <= 0) {
            throw new Error('Stake amount must be positive');
        }

        if (!params.basis) {
            throw new Error('Basis type must be specified');
        }

        if (!params.currency) {
            throw new Error('Currency must be specified');
        }

        if (!params.duration) {
            throw new Error('Duration must be specified');
        }

        if (!params.duration_unit) {
            throw new Error('Duration units must be specified');
        }

        if (!params.symbol) {
            throw new Error('Market symbol must be specified');
        }

        // Proper Error handling

        // Validate balance before execution
        const validation = this.validateAccountBalance(Number(params.amount));

        if (!validation.isValid) {
            const errorMsg = `Balance validation failed: ${validation.reasons.join(', ')}`;
            logger.error({
                error: new Error(errorMsg),
                validationMetrics: validation.metrics,
                strategy: this.constructor.name
            });
            throw new Error(errorMsg);
        }

        if (this.volatilityRiskManager?.checkRapidLosses()) {
            // TODO: properly handle this
            this.getSafetyExitResult();
            throw new Error('Many rapid losses');
        }

        // Additional validation based on purchase type
        this.validateContractTypeSpecificParams(params);

    }

    /**
     * Validates parameters specific to each purchase type
     * @param {ContractParams} params - Trade parameters
     * @protected
     */
    protected validateContractTypeSpecificParams(params: ContractParams): void {
        switch (this.contractType) {
            case ContractTypeEnum.DigitDiff:
            case ContractTypeEnum.DigitUnder:
            case ContractTypeEnum.DigitOver:
                if (params.barrier === undefined) {
                    throw new Error('Barrier is required for digit-based trades');
                }
                this.validateDigit(Number(params.barrier));
                break;
        }
    }

    /**
     * Sets the predicted digit for digit-based strategies
     * @param {number} predictedDigit - The digit to predict (0-9)
     */
    setPrediction(predictedDigit: number): void {
        this.predictedDigit = this.validateDigit(predictedDigit);
    }

    /**
     * Sets the barrier value for barrier-based strategies
     * @param {number|string} barrier - The barrier value
     */
    setBarrier(barrier: number | string): void {
        this.barrier = this.validateBarrier(barrier);
    }

    /**
     * Validates and normalizes the predicted digit
     * @param {number} digit - The digit to validate (0-9)
     * @returns {number} Validated digit (0-9)
     * @throws {Error} If digit is invalid
     */
    private validateDigit(digit: number): number {
        const validDigit = Math.round(digit);
        if (validDigit < 0 || validDigit > 9) {
            throw new Error('Predicted digit must be between 0-9');
        }
        return validDigit;
    }

    /**
     * Validates and normalizes the barrier value
     * @param {number|string} barrier - The barrier to validate
     * @returns {number|string} Validated barrier
     * @throws {Error} If barrier is invalid
     */
    private validateBarrier(barrier: number | string): number | string {
        if (typeof barrier === "string") {
            if (barrier !== ContractTypeEnum.DigitEven && barrier !== ContractTypeEnum.DigitOdd) {
                return ContractTypeEnum.DigitEven;
            }
            return barrier;
        }

        const validBarrier = Math.round(barrier);
        if (validBarrier < 0 || validBarrier > 9) {
            throw new Error('Barrier must be between 0-9');
        }
        return validBarrier;
    }

    /**
     * Validates account balance against proposed trade
     * @param amount - Proposed trade amount
     * @returns Validation result
     */
    protected validateAccountBalance(amount: number): any {
        if (!this.volatilityRiskManager) {
            logger.warn('VolatilityRiskManager not initialized - skipping balance validation');
            return {
                isValid: true,
                reasons: [],
                metrics: {
                    balance: 0,
                    proposedStake: amount,
                    riskPercentage: 0,
                    requiredMinimum: 0,
                    availableAfterTrade: 0,
                    bypassed: true
                }
            };
        }

        // Mock user account - replace with actual account data
        const userAccount: IDerivUserAccount = {
            balance: 1000, // Implement this method
            currency: this.currency,
            email: "",
            country: "",
            loginid: "",
            user_id: "",
            fullname: ""
        };

        return this.volatilityRiskManager.validateAccountBalance(amount, userAccount);
    }

    /**
     * Performs pre-contract purchase checks
     * @param {ContractType} contractType - The purchase type
     * @protected
     */
    protected async preContractPurchaseChecks(contractType: ContractType): Promise<void> {
        // Check if we're in safety mode
        if (this.volatilityRiskManager && this.volatilityRiskManager.getCurrentState().inSafetyMode) {
            throw new Error('Cannot execute trade while in safety mode');
        }

        const circuitCheck = this.checkCircuitBreakers();
        if (circuitCheck.shouldBlock) {
            logger.warn({
                event: 'TRADE_BLOCKED',
                reason: circuitCheck.reason,
                action: 'Entering safety mode'
            });
            this.enterSafetyMode(circuitCheck.reason!);
            return this.getSafetyExitResult(circuitCheck.reason!);
        }

    }

    /**
     * Gets parameters for the next contract using the factory
     * @param {ContractType} contractType - The purchase type
     * @returns {ContractParams} Parameters for the next contract
     * @protected
     */
    protected getNextContractParams(contractType: ContractType): ContractParams {
        // Get parameters from risk manager if available
        if (this.volatilityRiskManager) {
            const nextParams = this.volatilityRiskManager.getNextTradeParams();

            return this.createParamsFromFactory(
                contractType,
                nextParams.amount,
                nextParams.barrier
            );
        }

        // Fallback to basic parameters using factory
        return this.createParamsFromFactory(
            contractType,
            this.baseStake
        );
    }

    /**
     * Creates contract parameters using the factory
     * @private
     */
    private createParamsFromFactory(
        contractType: ContractType,
        amount: number,
        barrier?: number | string
    ): ContractParams {
        const commonParams = {
            amount,
            currency: this.currency,
            duration: this.contractDurationValue,
            durationUnit: this.contractDurationUnits,
            market: this.market,
            basis: this.basis
        };

        switch (contractType) {
            case ContractTypeEnum.DigitDiff:
                return this.contractFactory.createDigitDiffParams({
                    ...commonParams,
                    predictedDigit: barrier as number ?? this.predictedDigit
                });

            case ContractTypeEnum.DigitOver:
                return this.contractFactory.createDigitOverParams({
                    ...commonParams,
                    predictedDigit: barrier as number ?? (this.barrier as number)
                });

            case ContractTypeEnum.DigitUnder:
                return this.contractFactory.createDigitUnderParams({
                    ...commonParams,
                    predictedDigit: barrier as number ?? (this.barrier as number)
                });

            case ContractTypeEnum.DigitEven:
                return this.contractFactory.createDigitEvenParams({
                    ...commonParams,
                    barrier: ContractTypeEnum.DigitEven
                });

            case ContractTypeEnum.DigitOdd:
                return this.contractFactory.createDigitOddParams({
                    ...commonParams,
                    barrier: ContractTypeEnum.DigitOdd
                });

            case ContractTypeEnum.Call:
            case ContractTypeEnum.Put:
            default:
                return {
                    ...commonParams,
                    contract_type: contractType,
                    symbol: this.market
                };
        }
    }

}

/**
 * Digit Difference trading strategy
 */
export class DigitDiffStrategy extends TradeStrategy {

    /**
     * Creates a new DigitDiffStrategy instance
     * @param {number} predictedDigit - The digit to predict (0-9)
     */
    constructor(contractStrategies: any) {

        super();
        // Set the purchase type of the strategy
        this.contractType = ContractTypeEnum.DigitDiff;

        this.strategyTemplate = contractStrategies;

        this.initializeVolatilityRiskManager();

    }

    /**
     * Executes a DIGITDIFF trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {
        try {
            await this.preContractPurchaseChecks(this.contractType);

            logger.info({
                action: 'executing_strategy',
                strategy: 'DIGITDIFF',
                predictedDigit: this.predictedDigit
            });

            const params = this.getNextContractParams(this.contractType);

            this.validateParameters(params);

            const result = await this.executor.purchaseContract(params, this.userAccountToken);

            this.handleTradeResult(params, result);

            // Update risk manager with trade result
            if (this.volatilityRiskManager) {
                this.volatilityRiskManager.processTradeResult({
                    ...this.previousTradeResultData,
                    resultIsWin: result.status === StatusTypeEnum.Won
                });
            }

            return result;
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITDIFF',
                message: 'Error executing DIGITDIFF strategy'
            });
            this.checkCircuitBreakersOnFailure();
            throw error;
        }
    }

}

/**
 * Digit Even trading strategy
 */
export class DigitEvenStrategy extends TradeStrategy {

    constructor(contractStrategies: any) {

        super();
        // Set the purchase type of the strategy
        this.contractType = ContractTypeEnum.DigitEven;

        this.strategyTemplate = contractStrategies;

        this.initializeVolatilityRiskManager();

    }

    /**
     * Executes a DIGITEVEN trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {
        try {
            await this.preContractPurchaseChecks(this.contractType);

            logger.info({
                action: 'executing_strategy',
                strategy: 'DIGITEVEN'
            });

            const params = this.getNextContractParams(this.contractType);
            this.validateParameters(params);

            const result = await this.executor.purchaseContract(params, this.userAccountToken);

            this.handleTradeResult(params, result);

            // Update risk manager with trade result
            if (this.volatilityRiskManager) {
                this.volatilityRiskManager.processTradeResult({
                    ...this.previousTradeResultData,
                    resultIsWin: result.status === StatusTypeEnum.Won
                });
            }

            return result;
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITEVEN',
                message: 'Error executing DIGITEVEN strategy'
            });
            this.checkCircuitBreakersOnFailure();
            throw error;
        }
    }

}

/**
 * Digit Odd trading strategy
 */
export class DigitOddStrategy extends TradeStrategy {

    constructor(contractStrategies: any) {
        super();
        // Set the purchase type of the strategy
        this.contractType = ContractTypeEnum.DigitOdd;

        this.strategyTemplate = contractStrategies;

        this.initializeVolatilityRiskManager();

    }

    /**
     * Executes a DIGITODD trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {
        try {
            await this.preContractPurchaseChecks(this.contractType);

            logger.info({
                action: 'executing_strategy',
                strategy: 'DIGITODD'
            });

            const params = this.getNextContractParams(this.contractType);
            this.validateParameters(params);

            const result = await this.executor.purchaseContract(params, this.userAccountToken);

            this.handleTradeResult(params, result);

            // Update risk manager with trade result
            if (this.volatilityRiskManager) {
                this.volatilityRiskManager.processTradeResult({
                    ...this.previousTradeResultData,
                    resultIsWin: result.status === StatusTypeEnum.Won
                });
            }

            return result;
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITODD',
                message: 'Error executing DIGITODD strategy'
            });
            this.checkCircuitBreakersOnFailure();
            throw error;
        }
    }

}

/**
 * Call trading strategy
 */
export class CallStrategy extends TradeStrategy {

    constructor(contractStrategies: any) {
        super();
        // Set the purchase type of the strategy
        this.contractType = ContractTypeEnum.Call;

        this.strategyTemplate = contractStrategies;

        this.initializeVolatilityRiskManager();

    }

    /**
     * Executes a CALLE trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {
        try {
            await this.preContractPurchaseChecks(this.contractType);

            logger.info({
                action: 'executing_strategy',
                strategy: 'CALLE'
            });

            const params = this.getNextContractParams(this.contractType);
            this.validateParameters(params);

            const result = await this.executor.purchaseContract(params, this.userAccountToken);

            this.handleTradeResult(params, result);

            // Update risk manager with trade result
            if (this.volatilityRiskManager) {
                this.volatilityRiskManager.processTradeResult({
                    ...this.previousTradeResultData,
                    resultIsWin: result.status === StatusTypeEnum.Won
                });
            }

            return result;
        } catch (error) {
            logger.error({
                error,
                strategy: 'CALLE',
                message: 'Error executing CALLE strategy'
            });
            this.checkCircuitBreakersOnFailure();
            throw error;
        }
    }

}

/**
 * Put trading strategy
 */
export class PutStrategy extends TradeStrategy {

    constructor(contractStrategies: any) {
        super();
        // Set the purchase type of the strategy
        this.contractType = ContractTypeEnum.Put;

        this.strategyTemplate = contractStrategies;

        this.initializeVolatilityRiskManager();

    }

    /**
     * Executes a PUTE trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {
        try {
            await this.preContractPurchaseChecks(this.contractType);

            logger.info({
                action: 'executing_strategy',
                strategy: 'PUTE'
            });

            const params = this.getNextContractParams(this.contractType);
            this.validateParameters(params);

            const result = await this.executor.purchaseContract(params, this.userAccountToken);

            this.handleTradeResult(params, result);

            // Update risk manager with trade result
            if (this.volatilityRiskManager) {
                this.volatilityRiskManager.processTradeResult({
                    ...this.previousTradeResultData,
                    resultIsWin: result.status === StatusTypeEnum.Won
                });
            }

            return result;
        } catch (error) {
            logger.error({
                error,
                strategy: 'PUTE',
                message: 'Error executing PUTE strategy'
            });
            this.checkCircuitBreakersOnFailure();
            throw error;
        }
    }

}



/**
 * Digit Under trading strategy
 */
export class DigitUnderStrategy extends TradeStrategy {

    /**
     * Creates a new DigitUnderStrategy instance
     * @param {number} barrier - The barrier value (0-9)
     */
    constructor(contractStrategies: any) {
        super();
        // Set the purchase type of the strategy
        this.contractType = ContractTypeEnum.DigitUnder;

        this.strategyTemplate = contractStrategies;

        this.initializeVolatilityRiskManager();

    }

    /**
     * Executes a DIGITUNDER trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {
        try {
            await this.preContractPurchaseChecks(this.contractType);

            logger.info({
                action: 'executing_strategy',
                strategy: 'DIGITUNDER',
                barrier: this.barrier
            });

            const params = this.getNextContractParams(this.contractType);

            this.validateParameters(params);

            const result = await this.executor.purchaseContract(params, this.userAccountToken);

            this.handleTradeResult(params, result);

            // Update risk manager with trade result
            if (this.volatilityRiskManager) {
                this.volatilityRiskManager.processTradeResult({
                    ...this.previousTradeResultData,
                    resultIsWin: result.status === StatusTypeEnum.Won
                });
            }

            return result;
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITUNDER',
                message: 'Error executing DIGITUNDER strategy'
            });
            this.checkCircuitBreakersOnFailure();
            throw error;
        }
    }

}

/**
 * Digit Over trading strategy
 */
export class DigitOverStrategy extends TradeStrategy {

    /**
     * Creates a new DigitOverStrategy instance
     * @param {number} barrier - The barrier value (0-9)
     */
    constructor(contractStrategies: any) {
        super();
        // Set the purchase type of the strategy
        this.contractType = ContractTypeEnum.DigitOver;

        this.strategyTemplate = contractStrategies;

        this.initializeVolatilityRiskManager();

    }

    /**
     * Executes a DIGITOVER trade
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async execute(): Promise<ITradeData> {
        try {
            await this.preContractPurchaseChecks(this.contractType);

            logger.info({
                action: 'executing_strategy',
                strategy: 'DIGITOVER',
                barrier: this.barrier
            });

            const params = this.getNextContractParams(this.contractType);

            this.validateParameters(params);

            const result = await this.executor.purchaseContract(params, this.userAccountToken);

            this.handleTradeResult(params, result);

            // Update risk manager with trade result
            if (this.volatilityRiskManager) {
                this.volatilityRiskManager.processTradeResult({
                    ...this.previousTradeResultData,
                    resultIsWin: result.status === StatusTypeEnum.Won
                });
            }

            return result;
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITOVER',
                message: 'Error executing DIGITOVER strategy'
            });
            this.checkCircuitBreakersOnFailure();
            throw error;
        }
    }

}