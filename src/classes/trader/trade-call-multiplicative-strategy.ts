// trade-call-multiplicative-strategy.ts (FIXED VERSION)
/**
 * CALL Multiplicative Recovery Trading Strategy with Complete Type Safety
 * @class CallMultiplicativeRecoveryStrategy
 * @description Implements a robust CALL strategy with multiplicative recovery:
 * - Always trades CALL contracts
 * - Multiplicative recovery: (LossAmount*2 + 1) + 0.9*LossAmount on losses
 * - Resets to initial stake on wins
 * - Comprehensive risk management
 * - Complete type safety
 */

import { getRandomDigit, mathMax, mathMin, roundToTwoDecimals } from "@/common/utils/snippets";
import { ContractDurationUnitTypeEnum, ContractTypeEnum, ContractType, ContractDurationUnitType, MultiplicativeRecoveryMode } from './types';

// ==================== Type Definitions ====================

interface StrategyConfiguration {
    profitThreshold: number;
    lossThreshold: number;
    initialStake: number;
    market: string;
    maxRecoveryAttempts: number;
    maxDailyTrades: number;
    enableRecovery: boolean;
    maxStakeMultiplier: number;
    enableAutoAdjust: boolean;
    maxVolatility: number;
    minTrendStrength: number;
    minWinRate: number;
    recoveryMode: MultiplicativeRecoveryMode;
}

interface StrategyStatistics {
    totalWins: number;
    totalLosses: number;
    recoveryCycles: number;
    maxWinStreak: number;
    maxLossStreak: number;
    bestRecoveryProfit: number;
    worstRecoveryLoss: number;
    totalRecoveryAttempts: number;
    successfulRecoveries: number;
}

interface StrategyState {
    currentStake: number;
    totalProfit: number;
    consecutiveWins: number;
    consecutiveLosses: number;
    recoveryAttempts: number;
    tradesToday: number;
    lastTradeTimestamp: number;
    currentLossAmount: number;
    inRecovery: boolean;
    lastRecoveryProfit: number;
}

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
        inRecovery: boolean;
        recoveryAttempt: number;
        consecutiveLosses: number;
        stakeMultiplier: number;
        marketConditions: any;
    };
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

const RECOVERY_MULTIPLIERS: Record<MultiplicativeRecoveryMode, number> = {
    standard: 2.5, // (2 + 0.9) from the formula
    aggressive: 3.0,
    conservative: 2.0
};

const SAFETY_FACTORS = {
    MAX_RECOVERY_ATTEMPTS: 3,
    MAX_STAKE_MULTIPLIER: 10,
    MINIMUM_STAKE: 0.35,
    VOLATILITY_REDUCTION: 0.7
};

export const PAYOUT_RATE = 0.92;

export const RECOVERY_PAYOUT_RATE = 0.0964;

// ==================== Strategy Class ====================

export class CallMultiplicativeRecoveryStrategy {
    private config: StrategyConfiguration;
    private state: StrategyState;
    private stats: StrategyStatistics;
    private isActive: boolean;
    private recoveryHistory: RecoveryHistoryEntry[];
    private dailyProfitLoss: number;

    constructor(config: Partial<StrategyConfiguration> = {}) {
        this.config = this.initializeConfig(config);
        this.state = this.initializeState();
        this.stats = this.initializeStatistics();
        this.isActive = true;
        this.recoveryHistory = [];
        this.dailyProfitLoss = 0;
    }

    // ==================== Initialization Methods ====================

    private initializeConfig(config: Partial<StrategyConfiguration>): StrategyConfiguration {
        const defaults: StrategyConfiguration = {
            profitThreshold: 100,
            lossThreshold: 50,
            initialStake: 1,
            market: 'R_100',
            maxRecoveryAttempts: 3,
            maxDailyTrades: 50,
            enableRecovery: true,
            maxStakeMultiplier: 10,
            enableAutoAdjust: true,
            maxVolatility: 0.6,
            minWinRate: 0.4,
            minTrendStrength: 0.4,
            recoveryMode: 'standard'
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

        this.validateConfiguration(merged);
        return merged;
    }

    private validateConfiguration(config: StrategyConfiguration): void {
        if (config.initialStake <= 0) throw new Error("Initial stake must be positive");
        if (config.profitThreshold <= 0) throw new Error("Profit threshold must be positive");
        if (config.lossThreshold <= 0) throw new Error("Loss threshold must be positive");
        if (config.maxRecoveryAttempts < 0) throw new Error("Max recovery attempts cannot be negative");
        if (config.maxDailyTrades <= 0) throw new Error("Max daily trades must be positive");
        if (config.maxStakeMultiplier <= 1) throw new Error("Max stake multiplier must be greater than 1");
    }

    private initializeState(): StrategyState {
        return {
            currentStake: this.config.initialStake,
            totalProfit: 0,
            consecutiveWins: 0,
            consecutiveLosses: 0,
            recoveryAttempts: 0,
            tradesToday: 0,
            lastTradeTimestamp: Date.now(),
            currentLossAmount: 0,
            inRecovery: false,
            lastRecoveryProfit: 0
        };
    }

    private initializeStatistics(): StrategyStatistics {
        return {
            totalWins: 0,
            totalLosses: 0,
            recoveryCycles: 0,
            maxWinStreak: 0,
            maxLossStreak: 0,
            bestRecoveryProfit: 0,
            worstRecoveryLoss: 0,
            totalRecoveryAttempts: 0,
            successfulRecoveries: 0
        };
    }

    // ==================== Core Strategy Methods ====================

    public prepareForNextTrade(lastOutcome?: boolean, lastProfit?: number): TradeDecision {
        if (!this.isActive) {
            return {
                shouldTrade: false,
                reason: "Strategy is inactive"
            };
        }

        // Reset daily stats if new day
        this.checkDayChange();

        // Check trading conditions
        const shouldTrade = this.evaluateTradingConditions();
        if (!shouldTrade.shouldTrade) {
            return shouldTrade;
        }

        // Calculate next stake
        const stake = roundToTwoDecimals(this.calculateNextStake()) as number;
        const randomDigit = getRandomDigit();

        return {
            shouldTrade: true,
            amount: stake,
            prediction: 'CALLE', // Always predict CALL
            barrier: randomDigit,
            contractType: ContractTypeEnum.Call,
            market: this.config.market,
            duration: 1,
            durationType: ContractDurationUnitTypeEnum.Ticks,
            metadata: {
                inRecovery: this.state.inRecovery,
                recoveryAttempt: this.state.recoveryAttempts,
                consecutiveLosses: this.state.consecutiveLosses,
                stakeMultiplier: stake / this.config.initialStake,
                marketConditions: this.analyzeMarketConditions()
            }
        };
    }

    public updateState(outcome: boolean, profit: number): void {
        // Validate inputs
        this.validateProfitInput(profit);

        // Update daily stats
        this.state.tradesToday++;
        this.dailyProfitLoss += profit;
        this.state.lastTradeTimestamp = Date.now();

        // Update profit tracking with safety checks
        this.state.totalProfit = this.calculateSafeProfit(this.state.totalProfit, profit);

        if (outcome) {
            this.handleWin(profit);
        } else {
            this.handleLoss(profit);
        }

        // Update statistics
        this.updateStatistics(outcome, profit);

        // Record in history
        this.recordTradeHistory(outcome, profit);

        // Monitor session safety
        this.monitorSession();
    }

    // ==================== Win/Loss Handlers ====================

    private handleWin(profit: number): void {
        this.state.consecutiveWins++;
        this.state.consecutiveLosses = 0;
        this.stats.totalWins++;

        if (this.state.inRecovery) {
            this.handleRecoveryWin(profit);
        } else {
            this.handleNormalWin();
        }
        
    }

    private handleNormalWin(): void {
        // For normal wins (not in recovery), just update statistics
        // The stake is already reset to initial in the main handleWin method
        this.logEvent("Normal win - strategy continues with initial stake");
        this.state.currentStake = this.config.initialStake;
    }

    private handleLoss(profit: number): void {
        this.state.consecutiveLosses++;
        this.state.consecutiveWins = 0;
        this.stats.totalLosses++;

        // Track cumulative loss amount for recovery calculation
        this.state.currentLossAmount += Math.abs(profit);

        if (this.config.enableRecovery) {
            this.enterRecoveryMode();
        }

        this.updateRecoveryStatistics();
    }

    // ==================== Recovery Management ====================

    private enterRecoveryMode(): void {
        this.state.inRecovery = true;
        this.state.recoveryAttempts++;
        this.stats.totalRecoveryAttempts++;

        this.logEvent(`Entering recovery mode (Attempt ${this.state.recoveryAttempts})`, 'warn');
    }

    private exitRecoveryMode(): void {
        this.state.inRecovery = false;
        this.state.recoveryAttempts = 0;
        this.state.currentLossAmount = 0;
        this.stats.successfulRecoveries++;
        this.state.currentStake = this.config.initialStake;
        this.logEvent("Exited recovery mode successfully", 'info');
    }

    private handleRecoveryWin(profit: number): void {
        this.state.lastRecoveryProfit = profit;
        this.state.currentLossAmount -= Math.abs(profit); 
        if (this.state.currentLossAmount < 0) {
            // Full recovery achieved
            this.exitRecoveryMode();
        } else {
            // Partial recovery - continue with reduced stake
            this.state.currentStake = this.calculateRecoveryStake();
            
        }
    }

    // ==================== Calculation Methods ====================

    private calculateNextStake(): number {
        if (!this.shouldContinueTrading()) {
            return 0;
        }

        if (this.state.inRecovery) {
            return this.calculateRecoveryStake();
        }

        // Normal operation - use initial stake
        return this.config.initialStake;
    }

    private calculateRecoveryStake(): number {
        const baseMultiplier = RECOVERY_MULTIPLIERS[this.config.recoveryMode];
        const dynamicMultiplier = baseMultiplier * (1 + (this.state.consecutiveLosses * 0.1));

        let calculatedStake = this.state.currentLossAmount * dynamicMultiplier;

        // Apply volatility adjustment if enabled
        if (this.config.enableAutoAdjust) {
            calculatedStake = this.getVolatilityAdjustedStake(calculatedStake);
        }

        // Apply safety limits
        return this.validateStake(calculatedStake);
    }

    private validateStake(amount: number): number {
        const maxStake = this.config.initialStake * this.config.maxStakeMultiplier;
        const minStake = mathMax(this.config.initialStake, SAFETY_FACTORS.MINIMUM_STAKE);
        return mathMax(
            minStake,
            mathMin(amount, maxStake, this.config.lossThreshold * 0.3)
        );
    }

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

        return totalProfit+rawProfit;
    }

    // ==================== Risk Management ====================

    private evaluateTradingConditions(): TradeDecision {
        if (this.state.tradesToday >= this.config.maxDailyTrades) {
            return { shouldTrade: false, reason: "Daily trade limit reached" };
        }

        if (this.state.totalProfit >= this.config.profitThreshold) {
            return { shouldTrade: false, reason: `Profit target reached (${this.state.totalProfit.toFixed(2)})` };
        }

        if (this.state.totalProfit <= -this.config.lossThreshold) {
            return { shouldTrade: false, reason: `Loss limit reached (${Math.abs(this.state.totalProfit).toFixed(2)})` };
        }

        if (this.state.recoveryAttempts >= this.config.maxRecoveryAttempts) {
            return { shouldTrade: false, reason: `Max recovery attempts (${this.state.recoveryAttempts})` };
        }

        if (!this.checkMarketConditions()) {
            return { shouldTrade: false, reason: "Unfavorable market conditions" };
        }

        return { shouldTrade: true };
    }

    private shouldContinueTrading(): boolean {
        return this.state.tradesToday < this.config.maxDailyTrades &&
            this.state.totalProfit < this.config.profitThreshold &&
            this.state.totalProfit > -this.config.lossThreshold &&
            this.state.recoveryAttempts < this.config.maxRecoveryAttempts &&
            this.checkMarketConditions();
    }

    // ==================== Market Analysis ====================

    private    analyzeMarketConditions(): { wins: number, losses: number, totalProfit: number, volatility: number; trend: number; winRate: number } {
        const recent = this.recoveryHistory.slice(-20);
        if (recent.length === 0) {
            return { wins: 0, losses: 0, totalProfit: 0, volatility: 0, trend: this.config.minTrendStrength, winRate: this.config.minWinRate };
        }

        const wins = recent.filter(t => t.outcome === 'win').length;
        const losses = recent.filter(t => t.outcome !== 'win').length;
        const totalProfit = recent.reduce((sum, t) => sum + Math.abs(t.profit), 0);
        const avgProfit = totalProfit / recent.length;

        return {
            wins: wins,
            losses: losses,
            totalProfit: totalProfit,
            volatility: 1 - ((this.config.initialStake * PAYOUT_RATE) / avgProfit),
            trend: wins / recent.length,
            winRate: wins / recent.length
        };
    }

    private checkMarketConditions(): boolean {
        const conditions = this.analyzeMarketConditions();
        console.log("🔵 CONDITIONS:", [conditions])
        console.log("🔵 CONFIG:", [this.config])
        return conditions.volatility <= this.config.maxVolatility &&
            conditions.trend >= this.config.minTrendStrength &&
            conditions.winRate >= this.config.minWinRate;
    }

    public getVolatilityAdjustedStake(baseStake: number): number {
        const conditions = this.analyzeMarketConditions();
        const reductionFactor = 1 - (mathMin(SAFETY_FACTORS.MINIMUM_STAKE, conditions.volatility * SAFETY_FACTORS.VOLATILITY_REDUCTION));
        return baseStake * reductionFactor;
    }

    // ==================== Utility Methods ====================

    private checkDayChange(): void {
        const now = new Date();
        const last = new Date(this.state.lastTradeTimestamp);

        if (now.getDate() !== last.getDate() || now.getMonth() !== last.getMonth()) {
            this.state.tradesToday = 0;
            this.dailyProfitLoss = 0;
            this.logEvent("New trading day started");
        }
    }

    private monitorSession(): void {
        if (this.state.tradesToday > 30 && this.dailyProfitLoss < -this.config.lossThreshold * 0.5) {
            this.logEvent("Stopping after significant losses", 'warn');
            this.pauseStrategy();
        }
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

    private updateStatistics(outcome: boolean, profit: number): void {
        if (outcome) {
            this.stats.maxWinStreak = Math.max(this.stats.maxWinStreak, this.state.consecutiveWins);
            if (this.state.inRecovery && profit > 0) {
                this.stats.bestRecoveryProfit = Math.max(this.stats.bestRecoveryProfit, profit);
            }
        } else {
            this.stats.maxLossStreak = Math.max(this.stats.maxLossStreak, this.state.consecutiveLosses);
            if (this.state.inRecovery) {
                this.stats.worstRecoveryLoss = Math.min(this.stats.worstRecoveryLoss, profit);
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

    private updateRecoveryStatistics(): void {
        if (this.state.consecutiveLosses === 1 && !this.state.inRecovery) {
            this.stats.recoveryCycles++;
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

    private logEvent(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        const entry = {
            timestamp: new Date().toISOString(),
            strategy: 'CALL-Multiplicative-Recovery',
            level,
            message,
            state: { ...this.state },
            stats: { ...this.stats }
        };
        console.log(JSON.stringify(entry, null, 2));
    }

    // ==================== Public Interface ====================

    public updateConfig(updates: Partial<StrategyConfiguration>): void {
        this.config = this.initializeConfig({ ...this.config, ...updates });
        this.logEvent("Configuration updated");
    }

    public getStatistics(): StrategyStatistics {
        return { ...this.stats };
    }

    public getCurrentState(): StrategyState {
        return { ...this.state };
    }

    public getPerformanceMetrics() {
        return {
            recoveryHistory: this.recoveryHistory,
            dailyPerformance: this.dailyProfitLoss,
            streakAnalysis: {
                currentWinStreak: this.state.consecutiveWins,
                currentLossStreak: this.state.consecutiveLosses
            },
            marketConditions: this.analyzeMarketConditions()
        };
    }

    public resetStrategy(): void {
        this.state = this.initializeState();
        this.stats = this.initializeStatistics();
        this.recoveryHistory = [];
        this.isActive = true;
        this.logEvent("Strategy fully reset");
    }

    public pauseStrategy(): void {
        this.isActive = false;
        this.logEvent("Strategy paused");
    }

    public resumeStrategy(): void {
        this.isActive = true;
        this.logEvent("Strategy resumed");
    }

    public analyzePerformance(): { winRate: number; avgProfit: number; recoverySuccessRate: number } {
        const totalTrades = this.stats.totalWins + this.stats.totalLosses;
        const winRate = totalTrades > 0 ? this.stats.totalWins / totalTrades : 0;

        const totalProfit = this.recoveryHistory.reduce((sum, t) => sum + t.profit, 0);
        const avgProfit = this.recoveryHistory.length > 0 ? totalProfit / this.recoveryHistory.length : 0;

        const recoverySuccessRate = this.stats.totalRecoveryAttempts > 0 ?
            this.stats.successfulRecoveries / this.stats.totalRecoveryAttempts : 0;

        return { winRate, avgProfit, recoverySuccessRate };
    }

    public setTradesToday(tradesToday: number): void {
        this.state.tradesToday = tradesToday;
    }

    public setRecoveryAttempts(recoveryAttempts: number): void {
        this.state.recoveryAttempts = recoveryAttempts;
    }

    public setRecoveryHistory(recoveryHistory: any[]): void {
        this.recoveryHistory = recoveryHistory;
    }

}