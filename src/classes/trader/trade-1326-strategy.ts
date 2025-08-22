/**
 * Advanced 1-3-2-6 Trading Strategy with Complete Type Safety
 * @class Enhanced1326Strategy
 * @description Implements a robust 1-3-2-6 trading strategy with:
 * - Strict sequence adherence starting from position 0
 * - Multiple recovery modes
 * - Comprehensive risk management
 * - Complete type safety
 * - Detailed documentation
 */

import { getRandomDigit, roundToTwoDecimals } from "@/common/utils/snippets";
import { ContractDurationUnitTypeEnum, ContractTypeEnum, ContractType, ContractDurationUnitType } from './types';

// ==================== Type Definitions ====================

/**
 * @typedef {Object} StrategyConfiguration
 * @property {number} profitThreshold - Profit target at which to stop trading
 * @property {number} lossThreshold - Maximum allowed loss before stopping
 * @property {number} initialStake - Base stake amount
 * @property {number} initialBarrier - Starting barrier digit (0-9)
 * @property {string} market - Market identifier
 * @property {number} maxRecoveryAttempts - Max recovery attempts before reset
 * @property {RecoveryMode} recoveryMode - Selected recovery strategy mode
 * @property {boolean} enableSequenceProtection - Whether to use recovery mode
 * @property {number} maxDailyTrades - Maximum trades per day
 * //TODO : add props
 */
interface StrategyConfiguration {
    profitThreshold: number;
    lossThreshold: number;
    initialStake: number;
    initialBarrier: number;
    market: string;
    maxRecoveryAttempts: number;
    recoveryMode: RecoveryMode;
    enableSequenceProtection: boolean;
    maxDailyTrades: number;
    enableAutoAdjust: boolean;
    maxVolatility: number;
    minTrendStrength: number;
    minWinRate: number;
}

/**
 * @typedef {'aggressive' | 'conservative' | 'neutral'} RecoveryMode
 * @description Different recovery strategy modes
 */
type RecoveryMode = 'base' | 'aggressive' | 'conservative' | 'neutral';

/**
 * @typedef {Object} StrategyStatistics
 * @property {number} totalWins - Total winning trades
 * @property {number} totalLosses - Total losing trades
 * @property {number} sequencesCompleted - Completed 1-3-2-6 sequences
 * @property {number} maxWinStreak - Longest consecutive win streak
 * @property {number} maxLossStreak - Longest consecutive loss streak
 * @property {number} bestSequenceProfit - Most profitable sequence
 * @property {number} worstSequenceLoss - Least profitable sequence
 */
interface StrategyStatistics {
    totalWins: number;
    totalLosses: number;
    sequencesCompleted: number;
    maxWinStreak: number;
    maxLossStreak: number;
    bestSequenceProfit: number;
    worstSequenceLoss: number;
    totalRecoveryAttempts: number;
    successfulRecoveries: number;
    bestRecoveryProfit: number;
    worstRecoveryLoss: number;
}

/**
 * @typedef {Object} StrategyState
 * @property {number[]} currentSequence - Current sequence multipliers
 * @property {number} sequencePosition - Current position in sequence (0-3)
 * @property {number} currentStake - Current stake amount
 * @property {number} totalProfit - Cumulative profit/loss
 * @property {number} consecutiveWins - Current win streak
 * @property {number} consecutiveLosses - Current loss streak
 * @property {number} recoveryAttempts - Current recovery attempts
 * @property {number} tradesToday - Trades executed today
 * @property {number} lastTradeTimestamp - Timestamp of last trade
 * @property {number} sequenceProfit - Profit in current sequence
 * @property {boolean} inRecovery - Whether in recovery mode
 */
interface StrategyState {
    currentSequence: number[];
    sequencePosition: number;
    currentStake: number;
    totalProfit: number;
    consecutiveWins: number;
    consecutiveLosses: number;
    recoveryAttempts: number;
    tradesToday: number;
    lastTradeTimestamp: number;
    sequenceProfit: number;
    inRecovery: boolean;
}

/**
 * @typedef {Object} TradeDecision
 * @property {boolean} shouldTrade - Whether to execute a trade
 * @property {string} [reason] - Reason if not trading
 * @property {number} [amount] - Stake amount if trading
 * @property {number} [barrier] - Predicted digit if trading
 * @property {ContractTypeEnum} [contractType] - Type of contract
 * @property {number} [duration] - Contract duration
 * @property {ContractDurationUnitTypeEnum} [durationType] - Duration units
 * @property {string} [market] - Market identifier
 * @property {Object} [metadata] - Additional trade metadata
 * @property {number} metadata.sequencePosition - Current sequence position
 * @property {boolean} metadata.inRecovery - Whether in recovery mode
 * @property {string} metadata.sequence - Current sequence as string
 */
interface TradeDecision {
    shouldTrade: boolean;
    reason?: string;
    amount?: number;
    barrier?: number | string;
    prediction?: number | string;
    contractType?: ContractType;
    duration?: number;
    durationType?: ContractDurationUnitType;
    market?: string;
    metadata?: {
        sequencePosition: number;
        inRecovery: boolean;
        sequence: string;
        marketConditions: any;
    };
}

interface SequenceHistoryEntry {
    sequence: number[];
    outcome: 'win' | 'loss';
    profit: number;
    timestamp?: number;
}

interface RecoveryHistoryEntry {
    outcome: 'win' | 'loss';
    profit: number;
    stake: number;
    recoveryAttempt: number;
    timestamp: number;
    consecutiveLosses: number;
}
// ==================== Constants ====================

/** @constant {number[]} BASE_SEQUENCE - The standard 1-3-2-6 sequence */
const BASE_SEQUENCE: number[] = [1, 3, 2, 6];

/** 
 * @constant {Object.<RecoveryMode, number[]>} SEQUENCE_VARIANTS 
 * Different sequence variants for each recovery mode 
 */
const SEQUENCE_VARIANTS: Record<RecoveryMode, number[]> = {
    base: [1, 3, 2, 6],
    conservative: [1, 2, 3, 4],
    aggressive: [1, 3, 5, 7],
    neutral: BASE_SEQUENCE
};

/** 
 * @constant {Object.<RecoveryMode, number>} RECOVERY_MULTIPLIERS 
 * Stake multipliers for each recovery mode 
 */
const RECOVERY_MULTIPLIERS: Record<RecoveryMode, number> = {
    base: 15,
    conservative: 10.75,
    aggressive: 12.50,
    neutral: 5
};

const SAFETY_FACTORS = {
    MAX_SEQUENCE_ATTEMPTS: 5,
    LOSS_THRESHOLD_REDUCTION: 0.1,
    MINIMUM_STAKE_MULTIPLIER: 0.5
};

const STRATEGY_CONSTANTS = {
    MAX_RECOVERY_ATTEMPTS: 3,
    MIN_STAKE_MULTIPLIER: 0.3,
    SEQUENCE_LENGTH: 4
};


// ==================== Strategy Class ====================

export class Enhanced1326Strategy {
    /** @type {StrategyConfiguration} */
    private config: StrategyConfiguration;

    /** @type {StrategyState} */
    private state: StrategyState;

    /** @type {StrategyStatistics} */
    private stats: StrategyStatistics;

    /** @type {boolean} */
    private isActive: boolean;

    /** @type {boolean} */
    private startedTrading: boolean;

    /** @type {any[]} */
    private sequenceHistory: any[];

    /** @type {number} */
    private dailyProfitLoss: number;

    private recoveryHistory: RecoveryHistoryEntry[];

    private dailyProfitLoss: number;

    /**
     * Creates a new Enhanced1326Strategy instance
     * @constructor
     * @param {Partial<StrategyConfiguration>} [config={}] - Configuration overrides
     */
    constructor(config: Partial<StrategyConfiguration> = {}) {
        this.config = this.initializeConfig(config);
        this.state = this.initializeState();
        this.stats = this.initializeStatistics();
        this.startedTrading = false;
        this.isActive = true;
        this.sequenceHistory = [];
        this.dailyProfitLoss = 0;
        this.recoveryHistory = [];
        this.dailyProfitLoss = 0;
    }

    // ==================== Initialization Methods ====================

    /**
     * Initializes and validates configuration
     * @private
     * @param {Partial<StrategyConfiguration>} config - Partial configuration
     * @returns {StrategyConfiguration} Validated complete configuration
     */
    private initializeConfig(config: Partial<StrategyConfiguration>): StrategyConfiguration {
        const defaults: StrategyConfiguration = {
            profitThreshold: 1000,
            lossThreshold: 500,
            initialStake: 5,
            initialBarrier: getRandomDigit(),
            market: '1HZ100V',
            maxRecoveryAttempts: 2,
            recoveryMode: 'neutral',
            enableSequenceProtection: true,
            maxDailyTrades: 50,
            enableAutoAdjust: true,
            maxVolatility: 0.6,
            minTrendStrength: 0.4,
            minWinRate: 0.4
        };

        if (config.maxVolatility !== undefined && (config.maxVolatility < 0 || config.maxVolatility > 1)) {
            throw new Error("Max volatility must be between 0 and 1");
        }
        if (config.minTrendStrength !== undefined && (config.minTrendStrength < 0 || config.minTrendStrength > 1)) {
            throw new Error("Min trend strength must be between 0 and 1");
        }
        if (config.minWinRate !== undefined && (config.minWinRate < 0 || config.minWinRate > 1)) {
            throw new Error("Min win rate must be between 0 and 1");
        }

        const merged: StrategyConfiguration = { ...defaults, ...config };

        if (merged.initialStake <= 0) throw new Error("Initial stake must be positive");
        if (merged.profitThreshold <= 0) throw new Error("Profit threshold must be positive");
        if (merged.lossThreshold <= 0) throw new Error("Loss threshold must be positive");
        if (merged.maxRecoveryAttempts < 0) throw new Error("Max recovery attempts cannot be negative");
        if (merged.maxDailyTrades <= 0) throw new Error("Max daily trades must be positive");

        return merged;
    }

    public updateConfig(updates: Partial<StrategyConfiguration>): void {
        this.config = this.initializeConfig({ ...this.config, ...updates });
        this.logEvent("Configuration updated");
    }

    /**
     * Initializes strategy state
     * @private
     * @returns {StrategyState} Initial state object
     */
    private initializeState(): StrategyState {
        return {
            currentSequence: this.getSequenceVariant(),
            sequencePosition: 0, // Start at position 0 (first in sequence)
            currentStake: this.config.initialStake * this.getSequenceVariant()[0], // Start with first sequence value
            totalProfit: 0,
            consecutiveWins: 0,
            consecutiveLosses: 0,
            recoveryAttempts: 0,
            tradesToday: 0,
            lastTradeTimestamp: Date.now(),
            sequenceProfit: 0,
            inRecovery: false
        };
    }

    /**
     * Initializes statistics tracking
     * @private
     * @returns {StrategyStatistics} Initial statistics object
     */
    private initializeStatistics(): StrategyStatistics {
        return {
            totalWins: 0,
            totalLosses: 0,
            sequencesCompleted: 0,
            maxWinStreak: 0,
            maxLossStreak: 0,
            bestSequenceProfit: 0,
            worstSequenceLoss: 0,
    totalRecoveryAttempts: 0,
            successfulRecoveries: 0,
            bestRecoveryProfit: 0,
            worstRecoveryLoss: 0
        };
    }

    // ==================== Core Strategy Methods ====================

    // Add this method to select sequence based on market conditions
    private selectOptimalSequence(): number[] {
        // If we're in recovery, use neutral sequence (highest priority)
        if (this.state.inRecovery) {
            return SEQUENCE_VARIANTS.neutral; // [1, 3, 2, 6]
        }

        // If we're in a losing streak, use more conservative sequence
        if (this.state.consecutiveLosses >= 2) {
            return SEQUENCE_VARIANTS.conservative; // [1, 2, 3, 4]
        }

        // Default to configured sequence
        return SEQUENCE_VARIANTS[this.config.recoveryMode];
    }

    // Add this method to lock in profits
    public shouldLockInProfits(): boolean {
        // Lock in profits if we've reached 50% of target
        if (this.state.totalProfit >= this.config.profitThreshold * 0.5) {
            return true;
        }

        // Lock in profits if we've had a good sequence
        if (this.state.sequenceProfit >= this.config.initialStake * 10) {
            return true;
        }

        if (this.state.totalProfit >= this.config.profitThreshold * 0.5) {
            return true;
        }

        const { trend } = this.analyzeMarketConditions();

        if (trend < 0.4 && this.state.sequenceProfit > 0) {
            return true
        };

        return false;

    }

    /**
     * Executes the strategy's trade logic
     * @public
     * @param {boolean} [lastOutcome] - Outcome of last trade (true=win)
     * @param {number} [lastProfit] - Profit from last trade
     * @returns {TradeDecision} Trade decision object
     */
    public prepareForNextTrade(lastOutcome?: boolean, lastProfit?: number): TradeDecision {
        if (!this.isActive) {
            return {
                shouldTrade: false,
                reason: "Strategy is inactive"
            };
        }

        // Add profit lock check
        if (this.shouldLockInProfits()) {
            this.resetSequence();
            return {
                shouldTrade: false,
                reason: "Profit lock activated"
            };
        }

        // Reset daily stats if new day
        this.checkDayChange();

        if (!this.startedTrading) {

            this.startedTrading = true;

        }


        // Check trading conditions
        const shouldTrade: TradeDecision = this.evaluateTradingConditions();
        if (!shouldTrade.shouldTrade) {
            return shouldTrade;
        }


        // Calculate next stake (starting with sequence position 0)
        const stake: number = roundToTwoDecimals(this.calculateNextStake()) as number;
        const randomDigit: number | string = getRandomDigit();
        return {
            shouldTrade: true,
            amount: stake,
            prediction: randomDigit,
            barrier: randomDigit,
            contractType: ContractTypeEnum.DigitDiff,
            market: this.config.market,
            duration: 1,
            durationType: ContractDurationUnitTypeEnum.Default,
            metadata: {
                sequencePosition: this.state.sequencePosition,
                inRecovery: this.state.inRecovery,
                sequence: this.state.currentSequence.join('-'),
                marketConditions: this.analyzeMarketConditions()
            }
        };
    }

    // ==================== State Management Methods ====================

    /**
     * Updates strategy state based on trade outcome
     * @private
     * @param {boolean} outcome - Trade outcome (true=win)
     * @param {number} profit - Profit amount from trade
     */
    public updateState(outcome: boolean, profit: number): void {

        // Validate inputs
        this.validateProfitInput(profit);

        // Update daily stats
        this.state.tradesToday++;
        this.dailyProfitLoss += profit;
        this.state.lastTradeTimestamp = Date.now();

        // Update profit tracking
        this.state.totalProfit = this.calculateSafeProfit(this.state.totalProfit, profit);
        this.state.sequenceProfit += profit;

        if (outcome) {
            this.handleWin();
        } else {
            this.handleLoss();
        }

        // Update statistics
        this.updateStatistics(outcome, profit);

        // Record in history
        this.recordTradeHistory(outcome, profit);

        // Monitor session safety
        this.monitorSession();
    }

    private recordTradeHistory(outcome: boolean, profit: number): void {
        this.recoveryHistory.push({
            outcome: outcome ? 'win' : 'loss',
            profit,
            stake: this.state.currentStake,
            recoveryAttempt: this.state.recoveryAttempts,
            consecutiveLosses: this.state.consecutiveLosses,
            timestamp: Date.now()
        });

        // Keep history manageable
        if (this.recoveryHistory.length > 100) {
            this.recoveryHistory = this.recoveryHistory.slice(-50);
        }
    }


    private validateProfitInput(profit: number): void {
        if (Number.isNaN(profit)) throw new Error("Invalid profit value (NaN)");
        if (!Number.isFinite(profit)) throw new Error("Invalid profit value (Infinity)");
        if (Math.abs(profit) > this.config.lossThreshold * 5) {
            this.logEvent("Abnormal profit detected - pausing", 'error');
            this.pauseStrategy();
        }
    }

    public setSequenceProfit(profit: number): void {
        this.state.sequenceProfit = profit;
    }

    public setTradesToday(trades: number): void {
        this.state.tradesToday = trades;
    }

    public setDailyProfitLoss(losses: number): void {
        this.dailyProfitLoss = losses;
    }

    public setConsecutiveLosses(losses: number): void {
        this.state.consecutiveLosses = losses;
    }

    public setInRecovery(inRecovery: boolean): void {
        this.state.inRecovery = inRecovery;
    }

    public setSequencePosition(index: number): void {
        this.state.sequencePosition = index;
    }

    /**
     * Handles win outcome
     * @private
     */
    private handleWin(): void {
        this.state.consecutiveWins++;
        this.state.consecutiveLosses = 0;
        this.stats.totalWins++;

        if (this.state.inRecovery) {
            this.handleRecoveryWin();
        } else {
            this.handleSequenceWin();
        }
    }

    /**
     * Handles loss outcome
     * @private
     */
    // Enhance the handleLoss method
    private handleLoss(): void {
        this.state.consecutiveLosses++;
        this.state.consecutiveWins = 0;
        this.stats.totalLosses++;

        // Only count as recovery attempt if stake was significant
        if (this.state.currentStake > this.config.initialStake * 3) {
            this.state.recoveryAttempts++;
        }

        // Implement graduated response to losses
        if (this.state.consecutiveLosses === 1) {
            // First loss - reduce stake
            this.state.currentStake = Math.max(
                this.config.initialStake,
                this.state.currentStake * 0.7
            );
        }
        else if (this.state.consecutiveLosses >= 2) {
            // Multiple losses - enter recovery
            if (this.config.enableSequenceProtection) {
                this.enterRecoveryMode();
            } else {
                this.resetSequence();
            }
        }

        // Update worst sequence loss tracking
        this.stats.worstSequenceLoss = Math.min(
            this.stats.worstSequenceLoss,
            this.state.sequenceProfit
        );
    }

    // ==================== Sequence Management Methods ====================

    /**
     * Handles sequence progression on win
     * @private
     */
    private handleSequenceWin(): void {
        // Progress through sequence
        this.state.sequencePosition++;

        // Check for sequence completion
        if (this.state.sequencePosition >= this.state.currentSequence.length) {
            this.completeSequence();
        } else {
            this.state.currentStake = this.getNextSequenceStake();
        }
    }

    public safeSequencePositionIncrement(): void {
        if (this.state.sequencePosition >= this.state.currentSequence.length - 1) {
            this.completeSequence();
        } else {
            this.state.sequencePosition = Math.min(
                this.state.sequencePosition + 1,
                this.state.currentSequence.length - 1
            );
        }
    }

    /**
     * Handles sequence reset on loss
     * @private
     */
    private handleSequenceLoss(): void {
        // Enter recovery mode if enabled
        if (this.config.enableSequenceProtection) {
            this.enterRecoveryMode();
        } else {
            // Reset sequence on loss
            this.resetSequence();
        }
    }

    private getEffectiveLossThreshold(): number {
        // Reduce threshold during losing streaks
        const reductionFactor = 1 - (0.1 * this.state.consecutiveLosses);
        return Math.max(
            this.config.lossThreshold * 0.5, // Minimum 50% of original
            this.config.lossThreshold * reductionFactor
        );
    }

    public validateSequence(sequence: number[]): boolean {
        return sequence.length === 4 && sequence.every(x => Number.isInteger(x)) && sequence[0] === 1;
    }

    public validateCurrentSequence(): void {
        if (!this.validateSequence(this.state.currentSequence)) {
            this.logEvent("Invalid sequence detected", "error");
            this.state.currentSequence = this.selectOptimalSequence();
        }
    }

    /**
     * Completes current sequence successfully
     * @private
     */
    private completeSequence(): void {
        this.stats.sequencesCompleted++;

        this.stats.bestSequenceProfit = Math.max(
            this.stats.bestSequenceProfit,
            this.state.sequenceProfit
        );

        // Record successful sequence
        this.sequenceHistory.push({
            sequence: this.state.currentSequence.slice(),
            outcome: 'win',
            profit: this.state.sequenceProfit
        });

        // Reset for new sequence (starting at position 0)
        this.resetSequence();
        this.state.sequenceProfit = 0;

        this.logEvent("Sequence completed successfully");
    }

    /**
     * Resets sequence to initial state (position 0)
     * @private
     */
    private resetSequence(): void {
        this.state.sequencePosition = 0;

        // Replace getSequenceVariant() with the smarter selector
        this.state.currentSequence = this.selectOptimalSequence();

        // Start with first sequence value (now dynamically selected)
        this.state.currentStake = Number(roundToTwoDecimals(
            this.config.initialStake * this.state.currentSequence[0]
        ));

        this.state.sequenceProfit = 0;

        // Log the new sequence for debugging
        this.logEvent(`Sequence reset to: ${this.state.currentSequence.join('-')}`);
    }

    // ==================== Recovery Management Methods ====================

    /**
     * Enters recovery mode
     * @private
     */
    private enterRecoveryMode(): void {
        this.state.inRecovery = true;
        this.state.currentSequence = this.selectOptimalSequence(); // Set recovery sequence
        this.state.currentStake = this.calculateRecoveryStake();
        this.logEvent(`Entering recovery mode with sequence: ${this.state.currentSequence.join('-')}`);
    }

    /**
     * Exits recovery mode
     * @private
     */
    private exitRecoveryMode(): void {
        this.state.inRecovery = false;
        this.state.recoveryAttempts = 0;
        this.resetSequence(); // Reset to sequence position 0
        this.logEvent("Exited recovery mode");
    }

    /**
     * Handles win during recovery
     * @private
     */
    private handleRecoveryWin(): void {
        // If we recover successfully, exit recovery mode
        if (this.state.totalProfit >= 0) {
            this.exitRecoveryMode();
        } else {

            // Suggested (safer):
            if (this.state.totalProfit >= (this.config.lossThreshold * -0.75)) {
                // Exit when losses are recovered to 75% of threshold
                this.exitRecoveryMode();
            } else {
                // Continue recovery but with reduced stake
                this.state.currentStake = this.calculateRecoveryStake();
            }

        }
    }

    /**
     * Handles loss during recovery
     * @private
     */
    private handleRecoveryLoss(): void {
        // If recovery attempts exhausted, hard reset
        if (this.state.recoveryAttempts >= this.config.maxRecoveryAttempts) {
            this.hardReset();
            return;
        }

        // Increase recovery stake
        this.state.currentStake = this.calculateRecoveryStake(true);
    }

    /**
     * Performs hard reset of strategy
     * @private
     */
    private hardReset(): void {
        this.state = this.initializeState(); // Reset to position 0
        this.logEvent("Hard reset triggered after failed recovery");
    }

    /**
     * Performs hard reset of strategy
     * @private
     */
    private partialReset(): void {
        this.state.consecutiveLosses = 0;
        this.state.recoveryAttempts = 0;
        this.state.inRecovery = false;
        this.resetSequence();
        this.logEvent("Partial reset after failed recovery");
    }

    // ==================== Calculation Methods ====================

    /**
     * Calculates next stake amount
     * @private
     * @returns {number} Stake amount
     */
    private calculateNextStake(): number {

        // Add validation
        if (this.state.totalProfit <= -this.getEffectiveLossThreshold()) {
            this.pauseStrategy();
            return 0;
        }

        // If in negative territory, use recovery calculation
        if (this.state.totalProfit < 0) {
            return this.calculateRecoveryStake();
        }

        // If in recovery but positive, use sequence logic
        if (this.state.inRecovery) {
            return Math.min(
                this.calculateRecoveryStake(),
                this.getNextSequenceStake()
            );
        }

        // Normal sequence operation (starts at position 0)
        return this.getNextSequenceStake();
    }

    /**
     * Calculates recovery stake amount
     * @private
     * @param {boolean} [increase=false] - Whether to increase recovery multiplier
     * @returns {number} Recovery stake amount
     */
    private calculateRecoveryStake(increase: boolean = false): number {
        const lossAmount = Math.abs(this.state.totalProfit);
        const baseMultiplier = RECOVERY_MULTIPLIERS[this.config.recoveryMode];

        // Dynamic multiplier based on consecutive losses
        const dynamicMultiplier = baseMultiplier *
            (1 + (this.state.consecutiveLosses * 0.1)); // 10% increase per consecutive loss

        let calculatedStake = lossAmount * dynamicMultiplier;

        if (increase) {
            //calculatedStake = calculatedStake * 1.5;
        }

        // Cap at 25% of loss threshold and ensure minimum stake
        return Math.max(
            this.config.initialStake,
            Math.min(
                calculatedStake,
                this.config.lossThreshold * 0.25
            )
        );
    }

    private validateStake(amount: number): number {
        return Math.min(
            Math.max(amount, this.config.initialStake),
            this.config.lossThreshold * 0.3
        );
    }

    private isSafeToIncreaseStake(): boolean {
        return this.state.consecutiveWins >= 2 &&
            this.state.totalProfit > 0;
    }

    private checkSessionDuration(): boolean {
        const sessionDuration = Date.now() - this.state.lastTradeTimestamp;
        return sessionDuration < 1000 * 60 * 60 * 4; // 4 hour max session
    }

    /**
     * Gets next stake amount in sequence
     * @private
     * @returns {number} Stake amount
     */
    private getNextSequenceStake(): number {
        const multiplier = this.state.currentSequence[this.state.sequencePosition];
        if (isNaN(multiplier) || multiplier <= 0) {
            this.logEvent("Invalid sequence multiplier detected", "error");
            return this.config.initialStake;
        }
        return this.config.initialStake * multiplier;
    }

    public getVolatilityAdjustedStake(baseStake: number): number {
        const recentResults = this.sequenceHistory.slice(-5);

        // Handle empty array case
        if (recentResults.length === 0) {
            return baseStake;
        }

        const lossRate = recentResults.filter((x: any) => x.profit < 0).length / recentResults.length;
        return baseStake * (1 - Math.min(0.5, lossRate * 0.7));
    }

    public getVolatilityAdjustedStakeX(baseStake: number): number {
        const conditions = this.analyzeMarketConditions();
        const reductionFactor = 1 - (Math.min(0.5, conditions.volatility * 0.7));
        return baseStake * reductionFactor;
    }

    public checkTradingHours(): boolean {
        const now = new Date().getHours();
        return now >= 8 && now <= 20; // Only trade 8AM-8PM
    }

    private checkVolatility(): boolean {
        const recentResults = this.sequenceHistory.slice(-10);

        // Handle empty array case - no history means acceptable volatility
        if (recentResults.length === 0) {
            return true;
        }

        const lossRate = recentResults.filter((x: any) => x.profit < 0).length / recentResults.length;
        return lossRate < 0.6; // 60% max acceptable loss rate
    }

    private analyzeMarketConditions(): {
        wins: number,
        losses: number,
        totalProfit: number,
        volatility: number;
        trend: number;
        winRate: number
    } {
        const recent = this.sequenceHistory.slice(-20);
        if (recent.length === 0) {
            return {
                wins: 0,
                losses: 0,
                totalProfit: 0,
                volatility: 0,
                trend: this.config.minTrendStrength,
                winRate: this.config.minWinRate
            };
        }

        const wins = recent.filter((t: any) => t.outcome === 'win').length;
        const losses = recent.filter((t: any) => t.outcome !== 'win').length;
        const totalProfit = recent.reduce((sum: number, t: any) => sum + Math.abs(t.profit), 0);
        const avgProfit = totalProfit / recent.length;

        return {
            wins,
            losses,
            totalProfit,
            volatility: 1 - ((this.config.initialStake * 0.92) / avgProfit), // Assuming 92% payout
            trend: wins / recent.length,
            winRate: wins / recent.length
        };
    }

    private checkTradingConditions(): boolean {
        return this.checkMarketConditions() &&
            this.checkTradingHours() &&
            this.checkVolatility() &&
            this.checkSessionDuration();
    }

    /**
     * Ensures profit is valid and within bounds
     * @private
     * @param {number} rawProfit - Unverified profit amount
     * @returns {number} Validated profit
     */
    private calculateSafeProfit(totalProfit: number, rawProfit: number): number {
        if (totalProfit !== this.state.totalProfit) {
            this.logEvent("Profit changed externally", 'error');
            return this.state.totalProfit;
        }
        if (!Number.isFinite(rawProfit)) {
            this.logEvent("Invalid profit calculation detected", 'error');
            return this.state.totalProfit;
        }
        // Ensure profit doesn't exceed thresholds
        if (rawProfit > this.config.profitThreshold * 1.5) {
            return this.config.profitThreshold;
        }

        return totalProfit + rawProfit;
    }

    // ==================== Condition Evaluation Methods ====================

    private checkMarketConditions(): boolean {
        const conditions = this.analyzeMarketConditions();
        return conditions.volatility <= this.config.maxVolatility &&
            conditions.trend >= this.config.minTrendStrength &&
            conditions.winRate >= this.config.minWinRate;
    }

    public getPerformanceMetrics() {
        return {
            sequenceHistory: this.sequenceHistory,
            dailyPerformance: this.dailyProfitLoss,
            streakAnalysis: {
                currentWinStreak: this.state.consecutiveWins,
                currentLossStreak: this.state.consecutiveLosses
            }
        };
    }

    public getEnhancedMetrics() {
        return {
            ...this.getPerformanceMetrics(),
            winRate: this.stats.totalWins / (this.stats.totalWins + this.stats.totalLosses),
            recoverySuccessRate: this.sequenceHistory
                .filter((s: any) => s.inRecovery)
                .reduce((acc: any, curr: any) => acc + (curr.profit > 0 ? 1 : 0), 0)
        };
    }

    public analyzePerformance(): {
        winRate: number;
        avgProfit: number;
        recoverySuccessRate: number;
        sequenceCompletionRate: number;
    } {
        const totalTrades = this.stats.totalWins + this.stats.totalLosses;
        const winRate = totalTrades > 0 ? this.stats.totalWins / totalTrades : 0;

        const totalProfit = this.recoveryHistory.reduce((sum: number, t: any) => sum + t.profit, 0);
        const avgProfit = this.recoveryHistory.length > 0 ? totalProfit / this.recoveryHistory.length : 0;

        const recoveryTrades = this.recoveryHistory.filter(t => t.recoveryAttempt > 0);
        const recoverySuccessRate = recoveryTrades.length > 0 ?
            recoveryTrades.filter(t => t.outcome === 'win').length / recoveryTrades.length : 0;

        const sequenceCompletionRate = this.sequenceHistory.length > 0 ?
            this.stats.sequencesCompleted / this.sequenceHistory.length : 0;

        return {
            winRate,
            avgProfit,
            recoverySuccessRate,
            sequenceCompletionRate
        };
    }


    public analyzeSequencePerformance(): { winRate: number, avgProfit: number } {
        const results = this.sequenceHistory.filter((s: any) => s.outcome);
        const winRate = results.filter((s: any) => s.profit > 0).length / results.length;
        const avgProfit = results.reduce((sum: number, s: any) => sum + s.profit, 0) / results.length;
        return { winRate, avgProfit };
    }

    // Add this new method to evaluate sequence safety
    // In the shouldContinueSequence() method, line ~614:
    private shouldContinueSequence(): boolean {
        // Don't continue if we've hit daily trade limit
        if (this.state.tradesToday >= this.config.maxDailyTrades) return false;

        // Don't continue if we're in deep recovery
        if (this.state.inRecovery &&
            this.state.totalProfit < -(this.config.lossThreshold * 0.5)) {
            return false;
        }

        // Don't continue if we've had multiple sequence failures today
        // FIXED: Check seq.profit instead of array indexing
        const failedSequencesToday = this.sequenceHistory.filter(
            (seq: any) => seq.profit < 0  // Changed from seq[seq.length - 1] < 0
        ).length;

        return failedSequencesToday < 3; // Max 3 failed sequences per day
    }

    private monitorSession(): void {
        if (this.state.tradesToday > 30 && this.dailyProfitLoss < -this.config.lossThreshold * 0.5) {
            this.logEvent("Stopping after significant losses", 'warn');
            this.pauseStrategy();
        }
    }

    /**
     * Evaluates whether trading should continue
     * @private
     * @returns {TradeDecision} Trade decision with reason
     */
    private evaluateTradingConditions(): TradeDecision {
        // Check daily trade limit
        if (this.state.tradesToday >= this.config.maxDailyTrades) {
            return {
                shouldTrade: false,
                reason: "Daily trade limit reached"
            };
        }

        // Check profit threshold
        if (this.state.totalProfit >= this.config.profitThreshold) {
            return {
                shouldTrade: false,
                reason: `Profit target reached (${this.state.totalProfit.toFixed(2)})`
            };
        }

        // Check loss threshold
        if (this.state.totalProfit <= -this.config.lossThreshold) {
            return {
                shouldTrade: false,
                reason: `Loss limit reached (${Math.abs(this.state.totalProfit).toFixed(2)})`
            };
        }

        // Check consecutive losses
        if (this.state.consecutiveLosses >= this.config.maxRecoveryAttempts) {
            return {
                shouldTrade: false,
                reason: `Max consecutive losses (${this.state.consecutiveLosses})`
            };
        }

        // Add sequence safety check
        if (!this.shouldContinueSequence()) {
            return {
                shouldTrade: false,
                reason: "Sequence safety check failed"
            };
        }

        // Add maximum sequence attempts check
        if (this.sequenceHistory.length >= 5 &&
            this.stats.sequencesCompleted === 0) {
            return {
                shouldTrade: false,
                reason: "No successful sequences in last 5 attempts"
            };
        }

        return { shouldTrade: true };
    }

    // ==================== Utility Methods ====================

    /**
     * Gets sequence variant based on recovery mode
     * @private
     * @returns {number[]} Sequence array
     */
    private getSequenceVariant(): number[] {
        return SEQUENCE_VARIANTS[this.config.recoveryMode];
    }

    /**
     * Checks for new trading day and resets daily counters
     * @private
     */
    private checkDayChange(): void {
        const now: Date = new Date();
        const last: Date = new Date(this.state.lastTradeTimestamp);

        if (
            now.getDate() !== last.getDate() ||
            now.getMonth() !== last.getMonth() ||
            now.getFullYear() !== last.getFullYear()
        ) {
            // Reset daily counters
            this.state.tradesToday = 0;
            this.dailyProfitLoss = 0;
            this.logEvent("New trading day started");
        }
    }

    /**
     * Updates statistics based on trade outcome
     * @private
     * @param {boolean} outcome - Trade outcome
     * @param {number} profit - Profit amount
     */
    private updateStatistics(outcome: boolean, profit: number): void {
        // Update win/loss streaks
        if (outcome) {
            this.stats.maxWinStreak = Math.max(
                this.stats.maxWinStreak,
                this.state.consecutiveWins
            );
        } else {
            this.stats.maxLossStreak = Math.max(
                this.stats.maxLossStreak,
                this.state.consecutiveLosses
            );
        }

        // Track best/worst sequence performance
        if (this.state.sequencePosition === 0 && !this.state.inRecovery) {
            if (profit > 0) {
                this.stats.bestSequenceProfit = Math.max(
                    this.stats.bestSequenceProfit,
                    profit
                );
            } else {
                this.stats.worstSequenceLoss = Math.min(
                    this.stats.worstSequenceLoss,
                    profit
                );
            }
        }

        if (this.state.inRecovery) {
            if (outcome && profit > 0) {
                this.stats.bestRecoveryProfit = Math.max(this.stats.bestRecoveryProfit, profit);
                this.stats.successfulRecoveries++;
            } else if (!outcome) {
                this.stats.worstRecoveryLoss = Math.min(this.stats.worstRecoveryLoss, profit);
            }
            this.stats.totalRecoveryAttempts++;
        }
    }

    /**
     * Logs strategy events
     * @private
     * @param {string} message - Event message
     * @param {'info' | 'warn' | 'error'} [level='info'] - Log level
     */
    private logEvent(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        const entry = {
            timestamp: new Date().toISOString(),
            strategy: '1326-Enhanced',
            level,
            message,
            state: { ...this.state },
            stats: { ...this.stats }
        };

        console.log(JSON.stringify(entry, null, 2));
    }

    public logRecoveryAttempt(): void {
        this.logEvent(`Recovery attempt ${this.state.recoveryAttempts}/${this.config.maxRecoveryAttempts}`,
            this.state.recoveryAttempts >= 1 ? 'warn' : 'info');  // Changed > 1 to >= 1
    }

    // ==================== Public Interface Methods ====================

    /**
     * Gets current statistics
     * @public
     * @returns {StrategyStatistics} Strategy statistics
     */
    public getStatistics(): StrategyStatistics {
        return { ...this.stats };
    }

    /**
     * Gets current strategy state
     * @public
     * @returns {StrategyState} Current state
     */
    public getCurrentState(): StrategyState {
        return { ...this.state };
    }

    /**
     * Resets strategy to initial state
     * @public
     */
    public resetStrategy(): void {
        this.state = this.initializeState(); // Starts at sequence position 0
        this.stats = this.initializeStatistics();
        this.isActive = true;
        this.logEvent("Strategy fully reset");
    }

    /**
     * Pauses strategy execution
     * @public
     */
    public pauseStrategy(): void {
        this.isActive = false;
        this.logEvent("Strategy paused");
    }

    /**
     * Resumes strategy execution
     * @public
     */
    public resumeStrategy(): void {
        this.isActive = true;
        this.logEvent("Strategy resumed");
    }
}