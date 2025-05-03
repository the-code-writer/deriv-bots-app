// trade-executor.ts - Trade execution and contract management
/**
 * @file Handles the execution of trades and contract management
 * @module TradeExecutor
 */

import { pino } from "pino";
import { BotConfig, ContractParams, ContractResponse, CurrenciesEnum, ITradeData, TradingEvent } from './types';
import { parentPort } from 'worker_threads';
import { env } from "@/common/utils/envConfig";
import { DerivUserAccount, IDerivUserAccount } from '../user/UserDerivAccount';
import { defaultEventManager } from './trade-event-manager';

const DerivAPI = require("@deriv/deriv-api/dist/DerivAPI");
const logger = pino({ name: "Trade Executor" });

const jsan = require("jsan");

const { find } = require("rxjs/operators");

const {
    CONNECTION_PING_TIMEOUT,
    CONNECTION_CONTRACT_CREATION_TIMEOUT,
    DERIV_APP_ENDPOINT_DOMAIN,
    DERIV_APP_ENDPOINT_APP_ID,
    DERIV_APP_ENDPOINT_LANG,
} = env;

/**
 * Handles trade execution and contract lifecycle management
 */
export class TradeExecutor {
    private api: any = null;
    private connectionTimeout: number;
    private maxRetryAttempts: number;
    private retryDelayBase: number;
    private userAccountToken: string;

    /**
     * Constructs a new TradeExecutor instance
     * @param {number} [connectionTimeout=10000] - Timeout for connection operations in ms
     * @param {number} [maxRetryAttempts=3] - Maximum number of retry attempts
     * @param {number} [retryDelayBase=1000] - Base delay for retries in ms
     */
    constructor(
        connectionTimeout: number = 10000,
        maxRetryAttempts: number = 3,
        retryDelayBase: number = 1000
    ) {
        this.connectionTimeout = connectionTimeout;
        this.maxRetryAttempts = maxRetryAttempts;
        this.retryDelayBase = retryDelayBase;
        this.userAccountToken = "";
    }

    /**
    /**
     * Purchases a contract with retry logic and comprehensive error handling
     * @param {ContractParams} contractParameters - Parameters for the contract
     * @returns {Promise<ITradeData>} Trade execution result
     */
    async purchaseContract(contractParameters: ContractParams, config: BotConfig): Promise<ITradeData | undefined> {

        if (!contractParameters) {
            throw new Error('TradeExecutor not initialized');
        }

        this.validateContractParameters(contractParameters);

        let attempt = 0;

        while (attempt < this.maxRetryAttempts) {

            try {

                attempt++;

                const { contract, user } = await this.createContract(contractParameters, String(config.userAccountToken));

                // Subscribe to contract updates to monitor its status in real-time
                const onUpdateSubscription = contract.onUpdate(({ status, payout, bid_price }: any) => {
                    switch (status) {
                        case "proposal":
                            logger.info(`Proposal received. Payout : ${payout.currency} ${payout.display}`);
                            break;
                        case "open":
                            logger.info(`Contract opened. Bid Price: ${bid_price.currency} ${bid_price.display}`);
                            break;
                        default:
                            logger.info(`Contract status updated: ${status}`);
                            break;
                    }
                });


                await contract.buy();

                // Wait for the contract to be sold (i.e., the trade is completed)
                await contract.onUpdate()
                    .pipe(find(({ is_sold }: any) => is_sold))
                    .toPromise();

                logger.info('Contract purchased successfully');

                // Unsubscribe from contract updates to clean up resources
                onUpdateSubscription.unsubscribe();

                return this.transformContractToTradeData(contract, user);

            } catch (error: any) {

                logger.warn(`Attempt ${attempt} of ${this.maxRetryAttempts}`);

                logger.error(`Code: ${error.error.code} :: Message: ${error.error.message}`);

                if (attempt < this.maxRetryAttempts) {
                    const delay = this.calculateRetryDelay(attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

            }

        }

        logger.error('All purchase attempts failed');

        defaultEventManager.emit(TradingEvent.StopTrading.type, {
            reason: "Unknown error during contract purchase",
            timestamp: Date.now(),
            profit: 1250.50
          });

    }

    /**
     * Validates contract parameters before execution
     * @param {ContractParams} params - Contract parameters to validate
     * @throws {Error} If parameters are invalid
     * @private
     */
    private validateContractParameters(params: ContractParams): void {

        logger.warn({
            //params
        })

        const requiredFields = ['amount', 'contract_type', 'currency', 'symbol'];

        // @ts-ignore
        const missingFields = requiredFields.filter(field => !params[field]);

        let reason: string;

        const reasons: string[] = [];

        if (missingFields.length > 0) {
            reason = `Missing required fields: ${missingFields.join(', ')}`;
            reasons.push(reason);
            logger.error(reason);
        }

        if (typeof params.amount === 'number' && params.amount <= 0) {
            reason = 'Amount must be positive';
            reasons.push(reason);
            logger.error(reason);
        }

        if (typeof params.amount === 'string' && parseFloat(params.amount) <= 0) {
            reason = 'Amount must be positive';
            reasons.push(reason);
            logger.error(reason);
        }

        if (isNaN(Number(params.amount))) {
            reason = 'Amount must be a number';
            reasons.push(reason);
            logger.error(reason);
        }

        if (Number(params.amount) < env.MIN_STAKE) {
            reason = `Amount must be ${env.MIN_STAKE} or above`;
            reasons.push(reason);
            logger.error(reason);
        }

        if (Number(params.amount) > env.MAX_STAKE) {
            reason = `Amount must be ${env.MAX_STAKE} or below`;
            reasons.push(reason);
            logger.error(reason);
        }

        if (params.barrier !== undefined && isNaN(Number(params.barrier))) {
            reason = 'Barrier must be a number';
            reasons.push(reason);
            logger.error(reason);
        }

        if (reasons.length > 0) {

            defaultEventManager.emit(TradingEvent.StopTrading.type, {
                reason: "Contract parameters not valid", 
                reasons,
                timestamp: Date.now(),
                profit: 1250.50
              });
    
        }

    }

    /**
     * Creates a contract with timeout protection
     * @param {ContractParams} params - Contract parameters
     * @returns {Promise<ContractResponse>} Created contract
     * @private
     */
    private async createContract(params: ContractParams, userAccountToken: string): Promise<{ contract: ContractResponse; user: IDerivUserAccount }> {

        if (!DERIV_APP_ENDPOINT_DOMAIN) throw new Error('API Endpoint [ DERIV_APP_ENDPOINT_DOMAIN ] not defined');
        if (!DERIV_APP_ENDPOINT_APP_ID) throw new Error('API AppID [ DERIV_APP_ENDPOINT_APP_ID ] not defined');
        if (!DERIV_APP_ENDPOINT_LANG) throw new Error('API Endpoint Language [ DERIV_APP_ENDPOINT_LANG ] not defined');
        if (!userAccountToken) throw new Error('Invalid token');
        if (!params) throw new Error('Contract params not initialized');

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
                () => reject({ error: 'Contract creation timed out' }),
                this.connectionTimeout
            )
        );

        const api = new DerivAPI({ endpoint: DERIV_APP_ENDPOINT_DOMAIN, app_id: DERIV_APP_ENDPOINT_APP_ID, lang: DERIV_APP_ENDPOINT_LANG });

        const user: IDerivUserAccount = await DerivUserAccount.getUserAccount(api, userAccountToken) as IDerivUserAccount;

        const contractPromise = api.contract(params);

        const contract: ContractResponse = await Promise.race([contractPromise, timeoutPromise]);

        return { contract, user };

    }

    /**
     * Transforms contract response to standardized trade data
     * @param {any} contract - Completed contract data
     * @returns {ITradeData} Standardized trade data
     * @private
     */
    private transformContractToTradeData(contract: any, user: IDerivUserAccount): ITradeData {

        // Extract relevant data from the contract for the trade audit
        const {
            symbol,
            start_time,
            expiry_time,
            purchase_time,
            entry_spot,
            exit_spot,
            ask_price,
            buy_price,
            buy_transaction,
            bid_price,
            sell_price,
            sell_spot,
            sell_transaction,
            payout,
            profit,
            status,
            longcode,
            proposal_id,
            audit_details,
            ticks
        } = contract;

        // Populate the trade data object with the extracted contract details
        let tradeData: ITradeData = {
            symbol_short: symbol.short,
            symbol_full: symbol.full,
            start_time: start_time._data.internal.$d.getTime() / 1000,
            expiry_time: expiry_time._data.internal.$d.getTime() / 1000,
            purchase_time: purchase_time._data.internal.$d.getTime() / 1000,
            entry_spot_value: entry_spot._data.value,
            entry_spot_time: entry_spot._data.time._data.internal.$d.getTime() / 1000,
            exit_spot_value: exit_spot._data.value || sell_spot._data.value,
            exit_spot_time: exit_spot._data.time._data.internal.$d.getTime() / 1000,
            ask_price_currency: ask_price._data.currency,
            ask_price_value: ask_price._data.value,
            buy_price_currency: buy_price._data.currency,
            buy_price_value: buy_price._data.value,
            buy_transaction: buy_transaction,
            bid_price_currency: bid_price._data.currency,
            bid_price_value: bid_price._data.value,
            sell_price_currency: sell_price._data.currency,
            sell_price_value: sell_price._data.value,
            sell_spot: sell_spot._data.value,
            sell_spot_time: sell_spot._data.time._data.internal.$d.getTime() / 1000,
            sell_transaction: sell_transaction,
            payout: payout.value,
            payout_currency: payout.currency,
            profit_value: profit._data.value,
            profit_currency: payout.currency,
            profit_percentage: profit._data.percentage,
            profit_is_win: profit._data.is_win,
            profit_sign: profit._data.sign,
            safeProfit: 0,
            status: status,
            longcode: longcode,
            proposal_id: proposal_id,
            userAccount: user,
            audit_details: audit_details.all_ticks,
            ticks: ticks[0]
        };

        const safeProfit = tradeData.sell_price_value === 0 && tradeData.buy_price_value > 0
            ? 0
            : tradeData.sell_price_value - tradeData.buy_price_value;

        tradeData.safeProfit = safeProfit;

        return tradeData;

    }

    /**
     * Calculates retry delay with exponential backoff
     * @param {number} attempt - Current attempt number
     * @returns {number} Delay in milliseconds
     * @private
     */
    private calculateRetryDelay(attempt: number): number {
        const jitter = Math.random() * 500; // Add random jitter
        return Math.min(
            this.retryDelayBase * Math.pow(2, attempt - 1) + jitter,
            10000 // Max 10 seconds
        );
    }

}