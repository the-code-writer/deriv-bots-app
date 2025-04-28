// trade-strategies.ts - Trade strategy implementations
/**
 * @file Contains all trade strategy implementations for the Deriv trading bot
 * @module TradeStrategies
 */
import { pino } from "pino";
import {
    ContractParams,
    ITradeData,
    ContractType,
    IPreviousTradeResult,
    MarketType,
    ContractTypeEnum,
    ContractDurationUnitType,
    MarketTypeEnum,
    BasisType,
    CurrencyType,
    BasisTypeEnum,
    CurrenciesEnum,
    ContractDurationUnitTypeEnum,
    StatusTypeEnum
} from './types';
import { TradeExecutor } from './trade-executor';
import { VolatilityRiskManager } from './trade-risk-manager';
import { TradeRewardStructures } from "./trade-reward-structures";
import { ContractParamsFactory } from './contract-factory';
import { IDerivUserAccount } from "./deriv-user-account";
import { StrategyParser } from './trader-strategy-parser';
import { BotConfig } from './types';

const logger = pino({
    name: "TradeStrategy",
    level: process.env.LOG_LEVEL || "info",
    serializers: {
        error: pino.stdSerializers.err
    }
});

/**
 * Interface for strategy configuration
 */
interface IStrategyConfig {
    strategyName: string;
    strategySteps: {
        amount: number;
        symbol: MarketType;
        contractType: ContractType;
        contractDurationValue: number;
        contractDurationUnits: ContractDurationUnitType;
        barrier?: number;
        delay?: number;
    }[];
    isAggressive: boolean;
    maxSequence?: number;
    profitPercentage?: number;
    anticipatedProfitPercentage?: number;
    lossRecoveryPercentage?: number;
    maxConsecutiveLosses?: number;
    maxRiskExposure?: number;
}

/**
 * Abstract base class for all trading strategies
 */
export abstract class TradeStrategy {
    protected executor: TradeExecutor;
    protected market: MarketType = MarketTypeEnum.Default;
    protected contractType: ContractType = ContractTypeEnum.Default;
    protected basis: BasisType = BasisTypeEnum.Default;
    protected currency: CurrencyType = CurrenciesEnum.Default;
    protected baseStake: number = 1;
    protected contractDurationValue: number = 1;
    protected contractDurationUnits: ContractDurationUnitType = ContractDurationUnitTypeEnum.Default;
    protected userAccountToken: string = "";
    protected previousTradeResultData: IPreviousTradeResult = {} as IPreviousTradeResult;
    protected tradeRewardStructures: TradeRewardStructures;
    // @ts-ignore
    protected volatilityRiskManager: VolatilityRiskManager;
    // @ts-ignore
    protected strategyParser: StrategyParser;
    protected contractFactory: typeof ContractParamsFactory;
    protected predictedDigit: number = 0;
    protected barrier: number | string = 0;

    protected config: BotConfig;

    constructor(config: BotConfig) {
        this.config = config;
        this.executor = new TradeExecutor();
        this.tradeRewardStructures = new TradeRewardStructures();
        this.contractFactory = ContractParamsFactory;
    }

    /**
     * Executes the trade strategy
     * @abstract
     * @returns {Promise<ITradeData>} Trade execution result
     */
    abstract execute(): Promise<ITradeData>;

    protected initializeVolatilityRiskManager(strategyName: string): void {

        logger.info({
            action: 'initializeVolatilityRiskManager',
            strategyName: strategyName
        });

        const circuitBreakerConfig = {
            maxAbsoluteLoss: 1000,
            maxDailyLoss: 500,
            maxConsecutiveLosses: 5,
            maxBalancePercentageLoss: 0.2,
            rapidLossTimeWindow: 300000,
            rapidLossThreshold: 3,
            cooldownPeriod: 1800000
        };

        // Initialize strategy parser
        const strategyJson = require(`./strategies/NDTXStrategy${strategyName}.json`);

        this.strategyParser = new StrategyParser(strategyJson, 0, this.baseStake);


        logger.info({
            action: 'initializeVolatilityRiskManager',
            strategyJson: strategyJson,
            // strategyParser: this.strategyParser.getFormattedOutput() 
        });


        this.volatilityRiskManager = new VolatilityRiskManager(
            this.baseStake,
            this.market,
            this.currency,
            this.contractType,
            this.contractDurationValue,
            this.contractDurationUnits,
            this.strategyParser,
            circuitBreakerConfig
        );
    }

    protected async executeTrade(userAccountToken: string): Promise<ITradeData> {
        await this.preContractPurchaseChecks(this.contractType);

        logger.info({
            action: 'executing_strategy',
            strategy: this.contractType,
            ...(this.predictedDigit ? { predictedDigit: this.predictedDigit } : {}),
            ...(this.barrier ? { barrier: this.barrier } : {})
        });

        const params = this.getNextContractParams(this.contractType);
        this.validateParameters(params);

        const result = await this.executor.purchaseContract(params, userAccountToken);
        this.handleTradeResult(params, result);

        return result;
    }

    protected handleTradeResult(params: any, result: any): void {
        if (this.volatilityRiskManager) {
            this.volatilityRiskManager.processTradeResult({
                ...this.previousTradeResultData,
                resultIsWin: result.status === StatusTypeEnum.Won
            });
        }

        if (result.status === StatusTypeEnum.Blocked) {
            console.log(`Trade blocked due to: ${result.message}`); 
            if (result.metadata?.cooldownRemaining > 0) {
                console.log(`Wait ${result.metadata.cooldownRemaining}ms before retrying`);
            }
        }

        if (result.status === StatusTypeEnum.Lost) {
            this.recordAndCheckLoss(params.amount);
            const rapidLossState = this.volatilityRiskManager?.getRapidLossState();

            if (rapidLossState?.lastDetectedTime) {
                const cooldownRemaining = rapidLossState.lastDetectedTime +
                    (this.volatilityRiskManager.getRapidLossConfig().coolDownMs || 0) - Date.now();

                if (cooldownRemaining > 0) {
                    logger.info(`In rapid loss cooldown: ${cooldownRemaining}ms remaining`);
                    return this.getSafetyExitResult();
                }
            }
        }
    }

    private getSafetyExitResult(reason?: string): any {
        const state = this.volatilityRiskManager?.getCircuitBreakerState();
        return {
            status: 'blocked',
            message: `Trade blocked: ${reason}`,
            timestamp: Date.now(),
            metadata: {
                circuitBreakerState: state,
                cooldownRemaining: state?.lastTriggered
                    ? (state.lastTriggered + this.volatilityRiskManager!.getCircuitBreakerConfig().cooldownPeriod) - Date.now()
                    : 0
            }
        };
    }

    protected recordAndCheckLoss(amount: number): void {
        if (!this.volatilityRiskManager) {
            logger.warn('VolatilityRiskManager not initialized - skipping loss recording');
            return;
        }

        this.volatilityRiskManager.recordLoss(amount);
        this.volatilityRiskManager.recordRapidLoss(amount);

        const rapidLossDetected = this.volatilityRiskManager.checkRapidLosses(amount);
        if (rapidLossDetected) {
            const state = this.volatilityRiskManager.getRapidLossState();
            logger.warn({
                event: 'RAPID_LOSS_DETECTED',
                lossesCount: state.recentLossTimestamps.length,
                totalAmount: state.recentLossAmounts.reduce((a, b) => a + b, 0),
                message: 'Rapid loss threshold exceeded'
            });
            this.enterSafetyMode('rapid_loss_detected');
        }
    }

    protected enterSafetyMode(reason: string): void {
        this.volatilityRiskManager?.enterSafetyMode(reason);
    }

    protected checkCircuitBreakers(): { shouldBlock: boolean; reason?: string } {
        if (!this.volatilityRiskManager) {
            logger.debug('Risk manager not available - skipping circuit breaker check');
            return { shouldBlock: false };
        }

        const shouldBlock = this.volatilityRiskManager.checkCircuitBreakers(this.getCurrentAccount());
        if (shouldBlock) {
            const state = this.volatilityRiskManager.getCircuitBreakerState();
            return {
                shouldBlock: true,
                reason: state.lastReason || 'circuit_breaker_triggered'
            };
        }

        return { shouldBlock: false };
    }

    protected checkCircuitBreakersOnFailure(): void {
        if (this.volatilityRiskManager?.checkCircuitBreakers(this.getCurrentAccount())) {
            this.enterSafetyMode('post_trade_circuit_breaker');
        }
    }

    private getCurrentAccount(): IDerivUserAccount {
        return {
            balance: 1000,
            email: "",
            country: "",
            currency: "USD",
            loginid: "",
            user_id: "",
            fullname: ""
        };
    }

    protected validateParameters(params: ContractParams): void {
        if (!params) throw new Error('Trade parameters are required');
        if (Number(params.amount) <= 0) throw new Error('Stake amount must be positive');
        if (!params.basis) throw new Error('Basis type must be specified');
        if (!params.currency) throw new Error('Currency must be specified');
        if (!params.duration) throw new Error('Duration must be specified');
        if (!params.duration_unit) throw new Error('Duration units must be specified');
        if (!params.symbol) throw new Error('Market symbol must be specified');

        const validation = this.validateAccountBalance(Number(params.amount));
        if (!validation.isValid) {
            const errorMsg = `Balance validation failed: ${validation.reasons.join(', ')}`;
            logger.error({
                error: new Error(errorMsg),
                validationMetrics: validation.metrics,
                strategy: this.constructor.name
            });
            throw new Error(errorMsg);
        }

        if (this.volatilityRiskManager?.checkRapidLosses()) {
            this.getSafetyExitResult();
            throw new Error('Many rapid losses');
        }

        this.validateContractTypeSpecificParams(params);
    }

    protected validateContractTypeSpecificParams(params: ContractParams): void {
        switch (this.contractType) {
            case ContractTypeEnum.DigitDiff:
            case ContractTypeEnum.DigitUnder:
            case ContractTypeEnum.DigitOver:
                if (params.barrier === undefined) {
                    throw new Error('Barrier is required for digit-based trades');
                }
                this.validateDigit(Number(params.barrier));
                break;
        }
    }

    protected async preContractPurchaseChecks(contractType: ContractType): Promise<void> {
        if (this.volatilityRiskManager?.getCurrentState().inSafetyMode) {
            throw new Error('Cannot execute trade while in safety mode');
        }

        const circuitCheck = this.checkCircuitBreakers();
        if (circuitCheck.shouldBlock) {
            logger.warn({
                event: 'TRADE_BLOCKED',
                reason: circuitCheck.reason,
                action: 'Entering safety mode'
            });
            this.enterSafetyMode(circuitCheck.reason!);
            return this.getSafetyExitResult(circuitCheck.reason!);
        }
    }

    protected getNextContractParams(contractType: ContractType): ContractParams {
        if (this.volatilityRiskManager) {
            const nextParams = this.volatilityRiskManager.getNextTradeParams();
            return this.createParamsFromFactory(
                contractType,
                nextParams.amount,
                nextParams.barrier
            );
        }

        return this.createParamsFromFactory(
            contractType,
            this.baseStake
        );
    }

    private createParamsFromFactory(
        contractType: ContractType,
        amount: number,
        barrier?: number | string
    ): ContractParams {

        /*
        const commonParams = this.contractFactory.createParams(
            amount,
            this.basis,
            contractType,
            this.currency,
            this.contractDurationValue,
            this.contractDurationUnits,
            this.market,
        );
        */

        const commonParams = {
            amount: amount,
            basis: this.basis,
            currency: this.currency,
            duration: this.contractDurationValue,
            duration_unit: this.contractDurationUnits,
            symbol: this.market,
            contract_type: contractType,
            market: this.market, // Ensure market is included
            durationUnit: this.contractDurationUnits // Ensure durationUnit is included
        };

        switch (contractType) {
            case ContractTypeEnum.DigitDiff:
                return this.contractFactory.createDigitDiffParams({
                    ...commonParams,
                    barrier: barrier !== undefined ? barrier : this.predictedDigit,
                    predictedDigit: this.predictedDigit
                });

            case ContractTypeEnum.DigitOver:
                return this.contractFactory.createDigitOverParams({
                    ...commonParams,
                    barrier: barrier !== undefined ? barrier as number : this.barrier as number
                });

            case ContractTypeEnum.DigitUnder:
                return this.contractFactory.createDigitUnderParams({
                    ...commonParams,
                    barrier: barrier !== undefined ? barrier as number : this.barrier as number
                });

            case ContractTypeEnum.DigitEven:
                return this.contractFactory.createDigitEvenParams({
                    ...commonParams,
                    barrier: ContractTypeEnum.DigitEven
                });

            case ContractTypeEnum.DigitOdd:
                return this.contractFactory.createDigitOddParams({
                    ...commonParams,
                    barrier: ContractTypeEnum.DigitOdd
                });

            case ContractTypeEnum.Call:
            case ContractTypeEnum.Put:
            default:
                return {
                    ...commonParams,
                    contract_type: contractType,
                    symbol: this.market
                };
        }
        
    }

    setPrediction(predictedDigit: number): void {
        this.predictedDigit = this.validateDigit(predictedDigit);
    }

    setBarrier(barrier: number | string): void {
        this.barrier = this.validateBarrier(barrier);
    }

    private validateDigit(digit: number): number {
        const validDigit = Math.round(digit);
        if (validDigit < 0 || validDigit > 9) {
            throw new Error('Predicted digit must be between 0-9');
        }
        return validDigit;
    }

    private validateBarrier(barrier: number | string): number | string {
        if (typeof barrier === "string") {
            if (barrier !== ContractTypeEnum.DigitEven && barrier !== ContractTypeEnum.DigitOdd) {
                return ContractTypeEnum.DigitEven;
            }
            return barrier;
        }

        const validBarrier = Math.round(barrier);
        if (validBarrier < 0 || validBarrier > 9) {
            throw new Error('Barrier must be between 0-9');
        }
        return validBarrier;
    }

    protected validateAccountBalance(amount: number): any {
        if (!this.volatilityRiskManager) {
            logger.warn('VolatilityRiskManager not initialized - skipping balance validation');
            return {
                isValid: true,
                reasons: [],
                metrics: {
                    balance: 0,
                    proposedStake: amount,
                    riskPercentage: 0,
                    requiredMinimum: 0,
                    availableAfterTrade: 0,
                    bypassed: true
                }
            };
        }

        const userAccount: IDerivUserAccount = {
            balance: 1000,
            currency: this.currency,
            email: "",
            country: "",
            loginid: "",
            user_id: "",
            fullname: ""
        };

        return this.volatilityRiskManager.validateAccountBalance(amount, userAccount);
    }
}

// Concrete strategy implementations
export class DigitDiffStrategy extends TradeStrategy {
    constructor(config: BotConfig) {
        super(config);
        // Class based contract type
        this.contractType = ContractTypeEnum.DigitDiff;
        this.initializeVolatilityRiskManager(this.contractType);
    }

    async execute(): Promise<ITradeData | void> {
        try {
            return await this.executeTrade(userAccountToken);
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITDIFF',
                message: 'Error executing DIGITDIFF strategy'
            });
            this.checkCircuitBreakersOnFailure();
            throw error;
        }
    }
}

export class DigitEvenStrategy extends TradeStrategy {
    constructor(config: BotConfig) {
        super(config);
        // Class based contract type
        this.contractType = ContractTypeEnum.DigitEven;
        this.initializeVolatilityRiskManager(this.contractType);
    }

    async execute(): Promise<ITradeData | void> {
        try {
            return await this.executeTrade(userAccountToken);
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITEVEN',
                message: 'Error executing DIGITEVEN strategy'
            });
            this.checkCircuitBreakersOnFailure();
            throw error;
        }
    }
}

export class DigitOddStrategy extends TradeStrategy {
    constructor(config: BotConfig) {
        super(config);
        // Class based contract type
        this.contractType = ContractTypeEnum.DigitOdd;
        this.initializeVolatilityRiskManager(this.contractType);
    }

    async execute(): Promise<ITradeData | void> {
        try {
            return await this.executeTrade(userAccountToken);
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITODD',
                message: 'Error executing DIGITODD strategy'
            });
            this.checkCircuitBreakersOnFailure();
            throw error;
        }
    }
}

export class CallStrategy extends TradeStrategy {
    constructor(config: BotConfig) {
        super(config);
        // Class based contract type
        this.contractType = ContractTypeEnum.Call;
        this.initializeVolatilityRiskManager(this.contractType);
    }

    async execute(): Promise<ITradeData | void> {
        try {
            return await this.executeTrade(userAccountToken);
        } catch (error) {
            logger.error({
                error,
                strategy: 'CALL',
                message: 'Error executing CALL strategy'
            });
            this.checkCircuitBreakersOnFailure();
            //throw error;
        }
    }
}

export class PutStrategy extends TradeStrategy {
    constructor(config: BotConfig) {
        super(config);
        // Class based contract type
        this.contractType = ContractTypeEnum.Put;
        this.initializeVolatilityRiskManager(this.contractType);
    }

    async execute(): Promise<ITradeData | void> {
        try {
            return await this.executeTrade(userAccountToken);
        } catch (error) {
            logger.error({
                error,
                strategy: 'PUT',
                message: 'Error executing PUT strategy'
            });
            this.checkCircuitBreakersOnFailure();
            throw error;
        }
    }
}

export class DigitUnderStrategy extends TradeStrategy {
    constructor(config: BotConfig) {
        super(config);
        // Class based contract type
        this.contractType = ContractTypeEnum.DigitUnder;
        this.initializeVolatilityRiskManager(this.contractType);
    }

    async execute(): Promise<ITradeData | void> {
        try {
            return await this.executeTrade(userAccountToken);
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITUNDER',
                message: 'Error executing DIGITUNDER strategy'
            });
            this.checkCircuitBreakersOnFailure();
            throw error;
        }
    }
}

export class DigitOverStrategy extends TradeStrategy {
    constructor(config: BotConfig) {
        super(config);
        // Class based contract type
        this.contractType = ContractTypeEnum.DigitOver;
        this.initializeVolatilityRiskManager(this.contractType);
    }

    async execute(): Promise<ITradeData | void> {
        try {
            return await this.executeTrade(userAccountToken);
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITOVER',
                message: 'Error executing DIGITOVER strategy'
            });
            this.checkCircuitBreakersOnFailure();
            throw error;
        }
    }
}