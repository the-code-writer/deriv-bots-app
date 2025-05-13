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
import { RapidLossState, SafetyModeResponse, VolatilityRiskManager } from './trade-risk-manager';
import { TradeRewardStructures } from "./trade-reward-structures";
import { ContractParamsFactory } from './contract-factory';
import { IDerivUserAccount } from "../user/UserDerivAccount";
import { StrategyParser } from './trader-strategy-parser';
import { BotConfig, BasisTypeEnum, CurrenciesEnum } from './types';
import { getRandomDigit, roundToTwoDecimals, sleep } from "@/common/utils/snippets";
import { OneThreeTwoSixStrategy } from './trade-1326-strategy';

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
    protected barrier: number | string | null = null;

    protected config: BotConfig;

    protected strategy1326: any;

    constructor(config: BotConfig) {
        this.config = config;
        this.tradeRewardStructures = new TradeRewardStructures();
        this.contractFactory = ContractParamsFactory;
    }

    checkPendingRecovery(): boolean {

        return this.volatilityRiskManager.getTotalLostAmount() > 0;

    }

    getHighestStakeInvested(): number {

        return this.volatilityRiskManager.getHighestStakeInvested();

    }

    getHighestProfitAchieved(): number {

        return this.volatilityRiskManager.getHighestProfitAchieved();

    }

    /**
     * Executes the trade strategy
     * @abstract
     * @returns {Promise<ITradeData>} Trade execution result
     */
    abstract execute(): Promise<ITradeData | null>;

    protected initializeVolatilityRiskManager(strategyName: string, config: BotConfig): void {

        logger.info({
            action: 'initializeVolatilityRiskManager',
            strategyName: strategyName
        });

        const circuitBreakerConfig = {
            maxAbsoluteLoss: 1000,
            maxDailyLoss: 500,
            maxConsecutiveLosses: 4,
            maxBalancePercentageLoss: 0.5,

            rapidLoss: {
                timeWindowMs: 40000,     // 30 second window
                threshold: 4,            // 2 losses in 30s triggers
                initialCooldownMs: 15000, // 30s initial cooldown
                maxCooldownMs: 300000,   // 5min maximum cooldown
                cooldownMultiplier: 2    // Double cooldown each time
            },

            cooldownPeriod: 15000        // 1min for other circuit breakers
        };

        // Initialize strategy parser
        const strategyJson = require(`./strategies/${strategyName}.json`);

        this.strategyParser = new StrategyParser(strategyJson, this.baseStake, this.config);


        logger.info({
            action: 'initializeVolatilityRiskManager::::::' + this.userAccountToken,
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
            circuitBreakerConfig,
            this.userAccountToken
        );

        this.executor = new TradeExecutor(this.volatilityRiskManager);


        this.strategy1326  = new OneThreeTwoSixStrategy({
            initialStake: config.baseStake, // Custom initial stake
            profitThreshold: config.takeProfit, // Custom profit threshold
            lossThreshold: config.stopLoss, // Custom loss threshold,
            market: config.market
        });


    }

    protected async executeTrade(): Promise<ITradeData | null> {

        let params: ContractParams = {} as ContractParams;

        if (this.config.contractType === ContractTypeEnum.DigitDiff1326) {

            const decision = this.strategy1326.executeTrade(this.volatilityRiskManager.lastTradeWon, this.volatilityRiskManager.lastTradeProfit);

            if (!decision.shouldTrade) {
                //TODO return with a reason
                return null;
            }

            let recoveryAmount = this.volatilityRiskManager.lastTradeWon ? decision.amount : roundToTwoDecimals(this.volatilityRiskManager.lastTradeProfit * -1 * 12.75);

            if (this.volatilityRiskManager.getTotalProfit() < 0) {

                const nextRecoveryAmount = roundToTwoDecimals(this.volatilityRiskManager.getTotalProfit() * -1 * 12.75);
                if (recoveryAmount < nextRecoveryAmount) {
                    recoveryAmount = nextRecoveryAmount;
                }

            }

            const newParams = {
                amount: recoveryAmount,
                currency: CurrenciesEnum.Default,
                basis: BasisTypeEnum.Stake,
                contract_type: decision.contractType,
                symbol: decision.market,
                duration: decision.duration,
                duration_unit: decision.durationType,
                barrier: decision.prediction
            }
            
            this.validateParameters(newParams);

            params = newParams;

        } else {
          
            const response: SafetyModeResponse = await this.preContractPurchaseChecks();

            if (response?.status === 'OK') {

                // PASS

            } else if (response?.status === 'SAFETY_MODE') {

                console.error({
                    message: "SAFETY_MODE",
                    response: response
                });

                const remainingCooldown = this.getRemainingCooldown(response);

                logger.error(`*** In safety mode. Resuming in ${Math.ceil(remainingCooldown / 1000)} seconds...`);

                // Wait for the cooldown period plus a small buffer
                await sleep(remainingCooldown + 1000);

                // Reset or refresh your trade manager if needed
                this.resetSafetyMode();

            } else if (response?.status === 'TRADE_BLOCKED' || response?.status === 'BLOCKED') {

                console.error({
                    message: "TRADE_BLOCKED",
                    response: response
                });

                const remainingCooldown = this.getRemainingCooldown(response);

                logger.error(`*** Trade currently blocked. Resuming in ${Math.ceil(remainingCooldown / 1000)} seconds...`);

                // Wait for the cooldown period plus a small buffer
                await sleep(remainingCooldown + 1000);

                // Reset or refresh your trade manager if needed
                this.resetSafetyMode();

            } else if (response?.status === 'RAPID_LOSS_DETECTED') {

                console.error({
                    message: "RAPID_LOSS_DETECTED",
                    response: response
                });

                const remainingCooldown = this.getRemainingCooldown(response);

                logger.error(`*** Rapid loss detected. Resuming in ${Math.ceil(remainingCooldown / 1000)} seconds...`);

                // Wait for the cooldown period plus a small buffer
                await sleep(remainingCooldown + 1000);

                // Reset or refresh your trade manager if needed
                this.resetSafetyMode();

            } else {

                console.error({
                    message: "UNKNOWN",
                    response: response
                });

            }

            params = this.getNextContractParams(this.config, this.barrier);

            const validParams: boolean = this.validateParameters(params);

            if (!validParams) {
                console.error({
                    message: "INVALID_PARAMS",
                    params: validParams
                });

                // TODO : Stop Trades
            }
            
        }

        const result: ITradeData = await this.executor.purchaseContract(params, this.config) as ITradeData;

        if (this.volatilityRiskManager) {
            if (this.config.contractType === ContractTypeEnum.DigitDiff1326) {
                const isWin = result.profit_is_win;
                const profit = result.safeProfit || 0;
                await this.volatilityRiskManager.process1326TradeResult(params.amount, isWin, profit)
            } else {
                this.volatilityRiskManager.processTradeResult(result);
            }
        }

        return result;

    }

    private getRemainingCooldown(response: SafetyModeResponse): number {

        const safetyModeUntil: number = response.metadata.circuitBreakerState?.safetyModeUntil || 0;

        const currentTimestamp: number = Date.now();

        console.log([
            safetyModeUntil,
            currentTimestamp,
            (safetyModeUntil - currentTimestamp)
        ])

        return Math.max(0, safetyModeUntil - currentTimestamp);

    }

    private getDefaultExitResult(): SafetyModeResponse {
        return {
            status: 'OK',
            message: `Checks passed!`,
            timestamp: Date.now(),
            metadata: {}
        };
    }

    private getSafetyRapidLossResult(state?: any): SafetyModeResponse {

        return {
            status: 'RAPID_LOSS_DETECTED',
            message: `Rapid loss threshold exceeded`,
            timestamp: Date.now(),
            metadata: {
                rapidLosses: {
                    event: 'RAPID_LOSS_DETECTED',
                    lossesCount: state.recentLosses.length,  // Changed from recentLossTimestamps
                    totalAmount: state.recentLosses.reduce((sum: number, loss: any) => sum + loss.amount, 0), // Changed from recentLossAmounts
                    triggerCount: state.triggerCount,  // Added trigger count
                    currentCooldown: state.currentCooldownMs,  // Added cooldown info
                    message: `Rapid loss threshold exceeded. Cooldown active for ${state.currentCooldownMs}ms`,
                },
                circuitBreakerState: state,
                cooldownRemaining: state?.lastTriggered
                    ? (state.lastTriggered + this.volatilityRiskManager!.getCircuitBreakerConfig().cooldownPeriod) - Date.now()
                    : 0
            }
        };
    }

    private getSafetyExitResult(reason?: string): SafetyModeResponse {
        const state = this.volatilityRiskManager?.getCircuitBreakerState();
        return {
            status: 'BLOCKED',
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

    private getSafetyModeResult(): SafetyModeResponse {
        const currentState = this.volatilityRiskManager?.getCurrentState();
        const circuitBreakerState = this.volatilityRiskManager?.getCircuitBreakerState();
        return {
            status: 'SAFETY_MODE',
            message: `The state is in safety mode`,
            timestamp: Date.now(),
            metadata: {
                currentState: currentState,
                circuitBreakerState: circuitBreakerState,
            }
        };
    }

    protected recordAndCheckLoss(amount: number): void {
        if (!this.volatilityRiskManager) {
            logger.warn('VolatilityRiskManager not initialized - skipping loss recording');
            return;
        }

        // Record the loss
        this.volatilityRiskManager.recordRapidLoss(amount);

        // Check for rapid loss condition
        const rapidLossDetected = this.volatilityRiskManager.checkRapidLosses(amount);
        if (rapidLossDetected) {
            const state: RapidLossState = this.volatilityRiskManager.getRapidLossState();
            logger.warn({
                event: 'RAPID_LOSS_DETECTED',
                lossesCount: state.recentLosses.length,  // Changed from recentLossTimestamps
                totalAmount: state.recentLosses.reduce((sum, loss) => sum + loss.amount, 0), // Changed from recentLossAmounts
                triggerCount: state.triggerCount,  // Added trigger count
                currentCooldown: state.currentCooldownMs,  // Added cooldown info
                message: `Rapid loss threshold exceeded. Cooldown active for ${state.currentCooldownMs}ms`
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
            return { shouldBlock: false, reason: '' };
        }

        const shouldBlock = this.volatilityRiskManager.checkCircuitBreakers(this.getCurrentAccount());

        if (shouldBlock) {
            const state = this.volatilityRiskManager.getCircuitBreakerState();
            return {
                shouldBlock: true,
                reason: state.lastReason || 'circuit_breaker_triggered'
            };
        }

        return { shouldBlock: false, reason: '' };

    }

    protected checkCircuitBreakersOnFailure(): void {
        if (this.volatilityRiskManager?.checkCircuitBreakers(this.getCurrentAccount())) {
            this.enterSafetyMode('post_trade_circuit_breaker');
        }
    }

    public resetSafetyMode(): void {
        if (this.volatilityRiskManager) {
            this.volatilityRiskManager.resetSafetyMode();
        }
    }

    private getCurrentAccount(): IDerivUserAccount {
        return {
            balance: 5000,
            email: "",
            country: "",
            currency: "USD",
            loginid: "",
            user_id: "",
            fullname: ""
        };
    }

    protected validateParameters(params: ContractParams): boolean {
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
                error: errorMsg,
                validationMetrics: validation.metrics,
                strategy: this.constructor.name
            });
            console.error(errorMsg);
            return false;
        }

        if (this.volatilityRiskManager?.checkRapidLosses()) {
            this.getSafetyExitResult();
            console.error('Many rapid losses');
            return false;
        }

        return this.validateContractTypeSpecificParams(params);

    }

    protected validateContractTypeSpecificParams(params: ContractParams): boolean {
        switch (this.contractType) {
            case ContractTypeEnum.DigitDiff:
            case ContractTypeEnum.DigitUnder:
            case ContractTypeEnum.DigitOver:
                if (params.barrier === undefined) {
                    logger.error('Barrier is required for digit-based trades');
                    return false;
                }

                // Todo - validate the digits properly
                if (this.validateDigit(Number(params.barrier))) {
                    //logger.error('Barrier is required and must be a number');
                    //return false;
                };
                if (typeof params.barrier === "number") {
                    //logger.error('Barrier is required and must be a number');
                    //return false;
                };
        }
        return true;
    }

    protected async preContractPurchaseChecks(): Promise<SafetyModeResponse> {

        if (this.volatilityRiskManager?.getCurrentState().inSafetyMode) {
            return this.getSafetyModeResult();
        }

        const circuitCheck = this.checkCircuitBreakers();
        if (circuitCheck.shouldBlock) {
            this.enterSafetyMode(circuitCheck.reason!);
            return this.getSafetyExitResult(circuitCheck.reason!);
        }

        // Check for rapid loss condition
        const rapidLossDetected = this.volatilityRiskManager.checkRapidLosses();
        if (rapidLossDetected) {
            const state: RapidLossState = this.volatilityRiskManager.getRapidLossState();
            this.enterSafetyMode('rapid_loss_detected');
            return this.getSafetyRapidLossResult(state);
        }

        return this.getDefaultExitResult();

    }

    protected getNextContractParams(config: BotConfig, barrier: string | number | null): ContractParams {

        if (this.volatilityRiskManager) {

            const nextParams = this.volatilityRiskManager.getNextTradeParams(barrier);

            //console.error("nextParams", nextParams);

            const contractParams = this.createParamsFromFactory(
                nextParams.contractType,
                nextParams.amount,
                nextParams.basis,
                nextParams.currency,
                nextParams.contractDurationValue,
                nextParams.contractDurationUnits,
                nextParams.symbol,
                nextParams.barrier,
            );

            return contractParams;

        }

        return this.createParamsFromFactory(
            config.contractType as ContractType,
            this.baseStake,
            this.basis,
            this.currency,
            this.contractDurationValue,
            this.contractDurationUnits,
            this.market,
            this.barrier!,
        );

    }

    private createParamsFromFactory(
        contractType: ContractType,
        amount: number,
        basis: BasisType,
        currency: CurrencyType,
        duration: number,
        durationUnit: ContractDurationUnitType,
        market: MarketType,
        barrier?: number | string
    ): ContractParams {

        const commonParams = {
            amount: amount,
            basis: basis || this.basis,
            currency: currency || this.currency,
            duration: duration || this.contractDurationValue,
            duration_unit: durationUnit || this.contractDurationUnits,
            symbol: market || this.market,
            contract_type: contractType || this.contractType,
            barrier: barrier
        };

        if (!commonParams.barrier || commonParams.barrier === null || commonParams.barrier === undefined || typeof commonParams.barrier === undefined) {
            delete commonParams.barrier;
        }

        if ([ContractTypeEnum.Call, ContractTypeEnum.Put, ContractTypeEnum.DigitEven, ContractTypeEnum.DigitOdd].includes(commonParams.contract_type)) {
            delete commonParams.barrier;
        }

        return commonParams;

    }

    setBarrier(barrier: number | string): void {
        this.barrier = this.validateBarrier(barrier);
    }

    private validateDigit(digit: number): number {
        const validDigit = Math.round(digit);
        if (validDigit < 0 || validDigit > 9) {
            logger.error('Predicted digit must be between 0-9');
            return getRandomDigit();
        }
        return validDigit;
    }

    private validateBarrier(barrier: number | string): number | string {

        if (typeof barrier === "string") {
            if (barrier === ContractTypeEnum.DigitEven) {
                return ContractTypeEnum.DigitEven;
            } else {
                return ContractTypeEnum.DigitOdd;
            }
        }

        const validBarrier = Math.round(barrier);

        if (validBarrier < 0 || validBarrier > 9) {
            logger.error('Barrier must be between 0-9');
            return getRandomDigit();
        }

        return parseInt(`${validBarrier}`);

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
            balance: 5000,
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
export class DigitDiff1326Strategy extends TradeStrategy {
    constructor(config: BotConfig) {
        super(config);
        // Class based contract type
        logger.error({
            config,
            strategy: 'CONFIG',
        });
        this.contractType = ContractTypeEnum.DigitDiff;
        this.initializeVolatilityRiskManager(this.contractType, config);
    }

    async execute(): Promise<ITradeData | null> {
        try {
            return await this.executeTrade();
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITDIFF',
                message: 'Error executing DIGITDIFF strategy'
            });
            this.checkCircuitBreakersOnFailure();
            //throw error;
            return null;
        }
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

    async execute(): Promise<ITradeData | null> {
        try {
            return await this.executeTrade();
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITDIFF',
                message: 'Error executing DIGITDIFF strategy'
            });
            this.checkCircuitBreakersOnFailure();
            //throw error;
            return null;
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

    async execute(): Promise<ITradeData | null> {
        try {
            return await this.executeTrade();
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITEVEN',
                message: 'Error executing DIGITEVEN strategy'
            });
            this.checkCircuitBreakersOnFailure();
            //throw error;
            return null;
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

    async execute(): Promise<ITradeData | null> {
        try {
            return await this.executeTrade();
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITODD',
                message: 'Error executing DIGITODD strategy'
            });
            this.checkCircuitBreakersOnFailure();
            //throw error;
            return null;
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

    async execute(): Promise<ITradeData | null> {
        try {
            return await this.executeTrade();
        } catch (error) {
            logger.error({
                error,
                strategy: 'CALL',
                message: 'Error executing CALL strategy'
            });
            this.checkCircuitBreakersOnFailure();
            //throw error;
            return null;
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

    async execute(): Promise<ITradeData | null> {
        try {
            return await this.executeTrade();
        } catch (error) {
            logger.error({
                error,
                strategy: 'PUT',
                message: 'Error executing PUT strategy'
            });
            this.checkCircuitBreakersOnFailure();
            //throw error;
            return null;
        }
    }
}

export class DigitUnderStrategy extends TradeStrategy {
    constructor(config: BotConfig, barrier?:number) {
        super(config);
        // Class based contract type
        this.contractType = ContractTypeEnum.DigitUnder;
        this.initializeVolatilityRiskManager(this.contractType);
        if(barrier){
            this.barrier = barrier;
        }
        
    }

    async execute(): Promise<ITradeData | null> {
        try {
            return await this.executeTrade();
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITUNDER',
                message: 'Error executing DIGITUNDER strategy'
            });
            this.checkCircuitBreakersOnFailure();
            //throw error;
            return null;
        }
    }
}

export class DigitOverStrategy extends TradeStrategy {
    constructor(config: BotConfig, barrier?:number) {
        super(config);
        // Class based contract type
        this.contractType = ContractTypeEnum.DigitOver;
        this.initializeVolatilityRiskManager(this.contractType);
        if(barrier){
            this.barrier = barrier;
        }

    }

    async execute(): Promise<ITradeData | null> {
        try {
            return await this.executeTrade();
        } catch (error) {
            logger.error({
                error,
                strategy: 'DIGITOVER',
                message: 'Error executing DIGITOVER strategy'
            });
            this.checkCircuitBreakersOnFailure();
            //throw error;
            return null;
        }
    }
}