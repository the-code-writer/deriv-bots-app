import { getRandomDigit } from '@/common/utils/snippets';
import { IDerivUserAccount } from './deriv-user-account';
import { StrategyRewards, BasisType, ContractType, BasisTypeEnum, ContractTypeEnum, IPreviousTradeResult, ITradeData, MarketTypeEnum, CurrenciesEnum, ContractDurationUnitTypeEnum, CurrencyType, ContractDurationUnitType, MarketType } from './types';
import { pino } from "pino";
import { StrategyParser } from './trader-strategy-parser';
import { StrategyConfig, StrategyStepOutput, StrategyMetrics, StrategyMeta, StrategyVisualization } from './trader-strategy-parser';
import { roundToTwoDecimals } from '../../common/utils/snippets';

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

export interface CircuitBreakerConfig {
    // Existing properties
    maxAbsoluteLoss: number;
    maxDailyLoss: number;
    maxConsecutiveLosses: number;
    maxBalancePercentageLoss: number;

    // Improved rapid loss properties
    rapidLoss: {
        timeWindowMs: number;          // Monitoring window (e.g., 30000 = 30 seconds)
        threshold: number;             // Losses needed to trigger (e.g., 2)
        initialCooldownMs: number;     // First cooldown period (e.g., 30000 = 30s)
        maxCooldownMs: number;         // Maximum cooldown (e.g., 300000 = 5min)
        cooldownMultiplier: number;    // How much to increase cooldown each time (e.g., 2 = double)
    };

    // Other properties
    cooldownPeriod: number;
}

export interface RapidLossState {
    recentLosses: Array<{
        timestamp: number;
        amount: number;
    }>;
    lastTriggerTime: number;
    triggerCount: number;
    currentCooldownMs: number;
    isActive: boolean;
}

// Interface for the current trade manager state
export interface TradeManagerState {
    basis: string;
    symbol: string;
    amount: number;
    barrier: number | string | null;
    currency: string;
    contractType: string;
    contractDurationValue: number;
    contractDurationUnits: string;
    previousResultStatus: boolean;
    consecutiveLosses: number;
    totalAmountToRecover: number;
    maximumStakeValue: number;
    minimumStakeValue: number;
    winningTrades: number;
    losingTrades: number;
    inSafetyMode: boolean;
    recoveryAttempts: number;
}

export interface CircuitBreakerState {
    triggered: boolean;
    lastTriggered: number;
    lastReason: string;
    reasons: string[];
    inSafetyMode: boolean;
    safetyModeUntil: number;
}

interface RapidLossEvent {
    event: 'RAPID_LOSS_DETECTED';
    lossesCount: number;
    totalAmount: number;
    triggerCount: number;
    currentCooldown: number;
    message: string;
    // Optional timestamp for when the event occurred
    timestamp?: number;
    // Optional details about individual losses
    recentLosses?: Array<{
        timestamp: number;
        amount: number;
    }>;
}


// Interface for the safety mode response
export interface SafetyModeResponse {
    status: string;
    message: string;
    timestamp: number;
    metadata: {
        rapidLosses?: RapidLossEvent,
        currentState?: TradeManagerState;
        circuitBreakerState?: CircuitBreakerState;
        cooldownRemaining?: number;
    };
}

export interface NextTradeParams {
    basis: BasisType;
    symbol: MarketType;
    amount: number;
    barrier: string | number;
    currency: CurrencyType;
    contractType: ContractType;
    contractDurationValue: number;
    contractDurationUnits: ContractDurationUnitType;
    previousResultStatus: boolean;
    consecutiveLosses: number;
    totalAmountToRecover: number;
    maximumStakeValue: number;
    minimumStakeValue: number;
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
    private market: MarketType;
    private currency: CurrencyType;
    private contractType: ContractType;
    private contractDurationValue: number;
    private contractDurationUnits: ContractDurationUnitType;
    private circuitBreakerConfig: CircuitBreakerConfig;
    private rapidLossState: RapidLossState;
    private circuitBreakerState: CircuitBreakerState;

    // Trade state tracking
    private resultIsWin: boolean = false;
    private consecutiveLosses: number = 0;
    private totalLossAmount: number = 0;
    private maximumStakeValue: number = 0;
    private minimumStakeValue: number = 0;
    private winningTrades: number = 0;
    private losingTrades: number = 0;
    private totalTrades: number = 0;
    private recoveryAttempts: number = 0;
    private lastTradeTimestamp: number = 0;
    private inSafetyMode: boolean = false;
    private safetyModeUntil: number = 0;
    private dailyLossAmount: number = 0;

    private isEmergencyRecovery: boolean = false;

    constructor(
        baseStake: number,
        market: MarketType,
        currency: CurrencyType,
        contractType: ContractType,
        contractDurationValue: number,
        contractDurationUnits: ContractDurationUnitType,
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
            maxBalancePercentageLoss: 0.5,

            rapidLoss: {
                timeWindowMs: 30000,     // 30 second window
                threshold: 2,            // 2 losses in 30s triggers
                initialCooldownMs: 30000, // 30s initial cooldown
                maxCooldownMs: 300000,   // 5min maximum cooldown
                cooldownMultiplier: 2    // Double cooldown each time
            },

            cooldownPeriod: 60000        // 1min for other circuit breakers
        };

        this.rapidLossState = {
            recentLosses: [],
            lastTriggerTime: 0,
            triggerCount: 0,
            currentCooldownMs: 0,
            isActive: false,
        };

        this.circuitBreakerState = {
            triggered: false,
            lastTriggered: 0,
            lastReason: '',
            reasons: [],
            inSafetyMode: false,
            safetyModeUntil: 0,
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

    public processTradeResult(tradeResult: ITradeData): NextTradeParams {
        if (!this.validateTradeResult(tradeResult)) {
            logger.warn(
                { message: "Invalid trade result received", tradeResult });
            return this.getSafetyExitResult("invalid_trade_data");
        }

        this.totalTrades++;
        this.resultIsWin = tradeResult.profit_is_win;
        this.lastTradeTimestamp = Date.now();

        if (this.minimumStakeValue === 0) {
            this.minimumStakeValue = tradeResult.buy_price_value;
        }

        if (this.maximumStakeValue === 0) {
            this.maximumStakeValue = tradeResult.buy_price_value;
        }

        if (tradeResult.buy_price_value > this.maximumStakeValue) {
            this.maximumStakeValue = tradeResult.buy_price_value;
        }

        if (tradeResult.buy_price_value < this.minimumStakeValue) {
            this.minimumStakeValue = tradeResult.buy_price_value;
        }

        try {
            if (this.shouldEnterSafetyMode(tradeResult)) {
                this.enterSafetyMode("excessive_losses");
            }
            return this.resultIsWin ? this.handleWin(tradeResult) : this.handleLoss(tradeResult);
        } catch (error) {
            logger.error(error, "Error processing trade result");
            this.enterSafetyMode("processing_error");
        }

        return this.getNextTradeParams();
        
    }

    private handleWin(tradeResult: ITradeData): NextTradeParams {
        this.consecutiveLosses = 0;
        this.winningTrades++;
        this.recoveryAttempts = 0;

        if (this.totalLossAmount > 0) {

            const recoveredAmount = this.calculateRecoveredAmount(tradeResult);

            this.totalLossAmount = Math.max(0, this.totalLossAmount - recoveredAmount);

            if (this.totalLossAmount === 0) {
                logger.info("Full recovery achieved");
                this.resetRecoveryState();
            } else {
                logger.info(`Partial recovery: ${recoveredAmount} recovered, ${this.totalLossAmount} remaining`);
                this.isEmergencyRecovery = true;
            }
        } else {
            this.resetRecoveryState();
        }

        return this.getNextTradeParams();

    }

    private handleLoss(tradeResult: ITradeData): NextTradeParams {
        this.consecutiveLosses++;
        this.losingTrades++;
        this.recoveryAttempts++;

        const lossAmount = this.calculateLossAmount(tradeResult);

        this.totalLossAmount += lossAmount;
        this.dailyLossAmount += lossAmount;

        logger.warn(`Loss recorded. Trade loss: ${lossAmount}, Total loss: ${this.totalLossAmount}, Consecutive: ${this.consecutiveLosses}`);

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

            if (this.isEmergencyRecovery) {
                this.isEmergencyRecovery = false;
                return {
                    basis: BasisTypeEnum.Default,
                    symbol: MarketTypeEnum.Default,
                    amount: roundToTwoDecimals(this.totalLossAmount * 12),
                    barrier: getRandomDigit(),
                    currency: CurrenciesEnum.Default,
                    contractType: ContractTypeEnum.DigitDiff,
                    contractDurationValue: 1,
                    contractDurationUnits: ContractDurationUnitTypeEnum.Default,
                    previousResultStatus: this.resultIsWin,
                    consecutiveLosses: this.consecutiveLosses,
                    totalAmountToRecover: this.totalLossAmount,
                    maximumStakeValue: this.maximumStakeValue,
                    minimumStakeValue: this.minimumStakeValue,
                    winningTrades: this.winningTrades,
                    losingTrades: this.losingTrades
                };
            } else {
                
            return {
                basis: step.basis || strategyConfig.basis,
                symbol: step.symbol || this.market,
                amount: roundToTwoDecimals(step.amount),
                barrier: step.barrier || this.getBarrier(step.contract_type),
                currency: step.currency || strategyConfig.currency,
                contractType: step.contract_type || this.contractType,
                contractDurationValue: step.duration || this.contractDurationValue,
                contractDurationUnits: step.duration_unit || this.contractDurationUnits,
                previousResultStatus: this.resultIsWin,
                consecutiveLosses: this.consecutiveLosses,
                totalAmountToRecover: this.totalLossAmount,
                maximumStakeValue: this.maximumStakeValue,
                minimumStakeValue: this.minimumStakeValue,
                winningTrades: this.winningTrades,
                losingTrades: this.losingTrades
            };

            }

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
            maximumStakeValue: this.maximumStakeValue,
            minimumStakeValue: this.minimumStakeValue,
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

    private calculateRecoveredAmount(tradeResult: ITradeData): number {
        return tradeResult.safeProfit;
    }

    private calculateLossAmount(tradeResult: ITradeData): number {
        return tradeResult.buy_price_value;
    }

    private getCurrentStep(): StrategyStepOutput {
        const steps = this.strategyParser.getAllSteps();
        const stepIndex = Math.min(this.consecutiveLosses, steps.length - 1);
        return steps[stepIndex];
    }

    private shouldEnterSafetyMode(tradeResult: ITradeData): boolean {
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

    private validateTradeResult(data: ITradeData): boolean {
        // Basic type checks for required fields
        if (typeof data !== 'object' || data === null) return false;

        const requiredFields = [
            'symbol_short', 'symbol_full', 'start_time', 'expiry_time', 'purchase_time',
            'entry_spot_value', 'entry_spot_time', 'exit_spot_value', 'exit_spot_time',
            'ask_price_currency', 'ask_price_value', 'buy_price_currency', 'buy_price_value',
            'buy_transaction', 'bid_price_currency', 'bid_price_value', 'sell_price_currency',
            'sell_price_value', 'sell_spot', 'sell_spot_time', 'sell_transaction',
            'payout', 'payout_currency', 'profit_value', 'profit_currency',
            'profit_percentage', 'profit_is_win', 'profit_sign', 'status',
            'longcode', 'proposal_id', 'userAccount', 'audit_details', 'ticks'
        ];

        for (const field of requiredFields) {
            if (!(field in data)) {
                console.error(`Missing required field: ${field}`);
                return false;
            }
        }

        // Validate nested userAccount
        if (typeof data.userAccount !== 'object' || data.userAccount === null) return false;
        const requiredUserFields = ['email', 'country', 'currency', 'loginid', 'user_id', 'fullname', 'token'];
        for (const field of requiredUserFields) {
            if (!(field in data.userAccount)) {
                console.error(`Missing required userAccount field: ${field}`);
                return false;
            }
        }

        // Validate audit_details array
        if (!Array.isArray(data.audit_details)) return false;
        for (const detail of data.audit_details) {
            if (typeof detail !== 'object' || detail === null) return false;
            if (!('epoch' in detail) || typeof detail.epoch !== 'number') return false;
            //if (!('tick' in detail) || typeof detail.tick !== 'number') return false;
        }

        // Basic type checks for other fields
        if (typeof data.symbol_short !== 'string') return false;
        if (typeof data.symbol_full !== 'string') return false;
        if (typeof data.start_time !== 'number') return false;
        if (typeof data.expiry_time !== 'number') return false;

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
            maximumStakeValue: this.maximumStakeValue,
            minimumStakeValue: this.minimumStakeValue,
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
     * Gets the remaining cooldown time for rapid losses in milliseconds
     * @returns {number} Remaining cooldown time in ms, 0 if not in cooldown
     */
    public getRapidLossCooldownRemaining(): number {
        if (!this.rapidLossState.isActive) {
            return 0;
        }

        const now = Date.now();
        const cooldownEnd = this.rapidLossState.lastTriggerTime + this.rapidLossState.currentCooldownMs;

        return Math.max(0, cooldownEnd - now);
    }

    /**
     * Checks if rapid losses should trigger a cooldown
     * @param amount Optional loss amount to record before checking
     * @returns boolean indicating if rapid losses were detected
     */
    public checkRapidLosses(amount?: number): boolean {
        if (amount !== undefined) {
            this.recordRapidLoss(amount);
        }

        // Filter losses that are within the time window
        const now = Date.now();
        const recentLosses = this.rapidLossState.recentLosses.filter(
            loss => now - loss.timestamp <= this.circuitBreakerConfig.rapidLoss.timeWindowMs
        );

        // Update state with only recent losses
        this.rapidLossState.recentLosses = recentLosses;

        // Check if threshold is exceeded and handle cooldown
        if (recentLosses.length >= this.circuitBreakerConfig.rapidLoss.threshold) {
            return this.handleRapidLossTrigger();
        }

        return false;
    }

    private recordLoss(amount: number): void {
        this.rapidLossState.recentLosses.push({
            timestamp: Date.now(),
            amount
        });
    }

    private clearExpiredLosses(): void {
        const now = Date.now();
        this.rapidLossState.recentLosses = this.rapidLossState.recentLosses.filter(
            loss => now - loss.timestamp <= this.circuitBreakerConfig.rapidLoss.timeWindowMs
        );
    }

    /**
    * Records a rapid loss event
    * @param amount Loss amount to record
    */
    public recordRapidLoss(amount: number): void {
        this.rapidLossState.recentLosses.push({
            timestamp: Date.now(),
            amount
        });
    }

    /**
     * Handles a rapid loss trigger event
     * @returns boolean indicating if rapid losses were detected
     */
    private handleRapidLossTrigger(): boolean {
        const now = Date.now();

        // If we're already in cooldown, don't trigger again
        if (this.rapidLossState.isActive &&
            now < this.rapidLossState.lastTriggerTime + this.rapidLossState.currentCooldownMs) {
            return true;
        }

        // Increment trigger count
        this.rapidLossState.triggerCount++;
        this.rapidLossState.lastTriggerTime = now;

        // Calculate new cooldown with exponential backoff, capped at max
        this.rapidLossState.currentCooldownMs = Math.min(
            this.circuitBreakerConfig.rapidLoss.initialCooldownMs *
            Math.pow(this.circuitBreakerConfig.rapidLoss.cooldownMultiplier, this.rapidLossState.triggerCount - 1),
            this.circuitBreakerConfig.rapidLoss.maxCooldownMs
        );

        this.rapidLossState.isActive = true;

        logger.warn({
            event: 'RAPID_LOSS_DETECTED',
            lossesCount: this.rapidLossState.recentLosses.length,
            totalAmount: this.rapidLossState.recentLosses.reduce((sum, loss) => sum + loss.amount, 0),
            cooldownMs: this.rapidLossState.currentCooldownMs,
            triggerCount: this.rapidLossState.triggerCount
        });

        return true;
    }


    /**
    * Checks if currently in rapid loss cooldown
    * @returns boolean indicating if in cooldown
    */
    public isInRapidLossCooldown(): boolean {
        if (!this.rapidLossState.isActive) return false;

        const now = Date.now();
        const cooldownEnd = this.rapidLossState.lastTriggerTime + this.rapidLossState.currentCooldownMs;

        // Reset if cooldown has expired
        if (now >= cooldownEnd) {
            this.resetRapidLossState();
            return false;
        }

        return true;
    }

    /**
     * Resets the rapid loss tracking state
     */
    private resetRapidLossState(): void {
        this.rapidLossState.recentLosses = [];
        this.rapidLossState.isActive = false;
        // Note: We intentionally don't reset triggerCount to maintain memory across incidents
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
        const now:number = Date.now();
        let triggered:boolean = false;
        let reason:string = '';
        const reasons: string[] = [];

        // Check daily loss limit
        if (this.dailyLossAmount >= this.circuitBreakerConfig.maxDailyLoss) {
            triggered = true;
            reason = 'daily_loss_limit';
            reasons.push(reason);
        }

        // Check absolute loss limit
        if (this.totalLossAmount >= this.circuitBreakerConfig.maxAbsoluteLoss) {
            triggered = true;
            reason = 'absolute_loss_limit';
            reasons.push(reason);
        }

        // Check consecutive losses
        if (this.consecutiveLosses >= this.circuitBreakerConfig.maxConsecutiveLosses) {
            triggered = true;
            reason = 'max_consecutive_losses';
            reasons.push(reason);
        }

        // Check balance percentage
        const balanceCheck = this.validateAccountBalance(this.baseStake, account);
        if (!balanceCheck.isValid) {
            triggered = true;
            reason = 'balance_validation_failed';
            reasons.push(reason);
        }

        // Check rapid losses
        if (this.checkRapidLosses()) {
            triggered = true;
            reason = 'rapid_loss_detected';
            reasons.push(reason);
        }

        // Update circuit breaker state if triggered
        if (triggered) {
            this.circuitBreakerState = {
                triggered: true,
                lastTriggered: now,
                lastReason: reason,
                reasons: reasons,
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

    public resetSafetyMode(): void {

        this.circuitBreakerState = {
            triggered: false,
            lastTriggered: 0,
            lastReason: '',
            reasons: [],
            inSafetyMode: false,
            safetyModeUntil: 0
        };

        this.rapidLossState = {
            recentLosses: [],
            lastTriggerTime: 0,
            triggerCount: 0,
            currentCooldownMs: 0,
            isActive: false,
        };

    }

}

