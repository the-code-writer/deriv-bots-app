// trade-executor.ts - Trade execution and contract management
/**
 * @file Handles the execution of trades and contract management
 * @module TradeExecutor
 */

import { pino } from "pino";
import { ContractParams, ContractResponse, ITradeData } from './types';
import { parentPort } from 'worker_threads';
import { env } from "@/common/utils/envConfig";
import { DerivUserAccount } from "./deriv-user-account";

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
    DERIV_APP_TOKEN,
    MIN_STAKE,
    MAX_STAKE,
    MAX_RECOVERY_TRADES_X2,
    MAX_RECOVERY_TRADES_X10,
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
    async purchaseContract(contractParameters: ContractParams, userAccountToken: string): Promise<ITradeData> {

        if (!contractParameters) {
            throw new Error('TradeExecutor not initialized');
        }

        this.validateContractParameters(contractParameters);

        let attempt = 0;
        let lastError: Error | null = null;

        while (attempt < this.maxRetryAttempts) {

            try {

                attempt++;
                
                let contract = await this.createContract(contractParameters, userAccountToken);

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

                return this.transformContractToTradeData(contract);

            } catch (error:any) {
                lastError = error;
                console.log(error)
                logger.warn(`Attempt ${attempt} of ${this.maxRetryAttempts} failed:::: ${error.message}`);

                if (attempt < this.maxRetryAttempts) {
                    const delay = this.calculateRetryDelay(attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

            }
        }

        logger.error('All purchase attempts failed');

        throw lastError || new Error('Unknown error during contract purchase');

    }


    /**
     * Safely disconnects from the Deriv API
     * @returns {Promise<void>}
     */
    setToken(token: string): void {
        this.userAccountToken = token;
    }

    /**
     * Safely disconnects from the Deriv API
     * @returns {Promise<void>}
     */
    async disconnect(): Promise<void> {
        try {
            if (this.api) {
                await this.api.disconnect();
                this.api = null;
                logger.info('TradeExecutor disconnected successfully');
            }
        } catch (error) {
            logger.error('Error disconnecting TradeExecutor', error);
        }
    }

    /**
     * Validates contract parameters before execution
     * @param {ContractParams} params - Contract parameters to validate
     * @throws {Error} If parameters are invalid
     * @private
     */
    private validateContractParameters(params: ContractParams): void {
        const requiredFields = ['amount', 'contract_type', 'currency', 'symbol'];

        // @ts-ignore
        const missingFields = requiredFields.filter(field => !params[field]);

        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        if (typeof params.amount === 'number' && params.amount <= 0) {
            throw new Error('Amount must be positive');
        }

        if (params.barrier !== undefined && isNaN(Number(params.barrier))) {
            throw new Error('Barrier must be a number');
        }
    }

    /**
     * Creates a contract with timeout protection
     * @param {ContractParams} params - Contract parameters
     * @returns {Promise<ContractResponse>} Created contract
     * @private
     */
    private async createContract(params: ContractParams, userAccountToken: string): Promise<ContractResponse> {
        if (!params) throw new Error('API not initialized');
        if (!userAccountToken) throw new Error('Invalid token');
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
                () => reject(new Error('Contract creation timed out')),
                this.connectionTimeout
            )
        );

        const api = new DerivAPI({ endpoint: DERIV_APP_ENDPOINT_DOMAIN, app_id: DERIV_APP_ENDPOINT_APP_ID, lang: DERIV_APP_ENDPOINT_LANG });

        await DerivUserAccount.getUserAccount(api, userAccountToken);

        const contractPromise = api.contract(params);

        const contractPromiseResult: ContractResponse = await Promise.race([contractPromise, timeoutPromise]);

        return contractPromiseResult;

    }

    /**
     * Transforms contract response to standardized trade data
     * @param {any} contract - Completed contract data
     * @returns {ITradeData} Standardized trade data
     * @private
     */
    private transformContractToTradeData(contract: any): ITradeData {

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
            status: status,
            longcode: longcode,
            proposal_id: proposal_id,
            balance_currency: 'USD',
            balance_value: '0',
            audit_details: audit_details.all_ticks,
            ticks: ticks[0]
        };

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

    /**
     * Sends telemetry data to parent process
     * @param {string} event - Event type
     * @param {any} data - Telemetry data
     * @private
     */
    private sendTelemetry(event: string, data: any): void {
        if (parentPort) {
            parentPort.postMessage({ type: 'telemetry', event, data });
        }
    }
}