import { getRandomDigit } from '@/common/utils/snippets';
import { IDerivUserAccount } from './deriv-user-account';
import { StrategyRewards, BasisType, ContractType, BasisTypeEnum, ContractTypeEnum, IPreviousTradeResult } from './types';
import { pino } from "pino";
import { StrategyParser } from './trader-strategy-parser';
import { StrategyConfig, StrategyStepOutput, StrategyMetrics, StrategyMeta, StrategyVisualization } from './trader-strategy-parser';

// Initialize logger
const logger = pino({
    name: "StrategyVolatilityRiskManager",
    level: process.env.LOG_LEVEL || "info",
    serializers: {
        error: pino.stdSerializers.err
    }
});

// Constants
const MAX_RECOVERY_ATTEMPTS = 5;
const SAFETY_COOLDOWN_MS = 5000;
const RAPID_LOSS_THRESHOLD = 3;
const RAPID_LOSS_TIME_WINDOW = 60000;

interface CircuitBreakerConfig {
    maxAbsoluteLoss: number;
    maxDailyLoss: number;
    maxConsecutiveLosses: number;
    maxBalancePercentageLoss: number;
    rapidLossTimeWindow: number;
    rapidLossThreshold: number;
    cooldownPeriod: number;
}

interface RapidLossState {
    recentLossTimestamps: number[];
    recentLossAmounts: number[];
    eventCount: number;
    lastDetectedTime: number;
}

interface CircuitBreakerState {
    triggered: boolean;
    lastTriggered: number;
    lastReason: string;
    inSafetyMode: boolean;
    safetyModeUntil: number;
}

interface NextTradeParams {
    basis: BasisType;
    symbol: string;
    amount: number;
    barrier: string | number;
    currency: string;
    contractType: ContractType;
    contractDurationValue: number;
    contractDurationUnits: string;
    previousResultStatus: boolean;
    consecutiveLosses: number;
    totalAmountToRecover: number;
    winningTrades: number;
    losingTrades: number;
    metadata?: {
        safetyMode?: boolean;
        reason?: string;
        cooldownRemaining?: number;
    };
}

export class VolatilityRiskManager {
    private strategyParser: StrategyParser;
    private baseStake: number;
    private market: string;
    private currency: string;
    private contractType: ContractType;
    private contractDurationValue: number;
    private contractDurationUnits: string;
    private circuitBreakerConfig: CircuitBreakerConfig;
    private rapidLossState: RapidLossState;
    private circuitBreakerState: CircuitBreakerState;

    // Trade state tracking
    private resultIsWin: boolean = false;
    private consecutiveLosses: number = 0;
    private totalLossAmount: number = 0;
    private winningTrades: number = 0;
    private losingTrades: number = 0;
    private totalTrades: number = 0;
    private recoveryAttempts: number = 0;
    private lastTradeTimestamp: number = 0;
    private inSafetyMode: boolean = false;
    private safetyModeUntil: number = 0;
    private dailyLossAmount: number = 0;

    constructor(
        baseStake: number,
        market: string,
        currency: string,
        contractType: ContractType,
        contractDurationValue: number,
        contractDurationUnits: string,
        strategyParser: StrategyParser,
        circuitBreakerConfig?: CircuitBreakerConfig
    ) {
        this.baseStake = baseStake;
        this.market = market;
        this.currency = currency;
        this.contractType = contractType;
        this.contractDurationValue = contractDurationValue;
        this.contractDurationUnits = contractDurationUnits;
        this.strategyParser = strategyParser;

        // Initialize circuit breakers with defaults or provided config
        this.circuitBreakerConfig = circuitBreakerConfig || {
            maxAbsoluteLoss: 1000,
            maxDailyLoss: 500,
            maxConsecutiveLosses: 5,
            maxBalancePercentageLoss: 0.2,
            rapidLossTimeWindow: 300000,
            rapidLossThreshold: 3,
            cooldownPeriod: 1800000
        };

        this.rapidLossState = {
            recentLossTimestamps: [],
            recentLossAmounts: [],
            eventCount: 0,
            lastDetectedTime: 0
        };

        this.circuitBreakerState = {
            triggered: false,
            lastTriggered: 0,
            lastReason: '',
            inSafetyMode: false,
            safetyModeUntil: 0
        };

        this.validateInitialization();
    }

    private validateInitialization(): void {
        if (this.baseStake <= 0) throw new Error("Base stake must be positive");
        if (!this.market) throw new Error("Market must be specified");
        if (!this.currency) throw new Error("Currency must be specified");
        if (!Object.values(ContractTypeEnum).includes(this.contractType)) {
            throw new Error("Invalid contract type");
        }
    }

    public processTradeResult(tradeResult: IPreviousTradeResult): NextTradeParams {
        if (!this.validateTradeResult(tradeResult)) {
            logger.warn("Invalid trade result received");
            return this.getSafetyExitResult("invalid_trade_data");
        }

        this.totalTrades++;
        this.resultIsWin = tradeResult.resultIsWin;
        this.lastTradeTimestamp = Date.now();

        try {
            if (this.shouldEnterSafetyMode(tradeResult)) {
                this.enterSafetyMode("excessive_losses");
            }

            return this.resultIsWin ? this.handleWin() : this.handleLoss();
        } catch (error) {
            logger.error(error, "Error processing trade result");
            this.enterSafetyMode("processing_error");
        }

        return this.getNextTradeParams();
        
    }

    private handleWin(): NextTradeParams {
        this.consecutiveLosses = 0;
        this.winningTrades++;
        this.recoveryAttempts = 0;

        if (this.totalLossAmount > 0) {
            const recoveredAmount = this.calculateRecoveredAmount();
            this.totalLossAmount = Math.max(0, this.totalLossAmount - recoveredAmount);

            if (this.totalLossAmount === 0) {
                logger.info("Full recovery achieved");
                this.resetRecoveryState();
            } else {
                logger.info(`Partial recovery: ${recoveredAmount} recovered, ${this.totalLossAmount} remaining`);
            }
        } else {
            this.resetRecoveryState();
        }

        return this.getNextTradeParams();
    }

    private handleLoss(): NextTradeParams {
        this.consecutiveLosses++;
        this.losingTrades++;
        this.recoveryAttempts++;

        const lossAmount = this.calculateLossAmount();
        this.totalLossAmount += lossAmount;

        logger.warn(`Loss recorded. Total loss: ${this.totalLossAmount}, Consecutive: ${this.consecutiveLosses}`);

        if (this.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
            this.enterSafetyMode("max_recovery_attempts");
        }

        return this.getNextTradeParams();
    }

    public getNextTradeParams(): NextTradeParams {
        try {
            const strategyConfig = this.strategyParser.getStrategyConfig();
            const steps = this.strategyParser.getAllSteps();

            // Get the appropriate step based on consecutive losses
            const stepIndex = Math.min(this.consecutiveLosses, steps.length - 1);
            const step = steps[stepIndex];

            return {
                basis: step.basis || strategyConfig.basis,
                symbol: step.symbol || this.market,
                amount: step.amount,
                barrier: step.barrier || this.getBarrier(step.contract_type),
                currency: step.currency || strategyConfig.currency,
                contractType: step.contract_type || this.contractType,
                contractDurationValue: step.duration || this.contractDurationValue,
                contractDurationUnits: step.duration_unit || this.contractDurationUnits,
                previousResultStatus: this.resultIsWin,
                consecutiveLosses: this.consecutiveLosses,
                totalAmountToRecover: this.totalLossAmount,
                winningTrades: this.winningTrades,
                losingTrades: this.losingTrades
            };
        } catch (error) {
            logger.error("Error getting next trade params, using fallback", error);
            return this.getBaseTradeParams();
        }
    }

    private getBaseTradeParams(): NextTradeParams {
        return {
            basis: BasisTypeEnum.Default,
            symbol: this.market,
            amount: this.baseStake,
            barrier: this.getBarrier(this.contractType),
            currency: this.currency,
            contractType: this.contractType,
            contractDurationValue: this.contractDurationValue,
            contractDurationUnits: this.contractDurationUnits,
            previousResultStatus: this.resultIsWin,
            consecutiveLosses: this.consecutiveLosses,
            totalAmountToRecover: this.totalLossAmount,
            winningTrades: this.winningTrades,
            losingTrades: this.losingTrades
        };
    }

    private getBarrier(contractType: ContractType): string | number {
        switch (contractType) {
            case ContractTypeEnum.DigitEven: return "DIGITEVEN";
            case ContractTypeEnum.DigitOdd: return "DIGITODD";
            case ContractTypeEnum.DigitDiff: return getRandomDigit();
            case ContractTypeEnum.DigitUnder: return 5;
            case ContractTypeEnum.DigitOver: return 5;
            // Add other contract types as needed
            default: return getRandomDigit();
        }
    }

    private calculateRecoveredAmount(): number {
        const strategyConfig = this.strategyParser.getStrategyConfig();
        const currentStep = this.getCurrentStep();

        const stake = currentStep.amount;
        const profitPercentage = this.strategyParser.getStrategyMetrics().averageRewardToRiskRatio * 100;
        return stake * (1 + profitPercentage / 100);
    }

    private calculateLossAmount(): number {
        const currentStep = this.getCurrentStep();
        const stake = currentStep.amount;
        const profitPercentage = this.strategyParser.getStrategyMetrics().averageRewardToRiskRatio * 100;
        return stake * (1 + profitPercentage / 100);
    }

    private getCurrentStep(): StrategyStepOutput {
        const steps = this.strategyParser.getAllSteps();
        const stepIndex = Math.min(this.consecutiveLosses, steps.length - 1);
        return steps[stepIndex];
    }

    private shouldEnterSafetyMode(tradeResult: IPreviousTradeResult): boolean {
        if (this.inSafetyMode && this.safetyModeUntil > Date.now()) {
            return true;
        }

        const strategyConfig = this.strategyParser.getStrategyConfig();

        if (this.consecutiveLosses >= strategyConfig.maxConsecutiveLosses * 2) {
            return true;
        }

        if (this.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
            return true;
        }

        if (tradeResult.userAccount.balance < this.baseStake * 3) {
            return true;
        }

        if (this.totalLossAmount > this.baseStake * strategyConfig.maxRiskExposure) {
            return true;
        }

        return false;
    }

    private getSafetyExitResult(reason: string): NextTradeParams {
        const cooldownRemaining = this.safetyModeUntil > Date.now()
            ? this.safetyModeUntil - Date.now()
            : 0;

        return {
            ...this.getBaseTradeParams(),
            amount: this.baseStake,
            barrier: 5,
            metadata: {
                safetyMode: true,
                reason,
                cooldownRemaining
            }
        };
    }

    private validateTradeResult(data: IPreviousTradeResult): boolean {
        if (!data || typeof data !== 'object') return false;
        if (!data.strategyParams || typeof data.strategyParams !== 'object') return false;
        if (typeof data.resultIsWin !== 'boolean') return false;
        if (typeof data.baseStake !== 'number' || data.baseStake <= 0) return false;
        if (!data.userAccount || typeof data.userAccount.balance !== 'number') return false;
        return true;
    }

    private resetRecoveryState(): void {
        this.consecutiveLosses = 0;
    }

    // Additional helper methods
    public getCurrentState() {
        return {
            basis: BasisTypeEnum.Default,
            symbol: this.market,
            amount: this.baseStake,
            barrier: null,
            currency: this.currency,
            contractType: this.contractType,
            contractDurationValue: this.contractDurationValue,
            contractDurationUnits: this.contractDurationUnits,
            previousResultStatus: this.resultIsWin,
            consecutiveLosses: this.consecutiveLosses,
            totalAmountToRecover: this.totalLossAmount,
            winningTrades: this.winningTrades,
            losingTrades: this.losingTrades,
            inSafetyMode: this.inSafetyMode,
            recoveryAttempts: this.recoveryAttempts
        };
    }

    public getStrategyMetrics(): StrategyMetrics {
        return this.strategyParser.getStrategyMetrics();
    }

    public getStrategyMeta(): StrategyMeta {
        return this.strategyParser.getMetaInfo();
    }

    public getStrategyVisualization(): StrategyVisualization {
        return this.strategyParser.generateVisualization();
    }

    /**
     * Checks for rapid loss patterns
     * @param amount Optional loss amount to record before checking
     * @returns boolean indicating if rapid losses were detected
     */
    public checkRapidLosses(amount?: number): boolean {
        if (amount !== undefined) {
            this.recordRapidLoss(amount);
        }

        // Filter losses that are within the time window
        const now = Date.now();
        const recentLosses = this.rapidLossState.recentLossTimestamps.filter(
            timestamp => now - timestamp <= this.circuitBreakerConfig.rapidLossTimeWindow
        );

        // Update state with only recent losses
        this.rapidLossState.recentLossTimestamps = recentLosses;
        this.rapidLossState.recentLossAmounts = this.rapidLossState.recentLossAmounts.slice(
            0, recentLosses.length
        );

        // Check if threshold is exceeded
        if (recentLosses.length >= this.circuitBreakerConfig.rapidLossThreshold) {
            this.rapidLossState.eventCount++;
            this.rapidLossState.lastDetectedTime = now;
            return true;
        }

        return false;
    }

    /**
     * Records a rapid loss event
     * @param amount Loss amount to record
     */
    public recordRapidLoss(amount: number): void {
        const now = Date.now();
        this.rapidLossState.recentLossTimestamps.push(now);
        this.rapidLossState.recentLossAmounts.push(amount);
    }

    /**
     * Records a loss and updates daily loss tracking
     * @param amount Loss amount to record
     */
    public recordLoss(amount: number): void {
        this.totalLossAmount += amount;
        this.dailyLossAmount += amount;
        this.losingTrades++;
    }

    /**
     * Validates account balance against proposed trade amount
     * @param amount Proposed trade amount
     * @param account User account information
     * @returns Validation result
     */
    public validateAccountBalance(amount: number, account: IDerivUserAccount): {
        isValid: boolean;
        reasons: string[];
        metrics: {
            balance: number;
            proposedStake: number;
            riskPercentage: number;
            requiredMinimum: number;
            availableAfterTrade: number;
        };
    } {
        const reasons: string[] = [];
        const balance = account.balance;
        const riskPercentage = (amount / balance) * 100;
        const availableAfterTrade = balance - amount;
        const requiredMinimum = this.baseStake * 3; // Minimum 3x base stake

        // Check various balance conditions
        if (amount > balance) {
            reasons.push('insufficient_balance');
        }
        if (availableAfterTrade < requiredMinimum) {
            reasons.push('minimum_balance_violation');
        }
        if (riskPercentage > this.circuitBreakerConfig.maxBalancePercentageLoss * 100) {
            reasons.push('max_risk_exceeded');
        }

        return {
            isValid: reasons.length === 0,
            reasons,
            metrics: {
                balance,
                proposedStake: amount,
                riskPercentage,
                requiredMinimum,
                availableAfterTrade
            }
        };
    }

    /**
     * Checks all circuit breakers
     * @param account User account information
     * @returns boolean indicating if any circuit breaker was triggered
     */
    public checkCircuitBreakers(account: IDerivUserAccount): boolean {
        const now = Date.now();
        let triggered = false;
        let reason = '';

        // Check daily loss limit
        if (this.dailyLossAmount >= this.circuitBreakerConfig.maxDailyLoss) {
            triggered = true;
            reason = 'daily_loss_limit';
        }

        // Check absolute loss limit
        if (this.totalLossAmount >= this.circuitBreakerConfig.maxAbsoluteLoss) {
            triggered = true;
            reason = 'absolute_loss_limit';
        }

        // Check consecutive losses
        if (this.consecutiveLosses >= this.circuitBreakerConfig.maxConsecutiveLosses) {
            triggered = true;
            reason = 'max_consecutive_losses';
        }

        // Check balance percentage
        const balanceCheck = this.validateAccountBalance(this.baseStake, account);
        if (!balanceCheck.isValid) {
            triggered = true;
            reason = 'balance_validation_failed';
        }

        // Check rapid losses
        if (this.checkRapidLosses()) {
            triggered = true;
            reason = 'rapid_loss_detected';
        }

        // Update circuit breaker state if triggered
        if (triggered) {
            this.circuitBreakerState = {
                triggered: true,
                lastTriggered: now,
                lastReason: reason,
                inSafetyMode: true,
                safetyModeUntil: now + this.circuitBreakerConfig.cooldownPeriod
            };
            logger.warn(`Circuit breaker triggered: ${reason}`);
        }

        return triggered;
    }

    /**
     * Gets the current circuit breaker state
     * @returns CircuitBreakerState
     */
    public getCircuitBreakerState(): CircuitBreakerState {
        return this.circuitBreakerState;
    }

    /**
     * Gets the rapid loss configuration
     * @returns Rapid loss configuration
     */
    public getRapidLossConfig(): { coolDownMs: number } {
        return {
            coolDownMs: this.circuitBreakerConfig.cooldownPeriod
        };
    }

    /**
     * Gets the current rapid loss state
     * @returns RapidLossState
     */
    public getRapidLossState(): RapidLossState {
        return this.rapidLossState;
    }

    /**
     * Gets the circuit breaker configuration
     * @returns CircuitBreakerConfig
     */
    public getCircuitBreakerConfig(): CircuitBreakerConfig {
        return this.circuitBreakerConfig;
    }

    /**
     * Enters safety mode with optional cooldown period
     * @param reason Reason for entering safety mode
     * @param cooldownMs Optional cooldown period in milliseconds
     */
    public enterSafetyMode(reason: string, cooldownMs?: number): void {
        const now = Date.now();
        this.inSafetyMode = true;
        this.safetyModeUntil = now + (cooldownMs || this.circuitBreakerConfig.cooldownPeriod);
        this.circuitBreakerState = {
            ...this.circuitBreakerState,
            inSafetyMode: true,
            safetyModeUntil: this.safetyModeUntil,
            lastReason: reason
        };
        logger.warn(`Entered safety mode: ${reason}`);
    }

}

