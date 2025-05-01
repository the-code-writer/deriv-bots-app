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
import { defaultEventManager } from '@/common/utils/eventBus';

const logger = pino({ name: "TradeManager" });

/**
 * Manages trade execution and strategy adaptation
 */
export class TradeManager {

    private currentContractType: TradeStrategy;

    private config: BotConfig;

    /**
     * Constructs a new TradeManager instance
     * @param {BotConfig} config - Configuration object for the trade manager
     */
    constructor(config: BotConfig) {

        this.config = config;

        this.currentContractType = this.initializeContractTypeClass();

    }

    /**
     * Executes a trade based on the specified purchase type
     * @param {DerivAPI} api - Type of trade to execute
     * @param {ContractType} contractType - Type of trade to execute
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async executeTrade(): Promise<ITradeData | null> {

        const reasons : string[] = [];

        let reason: string = "";

        if (!this.config.contractType) {
            reason = 'TradeManager can not execute trade : Missing Contract Type';
            logger.error(reason);
            reasons.push(reason);
        }

        if (!this.config.userAccountToken) {
            reason = 'TradeManager can not execute trade : Missing User Account Token';
            logger.error(reason);
            reasons.push(reason);
        }

        if (!this.currentContractType) {
            reason = 'TradeManager can not execute trade : Contract Type not initialized';
            logger.error(reason);
            reasons.push(reason);
        }

        try {

            // Execute the trade using current strategy
            const response = await this.currentContractType.execute();

            // Validate and process trade result
            return response;

        } catch (error: any) {

            reason = `Trade execution failed: ${error.message}`;
            logger.error(reason);
            reasons.push(reason);

            logger.error(error);

        }

        if(reasons.length>0){

            defaultEventManager.emit('STOP_TRADING', {reason: "Trade execution failed", reasons});

        }

        return null;

    }

    /**
     * Creates a strategy instance based on type
     * @param {ContractType} contractType - Type of strategy to create
     * @returns {TradeStrategy} Strategy instance
     * @private
     */
    private initializeContractTypeClass(): TradeStrategy {

        switch (this.config.contractType) {
            case ContractTypeEnum.DigitDiff:
                return new DigitDiffStrategy(this.config);
            case ContractTypeEnum.DigitOver:
                return new DigitOverStrategy(this.config);
            case ContractTypeEnum.DigitUnder:
                return new DigitUnderStrategy(this.config);
            case ContractTypeEnum.DigitEven:
                return new DigitEvenStrategy(this.config);
            case ContractTypeEnum.DigitOdd:
                return new DigitOddStrategy(this.config);
            case ContractTypeEnum.Call:
                return new CallStrategy(this.config);
            case ContractTypeEnum.Put:
                return new PutStrategy(this.config);
            default:
                logger.warn({error: `Unknown strategy type: ${this.config.contractType}, using DigitDiffStrategy as fallback`, config: this.config});
                return new DigitDiffStrategy(this.config);
        }

    }

}