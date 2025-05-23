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

import { getRandomDigit } from "@/common/utils/snippets";
import { ContractDurationUnitTypeEnum, ContractTypeEnum, ContractType, ContractDurationUnitType } from './types';
import { roundToTwoDecimals } from '../../common/utils/snippets';

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
    contractType?: ContractType;
    duration?: number;
    durationType?: ContractDurationUnitType;
    market?: string;
    metadata?: {
        sequencePosition: number;
        inRecovery: boolean;
        sequence: string;
    };
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

    /** @type {number[][]} */
    private sequenceHistory: number[][];
    
    /** @type {number} */
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
            maxDailyTrades: 50
        };

        const merged: StrategyConfiguration = { ...defaults, ...config };

        if (merged.initialStake <= 0) throw new Error("Initial stake must be positive");
        if (merged.profitThreshold <= 0) throw new Error("Profit threshold must be positive");
        if (merged.lossThreshold <= 0) throw new Error("Loss threshold must be positive");
        if (merged.maxRecoveryAttempts < 0) throw new Error("Max recovery attempts cannot be negative");
        if (merged.maxDailyTrades <= 0) throw new Error("Max daily trades must be positive");

        return merged;
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
            worstSequenceLoss: 0
        };
    }

    // ==================== Core Strategy Methods ====================

    // Add this method to select sequence based on market conditions
    private selectOptimalSequence(): number[] {
        // If we're in a losing streak, use more conservative sequence
        if (this.state.consecutiveLosses >= 2) {
            return SEQUENCE_VARIANTS.conservative;
        }

        // If we're in recovery, use neutral sequence
        if (this.state.inRecovery) {
            return SEQUENCE_VARIANTS.neutral;
        }

        // Default to configured sequence
        return SEQUENCE_VARIANTS[this.config.recoveryMode];
    }

    // Add this method to lock in profits
    private shouldLockInProfits(): boolean {
        // Lock in profits if we've reached 50% of target
        if (this.state.totalProfit >= this.config.profitThreshold * 0.5) {
            return true;
        }

        // Lock in profits if we've had a good sequence
        if (this.state.sequenceProfit >= this.config.initialStake * 10) {
            return true;
        }

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
            
        } else {

            // Update state from previous trade if provided
            if (lastOutcome !== undefined && lastProfit !== undefined) {
                this.updateState(lastOutcome, lastProfit);
            }

            // Check trading conditions
            const shouldTrade: TradeDecision = this.evaluateTradingConditions();
            if (!shouldTrade.shouldTrade) {
                return shouldTrade;
            }

        }

        // Calculate next stake (starting with sequence position 0)
        const stake: number = roundToTwoDecimals(this.calculateNextStake()) as number;

        return {
            shouldTrade: true,
            amount: stake,
            prediction: getRandomDigit(),
            contractType: ContractTypeEnum.DigitDiff,
            market: this.config.market,
            duration: 1,
            durationType: ContractDurationUnitTypeEnum.Default,
            metadata: {
                sequencePosition: this.state.sequencePosition,
                inRecovery: this.state.inRecovery,
                sequence: this.state.currentSequence.join('-')
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
    private updateState(outcome: boolean, profit: number): void {
        // Validate profit value
        if (!Number.isFinite(profit)) {
            throw new Error("Invalid profit value");
        }

        // Update daily stats
        this.state.tradesToday++;
        this.dailyProfitLoss += profit;
        this.state.lastTradeTimestamp = Date.now();

        // Update profit tracking
        this.state.totalProfit = this.calculateSafeProfit(this.state.totalProfit + profit);
        this.state.sequenceProfit += profit;

        if (outcome) {
            this.handleWin();
        } else {
            this.handleLoss();
        }

        // Update statistics
        this.updateStatistics(outcome, profit);
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
        this.sequenceHistory.push([...this.state.currentSequence]);

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
        this.state.sequencePosition = 0; // Reset to first position
        this.state.currentSequence = this.getSequenceVariant();
        this.state.currentStake = this.config.initialStake * this.state.currentSequence[0]; // Start with first sequence value
        this.state.sequenceProfit = 0;
    }

    // ==================== Recovery Management Methods ====================

    /**
     * Enters recovery mode
     * @private
     */
    private enterRecoveryMode(): void {
        this.state.inRecovery = true;
        this.state.currentStake = this.calculateRecoveryStake();
        this.logEvent("Entering recovery mode");
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
            // Continue recovery but with reduced stake
            this.state.currentStake = this.calculateRecoveryStake();
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

    // ==================== Calculation Methods ====================

    /**
     * Calculates next stake amount
     * @private
     * @returns {number} Stake amount
     */
    private calculateNextStake(): number {
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
        const lossAmount: number = Math.abs(this.state.totalProfit);
        const baseMultiplier: number = RECOVERY_MULTIPLIERS[this.config.recoveryMode];
        const multiplier: number = increase ? baseMultiplier * 1.5 : baseMultiplier;
        
        const calculatedStake: number = lossAmount * multiplier;
        
        // Ensure stake doesn't exceed loss threshold
        return Math.min(
            calculatedStake,
            this.config.lossThreshold * 0.5 // Don't risk more than half loss threshold
        );
    }

    /**
     * Gets next stake amount in sequence
     * @private
     * @returns {number} Stake amount
     */
    private getNextSequenceStake(): number {
        return this.config.initialStake * 
               this.state.currentSequence[this.state.sequencePosition];
    }

    /**
     * Ensures profit is valid and within bounds
     * @private
     * @param {number} rawProfit - Unverified profit amount
     * @returns {number} Validated profit
     */
    private calculateSafeProfit(rawProfit: number): number {
        // Ensure profit is a finite number
        if (!Number.isFinite(rawProfit)) {
            this.logEvent("Invalid profit calculation detected", "error");
            return this.state.totalProfit; // Revert to previous value
        }
        
        // Ensure profit doesn't exceed thresholds
        if (rawProfit > this.config.profitThreshold * 1.5) {
            return this.config.profitThreshold;
        }
        
        return rawProfit;
    }

    // ==================== Condition Evaluation Methods ====================

    // Add this new method to calculate dynamic recovery stake
    private calculateDynamicRecoveryStake(): number {
        const lossAmount = Math.abs(this.state.totalProfit);
        const baseMultiplier = RECOVERY_MULTIPLIERS[this.config.recoveryMode];

        // Dynamic multiplier based on consecutive losses
        const dynamicMultiplier = baseMultiplier *
            (1 + (this.state.consecutiveLosses * 0.1)); // 10% increase per consecutive loss

        let calculatedStake = lossAmount * dynamicMultiplier;

        // Cap at 25% of loss threshold and ensure minimum stake
        return Math.max(
            this.config.initialStake,
            Math.min(
                calculatedStake,
                this.config.lossThreshold * 0.25
            )
        );
    }

    // Add this new method to evaluate sequence safety
    private shouldContinueSequence(): boolean {
        // Don't continue if we've hit daily trade limit
        if (this.state.tradesToday >= this.config.maxDailyTrades) return false;

        // Don't continue if we're in deep recovery
        if (this.state.inRecovery &&
            this.state.totalProfit < -(this.config.lossThreshold * 0.5)) {
            return false;
        }

        // Don't continue if we've had multiple sequence failures today
        const failedSequencesToday = this.sequenceHistory.filter(
            seq => seq[seq.length - 1] < 0
        ).length;

        return failedSequencesToday < 3; // Max 3 failed sequences per day
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
        if ( this.state.consecutiveLosses >= this.config.maxRecoveryAttempts ) {
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