import { StrategyRewards, ContractType } from './types';

import { pino } from "pino";

// Initialize logger for tracking events and errors
// Enhanced logger with error tracking
const logger = pino({
    name: "Trade Reward Structures",
    level: process.env.LOG_LEVEL || "info",
    serializers: {
        error: pino.stdSerializers.err
    }
});

/**
 * Class managing risk for volatility indices trading
 */
export class TradeRewardStructures {
    // Reward structures for different purchase types
    private rewardStructures: StrategyRewards;

    /**
     * Constructor for TradeRewardStructures
     */
    constructor() {

        this.rewardStructures = this.initializeRewardStructures();

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


    /**
     * Calculates profit percentage based on strategy type and stake
     * @param strategyType - The trading strategy type
     * @param stake - The trade stake amount
     * @returns The expected profit percentage
     * @throws Error if strategy type is invalid or stake is out of range
     */
    calculateProfitPercentage(strategyType: ContractType, stake: number): number {
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
 * Gets the full reward structure for a purchase type
 */
    public getRewardStructure(contractType: ContractType): { minStake: number; maxStake: number; rewardPercentage: number }[] {
        if (!this.rewardStructures[contractType]) {
            throw new Error(`No reward structure for ${contractType}`);
        }
        return this.rewardStructures[contractType];
    }

}