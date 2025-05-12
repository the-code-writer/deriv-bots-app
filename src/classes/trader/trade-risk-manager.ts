import { getRandomDigit } from '@/common/utils/snippets';
import { DerivUserAccount, IDerivUserAccount } from '../user/UserDerivAccount';
import { StrategyRewards, BasisType, ContractType, BasisTypeEnum, ContractTypeEnum, ITradeData, MarketTypeEnum, CurrenciesEnum, ContractDurationUnitTypeEnum, CurrencyType, ContractDurationUnitType, MarketType, TradingEvent } from './types';
import { pino } from "pino";
import { StrategyParser } from './trader-strategy-parser';
import { StrategyConfig, StrategyStepOutput, StrategyMetrics, StrategyMeta, StrategyVisualization } from './trader-strategy-parser';
import { roundToTwoDecimals } from '../../common/utils/snippets';
import { env } from '@/common/utils/envConfig';
import { defaultEventManager } from './trade-event-manager';

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
    lastTradeTimestamp: number;
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

    private highestStakeInvested: number = 0;
    private highestProfitAchieved: number = 0;
    private totalProfit: number = 0;

    private isEmergencyRecovery: boolean = false;
    private isCriticalRecovery: boolean = false;
    private stopAfterTradeLoss: boolean = false;

    private minStake: number;

    private maxStake: number;

    private userAccountToken: string = "";

    private accountInitialBalance: number = 0;

    public lastTradeWon: boolean = true;

    public lastTradeProfit: number = 0;

    constructor(
        baseStake: number,
        market: MarketType,
        currency: CurrencyType,
        contractType: ContractType,
        contractDurationValue: number,
        contractDurationUnits: ContractDurationUnitType,
        strategyParser: StrategyParser,
        circuitBreakerConfig?: CircuitBreakerConfig,
        userAccountToken?: string
    ) {
        this.baseStake = baseStake;
        this.minStake = env.MIN_STAKE
        this.maxStake = env.MAX_STAKE;
        this.market = market;
        this.currency = currency;
        this.contractType = contractType;
        this.contractDurationValue = contractDurationValue;
        this.contractDurationUnits = contractDurationUnits;
        this.strategyParser = strategyParser;

        this.userAccountToken = userAccountToken;

        // Initialize circuit breakers with defaults or provided config
        this.circuitBreakerConfig = {
            maxAbsoluteLoss: env.MAX_ABSOLUTE_LOSS,
            maxDailyLoss: env.MAX_DAILY_LOSS,
            maxConsecutiveLosses: env.MAX_CONSECUTIVE_LOSSES,
            maxBalancePercentageLoss: env.MAX_BALANCE_PERCENTAGE_LOSS,

            rapidLoss: {
                timeWindowMs: env.RAPID_LOSS_TIME_WINDOW_MS,
                threshold: env.RAPID_LOSS_THRESHOLD,
                initialCooldownMs: env.RAPID_LOSS_INITIAL_COOLDOWN_MS,
                maxCooldownMs: env.RAPID_LOSS_MAX_COOLDOWN_MS,
                cooldownMultiplier: env.RAPID_LOSS_COOLDOWN_MULTIPLIER,
            },

            cooldownPeriod: env.COOLDOWN_PERIOD_MS
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
            lastTradeTimestamp: 0,
        };

        this.checkUserBalance();

        this.validateInitialization();

    }

    private async checkUserBalance(): Promise<void>{

        const userBalance =  await this.getUserBalance();

        if (userBalance) {
            
            this.accountInitialBalance = parseFloat(userBalance.display);

        }

    }

    private async getUserBalance(): Promise<any> {

        if (this.userAccountToken) {

            const { balance } = await DerivUserAccount.getUserBalance(this.userAccountToken);

            return balance;

        }

    }

    private validateInitialization(): void {
        if (this.baseStake <= 0) throw new Error("Base stake must be positive");
        if (!this.market) throw new Error("Market must be specified");
        if (!this.currency) throw new Error("Currency must be specified");
        if (!Object.values(ContractTypeEnum).includes(this.contractType)) {
            throw new Error("Invalid contract type");
        }
    }

    public processTradeResult(tradeResult: ITradeData): void {

        try {

            if (!this.validateTradeResult(tradeResult)) {

                defaultEventManager.emit(TradingEvent.StopTrading.type, {
                    reason: "Invalid trade result received",
                    timestamp: Date.now(),
                    profit: this.getTotalProfit()
                });

                return;

            }

            this.totalTrades++;
            this.resultIsWin = tradeResult.profit_is_win;
            this.lastTradeTimestamp = Date.now();

            this.totalProfit += tradeResult.safeProfit;


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

            const riskStatus = this.shouldEnterSafetyMode(tradeResult);

            if (riskStatus.reasons.length > 0 || riskStatus.shouldEnter) {
                this.enterSafetyMode("excessive_losses", riskStatus.reasons);
            }

            this.resultIsWin ? this.handleWin(tradeResult) : this.handleLoss(tradeResult);

        } catch (error) {

            logger.error(error, "Error processing trade result");

            this.enterSafetyMode("processing_error");

        }

    }

    private handleWin(tradeResult: ITradeData): void {
        this.consecutiveLosses = 0;
        this.winningTrades++;
        this.recoveryAttempts = 0;

        if (this.highestProfitAchieved < this.totalProfit) {
            this.highestProfitAchieved = this.totalProfit;
        }

        this.lastTradeWon = true;
        this.lastTradeProfit = tradeResult.safeProfit;

        if (this.totalLossAmount > 0) {

            const recoveredAmount = this.calculateRecoveredAmount(tradeResult);

            this.totalLossAmount = Math.max(0, this.totalLossAmount - recoveredAmount);

            if (this.totalLossAmount === 0) {

                this.isEmergencyRecovery = false;

                this.stopAfterTradeLoss = false;

                this.isCriticalRecovery = false;

                logger.info("Full recovery achieved");

                this.resetRecoveryState();

            } else {

                this.isEmergencyRecovery = true;

                logger.error(`
                    Emergency?: ${this.isEmergencyRecovery}
                    Partial Recovery: ${this.currency} ${roundToTwoDecimals(recoveredAmount)}
                    Remaining: ${this.currency} ${roundToTwoDecimals(this.totalLossAmount)}
                    Total Profit: ${this.currency} ${roundToTwoDecimals(this.totalProfit)}
                    Highest Profit: ${this.currency} ${roundToTwoDecimals(this.highestProfitAchieved)}
                    Highest Stake: ${this.currency} ${roundToTwoDecimals(this.highestStakeInvested)}
                `);

            }

        } else {

            this.resetRecoveryState();

        }

    }

    private handleLoss(tradeResult: ITradeData): void {

        this.consecutiveLosses++;
        this.losingTrades++;
        this.recoveryAttempts++;

        const lossAmount = this.calculateLossAmount(tradeResult);

        this.totalLossAmount += lossAmount;
        this.dailyLossAmount += lossAmount;

        this.lastTradeWon = false;
        this.lastTradeProfit = tradeResult.safeProfit;

        logger.warn(`Loss: ${this.currency} ${roundToTwoDecimals(lossAmount)}, Total Loss: ${this.currency} ${roundToTwoDecimals(this.totalLossAmount)}, Consecutive: ${this.consecutiveLosses}`);

        if (this.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {

            this.enterSafetyMode("max_recovery_attempts");

            defaultEventManager.emit(TradingEvent.StopTrading.type, {
                reason: "Maximum recovery attempts reached",
                timestamp: Date.now(),
                profit: this.totalProfit
            });

        }

        if (this.stopAfterTradeLoss) {

            this.enterSafetyMode("🔸 Critical losses 🔸");

            this.isCriticalRecovery = true;

        }

        if (this.consecutiveLosses > this.circuitBreakerConfig.maxConsecutiveLosses - 1) {

            this.enterSafetyMode("🔸 Critical losses : Maximum consecutive loses eminent 🔸");

            this.isCriticalRecovery = true;

        }

        if (this.consecutiveLosses > this.circuitBreakerConfig.maxConsecutiveLosses) {

            defaultEventManager.emit(TradingEvent.StopTrading.type, {
                reason: "🔸 Catastrophic losses 🔸",
                timestamp: Date.now(),
                profit: this.totalProfit
            });

        }

    }

    public getNextTradeParams(barrier: string | number | null): NextTradeParams {

        try {

            const strategyConfig: StrategyConfig = this.strategyParser.getStrategyConfig();

            const steps = this.strategyParser.getAllSteps();

            // Get the appropriate step based on consecutive losses
            const stepIndex = Math.min(this.consecutiveLosses, steps.length - 1);

            const step = steps[stepIndex];

            //console.error("#### CHECK : this.isEmergencyRecovery #####", this.isEmergencyRecovery);

            if (this.isEmergencyRecovery) {

                this.stopAfterTradeLoss = true;

                let amountToRecover: number = this.clampStake(this.totalLossAmount * 100 / 8, true);

                if (this.isCriticalRecovery) {

                    amountToRecover = this.clampStake(this.totalLossAmount * 100 / 7, true);

                    this.isCriticalRecovery = false;

                }

                if (this.totalProfit < this.highestProfitAchieved) {
                    amountToRecover = amountToRecover + ((this.highestProfitAchieved - this.totalProfit) * 100 / 8);
                }

                const emergencyRecoveryStake = Number(roundToTwoDecimals(amountToRecover));

                if (this.highestStakeInvested < emergencyRecoveryStake) {
                    this.highestStakeInvested = emergencyRecoveryStake;
                }

                const params: NextTradeParams = {
                    basis: BasisTypeEnum.Default,
                    symbol: MarketTypeEnum.Default,
                    amount: emergencyRecoveryStake,
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

                //console.error("#### CHECK : params #####", params);

                return params;

            } else {

                const investmentStake = Number(roundToTwoDecimals(this.clampStake(step.amount)));

                if (this.highestStakeInvested < investmentStake) {
                    this.highestStakeInvested = investmentStake;
                }

                

                return {
                    basis: step.basis || strategyConfig.meta.basis,
                    symbol: step.symbol || this.market,
                    amount: investmentStake,
                    barrier: this.getBarrier(step.contract_type, barrier),
                    currency: step.currency || strategyConfig.meta.currency,
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

    private clampStake(stake: number, ignoreClampingUpperLimit: boolean = false): number {
        if (ignoreClampingUpperLimit) {
            return Math.min(Math.max(stake, this.minStake), Infinity);
        }
        return Math.min(Math.max(stake, this.minStake), this.maxStake);
    }

    private getBarrier(contractType: ContractType, barrier?: string | number | null): string | number {
        if (barrier) {
            return barrier;
        }
        switch (contractType) {
            case ContractTypeEnum.DigitEven: return "DIGITEVEN";
            case ContractTypeEnum.DigitOdd: return "DIGITODD";
            case ContractTypeEnum.DigitDiff: {
                // Always return a random digit for DIGITDIFF regardless of the barrier parameter
                return getRandomDigit();
            }
            case ContractTypeEnum.DigitUnder: return Math.min(Math.max(getRandomDigit(), 1), 9);
            case ContractTypeEnum.DigitOver: return Math.min(Math.max(getRandomDigit(), 0), 8);
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

    private shouldEnterSafetyMode(tradeResult: ITradeData): any {

        const reasons: string[] = [];

        let shouldEnter: boolean = false;

        if (this.inSafetyMode && this.safetyModeUntil > Date.now()) {
            shouldEnter = true;
            reasons.push("The app is still in safety mode.");
        }

        const strategyConfig: StrategyConfig = this.strategyParser.getStrategyConfig();

        if (this.consecutiveLosses >= strategyConfig.meta.maxConsecutiveLosses! * 2) {
            shouldEnter = true;
            reasons.push("Too many consecutive losses.");
        }

        if (this.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
            shouldEnter = true;
            reasons.push("Maximum recovery attempts reached.");
        }

        if (tradeResult.userAccount.balance < this.baseStake * 3) {
            reasons.push("Account balance too low.");
            shouldEnter = true;
        }

        if (this.totalLossAmount > this.baseStake * strategyConfig.meta.maxRiskExposure!) {
            reasons.push("Total losses are too high.");
            shouldEnter = true;
        }

        return { shouldEnter, reasons }

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

        if (!('profit_is_win' in (data || {}))) {
            return false;
        }

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
        if (typeof data.symbol_short !== 'string') {
            console.error(`Missing required data field: symbol_short`);
            return false;
        }
        if (typeof data.symbol_full !== 'string') {
            console.error(`Missing required data field: symbol_full`);
            return false;
        }
        if (typeof data.start_time !== 'number') {
            console.error(`Missing required data field: start_time`);
            return false;
        }
        if (typeof data.expiry_time !== 'number') {
            console.error(`Missing required data field: expiry_time`);
            return false;
        }

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
            amount: Number(this.baseStake),
            barrier: -1,
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
        const now: number = Date.now();
        let triggered: boolean = false;
        let reason: string = '';
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
            this.isEmergencyRecovery = true;
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
                safetyModeUntil: now + this.circuitBreakerConfig.cooldownPeriod,
                lastTradeTimestamp: this.lastTradeTimestamp
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

    public getTotalLostAmount(): number {
        return this.totalLossAmount;
    }

    public getTotalProfit(): number {
        return this.totalProfit;
    }

    public getHighestStakeInvested(): number {
        return this.highestStakeInvested;
    }

    public getHighestProfitAchieved(): number {
        return this.highestProfitAchieved;
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
    public enterSafetyMode(reason: string | string[], cooldownMs?: number): void {
        const now = Date.now();
        this.inSafetyMode = true;
        this.safetyModeUntil = now + (cooldownMs || this.circuitBreakerConfig.cooldownPeriod);
        this.circuitBreakerState = {
            ...this.circuitBreakerState,
            inSafetyMode: true,
            safetyModeUntil: this.safetyModeUntil,
            lastReason: typeof reason === "string" ? reason : reason.join(", "),
            lastTradeTimestamp: this.lastTradeTimestamp
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
            safetyModeUntil: 0,
            lastTradeTimestamp: 0,
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

