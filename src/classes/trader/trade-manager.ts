// trade-manager.ts - Trade management and strategy execution
/**
 * @file Manages trade execution and strategy adaptation
 * @module TradeManager
 */

import { pino } from "pino";
import { BotConfig, CurrenciesEnum, IPreviousTradeResult, MarketTypeEnum, ContractTypeEnum, TradingTypeEnum, AccountType, TradingType, MarketType, ContractType, ITradeData, TradingModeType, TradingTypesEnum, TradingModeTypeEnum, CurrencyType, ContractDurationUnitType, BotSessionDataType, TradingSessionDataType } from './types';
import { env } from "@/common/utils/envConfig";
import { TradeStrategy, DigitDiffStrategy, DigitEvenStrategy, DigitOddStrategy, CallStrategy, PutStrategy, DigitOverStrategy, DigitUnderStrategy } from './trade-strategies';
import { IDerivUserAccount } from "./deriv-user-account";

const logger = pino({ name: "TradeManager" });

/**
 * Manages trade execution and strategy adaptation
 */
export class TradeManager {

    private contractType?: ContractType;
    private currentContractType: TradeStrategy;

    /**
     * Constructs a new TradeManager instance
     * @param {BotConfig} config - Configuration object for the trade manager
     */
    constructor(config: BotConfig) {

        this.contractType = config.contractType;
        this.currentContractType = this.initializeContractTypeClass(this.contractType, config);

    }

    /**
     * Executes a trade based on the specified purchase type
     * @param {DerivAPI} api - Type of trade to execute
     * @param {ContractType} contractType - Type of trade to execute
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async executeTrade(userAccountToken:string): Promise<ITradeData | undefined> {

        logger.warn({
            userAccountToken,
            contractType : this.contractType,
            //currentContractType: this.currentContractType
        })

        if (!this.contractType) {
            throw new Error('TradeManager can not execute trade : Missing Contract Type');
        }

        if (!this.currentContractType) {
            throw new Error('TradeManager can not execute trade : Contract Type not initialized');
        }

        try {

            // Execute the trade using current strategy
            const response = await this.currentContractType.execute(userAccountToken);

            // Validate and process trade result
            return response;

        } catch (error: any) {

            logger.error('Trade execution failed', error);

            console.log("# !!! ERROR TRADE EXECUTION !!! #", error);

            throw new Error(`Trade execution failed: ${error.message}`);

        }

    }

    /**
     * Creates a strategy instance based on type
     * @param {ContractType} contractType - Type of strategy to create
     * @returns {TradeStrategy} Strategy instance
     * @private
     */
    private initializeContractTypeClass(contractType: ContractType | undefined, config:BotConfig): TradeStrategy {

        switch (contractType) {
            case ContractTypeEnum.DigitDiff:
                return new DigitDiffStrategy(config);
            case ContractTypeEnum.DigitOver:
                return new DigitOverStrategy(config);
            case ContractTypeEnum.DigitUnder:
                return new DigitUnderStrategy(config);
            case ContractTypeEnum.DigitEven:
                return new DigitEvenStrategy(config);
            case ContractTypeEnum.DigitOdd:
                return new DigitOddStrategy(config);
            case ContractTypeEnum.Call:
                return new CallStrategy(config);
            case ContractTypeEnum.Put:
                return new PutStrategy(config);
            default:
                logger.warn(`Unknown strategy type: ${contractType}, using DigitDiffStrategy as fallback`);
                return new DigitDiffStrategy(config);
        }

    }

}