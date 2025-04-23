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

const StrategyGeneriv001 = require("./strategies/StrategyGeneric001.json") ;

/**
 * Manages trade execution and strategy adaptation
 */
export class TradeManager {

    private market?: MarketType;
    private contractType?: ContractType;
    private baseStake?: number;
    private takeProfit?: number;
    private stopLoss?: number;
    private contractDurationUnits?: ContractDurationUnitType;
    private contractDurationValue?: number;
    private tradingMode?: TradingModeType;
    private sessionData?: TradingSessionDataType;

    private userAccount?: IDerivUserAccount;

    private currentContractType: TradeStrategy;

    /**
     * Constructs a new TradeManager instance
     * @param {BotConfig} config - Configuration object for the trade manager
     */
    constructor(config: BotConfig) {

        this.market = config.market;
        this.contractType = config.contractType;
        this.baseStake = config.baseStake;
        this.takeProfit = config.takeProfit;
        this.stopLoss = config.stopLoss;
        this.contractDurationUnits = config.contractDurationUnits;
        this.contractDurationValue = config.contractDurationValue;
        this.tradingMode = config.tradingMode;
        this.sessionData = config.sessionData;

        this.currentContractType = this.initializeContractTypeClass(this.contractType);

    }

    setUserAccount(userAccount:IDerivUserAccount) : void {

        this.userAccount = userAccount;

    }

    /**
     * Executes a trade based on the specified purchase type
     * @param {DerivAPI} api - Type of trade to execute
     * @param {ContractType} contractType - Type of trade to execute
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async executeTrade(): Promise<ITradeData | undefined> {

        if (!this.contractType) {
            throw new Error('TradeManager can not execute trade : Missing Contract Type');
        }

        if (!this.currentContractType) {
            throw new Error('TradeManager can not execute trade : Contract Type not initialized');
        }

        try {

            // Execute the trade using current strategy
            const response = await this.currentContractType.execute();

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
    private initializeContractTypeClass(contractType: ContractType | undefined): TradeStrategy {

        switch (contractType) {
            case ContractTypeEnum.DigitDiff:
                return new DigitDiffStrategy(StrategyGeneriv001);
            case ContractTypeEnum.DigitOver:
                return new DigitOverStrategy(StrategyGeneriv001);
            case ContractTypeEnum.DigitUnder:
                return new DigitUnderStrategy(StrategyGeneriv001);
            case ContractTypeEnum.DigitEven:
                return new DigitEvenStrategy(StrategyGeneriv001);
            case ContractTypeEnum.DigitOdd:
                return new DigitOddStrategy(StrategyGeneriv001);
            case ContractTypeEnum.Call:
                return new CallStrategy(StrategyGeneriv001);
            case ContractTypeEnum.Put:
                return new PutStrategy(StrategyGeneriv001);
            default:
                logger.warn(`Unknown strategy type: ${contractType}, using DigitDiffStrategy as fallback`);
                return new DigitDiffStrategy(StrategyGeneriv001);
        }

    }

}