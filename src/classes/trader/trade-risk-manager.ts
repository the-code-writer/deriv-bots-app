import { getRandomDigit } from '@/common/utils/snippets';
import { IDerivUserAccount } from './deriv-user-account';
import { StrategyRewards, BasisType, ContractType, BasisTypeEnum, ContractTypeEnum, MarketType, CurrencyType, ContractDurationUnitType, ITradeData, IPreviousTradeResult } from './types';
import { pino } from "pino";

// Initialize logger for tracking events and errors
// Enhanced logger with error tracking
const logger = pino({
    name: "StrategyVolatilityRiskManager",
    level: process.env.LOG_LEVEL || "info",
    serializers: {
        error: pino.stdSerializers.err
    }
});

// Constants for safety limits
const MAX_RECOVERY_ATTEMPTS = 5;
const MAX_STAKE_MULTIPLIER = 20;
const DEFAULT_TRADE_DELAY_MS = 1000;
const SAFETY_COOLDOWN_MS = 5000;

const MAX_ABSOLUTE_LOSS = 1000; // Example value
const RAPID_LOSS_THRESHOLD = 3; // Max losses in short period
const RAPID_LOSS_TIME_WINDOW = 60000; // 1 minute


enum ErrorCode {
    INVALID_STRATEGY = "STRATEGY_001",
    BALANCE_TOO_LOW = "ACCOUNT_001",
    MAX_RISK_EXCEEDED = "RISK_001"
}


/**
 * Interface defining parameters for the next trade
 */
interface NextTradeParams {
    basis: BasisType;                // Trade basis type
    symbol: string;                  // Market symbol
    amount: number;                  // Stake amount
    barrier: string | number;          // Barrier price (if applicable)
    currency: string;                // Currency
    contractType: ContractType;      // Contract type
    contractDurationValue: number;   // Contract duration value
    contractDurationUnits: string;   // Contract duration units
    previousResultStatus: boolean;   // Result of previous trade
    consecutiveLosses: number;       // Count of consecutive losses
    totalAmountToRecover: number;    // Total amount needing recovery
    winningTrades: number;           // Count of winning trades
    losingTrades: number;            // Count of losing trades
}

/**
 * Interface defining a recovery strategy
 */
interface RecoveryStrategy {
    readonly strategyName: string;            // Name of the strategy
    readonly strategySteps: RecoveryStep[];    // Sequence of steps in the strategy
    readonly maxSequence: number;             // Maximum steps in sequence
    profitPercentage: number;        // Expected profit percentage
    readonly lossRecoveryPercentage: number;  // Percentage of loss to recover
    readonly anticipatedProfitPercentage: number; // Percentage of anticipated profit
    readonly maxConsecutiveLosses: number;    // Maximum allowed consecutive losses
    readonly maxRiskExposure: number;         // Maximum risk exposure multiplier
    readonly minBalanceRequired?: number;
}

interface AdaptiveRecoveryStrategy extends RecoveryStrategy {
    historicalWinRate?: number;
    dynamicProfitPercentage?: boolean;
    maxDailyAttempts?: number;
}

/**
 * Interface defining a single step in a recovery strategy
 */
interface RecoveryStep {
    amount: number | ((prevLoss: number) => number); // Stake amount for this step
    symbol: string;                  // Market symbol
    contractType: ContractType;      // Contract type
    contractDurationValue: number;   // Contract duration value
    contractDurationUnits: string;   // Contract duration units
    contractBarrier?: number;        // Optional barrier price
    delay?: number;                  // Optional delay before next trade
    profitPercentage?: number | ((prevLoss: number, contractType: ContractType) => number);
    readonly minSuccessProbability?: number;
}

/**
 * Performance metrics tracking system for recovery strategies
 */
interface IPerformanceMetrics {
    /**
     * Overall recovery success rate (0-1)
     * @description Tracks the percentage of successful recovery attempts
     */
    recoverySuccessRate: number;

    /**
     * Average time taken for successful recoveries (in milliseconds)
     * @description Calculated as exponential moving average for responsiveness
     */
    avgRecoveryTime: number;

    /**
     * Effectiveness score per strategy (0-100)
     * @description Composite score based on win rate, profitability, and speed
     */
    strategyEffectiveness: Map<string, number>;

    /**
     * Historical trade outcomes
     * @description Stores complete history of trade attempts and outcomes
     */
    tradeHistory: Array<{
        timestamp: number;
        strategy: string;
        stake: number;
        outcome: 'win' | 'loss';
        recoveryAmount: number;
        duration: number;
        marketConditions?: string;
    }>;

    /**
     * Current streak counters
     * @description Tracks consecutive wins/losses for trend analysis
     */
    streaks: {
        currentWin: number;
        currentLoss: number;
        maxWin: number;
        maxLoss: number;
    };

    /**
     * Time-based metrics
     * @description Tracks performance by time periods
     */
    timeMetrics: {
        hourly: {
            wins: number;
            losses: number;
            profit: number;
        };
        daily: {
            wins: number;
            losses: number;
            profit: number;
        };
    };

    calculated: {
        hourlyWinRate?: number;
        dailyWinRate?: number;
        strategyRisk?: Map<string, { wins: number; losses: number; avgProfit: number }>;
        filteredWinRate?: number;
        filteredCount?: number;
    };
}


/**
* Circuit breaker configuration interface
*/
interface ICircuitBreakerConfig {
    /**
     * Maximum absolute loss before triggering circuit breaker
     * @description Absolute loss limit across all trades
     */
    maxAbsoluteLoss: number;

    /**
     * Maximum daily loss before triggering circuit breaker
     * @description Resets at midnight local time
     */
    maxDailyLoss: number;

    /**
     * Maximum consecutive losses before triggering
     * @description Independent of monetary amount
     */
    maxConsecutiveLosses: number;

    /**
     * Maximum loss percentage of account balance
     * @description Percentage of current account balance (0-1)
     */
    maxBalancePercentageLoss: number;

    /**
     * Time window for rapid loss detection (ms)
     * @description Detects abnormal frequency of losses
     */
    rapidLossTimeWindow: number;

    /**
     * Number of losses in time window to trigger
     * @description Combined with rapidLossTimeWindow
     */
    rapidLossThreshold: number;

    /**
     * Cooldown period after triggering (ms)
     * @description How long to remain in safety mode
     */
    cooldownPeriod: number;
}

/**
 * Circuit breaker state tracker
 */
interface ICircuitBreakerState {
    /**
     * Timestamp of last triggered breaker
     */
    lastTriggered: number | null;

    /**
     * Reason for last trigger
     */
    lastReason: string | null;

    /**
     * Daily loss accumulator
     */
    dailyLoss: number;

    /**
     * Timestamp of last daily reset
     */
    lastDailyReset: number;

    /**
     * Timestamps of recent losses for rapid detection
     */
    recentLossTimestamps: number[];
}

/**
 * Rapid loss detection configuration interface
 */
interface IRapidLossConfig {
    /**
     * Time window for rapid loss detection (milliseconds)
     * @default 300000 (5 minutes)
     * @description The sliding window period to monitor for abnormal loss frequency
     */
    timeWindowMs: number;

    /**
     * Threshold count of losses within time window to trigger
     * @default 3
     * @description Number of losses required within timeWindowMs to consider it rapid
     */
    threshold: number;

    /**
     * Minimum stake multiplier to consider for rapid losses
     * @default 1.5
     * @description Only losses above (baseStake * multiplier) are counted as significant
     */
    minStakeMultiplier: number;

    /**
     * Cool-down period after rapid loss detection (milliseconds)
     * @default 900000 (15 minutes)
     * @description How long to pause trading after rapid losses detected
     */
    coolDownMs: number;

    /**
     * Enable/disable rapid loss protection
     * @default true
     */
    enabled: boolean;
}

/**
 * Rapid loss detection state tracker
 */
interface IRapidLossState {
    /**
     * Timestamps of recent qualifying losses
     * @description Stores timestamps of losses that meet minimum stake criteria
     */
    recentLossTimestamps: number[];

    /**
     * Amounts of recent qualifying losses
     * @description Parallel array to track loss amounts for analysis
     */
    recentLossAmounts: number[];

    /**
     * Time when rapid loss was last detected
     * @description Used to enforce cool-down period
     */
    lastDetectedTime: number | null;

    /**
     * Count of rapid loss events in current session
     * @description For monitoring overall system health
     */
    eventCount: number;
}

/**
 * Account balance validation configuration
 */
interface IBalanceValidationConfig {
    /**
     * Minimum account balance multiplier
     * @default 3.0
     * @description Minimum balance must be (currentStake * multiplier)
     */
    minBalanceMultiplier: number;

    /**
     * Absolute minimum account balance
     * @default 50
     * @description Minimum account balance in account currency
     */
    minAbsoluteBalance: number;

    /**
     * Risk percentage per trade
     * @default 0.02 (2%)
     * @description Max percentage of balance that can be risked per trade
     */
    maxRiskPercentage: number;

    /**
     * Enable balance validation
     * @default true
     */
    enabled: boolean;

    /**
     * Safety buffer percentage
     * @default 0.1 (10%)
     * @description Additional buffer beyond minimum requirements
     */
    safetyBuffer: number;
}


/**
 * Validation result interface
 */
interface ValidationResult {
    /**
     * Overall validation status
     */
    isValid: boolean;

    /**
     * Array of failure reasons if invalid
     */
    reasons: string[];

    /**
     * Detailed validation metrics
     */
    metrics: {
        /**
         * Current account balance
         */
        balance: number;

        /**
         * Proposed stake amount
         */
        proposedStake: number;

        /**
         * Percentage of balance being risked
         */
        riskPercentage: number;

        /**
         * Calculated minimum required balance
         */
        requiredMinimum: number;

        /**
         * Projected balance after trade
         */
        availableAfterTrade: number;

        /**
         * Indicates if validation was bypassed
         */
        bypassed?: boolean;
    };
}

/**
 * Profit adjustment configuration interface
 */
interface IProfitAdjustmentConfig {
    /**
     * Base profit percentage for the strategy
     * @description Used as starting point before adjustments
     */
    basePercentage: number;

    /**
     * Maximum allowed adjustment (0-1)
     * @default 0.3 (30%)
     * @description Limits how much the percentage can vary from base
     */
    maxAdjustment: number;

    /**
     * Market volatility sensitivity (0-1)
     * @default 0.5
     * @description How strongly volatility affects profit targets
     */
    volatilitySensitivity: number;

    /**
     * Trend impact multiplier
     * @default { up: 1.1, down: 0.9, neutral: 1.0 }
     * @description Modifiers for different market trends
     */
    trendMultipliers: {
        up: number;
        down: number;
        neutral: number;
    };

    /**
     * Strategy performance weights
     * @description How much different factors influence adjustment
     */
    weights: {
        /**
         * Historical win rate impact (0-1)
         * @default 0.4
         */
        winRate: number;

        /**
         * Recent performance impact (0-1)
         * @default 0.3
         */
        recentPerformance: number;

        /**
         * Market conditions impact (0-1)
         * @default 0.3
         */
        marketConditions: number;
    };

    /**
     * Minimum allowed profit percentage
     * @description Absolute floor for adjusted percentage
     */
    minPercentage: number;

    /**
     * Enable dynamic profit adjustment
     * @default true
     */
    enabled: boolean;
}

/**
 * Strategy performance data interface
 */
interface IStrategyPerformance {
    /**
     * Historical win rate (0-1)
     */
    winRate: number;

    /**
     * Recent profitability score
     * @description Normalized measure of recent performance (0-2 where 1 = neutral)
     */
    recentProfit: number;

    /**
     * Total trades using this strategy
     */
    totalTrades: number;
}


/**
 * Market conditions interface
 */
interface MarketConditions {
    /**
     * Current volatility index (0-1)
     */
    volatility: number;

    /**
     * Market trend direction
     */
    trend: 'up' | 'down' | 'neutral';

    /**
     * Additional market indicators
     */
    indicators?: {
        rsi?: number;
        volume?: number;
        sentiment?: number;
    };
}


/**
 * Class managing risk for volatility indices trading
 */
export class VolatilityRiskManager {
    // Reward structures for different purchase types
    private static rewardStructures: StrategyRewards;

    // Basic trade parameters
    private baseStake: number;               // Default stake amount
    private market: string;                  // Market identifier
    private currency: string;                // Currency used
    private contractType: ContractType;      // Default contract type
    private contractDurationValue: number;   // Contract duration value
    private contractDurationUnits: string;   // Contract duration units

    // Trade state tracking
    private resultIsWin: boolean = false;    // Last trade result
    private consecutiveLosses: number = 0;   // Current consecutive losses
    private totalLossAmount: number = 0;     // Total amount to recover
    private winningTrades: number = 0;       // Count of winning trades
    private losingTrades: number = 0;        // Count of losing trades
    private totalTrades: number = 0;         // Total trades executed

    private recoveryAttempts: number = 0;
    private lastTradeTimestamp: number = 0;
    private inSafetyMode: boolean = false;
    private safetyModeUntil: number = 0;

    // Recovery strategy management
    private currentStrategyIndex: number = 0;        // Index of current strategy
    private currentRecoveryStep: number = 0;         // Current step in strategy
    private recoveryStrategies: RecoveryStrategy[];   // Available strategies
    private activeStrategy: RecoveryStrategy | null;  // Currently active strategy

    private lastLossTimestamps: number[] = [];

    private historicalPerformance: {
        strategyName: string;
        winRate: number;
        avgProfit: number;
    }[] = [];


    private circuitBreakers = {
        totalLoss: 0,
        dailyLoss: 0,
        weeklyLoss: 0
    };


    private metrics: IPerformanceMetrics;

    private maxHistoryItems = 1000;

    private metricsRetentionDays = 7;

    private strategyCache = new Map<string, RecoveryStrategy>();

    private strategyPerformanceData: Map<string, IStrategyPerformance> = new Map();

    private defaultFallbackStrategy: string;
    private balanceValidationConfig: IBalanceValidationConfig;
    private profitAdjustmentConfig: IProfitAdjustmentConfig;
    private circuitBreakerState: ICircuitBreakerState;
    private circuitBreakerConfig: ICircuitBreakerConfig;
    private rapidLossConfig: IRapidLossConfig;
    private rapidLossState: IRapidLossState;

    /**
     * Constructor for VolatilityRiskManager
     * @param baseStake - Default stake amount
     * @param market - Market identifier
     * @param currency - Currency used
     * @param contractType - Default contract type
     * @param contractDurationValue - Contract duration value
     * @param contractDurationUnits - Contract duration units
     * @param recoveryStrategies - Array of recovery strategies
     */
    constructor(
        baseStake: number,
        market: string,
        currency: string,
        contractType: ContractType,
        contractDurationValue: number,
        contractDurationUnits: string,
        recoveryStrategies: RecoveryStrategy[],
        circuitBreakerConfigOverrides?: Partial<ICircuitBreakerConfig>,
        rapidLossConfigOverrides?: Partial<IRapidLossConfig>,
        balanceValidationConfigOverrides?: Partial<IBalanceValidationConfig>,
        profitAdjustmentConfigOverrides?: Partial<IProfitAdjustmentConfig>
    ) {

        if (baseStake <= 0) throw new Error("Base stake must be positive");
        if (!market) throw new Error("Market must be specified");
        if (!currency) throw new Error("Currency must be specified");
        if (!Object.values(ContractTypeEnum).includes(contractType)) {
            throw new Error("Invalid purchase type");
        }

        // Initialize basic parameters
        this.baseStake = baseStake;
        this.market = market;
        this.currency = currency;
        this.contractType = contractType;
        this.contractDurationValue = contractDurationValue;
        this.contractDurationUnits = contractDurationUnits;

        // Set up recovery strategies
        this.recoveryStrategies = recoveryStrategies.length > 0 ? recoveryStrategies : this.initializeDefaultStrategies();
        this.activeStrategy = this.recoveryStrategies[0];


        this.circuitBreakers = {
            totalLoss: this.baseStake * 20,
            dailyLoss: this.baseStake * 100,
            weeklyLoss: this.baseStake * 500
        };

        this.metrics = this.initializeMetrics();

        // Initialize default fallback strategy (first strategy or 'SafeRecovery')
        this.defaultFallbackStrategy = recoveryStrategies.length > 0
            ? recoveryStrategies[0].strategyName
            : 'SafeRecovery';

        // Initialize balance validation config with potential overrides
        this.balanceValidationConfig = this.initializeBalanceValidationConfig(balanceValidationConfigOverrides);

        // Initialize profit adjustment config with potential overrides
        this.profitAdjustmentConfig = this.initializeProfitAdjustmentConfig(profitAdjustmentConfigOverrides);

        // Initialize circuit breaker config with potential overrides
        this.circuitBreakerConfig = this.initializeCircuitBreakerConfig(circuitBreakerConfigOverrides);

        // Initialize rapid loss config with potential overrides
        this.rapidLossConfig = this.initializeRapidLossConfig(rapidLossConfigOverrides);

        // Initialize state objects
        this.circuitBreakerState = this.initializeCircuitBreakerState();
        this.rapidLossState = this.initializeRapidLossState();

    }

    /**
   * Initializes reward structures with validation
   */
    private initializeRewardStructures(): StrategyRewards {
        const structures: StrategyRewards = {
            DIGITDIFF: [
                { minStake: 0.35, maxStake: 0.49, rewardPercentage: 5.71 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 6.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 8.00 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 9.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 9.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 9.67 },
                { minStake: 5.00, maxStake: Infinity, rewardPercentage: 9.67 }
            ],
            EVEN: [
                { minStake: 0.35, maxStake: 0.49, rewardPercentage: 88.57 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 92.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 94.67 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 95.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 95.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 95.33 },
                { minStake: 5.00, maxStake: Infinity, rewardPercentage: 95.40 }
            ],
            ODD: [
                { minStake: 0.35, maxStake: 0.49, rewardPercentage: 88.57 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 92.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 94.67 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 95.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 95.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 95.33 },
                { minStake: 5.00, maxStake: Infinity, rewardPercentage: 95.40 }
            ],
            CALL: [
                { minStake: 0.35, maxStake: 0.49, rewardPercentage: 77.14 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 78.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 78.67 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 79.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 79.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 79.33 },
                { minStake: 5.00, maxStake: Infinity, rewardPercentage: 79.40 }
            ],
            PUT: [
                { minStake: 0.35, maxStake: 0.49, rewardPercentage: 77.14 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 78.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 78.67 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 79.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 79.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 79.33 },
                { minStake: 5.00, maxStake: Infinity, rewardPercentage: 79.40 }
            ],
            DIGITUNDER: [
                { minStake: 0.35, maxStake: 0.49, rewardPercentage: 5.71 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 6.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 8.00 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 9.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 9.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 9.67 },
                { minStake: 5.00, maxStake: Infinity, rewardPercentage: 9.67 }
            ],
            DIGITOVER: [
                { minStake: 0.35, maxStake: 0.49, rewardPercentage: 5.71 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 6.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 8.00 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 9.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 9.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 9.67 },
                { minStake: 5.00, maxStake: Infinity, rewardPercentage: 9.67 }
            ]
        };


        // Validate all reward structures
        for (const [type, tiers] of Object.entries(structures)) {
            if (!tiers || tiers.length === 0) {
                throw new Error(`Invalid reward structure for ${type}`);
            }

            // Check for coverage from 0 to Infinity
            if (tiers[0].minStake !== 0 || tiers[tiers.length - 1].maxStake !== Infinity) {
                throw new Error(`Reward structure for ${type} must cover full stake range`);
            }
        }

        return structures;
    }

    // Helper methods for initialization
    private initializeCircuitBreakerState(): ICircuitBreakerState {
        return {
            lastTriggered: null,
            lastReason: null,
            dailyLoss: 0,
            lastDailyReset: Date.now(),
            recentLossTimestamps: []
        };
    }

    private initializeRapidLossState(): IRapidLossState {
        return {
            recentLossTimestamps: [],
            recentLossAmounts: [],
            lastDetectedTime: null,
            eventCount: 0
        };
    }

    private initializeMetrics(): IPerformanceMetrics {
        return {
            recoverySuccessRate: 0,
            avgRecoveryTime: 0,
            strategyEffectiveness: new Map<string, number>(),
            tradeHistory: [],
            streaks: {
                currentWin: 0,
                currentLoss: 0,
                maxWin: 0,
                maxLoss: 0
            },
            timeMetrics: {
                hourly: { wins: 0, losses: 0, profit: 0 },
                daily: { wins: 0, losses: 0, profit: 0 }
            },
            calculated: {}
        };
    }


    /**
     * Gets the current state of the risk manager with additional safety checks
     * @returns Readonly object containing current trade parameters and state
     */
    public getCurrentState(): Readonly<{
        basis: BasisType;
        symbol: string;
        amount: number;
        barrier: number | null;
        currency: string;
        contractType: ContractType;
        contractDurationValue: number;
        contractDurationUnits: string;
        previousResultStatus: boolean;
        consecutiveLosses: number;
        totalAmountToRecover: number;
        winningTrades: number;
        losingTrades: number;
        inSafetyMode: boolean;
        recoveryAttempts: number;
    }> {
        return Object.freeze({
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
        });
    }


    /**
   * Processes trade result with enhanced validation and safety checks
   * @param previousTradeResultData - Validated trade result data
   * @returns Parameters for next trade or safety exit if conditions are met
   */
    public processTradeResult(
        previousTradeResultData: IPreviousTradeResult
    ): Readonly<NextTradeParams> {
        if (!this.validateTradeResult(previousTradeResultData)) {
            logger.warn("Invalid trade result received");
            return this.getSafetyExitResult("invalid_trade_data");
        }

        this.totalTrades++;
        this.resultIsWin = previousTradeResultData.resultIsWin;
        this.lastTradeTimestamp = Date.now();

        try {
            this.updatePreviousTradeResult(previousTradeResultData);

            // Check if we should enter safety mode
            if (this.shouldEnterSafetyMode(previousTradeResultData)) {
                return this.enterSafetyMode("excessive_losses");
            }

            if (this.resultIsWin) {
                return this.handleWin();
            } else {
                return this.handleLoss();
            }
        } catch (error) {
            logger.error(error, "Error processing trade result");
            return this.enterSafetyMode("processing_error");
        }
    }

    /**
     * Handles a winning trade scenario
     * @returns Parameters for the next trade
     */
    private handleWin(): NextTradeParams {
        // Reset consecutive losses counter
        this.consecutiveLosses = 0;
        // Increment winning trades count
        this.winningTrades++;
        this.recoveryAttempts = 0;

        // Check if we were in recovery mode
        if (this.totalLossAmount > 0) {
            // Calculate how much was recovered in this trade
            const recoveredAmount = this.calculateRecoveredAmount();
            // Deduct recovered amount from total loss
            this.totalLossAmount = Math.max(0, this.totalLossAmount - recoveredAmount);

            // If fully recovered, reset recovery state
            if (this.totalLossAmount === 0) {
                logger.info("Full recovery achieved");
                this.resetRecoveryState();
            } else {
                logger.info(`Partial recovery: ${recoveredAmount} recovered, ${this.totalLossAmount} remaining`);
            }
        } else {
            // Normal win, reset recovery state
            // this.resetRecoveryState();
        }

        // Get parameters for next trade
        return this.getNextTradeParams();
    }

    /**
     * Handles a losing trade scenario
     * @returns Parameters for the next trade
     */
    private handleLoss(): NextTradeParams {
        // Increment consecutive losses counter
        this.consecutiveLosses++;
        // Increment losing trades count
        this.losingTrades++;
        this.recoveryAttempts++;

        // Calculate total loss including this trade
        const lossAmount = this.calculateLossAmount();
        // Add to total loss amount
        this.totalLossAmount += lossAmount;

        logger.warn(`Loss recorded. Total loss: ${this.totalLossAmount}, Consecutive: ${this.consecutiveLosses}`);

        // Check for strategy switch or safety mode
        if (this.activeStrategy) {
            if (this.consecutiveLosses >= this.activeStrategy.maxConsecutiveLosses) {
                if (this.currentStrategyIndex < this.recoveryStrategies.length - 1) {
                    logger.info("Switching to next recovery strategy");
                    this.nextRecoveryStrategy();
                } else if (this.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
                    return this.enterSafetyMode("max_recovery_attempts");
                }
            }

            // Check if we're exceeding account balance safety limits
            const nextStake = this.calculateNextStake();
            if (nextStake > this.baseStake * MAX_STAKE_MULTIPLIER) {
                return this.enterSafetyMode("stake_limit_exceeded");
            }
        }

        return this.getNextTradeParams();
    }

    /**
     * Calculates the amount recovered in a winning trade
     * @returns The recovered amount including original loss and profits
     */
    private calculateRecoveredAmount(): number {
        // If no active strategy, return 0
        if (!this.activeStrategy) return 0;

        // Get current step in recovery strategy
        const currentStep = this.activeStrategy.strategySteps[this.currentRecoveryStep];
        // Get stake amount for this step
        const stake = this.getStepAmount(currentStep, this.totalLossAmount);

        // Get profit percentage from strategy
        const profitPercentage = this.activeStrategy.profitPercentage;
        // Calculate total recovered amount (stake + profit)
        const recoveryAmount = stake * (1 + profitPercentage / 100);

        return recoveryAmount;
    }

    /**
     * Calculates the total loss amount including anticipated profits
     * @returns The total loss amount
     */
    private calculateLossAmount(): number {
        // If no active strategy, return base stake as loss
        if (!this.activeStrategy) return this.baseStake;

        // Get current step in recovery strategy
        const currentStep = this.activeStrategy.strategySteps[this.currentRecoveryStep];
        // Get stake amount for this step
        const stake = this.getStepAmount(currentStep, this.totalLossAmount);

        // Calculate anticipated profit that would have been earned
        const anticipatedProfit = stake * (this.activeStrategy.anticipatedProfitPercentage / 100);

        // Return total loss (stake + anticipated profit)
        return stake + anticipatedProfit;
    }

    public getStepAmount(step: RecoveryStep, totalLoss: number): number {
        if (typeof step.amount === 'function') {
            return step.amount(totalLoss);
        }
        return step.amount;
    }

    /**
     * Gets parameters for the next trade
     * @returns Parameters for the next trade
     */
    public getNextTradeParams(): NextTradeParams {
        // If no active strategy, return base trade parameters
        if (!this.activeStrategy) {
            return this.getBaseTradeParams();
        }

        // If in recovery mode (losses to recover or consecutive losses)
        if (this.totalLossAmount > 0 || this.consecutiveLosses > 0) {
            // Move to next step in strategy (without exceeding max steps)
            this.currentRecoveryStep = Math.min(
                this.currentRecoveryStep + 1,
                this.activeStrategy.strategySteps.length - 1
            );

            // Get the current step parameters
            const step = this.activeStrategy.strategySteps[this.currentRecoveryStep];

            // Return trade parameters with values from strategy or defaults
            return {
                basis: BasisTypeEnum.Default,
                symbol: step.symbol || this.market,
                amount: this.getStepAmount(step, this.totalLossAmount),
                barrier: step.contractBarrier || this.getBarrier(this.contractType),
                currency: this.currency,
                contractType: step.contractType || this.contractType,
                contractDurationValue: step.contractDurationValue || this.contractDurationValue,
                contractDurationUnits: step.contractDurationUnits || this.contractDurationUnits,
                previousResultStatus: this.resultIsWin,
                consecutiveLosses: this.consecutiveLosses,
                totalAmountToRecover: this.totalLossAmount,
                winningTrades: this.winningTrades,
                losingTrades: this.losingTrades
            };
        }

        // Default to base trade parameters if not in recovery
        return this.getBaseTradeParams();
    }

    getBarrier(contractType: ContractType): number | string {

        switch (contractType) {

            case ContractTypeEnum.Call:
            case ContractTypeEnum.Put:
                return "";

            case ContractTypeEnum.DigitEven:
                return "EVEN";

            case ContractTypeEnum.DigitOdd:
                return "ODD";

            case ContractTypeEnum.DigitDiff:
                return getRandomDigit();

            case ContractTypeEnum.DigitOver:
                return 1;

            case ContractTypeEnum.DigitOver0:
                return 0;

            case ContractTypeEnum.DigitOver1:
                return 1;

            case ContractTypeEnum.DigitOver2:
                return 2;

            case ContractTypeEnum.DigitOver3:
                return 3;

            case ContractTypeEnum.DigitOver4:
                return 4;

            case ContractTypeEnum.DigitOver5:
                return 5;

            case ContractTypeEnum.DigitOver6:
                return 6;

            case ContractTypeEnum.DigitOver7:
                return 7;

            case ContractTypeEnum.DigitOver8:
                return 8;

            case ContractTypeEnum.DigitUnder1:
                return 1;

            case ContractTypeEnum.DigitUnder2:
                return 2;

            case ContractTypeEnum.DigitUnder3:
                return 3;

            case ContractTypeEnum.DigitUnder4:
                return 4;

            case ContractTypeEnum.DigitUnder5:
                return 5;

            case ContractTypeEnum.DigitUnder6:
                return 6;

            case ContractTypeEnum.DigitUnder7:
                return 7;

            case ContractTypeEnum.DigitUnder8:
                return 8;

            case ContractTypeEnum.DigitUnder9:
                return 9;

            // ... other derivative contract types

            default:
                throw new Error(`Unsupported purchase type for derivatives: ${contractType}`);
        }

    }

    /**
     * Gets base trade parameters (non-recovery mode)
     * @returns Base trade parameters
     */
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

    /**
   * Enters safety mode with cooldown period
   */
    public enterSafetyMode(reason: string): Readonly<NextTradeParams> {
        this.inSafetyMode = true;
        this.safetyModeUntil = Date.now() + SAFETY_COOLDOWN_MS;
        logger.warn(`Entering safety mode due to: ${reason}`);
        return this.getSafetyExitResult(reason);
    }

    /**
     * Gets safety exit parameters when an error occurs
     * Enhanced safety exit with cooldown tracking
     * @returns Safe trade parameters minimizing risk
     */
    private getSafetyExitResult(reason?: string): Readonly<NextTradeParams> {
        const cooldownRemaining = this.safetyModeUntil > Date.now()
            ? this.safetyModeUntil - Date.now()
            : 0;

        return Object.freeze({
            ...this.getBaseTradeParams(),
            amount: this.baseStake,
            barrier: null,
            recoveryAttempt: this.recoveryAttempts,
            metadata: {
                safetyMode: true,
                reason,
                cooldownRemaining
            }
        });
    }

    /**
   * Checks if safety mode should be entered based on multiple factors
   */
    private shouldEnterSafetyMode(tradeData: IPreviousTradeResult): boolean {
        // Check if we're already in safety mode
        if (this.inSafetyMode && this.safetyModeUntil > Date.now()) {
            return true;
        }

        // Check consecutive losses
        if (this.consecutiveLosses >= (this.activeStrategy?.maxConsecutiveLosses || 5) * 2) {
            return true;
        }

        // Check recovery attempts
        if (this.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
            return true;
        }

        // Check account balance
        if (tradeData.userAccount.balance < this.baseStake * 3) {
            return true;
        }

        // Check if total losses exceed safe threshold
        if (this.totalLossAmount > this.baseStake * 10) {
            return true;
        }

        return false;
    }

    /**
 * Retrieves a recovery strategy by name with enhanced validation and fallback logic
 * @param {string} name - Name of the strategy to retrieve
 * @param {object} [options] - Additional options
 * @param {boolean} [options.throwOnNotFound=true] - Whether to throw if strategy not found
 * @param {boolean} [options.validate=true] - Whether to validate strategy before returning
 * @param {string} [options.fallbackStrategy] - Fallback strategy name if primary not found
 * @returns {RecoveryStrategy | undefined} The requested strategy or fallback if configured
 * 
 * @description
 * This enhanced version provides:
 * 1. Robust strategy lookup with multiple fallback options
 * 2. Strategy validation before returning
 * 3. Configurable error handling
 * 4. Detailed logging
 * 5. Performance optimization through caching
 * 
 * Throws an error if:
 * - Strategy not found and throwOnNotFound=true
 * - Strategy is invalid and validate=true
 */
    public getRecoveryStrategy(
        name: string,
        options: {
            throwOnNotFound?: boolean;
            validate?: boolean;
            fallbackStrategy?: string;
        } = {}
    ): RecoveryStrategy | undefined {
        const {
            throwOnNotFound = true,
            validate = true,
            fallbackStrategy
        } = options;

        // Check cache first
        if (this.strategyCache.has(name)) {
            const cached = this.strategyCache.get(name);
            if (!validate || this.validateRecoveryStrategy(cached)) {
                return cached;
            }
        }

        // Find strategy in available strategies
        let strategy = this.recoveryStrategies.find(s => s.strategyName === name);

        // If not found, attempt fallback in this order:
        // 1. Specified fallbackStrategy parameter
        // 2. Default fallback strategy
        // 3. First available strategy
        if (!strategy) {

            const fallbackOptions: string[] = [];

            if (fallbackStrategy) {
                fallbackOptions.push(`specified fallback (${fallbackStrategy})`);
                strategy = this.recoveryStrategies.find(s => s.strategyName === fallbackStrategy);
            }

            if (!strategy && this.defaultFallbackStrategy) {
                fallbackOptions.push(`default fallback (${this.defaultFallbackStrategy})`);
                strategy = this.recoveryStrategies.find(s => s.strategyName === this.defaultFallbackStrategy);
            }

            if (!strategy && this.recoveryStrategies.length > 0) {
                fallbackOptions.push(`first available strategy (${this.recoveryStrategies[0].strategyName})`);
                strategy = this.recoveryStrategies[0];
            }

            if (strategy) {
                logger.warn(`Strategy "${name}" not found, using ${fallbackOptions.join(' -> ')}`);
            }
        }

        // Throw if still not found and configured to do so
        if (!strategy && throwOnNotFound) {
            const error = new Error(`Recovery strategy "${name}" not found and no valid fallback available`);
            logger.error(error.message, { availableStrategies: this.getStrategyNames() });
            throw error;
        }

        // Validate strategy if found and validation enabled
        if (strategy && validate && !this.validateRecoveryStrategy(strategy)) {
            const error = new Error(`Recovery strategy "${name}" failed validation`);
            logger.error(error.message, { strategy });

            if (throwOnNotFound) {
                throw error;
            }
            return undefined;
        }

        // Cache valid strategy
        if (strategy) {
            this.strategyCache.set(name, strategy);
        }

        return strategy;
    }

    /**
     * Validates a recovery strategy's structure and parameters
     * @private
     * @param {RecoveryStrategy} strategy - Strategy to validate
     * @returns {boolean} True if strategy is valid
     * 
     * @description
     * Performs comprehensive validation including:
     * 1. Basic structure validation
     * 2. Parameter range checking
     * 3. Sequence step validation
     * 4. Risk parameter consistency
     */
    private validateRecoveryStrategy(strategy: RecoveryStrategy | undefined): boolean {
        if (!strategy) return false;

        const errors: string[] = [];

        // Validate basic structure
        if (!strategy.strategyName?.trim() || typeof strategy.strategyName !== 'string') {
            errors.push('Missing or invalid strategyName');
        }

        if (!Array.isArray(strategy.strategySteps) || strategy.strategySteps.length === 0) {
            errors.push('strategySteps must be a non-empty array');
        } else {

            // Validate each step in the strategy

            strategy.strategySteps.forEach((step, i) => {
                if (typeof step.amount !== 'number' && typeof step.amount !== 'function') {
                    errors.push(`Step ${i} amount must be number or function`);
                }
                if (typeof step.amount !== 'number' || step.amount <= 0) {
                    errors.push(`Step ${i + 1} has invalid amount: ${step.amount}`);
                }
                if (!step.symbol?.trim()) {
                    errors.push(`Step ${i} symbol is required`);
                }
                if (!Object.values(ContractTypeEnum).includes(step.contractType)) {
                    errors.push(`Step ${i} has invalid contractType`);
                }
                if (!step.contractType || !Object.values(ContractTypeEnum).includes(step.contractType)) {
                    errors.push(`Step ${i + 1} has invalid contractType: ${step.contractType}`);
                }

                if (typeof step.contractDurationValue !== 'number' || step.contractDurationValue <= 0) {
                    errors.push(`Step ${i + 1} has invalid durationValue: ${step.contractDurationValue}`);
                }
            });
        }

        // Validate numerical parameters
        const validateRange = (value: number, min: number, max: number, name: string) => {
            if (typeof value !== 'number' || value < min || value > max) {
                errors.push(`${name} must be between ${min} and ${max}, got ${value}`);
            }
        };

        validateRange(strategy.profitPercentage, 1, 1000, 'profitPercentage');
        validateRange(strategy.lossRecoveryPercentage, 50, 200, 'lossRecoveryPercentage');
        validateRange(strategy.maxConsecutiveLosses, 1, 20, 'maxConsecutiveLosses');
        validateRange(strategy.maxRiskExposure, 1, 50, 'maxRiskExposure');

        // Check risk exposure consistency
        const maxStepAmount = Math.max(...strategy.strategySteps.map(step => this.getStepAmount(step, this.totalLossAmount)));
        const maxAllowed = this.baseStake * strategy.maxRiskExposure;

        if (maxStepAmount > maxAllowed) {
            errors.push(
                `Max step amount ${maxStepAmount} exceeds maxRiskExposure ` +
                `of ${strategy.maxRiskExposure}x base stake (${maxAllowed})`
            );
        }

        // Validate adaptive strategies
        if ('historicalWinRate' in strategy) {
            const adaptive = strategy as AdaptiveRecoveryStrategy;
            if (adaptive.historicalWinRate !== undefined &&
                (adaptive.historicalWinRate < 0 || adaptive.historicalWinRate > 1)) {
                errors.push('historicalWinRate must be between 0 and 1');
            }
        }

        // Log validation errors if any
        if (errors.length > 0) {
            logger.warn('Strategy validation failed', {
                strategy: strategy.strategyName,
                errors
            });
            return false;
        }

        return true;

    }

    /**
     * Gets names of all available strategies
     * @returns {string[]} Array of strategy names
     */
    public getStrategyNames(): string[] {
        return this.recoveryStrategies.map(s => s.strategyName);
    }

    /**
     * Initializes strategy cache
     * @private
     * @returns {Map<string, RecoveryStrategy>}
     */
    private initializeStrategyCache(): Map<string, RecoveryStrategy> {
        const cache = new Map<string, RecoveryStrategy>();

        // Pre-cache validated strategies
        this.recoveryStrategies.forEach(strategy => {
            if (this.validateRecoveryStrategy(strategy)) {
                cache.set(strategy.strategyName, strategy);
            }
        });

        return cache;
    }

    /***
     * 
     * 
     * USAGE EXAMPLE
     * 
     * 
     * // Initialize with multiple strategies
        const riskManager = new VolatilityRiskManager(
            10, // baseStake
            "1HZ100V", // market
            "USD", // currency
            ContractType.ODD, // contractType
            5, // contractDurationValue
            "t", // contractDurationUnits
            [
                {
                    strategyName: "AggressiveRecovery",
                    strategySteps: [
                        { amount: 20, contractType: ContractType.ODD, contractDurationValue: 5 },
                        { amount: 40, contractType: ContractType.ODD, contractDurationValue: 5 }
                    ],
                    profitPercentage: 90,
                    lossRecoveryPercentage: 110,
                    maxConsecutiveLosses: 4,
                    maxRiskExposure: 10
                },
                {
                    strategyName: "SafeRecovery",
                    strategySteps: [
                        { amount: 15, contractType: ContractType.ODD, contractDurationValue: 5 }
                    ],
                    profitPercentage: 60,
                    lossRecoveryPercentage: 80,
                    maxConsecutiveLosses: 2,
                    maxRiskExposure: 5
                }
            ]
        );

        // 1. Basic successful lookup
        const aggressive = riskManager.getRecoveryStrategy("AggressiveRecovery");
        console.log(aggressive?.strategyName); // "AggressiveRecovery"

        // 2. Failed lookup with fallback
        const safe = riskManager.getRecoveryStrategy("Nonexistent", {
            fallbackStrategy: "SafeRecovery"
        });
        console.log(safe?.strategyName); // "SafeRecovery"

        // 3. Failed lookup with error
        try {
            riskManager.getRecoveryStrategy("Nonexistent", {
                throwOnNotFound: true
            });
        } catch (e) {
            console.error(e.message); // "Recovery strategy "Nonexistent" not found..."
        }

        // 4. Invalid strategy detection
        const invalidStrategy = {
            strategyName: "Invalid",
            strategySteps: [
                { amount: -10, contractType: "INVALID", contractDurationValue: 0 }
            ],
            // Missing required parameters
        };
        riskManager.recoveryStrategies.push(invalidStrategy);

        const result = riskManager.getRecoveryStrategy("Invalid", {
            validate: true,
            throwOnNotFound: false
        });
        console.log(result); // undefined (due to validation failure)

        // 5. Get all strategy names
        console.log(riskManager.getStrategyNames()); 
        // ["AggressiveRecovery", "SafeRecovery", "Invalid"]
     * 
     */

    /**
     * Updates or adds a recovery strategy
     * @param strategy - The strategy to update or add
     */
    public updateRecoveryStrategy(strategy: RecoveryStrategy): void {
        // Find index of existing strategy with same name
        const index = this.recoveryStrategies.findIndex(s => s.strategyName === strategy.strategyName);
        if (index >= 0) {
            // Update existing strategy
            this.recoveryStrategies[index] = strategy;
        } else {
            // Add new strategy
            this.recoveryStrategies.push(strategy);
        }
    }

    /**
     * Moves to the next recovery strategy in the list
     */
    public nextRecoveryStrategy(): void {
        // Cycle to next strategy (wrapping around if necessary)
        this.currentStrategyIndex = (this.currentStrategyIndex + 1) % this.recoveryStrategies.length;
        // Set active strategy
        this.activeStrategy = this.recoveryStrategies[this.currentStrategyIndex];
        // Reset to first step in new strategy
        this.currentRecoveryStep = 0;
    }

    /**
     * Calculates delay before next trade based on current strategy
     * @returns Delay in milliseconds
     */
    public calculateNextTradeDelay(): number {
        // If no active strategy, return 0 delay
        if (!this.activeStrategy) return 0;

        // Get delay from current step (default to 0 if not specified)
        const step = this.activeStrategy.strategySteps[this.currentRecoveryStep];
        return step.delay || 0;
    }

    /**
     * Calculates the required stake for recovery
     * @returns The calculated stake amount
     */
    public calculateRequiredStake(): number {
        // If no active strategy or no losses, return base stake
        if (!this.activeStrategy || this.totalLossAmount <= 0) {
            return this.baseStake;
        }

        // Get recovery parameters from strategy
        const recoveryPercentage = this.activeStrategy.lossRecoveryPercentage;
        const profitPercentage = this.activeStrategy.profitPercentage;

        // Calculate total amount needed to recover (losses + recovery percentage + profit)
        const totalToRecover = this.totalLossAmount * (1 + recoveryPercentage / 100);
        // Calculate required stake to achieve this recovery
        const requiredStake = totalToRecover / (1 + profitPercentage / 100);

        // Return stake adjusted for risk limits
        return this.calculateRiskAdjustedStake(requiredStake);
    }



    /**
 * Validates account balance against proposed trade
 * @param {number} proposedStake - Amount to be staked
 * @param {IUserAccount} account - User account information
 * @returns {ValidationResult} Validation result object
 * 
 * @description
 * Performs multiple layers of balance validation:
 * 1. Absolute minimum balance check
 * 2. Stake-to-balance ratio validation
 * 3. Risk percentage validation
 * 4. Safety buffer verification
 * 
 * Returns detailed result object with:
 * - Validation status
 * - Failure reasons (if any)
 * - Metrics about the validation
 */
    public validateAccountBalance(
        proposedStake: number,
        account: IDerivUserAccount
    ): ValidationResult {
        // Initialize default result object
        const result: ValidationResult = {
            isValid: true,
            reasons: [],
            metrics: {
                balance: account.balance,
                proposedStake,
                riskPercentage: proposedStake / account.balance,
                requiredMinimum: 0,
                availableAfterTrade: 0
            }
        };

        // Early exit if validation disabled
        if (!this.balanceValidationConfig.enabled) {
            result.metrics.bypassed = true;
            return result;
        }

        // Calculate all minimum requirements
        const stakeBasedMin = proposedStake * this.balanceValidationConfig.minBalanceMultiplier;
        const absoluteMin = this.balanceValidationConfig.minAbsoluteBalance;
        const riskBasedMax = account.balance * this.balanceValidationConfig.maxRiskPercentage;
        const withSafetyBuffer = 1 + this.balanceValidationConfig.safetyBuffer;

        // Determine the most restrictive minimum requirement
        const requiredMinimum = Math.max(
            stakeBasedMin,
            absoluteMin
        ) * withSafetyBuffer;

        // Calculate available balance after trade
        const availableAfterTrade = account.balance - proposedStake;

        // Update metrics
        result.metrics.requiredMinimum = requiredMinimum;
        result.metrics.availableAfterTrade = availableAfterTrade;

        // Perform validations
        if (account.balance < absoluteMin) {
            result.isValid = false;
            result.reasons.push(`Balance ${account.balance} below absolute minimum ${absoluteMin}`);
        }

        if (availableAfterTrade < requiredMinimum) {
            result.isValid = false;
            result.reasons.push(
                `Post-trade balance ${availableAfterTrade} would be below required minimum ${requiredMinimum} ` +
                `(stake ${proposedStake} * ${this.balanceValidationConfig.minBalanceMultiplier} multiplier)`
            );
        }

        if (proposedStake > riskBasedMax) {
            result.isValid = false;
            result.reasons.push(
                `Stake ${proposedStake} exceeds ${this.balanceValidationConfig.maxRiskPercentage * 100}% ` +
                `of account balance (max ${riskBasedMax})`
            );
        }

        // Additional check for negative balance (should never happen)
        if (availableAfterTrade < 0) {
            result.isValid = false;
            result.reasons.push(`Trade would result in negative balance`);
        }

        return result;
    }


    /**
     * Initializes balance validation configuration
     * @param {Partial<IBalanceValidationConfig>} [overrides] 
     * @returns {IBalanceValidationConfig}
     */
    private initializeBalanceValidationConfig(
        overrides?: Partial<IBalanceValidationConfig>
    ): IBalanceValidationConfig {
        const defaults: IBalanceValidationConfig = {
            minBalanceMultiplier: 3.0,
            minAbsoluteBalance: 50,
            maxRiskPercentage: 0.02, // 2%
            enabled: true,
            safetyBuffer: 0.1 // 10%
        };

        return { ...defaults, ...overrides };
    }

    /**
     * Performs pre-trade balance validation
     * @param {number} stake 
     * @param {IUserAccount} account 
     * @returns {boolean}
     * 
     * @description
     * Simplified version that throws errors on failure
     * Wraps the detailed validateAccountBalance method
     */
    private ensureValidBalance(stake: number, account: IDerivUserAccount): boolean {
        const validation = this.validateAccountBalance(stake, account);

        if (!validation.isValid) {
            throw new Error(
                `Balance validation failed: ${validation.reasons.join('; ')}\n` +
                `Details: ${JSON.stringify(validation.metrics)}`
            );
        }

        return true;
    }

    /***
     * 
     * 
     * USAGE EXAMPLE
     * 
     * 
     * // Initialize with custom balance validation settings
        const riskManager = new VolatilityRiskManager(
            10, // baseStake
            "1HZ100V", // market
            "USD", // currency
            ContractType.ODD, // contractType
            5, // contractDurationValue
            "t", // contractDurationUnits
            [], // strategies
            {}, // circuit breaker config
            {}, // rapid loss config
            {
                minBalanceMultiplier: 2.5,
                minAbsoluteBalance: 100,
                maxRiskPercentage: 0.05 // 5%
            }
        );
        
        // Test cases
        const testAccount = { balance: 1000, currency: "USD" };
        
        // 1. Valid trade
        const validation1 = riskManager.validateAccountBalance(20, testAccount);
        console.log(validation1.isValid); // true
        console.log(validation1.metrics.riskPercentage); // 0.02 (2%)
        
        // 2. Stake too large relative to balance
        const validation2 = riskManager.validateAccountBalance(60, testAccount);
        console.log(validation2.isValid); // false
        console.log(validation2.reasons);
        // ["Stake 60 exceeds 5% of account balance (max 50)"]
        
        // 3. Would leave insufficient remaining balance
        const validation3 = riskManager.validateAccountBalance(800, testAccount);
        console.log(validation3.isValid); // false
        console.log(validation3.reasons);
        // [
        //   "Post-trade balance 200 would be below required minimum 2000",
        //   "Stake 800 exceeds 5% of account balance (max 50)"
        // ]
        
        // 4. Absolute minimum check
        const smallAccount = { balance: 30, currency: "USD" };
        const validation4 = riskManager.validateAccountBalance(10, smallAccount);
        console.log(validation4.isValid); // false
        console.log(validation4.reasons);
        // ["Balance 30 below absolute minimum 100"]
        
        // 5. Simplified version (throws on failure)
        try {
            riskManager.ensureValidBalance(900, testAccount);
            console.log("Trade allowed");
        } catch (e) {
            console.error(e.message);
            // "Balance validation failed: Post-trade balance 100 would be below required minimum 2250..."
        }
     * 
     */

    /**
 * Adjusts profit percentage based on multiple factors
 * @param {string} strategyName - Name of the strategy being adjusted
 * @param {MarketConditions} marketConditions - Current market state
 * @param {number} [currentStake] - Optional current stake amount
 * @returns {number} Adjusted profit percentage
 * 
 * @description
 * Dynamically adjusts profit targets based on:
 * 1. Strategy historical performance
 * 2. Current market conditions
 * 3. Recent trade outcomes
 * 4. Current stake size
 * 
 * Uses weighted averaging of multiple factors to determine
 * optimal profit percentage while respecting configured limits
 */
    public adjustProfitPercentage(
        strategyName: string,
        marketConditions: MarketConditions,
        currentStake?: number
    ): number {
        // Early exit if adjustment disabled
        if (!this.profitAdjustmentConfig.enabled) {
            return this.profitAdjustmentConfig.basePercentage;
        }

        // Get strategy performance data
        const strategyData = this.getStrategyPerformance(strategyName);
        const basePercentage = this.profitAdjustmentConfig.basePercentage;

        // Calculate adjustment factors (0-1 scale)
        const factors = {
            // Historical win rate factor (higher win rate -> higher percentage)
            winRate: this.calculateWinRateFactor(strategyData.winRate),

            // Recent performance factor (better performance -> higher percentage)
            recentPerformance: this.calculateRecentPerformanceFactor(strategyData.recentProfit),

            // Market volatility factor (higher volatility -> lower percentage)
            volatility: this.calculateVolatilityFactor(marketConditions.volatility),

            // Market trend factor
            trend: this.calculateTrendFactor(marketConditions.trend),

            // Stake size factor (larger stakes -> slightly lower percentage)
            stakeSize: currentStake ? this.calculateStakeSizeFactor(currentStake) : 1
        };

        // Calculate weighted adjustment
        const weights = this.profitAdjustmentConfig.weights;
        const weightedAdjustment =
            (factors.winRate * weights.winRate) +
            (factors.recentPerformance * weights.recentPerformance) +
            (factors.volatility * factors.trend * weights.marketConditions);

        // Apply base adjustment with limits
        let adjustedPercentage = basePercentage * weightedAdjustment;

        // Apply stake size modifier
        adjustedPercentage *= factors.stakeSize;

        // Enforce absolute limits
        const maxAdjustment = this.profitAdjustmentConfig.maxAdjustment;
        adjustedPercentage = Math.max(
            this.profitAdjustmentConfig.minPercentage,
            Math.min(
                basePercentage * (1 + maxAdjustment),
                adjustedPercentage
            )
        );

        // Log adjustment details for auditing
        this.logAdjustment({
            strategyName,
            basePercentage,
            adjustedPercentage,
            factors,
            marketConditions,
            currentStake
        });

        return adjustedPercentage;
    }

    /**
     * Calculates win rate adjustment factor
     * @private
     * @param {number} winRate - Strategy win rate (0-1)
     * @returns {number} Adjustment factor (0.8-1.2)
     */
    private calculateWinRateFactor(winRate: number): number {
        // Normalize to 0.8-1.2 range where 1.0 = 50% win rate
        return 0.8 + (winRate * 0.4);
    }

    /**
     * Calculates recent performance factor
     * @private
     * @param {number} recentProfit - Recent profitability score
     * @returns {number} Adjustment factor (0.9-1.1)
     */
    private calculateRecentPerformanceFactor(recentProfit: number): number {
        // Recent profit is normalized to 0-2 where 1 = neutral
        return Math.max(0.9, Math.min(1.1, recentProfit));
    }

    /**
     * Calculates volatility adjustment factor
     * @private
     * @param {number} volatility - Current volatility (0-1)
     * @returns {number} Adjustment factor (0.7-1.0)
     */
    private calculateVolatilityFactor(volatility: number): number {
        const sensitivity = this.profitAdjustmentConfig.volatilitySensitivity;
        // Higher volatility reduces profit targets
        return 1 - (volatility * sensitivity * 0.3);
    }

    /**
     * Calculates market trend factor
     * @private
     * @param {'up' | 'down' | 'neutral'} trend - Market trend
     * @returns {number} Adjustment factor
     */
    private calculateTrendFactor(trend: 'up' | 'down' | 'neutral'): number {
        return this.profitAdjustmentConfig.trendMultipliers[trend];
    }

    /**
     * Calculates stake size adjustment factor
     * @private
     * @param {number} stake - Current stake amount
     * @returns {number} Adjustment factor (0.95-1.0)
     */
    private calculateStakeSizeFactor(stake: number): number {
        // Larger stakes get slightly reduced profit targets
        const base = this.baseStake;
        if (stake <= base) return 1.0;
        if (stake >= base * 5) return 0.95;
        return 1 - ((stake - base) / (base * 5) * 0.05);
    }

    /**
     * Logs adjustment details for auditing
     * @private
     * @param {object} details - Adjustment details
     * @returns {void}
     */
    private logAdjustment(details: {
        strategyName: string;
        basePercentage: number;
        adjustedPercentage: number;
        factors: Record<string, number>;
        marketConditions: MarketConditions;
        currentStake?: number;
    }): void {
        logger.debug({
            event: 'PROFIT_PERCENTAGE_ADJUSTED',
            strategy: details.strategyName,
            base: details.basePercentage,
            adjusted: details.adjustedPercentage,
            change: ((details.adjustedPercentage / details.basePercentage) - 1) * 100,
            factors: details.factors,
            marketConditions: details.marketConditions,
            stake: details.currentStake,
            timestamp: Date.now()
        });
    }

    /**
     * Initializes profit adjustment configuration
     * @param {Partial<IProfitAdjustmentConfig>} [overrides]
     * @returns {IProfitAdjustmentConfig}
     */
    private initializeProfitAdjustmentConfig(
        overrides?: Partial<IProfitAdjustmentConfig>
    ): IProfitAdjustmentConfig {
        const defaults: IProfitAdjustmentConfig = {
            basePercentage: 80,
            maxAdjustment: 0.3,
            volatilitySensitivity: 0.5,
            trendMultipliers: {
                up: 1.1,
                down: 0.9,
                neutral: 1.0
            },
            weights: {
                winRate: 0.4,
                recentPerformance: 0.3,
                marketConditions: 0.3
            },
            minPercentage: 50,
            enabled: true
        };

        return { ...defaults, ...overrides };
    }

    /***
     * 
     * 
     * USAGE EXAMPLE
     * 
     * 
     * // Initialize with custom profit adjustment settings
        const riskManager = new VolatilityRiskManager(
            10, // baseStake
            "1HZ100V", // market
            "USD", // currency
            ContractType.ODD, // contractType
            5, // contractDurationValue
            "t", // contractDurationUnits
            [], // strategies
            {}, // circuit breaker config
            {}, // rapid loss config
            {}, // balance validation config
            {
                basePercentage: 75,
                volatilitySensitivity: 0.7,
                trendMultipliers: {
                    up: 1.15,
                    down: 0.85,
                    neutral: 1.0
                },
                minPercentage: 60
            }
        );
    
        // Mock strategy performance data
        riskManager.saveStrategyPerformance("RecoveryV1", {
            winRate: 0.65, // 65% win rate
            recentProfit: 1.2, // 20% better than neutral
            totalTrades: 42
        });
    
        // Test case 1: Favorable conditions
        const marketUp = { volatility: 0.3, trend: 'up' };
        const adjusted1 = riskManager.adjustProfitPercentage("RecoveryV1", marketUp, 15);
        console.log(adjusted1); // ~86.5 (base 75 + up trend + good performance)
    
        // Test case 2: Volatile down market
        const marketDown = { volatility: 0.8, trend: 'down' };
        const adjusted2 = riskManager.adjustProfitPercentage("RecoveryV1", marketDown, 25);
        console.log(adjusted2); // ~60 (minimum due to bad conditions + large stake)
    
        // Test case 3: Disabled adjustment
        riskManager.profitAdjustmentConfig.enabled = false;
        const adjusted3 = riskManager.adjustProfitPercentage("RecoveryV1", marketUp, 10);
        console.log(adjusted3); // 75 (base percentage)
    
     */

    private validateStrategy(strategy: RecoveryStrategy): boolean {
        if (!strategy.strategySteps.length) return false;
        if (strategy.maxRiskExposure > MAX_STAKE_MULTIPLIER) return false;
        return strategy.strategySteps.every(step =>
            step.amount !== undefined && this.getStepAmount(step, this.totalLossAmount) > 0
        );
    }

    private getFallbackStrategy(): RecoveryStrategy {
        return {
            strategyName: "SAFE_FALLBACK",
            strategySteps: [
                {
                    amount: this.baseStake,
                    symbol: this.market,
                    contractType: this.contractType,
                    contractDurationValue: this.contractDurationValue,
                    contractDurationUnits: this.contractDurationUnits
                }
            ],
            // Conservative parameters
            maxSequence: 1,
            profitPercentage: 50,
            lossRecoveryPercentage: 50,
            anticipatedProfitPercentage: 50,
            maxConsecutiveLosses: 2,
            maxRiskExposure: 3
        };
    }

    private marketConditions = {
        volatility: 0, // 0-1 scale
        trend: 'neutral' // up/down/neutral
    };

    private adjustForMarketConditions(stake: number): number {
        if (this.marketConditions.volatility > 0.7) {
            return stake * 0.8; // Reduce stake in high volatility
        }
        if (this.marketConditions.trend === 'up') {
            return stake * 1.1; // Increase slightly in upward trends
        }
        return stake;
    }

    // Add machine learning integration point
    private predictWinProbability(strategy: RecoveryStrategy): number {
        // Could integrate with ML model
        const baseProbability = 1 / strategy.strategySteps.length;
        return this.marketConditions.volatility > 0.7
            ? baseProbability * 0.8
            : baseProbability;
    }

    // Enhanced error handling
    private handleError(code: ErrorCode, message: string): void {
        logger.error({ code, message });
        this.enterSafetyMode(code);
        // throw new Error(`${code}: ${message}`);
    }


    /**
     * Checks all circuit breaker conditions
     * @param {IUserAccount} account - Current user account state
     * @returns {boolean} True if any circuit breaker should trigger
     * 
     * @description
     * Evaluates multiple risk protection layers:
     * 1. Absolute loss limits
     * 2. Time-based loss limits (daily)
     * 3. Consecutive loss patterns
     * 4. Account balance protection
     * 5. Abnormal loss frequency detection
     * 
     * Uses conservative defaults that can be overridden in constructor
     */
    public checkCircuitBreakers(account: IDerivUserAccount): boolean {
        // Initialize circuit breaker state if it doesn't exist
        if (!this.circuitBreakerState) {
            this.circuitBreakerState = {
                lastTriggered: null,
                lastReason: null,
                dailyLoss: 0,
                lastDailyReset: Date.now(),
                recentLossTimestamps: []
            };
        }

        // Check if we're still in cooldown from previous trigger
        if (this.circuitBreakerState.lastTriggered &&
            Date.now() - this.circuitBreakerState.lastTriggered < this.circuitBreakerConfig.cooldownPeriod) {
            return true;
        }

        // Reset daily loss counter if needed
        this.resetDailyLossCounterIfNewDay();

        // Check absolute loss limit
        if (this.totalLossAmount >= this.circuitBreakerConfig.maxAbsoluteLoss) {
            this.triggerCircuitBreaker('absolute_loss_limit');
            return true;
        }

        // Check daily loss limit
        if (this.circuitBreakerState.dailyLoss >= this.circuitBreakerConfig.maxDailyLoss) {
            this.triggerCircuitBreaker('daily_loss_limit');
            return true;
        }

        // Check account balance protection
        const balancePercentageLoss = this.totalLossAmount / account.balance;
        if (balancePercentageLoss >= this.circuitBreakerConfig.maxBalancePercentageLoss) {
            this.triggerCircuitBreaker('balance_protection');
            return true;
        }

        // Check consecutive losses
        if (this.consecutiveLosses >= this.circuitBreakerConfig.maxConsecutiveLosses) {
            this.triggerCircuitBreaker('consecutive_losses');
            return true;
        }

        // Check for rapid losses (abnormal frequency)
        if (this.checkRapidLosses()) {
            this.triggerCircuitBreaker('rapid_losses');
            return true;
        }

        return false;
    }

    /**
     * Records a loss for circuit breaker tracking
     * @param {number} amount - Loss amount to record
     * @returns {void}
     * 
     * @description
     * Updates all loss tracking systems:
     * - Total loss amount
     * - Daily loss accumulator
     * - Recent loss timestamps for frequency detection
     */
    public recordLoss(amount: number): void {
        if (!this.circuitBreakerState) {
            this.circuitBreakerState = this.initializeCircuitBreakerState();
        }

        // Update total loss (maintained by main class)
        this.totalLossAmount += amount;

        // Update daily loss
        this.circuitBreakerState.dailyLoss += amount;

        // Record loss timestamp for frequency detection
        const now = Date.now();
        this.circuitBreakerState.recentLossTimestamps.push(now);

        // Cleanup old timestamps (older than our detection window)
        this.circuitBreakerState.recentLossTimestamps =
            this.circuitBreakerState.recentLossTimestamps.filter(
                (timestamp: number) => now - timestamp < this.circuitBreakerConfig.rapidLossTimeWindow
            );
    }

    /**
 * Checks for rapid consecutive losses within configured time window
 * @param {number} [currentStake] - Optional current stake amount for validation
 * @returns {boolean} True if rapid losses detected and protection should trigger
 * 
 * @description
 * This detection system:
 * 1. Tracks both timing and size of losses
 * 2. Only considers losses above minimum stake threshold
 * 3. Uses sliding window algorithm for efficient tracking
 * 4. Enforces cool-down periods after detection
 * 5. Provides detailed monitoring capabilities
 * 
 * Algorithm:
 * - Maintains rolling window of recent qualifying losses
 * - Triggers when threshold met within time window
 * - Automatically purges outdated entries
 * - Enforces minimum stake requirements
 */
    public checkRapidLosses(currentStake?: number): boolean {
        // Early exit if protection disabled
        if (!this.rapidLossConfig.enabled) return false;

        // Initialize state if not exists
        if (!this.rapidLossState) {
            this.rapidLossState = {
                recentLossTimestamps: [],
                recentLossAmounts: [],
                lastDetectedTime: null,
                eventCount: 0
            };
        }

        // Check if in cool-down period
        if (this.isInRapidLossCoolDown()) {
            return true;
        }

        const now = Date.now();
        const minStake = this.baseStake * this.rapidLossConfig.minStakeMultiplier;

        // Filter only recent losses within time window
        const recentLosses = this.rapidLossState.recentLossTimestamps
            .map((ts, i) => ({ timestamp: ts, amount: this.rapidLossState.recentLossAmounts[i] }))
            .filter(loss => {
                const isRecent = now - loss.timestamp < this.rapidLossConfig.timeWindowMs;
                const isSignificant = loss.amount >= minStake;
                return isRecent && isSignificant;
            });

        // Update state with filtered losses
        this.rapidLossState.recentLossTimestamps = recentLosses.map(l => l.timestamp);
        this.rapidLossState.recentLossAmounts = recentLosses.map(l => l.amount);

        // Check if threshold reached
        if (recentLosses.length >= this.rapidLossConfig.threshold) {
            this.handleRapidLossDetection();
            return true;
        }

        return false;
    }

    /**
     * Records a loss for rapid loss detection
     * @param {number} amount - Loss amount to record
     * @returns {void}
     * 
     * @description
     * Stores loss information for frequency analysis:
     * - Timestamps for temporal pattern detection
     * - Amounts for significance validation
     * - Automatically purges stale entries
     */
    public recordRapidLoss(amount: number): void {
        if (!this.rapidLossState) {
            this.rapidLossState = this.initializeRapidLossState();
        }

        const now = Date.now();

        // Add new loss to tracking
        this.rapidLossState.recentLossTimestamps.push(now);
        this.rapidLossState.recentLossAmounts.push(amount);

        // Cleanup old entries beyond time window
        this.cleanupOldLosses();
    }

    /**
     * Checks if rapid loss cool-down period is active
     * @private
     * @returns {boolean} True if in cool-down period
     */
    private isInRapidLossCoolDown(): boolean {
        return this.rapidLossState.lastDetectedTime !== null &&
            Date.now() - this.rapidLossState.lastDetectedTime < this.rapidLossConfig.coolDownMs;
    }

    /**
     * Handles rapid loss detection event
     * @private
     * @returns {void}
     * 
     * @description
     * Actions taken on detection:
     * 1. Records detection time
     * 2. Increments event counter
     * 3. Logs detailed event information
     * 4. Triggers safety protocols
     */
    private handleRapidLossDetection(): void {
        const now = Date.now();

        this.rapidLossState = {
            ...this.rapidLossState,
            lastDetectedTime: now,
            eventCount: this.rapidLossState.eventCount + 1
        };

        // Calculate statistics about the rapid losses
        const losses = this.rapidLossState.recentLossAmounts;
        const totalLoss = losses.reduce((sum, amount) => sum + amount, 0);
        const avgLoss = totalLoss / losses.length;

        logger.warn({
            event: 'RAPID_LOSS_DETECTED',
            count: losses.length,
            timeWindow: this.rapidLossConfig.timeWindowMs,
            totalLoss,
            avgLoss,
            maxLoss: Math.max(...losses),
            timestamps: this.rapidLossState.recentLossTimestamps
        });

        // Trigger safety protocols
        this.enterSafetyMode('rapid_loss_detection');
    }

    /**
     * Cleans up old loss records beyond time window
     * @private
     * @returns {void}
     */
    private cleanupOldLosses(): void {
        const now = Date.now();
        const cutoff = now - this.rapidLossConfig.timeWindowMs;

        const validEntries = this.rapidLossState.recentLossTimestamps
            .map((ts, i) => ({ timestamp: ts, amount: this.rapidLossState.recentLossAmounts[i] }))
            .filter(entry => entry.timestamp >= cutoff);

        this.rapidLossState.recentLossTimestamps = validEntries.map((e: any) => e.timestamp);
        this.rapidLossState.recentLossAmounts = validEntries.map((e: any) => e.amount);
    }

    /**
     * Initializes rapid loss configuration with defaults
     * @param {Partial<IRapidLossConfig>} [overrides] - Configuration overrides
     * @returns {IRapidLossConfig} Complete configuration
     */
    private initializeRapidLossConfig(overrides?: Partial<IRapidLossConfig>): IRapidLossConfig {
        const defaults: IRapidLossConfig = {
            timeWindowMs: 5 * 60 * 1000,    // 5 minutes
            threshold: 3,                   // 3 losses
            minStakeMultiplier: 1.5,        // 1.5x base stake
            coolDownMs: 15 * 60 * 1000,     // 15 minutes
            enabled: true
        };

        return { ...defaults, ...overrides };
    }

    /**
     * Gets current rapid loss detection state
     * @returns {IRapidLossState} Readonly snapshot of current state
     */
    public getRapidLossState(): Readonly<IRapidLossState> {
        return Object.freeze({ ...this.rapidLossState });
    }

    /****
     * 
     * USAGE EXAMPLE
     * 
     * 
     * // Initialize with custom rapid loss settings
    const riskManager = new VolatilityRiskManager(
        10, // baseStake
        "1HZ100V", // market
        "USD", // currency
        ContractType.ODD, // contractType
        5, // contractDurationValue
        "t", // contractDurationUnits
        [], // strategies
        {}, // circuit breaker config
        {
            timeWindowMs: 180000, // 3 minute window
            threshold: 2,         // 2 losses trigger
            minStakeMultiplier: 2 // Only count losses > 2x base stake
        }
    );
    
    // Simulate normal trading
    riskManager.recordRapidLoss(15); // Below threshold (10 * 2 = 20)
    console.log(riskManager.checkRapidLosses()); // false
    
    // Simulate qualifying losses
    riskManager.recordRapidLoss(25); // Above threshold
    riskManager.recordRapidLoss(30); // Above threshold
    
    // Check rapid losses (within 3 minute window)
    console.log(riskManager.checkRapidLosses()); // true
    
    // Check state
    console.log(riskManager.getRapidLossState());
     
    {
        recentLossTimestamps: [ts1, ts2],
        recentLossAmounts: [25, 30],
        lastDetectedTime: [currentTimestamp],
        eventCount: 1
    }
     
    
    // Attempt to trade while in cool-down
    const nextTrade = riskManager.processTradeResult(tradeData);
    console.log(nextTrade.metadata.safetyMode); // true
    console.log(nextTrade.metadata.reason); // "rapid_loss_detection"
    
    // Force cool-down expiration (in real usage would wait)
    riskManager.rapidLossState.lastDetectedTime = Date.now() - 16 * 60 * 1000;
    
    // Verify cool-down expired
    console.log(riskManager.checkRapidLosses()); // false
     * 
     */

    /**
     * Resets daily loss counter if new trading day
     * @private
     * @returns {void}
     * 
     * @description
     * Uses local time to detect day change and reset:
     * - Daily loss counter
     * - Daily metrics
     */
    private resetDailyLossCounterIfNewDay(): void {
        const now = new Date();
        const lastReset = new Date(this.circuitBreakerState.lastDailyReset);

        if (now.getDate() !== lastReset.getDate() ||
            now.getMonth() !== lastReset.getMonth() ||
            now.getFullYear() !== lastReset.getFullYear()) {

            this.circuitBreakerState.dailyLoss = 0;
            this.circuitBreakerState.lastDailyReset = now.getTime();

            // Also reset daily metrics
            if (this.metrics?.timeMetrics) {
                this.metrics.timeMetrics.daily = { wins: 0, losses: 0, profit: 0 };
            }
        }
    }

    /**
     * Triggers circuit breaker protection
     * @private
     * @param {string} reason - Reason for triggering
     * @returns {void}
     * 
     * @description
     * Actions taken:
     * 1. Records trigger event
     * 2. Enters safety mode
     * 3. Logs incident
     * 4. Notifies monitoring systems
     */
    private triggerCircuitBreaker(reason: string): void {
        const now = Date.now();

        this.circuitBreakerState = {
            ...this.circuitBreakerState,
            lastTriggered: now,
            lastReason: reason
        };

        // Enter safety mode
        this.enterSafetyMode(`circuit_breaker:${reason}`);

        // Log the event with details
        logger.warn({
            event: 'CIRCUIT_BREAKER_TRIGGERED',
            reason,
            totalLoss: this.totalLossAmount,
            dailyLoss: this.circuitBreakerState.dailyLoss,
            consecutiveLosses: this.consecutiveLosses,
            recentLosses: this.circuitBreakerState.recentLossTimestamps.length
        });

        // TODO: Add external notification hook here
        // this.notifyRiskTeam(reason);
    }

    /**
     * Initializes circuit breaker configuration with defaults
     * @param {Partial<ICircuitBreakerConfig>} [overrides] - Configuration overrides
     * @returns {ICircuitBreakerConfig} Complete configuration
     * 
     * @description
     * Provides conservative default values that can be:
     * - Overridden in constructor
     * - Adjusted based on account risk profile
     * - Dynamically modified during operation
     */
    private initializeCircuitBreakerConfig(
        overrides?: Partial<ICircuitBreakerConfig>
    ): ICircuitBreakerConfig {
        const baseConfig: ICircuitBreakerConfig = {
            maxAbsoluteLoss: this.baseStake * 100,  // 100x base stake
            maxDailyLoss: this.baseStake * 20,     // 20x base stake
            maxConsecutiveLosses: 5,
            maxBalancePercentageLoss: 0.2,         // 20% of account balance
            rapidLossTimeWindow: 5 * 60 * 1000,    // 5 minute window
            rapidLossThreshold: 3,                 // 3 losses in 5 minutes
            cooldownPeriod: 30 * 60 * 1000         // 30 minute cooldown
        };

        return { ...baseConfig, ...overrides };
    }

    /***
     * 
     * USAGE EXAMPLE
     * 
     * // Initialize risk manager with custom circuit breaker settings
    const riskManager = new VolatilityRiskManager(
        10, // baseStake
        "1HZ100V", // market
        "USD", // currency
        ContractType.ODD, // contractType
        5, // contractDurationValue
        "t", // contractDurationUnits
        [], // strategies (use defaults)
        {
            // Custom circuit breaker thresholds
            maxAbsoluteLoss: 500, // $500 max loss
            maxDailyLoss: 200,    // $200 daily loss
            maxBalancePercentageLoss: 0.15 // 15% of balance
        }
    );
    
    // Simulate trading sequence
    const account = { balance: 1000, currency: "USD" };
    
    // 1. Normal trading
    riskManager.recordLoss(15); // Small loss
    console.log(riskManager.checkCircuitBreakers(account)); // false
    
    // 2. Accumulate losses
    [50, 75, 30].forEach(loss => riskManager.recordLoss(loss));
    console.log(riskManager.checkCircuitBreakers(account)); // false
    
    // 3. Trigger daily limit
    riskManager.recordLoss(100); // Total daily loss now $270
    console.log(riskManager.checkCircuitBreakers(account)); // true (exceeded $200 daily limit)
    
    // Check breaker state
    console.log(riskManager.getCircuitBreakerState());
     
    {
        lastTriggered: [timestamp],
        lastReason: "daily_loss_limit",
        dailyLoss: 270,
        recentLossTimestamps: [array of 5 timestamps]
    }
     
    
    // 4. Try to process trade while in safety mode
    const nextTrade = riskManager.processTradeResult({
        ...tradeData,
        strategyParams: { ...tradeData.strategyParams, totalLost: 270 }
    });
    console.log(nextTrade.metadata.safetyMode); // true
    console.log(nextTrade.metadata.reason); // "circuit_breaker:daily_loss_limit"
    
    // 5. After cooldown period expires
    // (In real usage, would need to wait 30 mins based on defaults)
    riskManager.circuitBreakerState.lastTriggered = Date.now() - 31 * 60 * 1000;
    console.log(riskManager.checkCircuitBreakers(account)); // false (cooldown expired)
    
    // 6. Simulate rapid losses
    riskManager.recordLoss(10);
    riskManager.recordLoss(15);
    riskManager.recordLoss(20); // 3 losses in quick succession
    console.log(riskManager.checkCircuitBreakers(account)); // true (rapid loss threshold)
     * 
     */

    /**
     * Updates performance metrics after each trade outcome
     * @param {boolean} success - Whether the recovery attempt was successful
     * @param {string} strategyUsed - Name of the strategy used
     * @param {number} recoveryAmount - Amount recovered (if successful)
     * @param {number} duration - Time taken for the recovery (ms)
     * @param {object} marketConditions - Current market state snapshot
     * @returns {void}
     * 
     * @description
     * This comprehensive metrics system tracks:
     * 1. Overall and strategy-specific success rates
     * 2. Recovery efficiency (time and amount)
     * 3. Win/loss streaks
     * 4. Time-based performance patterns
     * 5. Strategy effectiveness scores
     * 
     * All metrics are updated using exponential moving averages for
     * responsiveness while maintaining stability.
     */
    private updateMetrics(
        success: boolean,
        strategyUsed: string,
        recoveryAmount: number = 0,
        duration: number = 0,
        marketConditions?: {
            volatility: number;
            trend: 'up' | 'down' | 'neutral';
        }
    ): void {
        // Initialize metrics if they don't exist
        if (!this.metrics) {
            this.metrics = {
                recoverySuccessRate: 0,
                avgRecoveryTime: 0,
                strategyEffectiveness: new Map(),
                tradeHistory: [],
                streaks: {
                    currentWin: 0,
                    currentLoss: 0,
                    maxWin: 0,
                    maxLoss: 0
                },
                timeMetrics: {
                    hourly: { wins: 0, losses: 0, profit: 0 },
                    daily: { wins: 0, losses: 0, profit: 0 }
                },
                calculated: {
                    hourlyWinRate: 0,
                    dailyWinRate: 0,
                    filteredWinRate: 0,
                    filteredCount: 0,
                }
            };
        }

        const now = Date.now();
        const currentHour = new Date(now).getHours();
        const currentDay = new Date(now).getDay();

        // Update streaks
        if (success) {
            this.metrics.streaks.currentWin++;
            this.metrics.streaks.currentLoss = 0;
            if (this.metrics.streaks.currentWin > this.metrics.streaks.maxWin) {
                this.metrics.streaks.maxWin = this.metrics.streaks.currentWin;
            }
        } else {
            this.metrics.streaks.currentLoss++;
            this.metrics.streaks.currentWin = 0;
            if (this.metrics.streaks.currentLoss > this.metrics.streaks.maxLoss) {
                this.metrics.streaks.maxLoss = this.metrics.streaks.currentLoss;
            }
        }

        // Calculate exponential moving average for success rate (alpha = 0.1)
        const alpha = 0.1;
        this.metrics.recoverySuccessRate =
            alpha * (success ? 1 : 0) +
            (1 - alpha) * this.metrics.recoverySuccessRate;

        // Update average recovery time only for successful recoveries
        if (success && duration > 0) {
            this.metrics.avgRecoveryTime =
                alpha * duration +
                (1 - alpha) * this.metrics.avgRecoveryTime;
        }

        // Update strategy effectiveness (composite score 0-100)
        const strategyData = this.metrics.strategyEffectiveness.get(strategyUsed) || 50;
        const effectivenessUpdate = success
            ? Math.min(100, strategyData + 5)  // Successful recovery boosts score
            : Math.max(0, strategyData - 10);  // Failed recovery penalizes more

        this.metrics.strategyEffectiveness.set(strategyUsed, effectivenessUpdate);

        // Record trade in history
        this.metrics.tradeHistory.push({
            timestamp: now,
            strategy: strategyUsed,
            stake: this.getCurrentState().amount,
            outcome: success ? 'win' : 'loss',
            recoveryAmount: success ? recoveryAmount : 0,
            duration,
            marketConditions: marketConditions
                ? `${marketConditions.trend}_${marketConditions.volatility.toFixed(2)}`
                : undefined
        });

        // Maintain rolling history (last 1000 trades)
        if (this.metrics.tradeHistory.length > 1000) {
            this.metrics.tradeHistory.shift();
        }

        // Update time-based metrics
        const timeMetrics = this.metrics.timeMetrics;

        // Reset hourly metrics if hour changed
        if (currentHour !== new Date(this.metrics.tradeHistory[0]?.timestamp).getHours()) {
            timeMetrics.hourly = { wins: 0, losses: 0, profit: 0 };
        }

        // Reset daily metrics if day changed
        if (currentDay !== new Date(this.metrics.tradeHistory[0]?.timestamp).getDay()) {
            timeMetrics.daily = { wins: 0, losses: 0, profit: 0 };
        }

        // Update counts
        if (success) {
            timeMetrics.hourly.wins++;
            timeMetrics.daily.wins++;
            timeMetrics.hourly.profit += recoveryAmount;
            timeMetrics.daily.profit += recoveryAmount;
        } else {
            timeMetrics.hourly.losses++;
            timeMetrics.daily.losses++;
        }

        // Calculate additional derived metrics
        this.calculateDerivedMetrics();

        if (this.metrics.tradeHistory.length % 100 === 0) {
            this.cleanupOldMetrics();
        }
    }

    private cleanupOldMetrics(): void {
        const cutoff = Date.now() - (this.metricsRetentionDays * 24 * 60 * 60 * 1000);

        this.metrics.tradeHistory = this.metrics.tradeHistory
            .filter(trade => trade.timestamp >= cutoff)
            .slice(-this.maxHistoryItems);

        // Add similar cleanup for other metrics as needed
    }

    /**
     * Calculates derived performance metrics
     * @private
     * @returns {void}
     * 
     * @description
     * Computes additional performance indicators including:
     * - Win/loss ratios by time period
     * - Strategy risk-adjusted returns
     * - Market condition correlations
     */
    private calculateDerivedMetrics(): void {
        // Calculate hourly win rate
        const hourly = this.metrics.timeMetrics.hourly;
        const hourlyWinRate = hourly.wins + hourly.losses > 0
            ? hourly.wins / (hourly.wins + hourly.losses)
            : 0;

        // Calculate daily win rate
        const daily = this.metrics.timeMetrics.daily;
        const dailyWinRate = daily.wins + daily.losses > 0
            ? daily.wins / (daily.wins + daily.losses)
            : 0;

        // Calculate strategy risk profiles
        const strategyRisk = new Map<string, { wins: number; losses: number; avgProfit: number }>();

        this.metrics.tradeHistory.forEach((trade: any) => {
            const data = strategyRisk.get(trade.strategy) || { wins: 0, losses: 0, avgProfit: 0 };
            if (trade.outcome === 'win') {
                data.wins++;
                data.avgProfit = (data.avgProfit * (data.wins - 1) + trade.recoveryAmount) / data.wins;
            } else {
                data.losses++;
            }
            strategyRisk.set(trade.strategy, data);
        });

        // Store additional calculated metrics
        this.metrics.calculated = {
            hourlyWinRate,
            dailyWinRate,
            strategyRisk,
            // Add more derived metrics as needed
        };
    }

    /**
     * Gets performance metrics with optional filtering
     * @param {object} [options] - Filtering options
     * @param {string} [options.strategy] - Filter by strategy name
     * @param {number} [options.since] - Timestamp for filtering history
     * @returns {IPerformanceMetrics} Filtered performance metrics
     * 
     * @description
     * Returns metrics with optional filters applied. Includes:
     * - Full metrics when no filters
     * - Strategy-specific metrics when filtered
     * - Time-window metrics when since timestamp provided
     */
    public getMetrics(options?: { strategy?: string; since?: number }): IPerformanceMetrics {
        if (!options) {
            return this.metrics;
        }

        const filteredMetrics: IPerformanceMetrics = {
            ...this.metrics,
            tradeHistory: this.metrics.tradeHistory.filter(trade => {
                const matchesStrategy = options.strategy ? trade.strategy === options.strategy : true;
                const matchesTime = options.since ? trade.timestamp >= options.since : true;
                return matchesStrategy && matchesTime;
            }),
            // Recalculate derived metrics for filtered subset
            calculated: this.calculateFilteredMetrics(options)
        };

        return filteredMetrics;
    }

    /**
     * Calculates metrics for filtered data subsets
     * @private
     * @param {object} options - Filtering options
     * @returns {object} Recalculated derived metrics
     */
    private calculateFilteredMetrics(options: { strategy?: string; since?: number }): object {
        // Implement specific filtered calculations
        const filteredHistory = this.metrics.tradeHistory.filter((trade: any) => {
            const matchesStrategy = options.strategy ? trade.strategy === options.strategy : true;
            const matchesTime = options.since ? trade.timestamp >= options.since : true;
            return matchesStrategy && matchesTime;
        });

        const wins = filteredHistory.filter((t: any) => t.outcome === 'win').length;
        const losses = filteredHistory.filter((t: any) => t.outcome === 'loss').length;
        const winRate = wins + losses > 0 ? wins / (wins + losses) : 0;

        return {
            filteredWinRate: winRate,
            filteredCount: filteredHistory.length,
            // Add more filtered metrics as needed
        };
    }

    /*****
     * 
     * USAGE EXAMPLE
     * 
     * 
     * 
     * 
     * // After a trade completes:
    riskManager.updateMetrics(
        true, // success
        "RecoveryStrategyV2", 
        85.50, // recovered amount
        1200, // duration in ms
        { volatility: 0.65, trend: 'up' } // market conditions
    );

    // Get filtered metrics:
    const strategyMetrics = riskManager.getMetrics({ 
        strategy: "RecoveryStrategyV2",
        since: Date.now() - 86400000 // last 24 hours
    });

     */


    /**
     * Gets the total losses amount
     * @returns The total losses
     */
    public calculateTotalLosses(): number {
        return this.totalLossAmount;
    }

    /**
     * Calculates total amount needed to recover including recovery percentage
     * @returns The total amount to recover
     */
    public calculateTotalToRecover(): number {
        // If no active strategy, return raw loss amount
        if (!this.activeStrategy) return this.totalLossAmount;

        // Calculate total including recovery percentage
        return this.totalLossAmount * (1 + this.activeStrategy.lossRecoveryPercentage / 100);
    }

    /**
   * Calculates next stake with dynamic strategy support and safety limits
   */
    private calculateNextStake(): number {
        if (!this.activeStrategy || this.totalLossAmount <= 0) {
            return this.baseStake;
        }

        const currentStep = this.activeStrategy.strategySteps[
            Math.min(this.currentRecoveryStep, this.activeStrategy.strategySteps.length - 1)
        ];

        // Handle dynamic stake calculation functions
        const stepAmount = typeof currentStep.amount === 'function'
            ? currentStep.amount(this.totalLossAmount)
            : currentStep.amount;

        // Apply risk adjustment
        return this.calculateRiskAdjustedStake(stepAmount);
    }

    /**
       * Adjusts stake amount based on risk limits
       * @param requiredStake - The calculated required stake
       * @returns The stake amount adjusted for risk limits
       */
    private calculateRiskAdjustedStake(requiredStake: number): number {
        if (!this.activeStrategy) {
            return Math.min(requiredStake, this.baseStake * MAX_STAKE_MULTIPLIER);
        }

        // Calculate multiple risk factors
        const maxStakeByExposure = this.baseStake * this.activeStrategy.maxRiskExposure;
        const maxStakeByBalance = this.baseStake * MAX_STAKE_MULTIPLIER;
        const sequenceRiskFactor = 1 - (this.currentRecoveryStep / this.activeStrategy.strategySteps.length);

        const maxAllowedStake = Math.min(
            maxStakeByExposure,
            maxStakeByBalance,
            this.baseStake * (MAX_STAKE_MULTIPLIER * sequenceRiskFactor)
        );

        return Math.min(requiredStake, maxAllowedStake);
    }



    /**
     * Calculates the required win rate for the strategy to break even
     * @returns The required win rate (0-1)
     */
    public calculateRequiredWinRate(): number {
        // If no active strategy, assume 50% win rate needed
        if (!this.activeStrategy) return 0.5;

        // Calculate minimum win rate needed (1 / sequence length)
        const sequenceLength = this.activeStrategy.strategySteps.length;
        return 1 / sequenceLength;
    }

    /**
     * Calculates potential payout for a given stake
     * @param stake - The stake amount
     * @returns The potential payout amount
     */
    public calculatePotentialPayout(stake: number): number {
        // If no active strategy, assume 80% profit (1.8x payout)
        if (!this.activeStrategy) return stake * 1.8;

        // Calculate payout based on strategy profit percentage
        return stake * (1 + this.activeStrategy.profitPercentage / 100);
    }

    /**
     * Calculates profit percentage based on strategy type and stake
     * @param strategyType - The trading strategy type
     * @param stake - The trade stake amount
     * @returns The expected profit percentage
     * @throws Error if strategy type is invalid or stake is out of range
     */
    static calculateProfitPercentage(strategyType: ContractType, stake: number): number {
        // Get reward structure for this strategy type
        const rewards = this.rewardStructures[strategyType];
        if (!rewards) {
            logger.error(`No reward structure found for strategy: ${strategyType}`);
            throw new Error(`Unsupported strategy type: ${strategyType}`);
        }

        // Find the reward tier that matches the stake amount
        const rewardTier = rewards.find(tier =>
            stake >= tier.minStake && stake <= tier.maxStake
        );

        if (!rewardTier) {
            logger.error(`No reward tier found for stake: ${stake}`);
            throw new Error(`Stake amount ${stake} out of valid range`);
        }

        // Log and return the reward percentage
        logger.debug(`Calculated ${rewardTier.rewardPercentage}% profit for ${strategyType} with stake ${stake}`);
        return rewardTier.rewardPercentage;
    }

    /**
     * Updates internal state with previous trade result data
     * @param data - The previous trade result data
     */
    private updatePreviousTradeResult(data: IPreviousTradeResult): void {
        // Validate the input data
        this.validatePreviousTradeData(data);

        // Update internal state from trade result
        this.resultIsWin = data.resultIsWin;
        this.consecutiveLosses = data.strategyParams.consecutiveLosses;
        this.totalLossAmount = data.strategyParams.totalLost || 0;
        this.winningTrades = data.strategyParams.winningTrades || 0;
        this.losingTrades = data.strategyParams.losingTrades || 0;
    }

    /**
     * Validates previous trade data structure
     * @param data - The data to validate
     * @throws Error if data is invalid
     */
    private validatePreviousTradeData(data: IPreviousTradeResult): void {
        if (!data || !data.strategyParams) {
            throw new Error('Invalid previous trade data');
        }
    }

    /**
   * Validates trade result data structure and values
   */
    private validateTradeResult(data: IPreviousTradeResult): boolean {
        if (!data || typeof data !== 'object') return false;
        if (!data.strategyParams || typeof data.strategyParams !== 'object') return false;
        if (typeof data.resultIsWin !== 'boolean') return false;
        if (typeof data.baseStake !== 'number' || data.baseStake <= 0) return false;
        if (!data.userAccount || typeof data.userAccount.balance !== 'number') return false;
        return true;
    }

    /**
     * Validates recovery parameters against strategy limits
     * @returns True if parameters are valid, false otherwise
     */
    private validateRecoveryParameters(): boolean {
        // If no active strategy, return false
        if (!this.activeStrategy) return false;

        // Check if consecutive losses exceed strategy maximum
        if (this.consecutiveLosses >= this.activeStrategy.maxConsecutiveLosses) {
            return false;
        }

        // Check if current stake exceeds maximum risk exposure
        const currentStake = this.getStepAmount(this.activeStrategy.strategySteps[this.currentRecoveryStep], this.totalLossAmount);
        if (currentStake > this.baseStake * this.activeStrategy.maxRiskExposure) {
            return false;
        }

        return true;
    }

    /**
     * Resets all state to initial values
     */
    private resetState(): void {
        this.consecutiveLosses = 0;
        this.totalLossAmount = 0;
        this.currentRecoveryStep = 0;
        this.currentStrategyIndex = 0;
        this.activeStrategy = this.recoveryStrategies[0];
    }

    /**
     * Resets recovery-specific state (keeps loss amount)
     */
    private resetRecoveryState(): void {
        this.consecutiveLosses = 0;
        this.currentRecoveryStep = 0;
    }

    /**
     * Gets the currently active strategy
     * @returns The active strategy or null
     */
    public getCurrentStrategy(): RecoveryStrategy | null {
        return this.activeStrategy;
    }

    /**
     * Gets the delay for the current strategy step
     * @returns The delay in milliseconds
     */
    public getStrategyDelay(): number {
        // If no active strategy, return 0 delay
        if (!this.activeStrategy) return 0;
        // Get delay from current step (default to 0 if not specified)
        return this.activeStrategy.strategySteps[this.currentRecoveryStep].delay || 0;
    }

    /**
     * Gets performance data for a specific strategy
     * @param strategyName - Name of the strategy to look up
     * @returns Strategy performance data (defaults if not found)
     */
    public getStrategyPerformance(strategyName: string): IStrategyPerformance {
        // Return cached data if available
        if (this.strategyPerformanceData.has(strategyName)) {
            return this.strategyPerformanceData.get(strategyName)!;
        }

        // Return defaults if strategy not found
        return {
            winRate: 0.5,  // Default to 50% win rate
            recentProfit: 1.0,  // Neutral recent performance
            totalTrades: 0
        };
    }

    /**
     * Saves/updates performance data for a strategy
     * @param strategyName - Name of the strategy
     * @param data - Performance data to store
     */
    public saveStrategyPerformance(strategyName: string, data: Partial<IStrategyPerformance>): void {
        const current = this.getStrategyPerformance(strategyName);

        // Merge with existing data (if any)
        const updatedData: IStrategyPerformance = {
            winRate: data.winRate ?? current.winRate,
            recentProfit: data.recentProfit ?? current.recentProfit,
            totalTrades: data.totalTrades ?? current.totalTrades
        };

        this.strategyPerformanceData.set(strategyName, updatedData);
    }

    /**
     * Initializes default recovery strategies
     * @returns Array of default recovery strategies
     */
    private initializeDefaultStrategies(): RecoveryStrategy[] {
        return [
            {
                strategyName: "Beast001",
                strategySteps: [
                    {
                        amount: this.baseStake * 2,
                        symbol: this.market,
                        contractType: this.contractType,
                        contractDurationValue: this.contractDurationValue,
                        contractDurationUnits: this.contractDurationUnits
                    },
                    {
                        amount: this.baseStake * 4,
                        symbol: this.market,
                        contractType: this.contractType,
                        contractDurationValue: this.contractDurationValue,
                        contractDurationUnits: this.contractDurationUnits
                    },
                    {
                        amount: this.baseStake * 8,
                        symbol: this.market,
                        contractType: this.contractType,
                        contractDurationValue: this.contractDurationValue,
                        contractDurationUnits: this.contractDurationUnits
                    }
                ],
                maxSequence: 3,
                profitPercentage: 80,
                lossRecoveryPercentage: 100,
                anticipatedProfitPercentage: 80,
                maxConsecutiveLosses: 5,
                maxRiskExposure: 15
            },
            {
                strategyName: "SafeRecovery",
                strategySteps: [
                    {
                        amount: this.baseStake * 1.5,
                        symbol: this.market,
                        contractType: this.contractType,
                        contractDurationValue: this.contractDurationValue,
                        contractDurationUnits: this.contractDurationUnits
                    },
                    {
                        amount: this.baseStake * 2.25,
                        symbol: this.market,
                        contractType: this.contractType,
                        contractDurationValue: this.contractDurationValue,
                        contractDurationUnits: this.contractDurationUnits
                    },
                    {
                        amount: this.baseStake * 3.375,
                        symbol: this.market,
                        contractType: this.contractType,
                        contractDurationValue: this.contractDurationValue,
                        contractDurationUnits: this.contractDurationUnits
                    }
                ],
                maxSequence: 3,
                profitPercentage: 50,
                lossRecoveryPercentage: 80,
                anticipatedProfitPercentage: 50,
                maxConsecutiveLosses: 3,
                maxRiskExposure: 5
            }
        ];
    }
}