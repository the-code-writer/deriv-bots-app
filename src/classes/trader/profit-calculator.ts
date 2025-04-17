// profit-calculator.ts - Profit calculation and risk management
/**
 * @file Handles profit calculations, risk assessment, and stake management
 * @module ProfitCalculator
 */

import { PurchaseType } from './types';
import { pino } from "pino";
const logger = pino({ name: "Trade Executor" });

// Type definitions for reward structures
type RewardStructure = {
    minStake: number;
    maxStake: number;
    rewardPercentage: number;
};

type StrategyRewards = {
    [key in PurchaseType]?: RewardStructure[];
};

/**
 * Handles profit calculations and risk management for trading strategies
 */
export class ProfitCalculator {
    // Reward structures for different strategy types
    private readonly rewardStructures: StrategyRewards;
    // Martingale configuration
    private readonly recoveryMultiplier: number;
    private readonly maxRecoveryTrades: number;

    /**
     * Constructs a new ProfitCalculator instance
     * @param {number} [recoveryMultiplier=2.0] - Multiplier for recovery trades
     * @param {number} [maxRecoveryTrades=5] - Maximum consecutive recovery trades
     */
    constructor(recoveryMultiplier: number = 2.0, maxRecoveryTrades: number = 5) {
        this.recoveryMultiplier = recoveryMultiplier;
        this.maxRecoveryTrades = maxRecoveryTrades;

        // Initialize reward structures for all strategy types
        this.rewardStructures = {
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
    }

    /**
     * Calculates profit percentage based on strategy type and stake
     * @param {PurchaseType} strategyType - The trading strategy type
     * @param {number} stake - The trade stake amount
     * @returns {number} The expected profit percentage
     * @throws {Error} If strategy type is invalid or stake is negative
     */
    calculateProfitPercentage(strategyType: PurchaseType, stake: number): number {

        this.validateInputs(strategyType, stake);

        const rewards = this.rewardStructures[strategyType];
        if (!rewards) {
            logger.error(`No reward structure found for strategy: ${strategyType}`);
            throw new Error(`Unsupported strategy type: ${strategyType}`);
        }

        const rewardTier = rewards.find(tier =>
            stake >= tier.minStake && stake <= tier.maxStake
        );

        if (!rewardTier) {
            logger.error(`No reward tier found for stake: ${stake}`);
            throw new Error(`Stake amount ${stake} out of valid range`);
        }

        logger.debug(`Calculated ${rewardTier.rewardPercentage}% profit for ${strategyType} with stake ${stake}`);
        return rewardTier.rewardPercentage;
    }

    /**
     * Calculates the next trading amount with risk management
     * @param {boolean} wasSuccessful - Whether the previous trade was successful
     * @param {number} profitAfterSale - Profit/loss from the previous trade
     * @param {number} baseStake - The base stake amount
     * @param {number} profitPercentage - The expected profit percentage
     * @returns {number} The calculated next stake amount
     */
    getTradingAmount(previousTradeResultData: any): number {
        // TODO - calculate next stake
        return previousTradeResultData.baseStake;
    }

    /**
     * Validates input parameters for calculations
     * @param {PurchaseType} strategyType - Strategy type to validate
     * @param {number} stake - Stake amount to validate
     * @throws {Error} If inputs are invalid
     * @private
     */
    private validateInputs(strategyType: PurchaseType, stake: number): void {

        // @ts-ignore
        if (!strategyType) {
            throw new Error(`Invalid strategy type: ${strategyType}`);
        }

        if (stake <= 0 || isNaN(stake)) {
            throw new Error(`Stake must be positive number, got ${stake}`);
        }
    }

    /**
     * Rounds stake amount to valid increment
     * @param {number} amount - Raw stake amount
     * @returns {number} Rounded stake amount
     * @private
     */
    private roundToValidStake(amount: number): number {
        // Exchange typically accepts stakes with 2 decimal places
        const rounded = Math.round(amount * 100) / 100;

        // Ensure minimum stake of 0.35
        return Math.max(rounded, 0.35);
    }

    /**
     * Calculates the potential payout for a trade
     * @param {number} stake - The trade stake amount
     * @param {number} profitPercentage - The expected profit percentage
     * @returns {number} The potential payout amount
     */
    calculatePotentialPayout(stake: number, profitPercentage: number): number {
        return stake + (stake * (profitPercentage / 100));
    }

    /**
     * Calculates the required win rate for profitability
     * @param {number} profitPercentage - The expected profit percentage
     * @returns {number} The required win rate (0-100)
     */
    calculateRequiredWinRate(profitPercentage: number): number {
        if (profitPercentage <= 0) return 100;
        return (100 / (100 + profitPercentage)) * 100;
    }

    /**
     * Calculates risk-adjusted stake amount
     * @param {number} baseStake - The base stake amount
     * @param {number} balance - Current account balance
     * @param {number} riskPercentage - Max risk percentage (1-100)
     * @returns {number} Risk-adjusted stake amount
     */
    calculateRiskAdjustedStake(
        baseStake: number,
        balance: number,
        riskPercentage: number
    ): number {
        const maxRiskAmount = balance * (riskPercentage / 100);
        return this.roundToValidStake(Math.min(baseStake, maxRiskAmount));
    }
}