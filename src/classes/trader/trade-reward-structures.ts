import { StrategyRewards, ContractType } from './types';
import { pino } from "pino";
import { env } from '@/common/utils/envConfig';

// Interface for individual reward tiers
interface RewardTier {
    minStake: number;
    maxStake: number;
    rewardPercentage: number;
}

// Interface for the logger configuration
interface LoggerConfig {
    name: string;
    level: string;
    serializers: {
        error: (error: Error) => object;
    };
}

/**
 * Configuration for the reward structures logger
 */
const loggerConfig: LoggerConfig = {
    name: "Trade Reward Structures",
    level: process.env.LOG_LEVEL || "info",
    serializers: {
        error: pino.stdSerializers.err
    }
};

// Initialize logger with the configuration
const logger = pino(loggerConfig);

/**
 * Class managing reward structures for different contract types based on stake amounts
 * @class TradeRewardStructures
 * @description Provides methods to calculate profit percentages and retrieve reward structures
 *              for various trading contract types based on stake amounts.
 */
export class TradeRewardStructures {
    // Reward structures for different contract types
    private rewardStructures: StrategyRewards;

    /**
     * Constructor for TradeRewardStructures
     * @constructor
     * @description Initializes the reward structures with validation
     */
    constructor() {
        this.rewardStructures = this.initializeRewardStructures();
    }

    /**
     * Initializes reward structures with validation
     * @private
     * @method initializeRewardStructures
     * @returns {StrategyRewards} The validated reward structures for all contract types
     * @throws {Error} If any reward structure is invalid or doesn't cover the full stake range
     */
    private initializeRewardStructures(): StrategyRewards {
        const structures: StrategyRewards = {
            DIGITMATCH: [
                { minStake: env.MIN_STAKE, maxStake: env.MAX_STAKE, rewardPercentage: 7.00 }
            ],
            DIGITDIFF: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 5.71 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 6.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 8.00 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 9.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 9.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 9.67 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 9.67 }
            ],
            DIGITEVEN: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 88.57 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 92.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 94.67 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 95.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 95.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 95.33 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 95.40 }
            ],
            DIGITODD: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 88.57 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 92.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 94.67 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 95.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 95.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 95.33 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 95.40 }
            ],
            CALLE: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 77.14 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 78.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 78.67 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 79.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 79.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 79.33 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 79.40 }
            ],
            PUTE: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 77.14 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 78.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 78.67 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 79.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 79.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 79.33 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 79.40 }
            ],
            DIGITDIFF1326: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 5.71 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 6.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 8.00 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 9.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 9.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 9.67 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 9.67 }
            ],
            DIGITUNDER: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 5.71 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 6.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 8.00 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 9.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 9.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 9.67 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 9.67 }
            ],
            DIGITUNDER_9: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 5.71 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 6.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 8.00 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 9.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 9.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 9.67 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 9.67 }
            ],
            DIGITUNDER_8: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 17.10 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 20.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 21.30 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 23.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 23.00 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 23.00 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 23.2 }
            ],
            DIGITUNDER_7: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 34.30 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 38.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 38.75 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 40.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 40.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 40.30 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 40.50 }
            ],
            DIGITUNDER_6: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 51.70 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 60.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 62.7 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 63.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 63.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 63.30 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 63.40 }
            ],
            DIGITUNDER_5: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 88.60 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 92.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 94.70 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 95.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 95.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 95.30 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 95.4 }
            ],
            DIGITUNDER_4: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 137.1 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 140.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 142.70 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 143.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 142.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 142.70 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 142.8 }
            ],
            DIGITUNDER_3: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 214.3 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 220.0 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 220.0 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 221.0 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 220.5 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 220.7 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 220.6 }
            ],
            DIGITUNDER_2: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 371.40 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 372.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 372.00 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 372.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 371.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 371.70 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 371.60 }
            ],
            DIGITUNDER_1: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 794.30 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 792.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 793.30 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 793.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 793.00 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 793.00 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 792.80 }
            ],
            DIGITOVER: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 5.71 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 6.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 8.00 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 9.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 9.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 9.67 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 9.67 }
            ],
            DIGITOVER_0: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 5.71 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 6.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 8.00 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 9.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 9.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 9.67 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 9.67 }
            ],
            DIGITOVER_1: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 17.10 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 20.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 21.30 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 23.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 23.00 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 23.00 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 23.2 }
            ],
            DIGITOVER_2: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 34.30 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 38.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 38.75 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 40.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 40.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 40.30 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 40.50 }
            ],
            DIGITOVER_3: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 57.10 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 60.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 62.70 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 63.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 63.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 63.30 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 63.40 }
            ],
            DIGITOVER_4: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 5.71 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 6.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 8.00 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 9.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 9.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 9.67 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 220.6 }
            ],
            DIGITOVER_5: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 137.1 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 140.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 142.70 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 143.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 142.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 142.70 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 142.8 }
            ],
            DIGITOVER_6: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 214.3 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 220.0 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 220.0 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 221.0 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 220.5 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 220.7 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 220.6 }
            ],
            DIGITOVER_7: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 371.40 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 372.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 372.00 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 372.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 371.50 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 371.70 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 371.60 }
            ],
            DIGITOVER_8: [
                { minStake: env.MIN_STAKE, maxStake: 0.49, rewardPercentage: 794.30 },
                { minStake: 0.50, maxStake: 0.74, rewardPercentage: 792.00 },
                { minStake: 0.75, maxStake: 0.99, rewardPercentage: 793.30 },
                { minStake: 1.00, maxStake: 1.99, rewardPercentage: 793.00 },
                { minStake: 2.00, maxStake: 2.99, rewardPercentage: 793.00 },
                { minStake: 3.00, maxStake: 4.99, rewardPercentage: 793.00 },
                { minStake: 5.00, maxStake: env.MAX_STAKE, rewardPercentage: 792.80 }
            ],
        };

        // Validate all reward structures
        for (const [type, tiers] of Object.entries(structures)) {
            if (!tiers || tiers.length === 0) {
                throw new Error(`Invalid reward structure for ${type}`);
            }

            // Check for coverage from MIN_STAKE to MAX_STAKE
            const firstTier: RewardTier = tiers[0];
            const lastTier: RewardTier = tiers[tiers.length - 1];

            if (firstTier.minStake > Number(env.MIN_STAKE) || lastTier.maxStake < Number(env.MAX_STAKE)) {
                logger.error("Invalid stake range coverage", {
                    type,
                    minStake: firstTier.minStake,
                    maxStake: lastTier.maxStake,
                    expectedMin: env.MIN_STAKE,
                    expectedMax: env.MAX_STAKE
                });
                throw new Error(`Reward structure for ${type} must cover full stake range`);
            }
        }

        return structures;
    }

    /**
     * Calculates profit percentage based on contract type and stake
     * @public
     * @method calculateProfitPercentage
     * @param {ContractType} contractType - The contract type to calculate rewards for
     * @param {number} stake - The trade stake amount
     * @returns {number} The expected profit percentage
     * @throws {Error} If contract type is invalid or stake is out of range
     */
    public calculateProfitPercentage(contractType: ContractType, stake: number): number {
        // Validate stake input
        if (typeof stake !== 'number' || isNaN(stake)) {
            logger.error("Invalid stake amount", { stake });
            throw new Error("Stake must be a valid number");
        }

        if (stake < Number(env.MIN_STAKE) || stake > Number(env.MAX_STAKE)) {
            console.error("Stake out of allowed range", { stake, min: env.MIN_STAKE, max: env.MAX_STAKE });
            throw new Error(`Stake must be between ${env.MIN_STAKE} and ${env.MAX_STAKE}`);
        }

        // Get reward structure for this contract type
        const rewards: RewardTier[] | undefined = this.rewardStructures[contractType];
        if (!rewards) {
            logger.error(`No reward structure found for contract type: ${contractType}`);
            throw new Error(`Unsupported contract type: ${contractType}`);
        }

        // Find the reward tier that matches the stake amount
        const rewardTier: RewardTier | undefined = rewards.find((tier: RewardTier) =>
            stake >= tier.minStake && stake <= tier.maxStake
        );

        if (!rewardTier) {
            logger.error(`No reward tier found for stake: ${stake}`, { contractType });
            throw new Error(`Stake amount ${stake} out of valid range for ${contractType}`);
        }

        // Log and return the reward percentage
        logger.debug(`Calculated profit percentage`, {
            contractType,
            stake,
            rewardPercentage: rewardTier.rewardPercentage
        });
        return rewardTier.rewardPercentage;
    }

    /**
     * Gets the full reward structure for a contract type
     * @public
     * @method getRewardStructure
     * @param {ContractType} contractType - The contract type to get rewards for
     * @returns {RewardTier[]} Array of reward tiers for the specified contract type
     * @throws {Error} If no reward structure exists for the contract type
     */
    public getRewardStructure(contractType: ContractType): RewardTier[] {
        const rewardStructure: RewardTier[] | undefined = this.rewardStructures[contractType];

        if (!rewardStructure) {
            logger.error(`No reward structure for contract type: ${contractType}`);
            throw new Error(`No reward structure for ${contractType}`);
        }

        return rewardStructure;
    }
}