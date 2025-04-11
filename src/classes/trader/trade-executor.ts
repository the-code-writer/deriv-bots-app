// trade-executor.ts - Trade execution and contract management
/**
 * @file Handles the execution of trades and contract management
 * @module TradeExecutor
 */

import { pino } from "pino";
import { ContractParams, ContractResponse, ITradeData } from './types';
import { parentPort } from 'worker_threads';
import { env } from "@/common/utils/envConfig";

const DerivAPI = require("@deriv/deriv-api/dist/DerivAPI");
const logger = pino({ name: "Trade Executor" });

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
                logger.info(`Attempt ${attempt} to purchase contract`);

                const contract = await this.createContract(contractParameters, userAccountToken);
                this.setupContractUpdates(contract);

                await this.buyContract(contract);
                const tradeData = await this.waitForContractCompletion(contract);

                logger.info('Contract purchased successfully');
                return this.transformContractToTradeData(tradeData);

            } catch (error:any) {
                lastError = error;
                console.log(error)
                logger.warn(`Attempt ${attempt} failed:::: ${error.message}`);

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

        await api.account(userAccountToken);

        const contractPromise = api.contract(params);

        return Promise.race([contractPromise, timeoutPromise]);
    }

    /**
     * Sets up contract update listeners
     * @param {ContractResponse} contract - Contract to monitor
     * @private
     */
    private setupContractUpdates(contract: ContractResponse): void {
        contract.onUpdate(({ status, payout, bid_price }: any) => {
            switch (status) {
                case 'proposal':
                    logger.debug(`Proposal received. Payout: ${payout.currency} ${payout.display}`);
                    break;
                case 'open':
                    logger.debug(`Contract opened. Bid Price: ${bid_price.currency} ${bid_price.display}`);
                    break;
                case 'sold':
                    logger.debug('Contract sold');
                    break;
                default:
                    logger.debug(`Contract status: ${status}`);
            }
        });
    }

    /**
     * Executes the contract purchase
     * @param {ContractResponse} contract - Contract to purchase
     * @returns {Promise<void>}
     * @private
     */
    private async buyContract(contract: ContractResponse): Promise<void> {
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
                () => reject(new Error('Contract purchase timed out')),
                this.connectionTimeout
            )
        );

        await Promise.race([contract.buy(), timeoutPromise]);
    }

    /**
     * Waits for contract completion
     * @param {ContractResponse} contract - Contract to wait for
     * @returns {Promise<any>} Completed contract data
     * @private
     */
    private async waitForContractCompletion(contract: ContractResponse): Promise<any> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Contract completion timed out'));
            }, this.connectionTimeout);

            contract.onUpdate()
                .pipe()
                .subscribe({
                    next: (update: any) => {
                        if (update.is_sold) {
                            clearTimeout(timeout);
                            resolve(update);
                        }
                    },
                    error: (err: Error) => {
                        clearTimeout(timeout);
                        reject(err);
                    }
                });
        });
    }

    /**
     * Transforms contract response to standardized trade data
     * @param {any} contract - Completed contract data
     * @returns {ITradeData} Standardized trade data
     * @private
     */
    private transformContractToTradeData(contract: any): ITradeData {
        return {
            symbol_short: contract.symbol?.short || '',
            symbol_full: contract.symbol?.full || '',
            start_time: contract.start_time?._data?.internal?.$d?.getTime() / 1000 || 0,
            expiry_time: contract.expiry_time?._data?.internal?.$d?.getTime() / 1000 || 0,
            purchase_time: contract.purchase_time?._data?.internal?.$d?.getTime() / 1000 || 0,
            entry_spot_value: contract.entry_spot?._data?.value || 0,
            entry_spot_time: contract.entry_spot?._data?.time?._data?.internal?.$d?.getTime() / 1000 || 0,
            exit_spot_value: contract.exit_spot?._data?.value || contract.sell_spot?._data?.value || 0,
            exit_spot_time: contract.exit_spot?._data?.time?._data?.internal?.$d?.getTime() / 1000 || 0,
            ask_price_currency: contract.ask_price?._data?.currency || '',
            ask_price_value: contract.ask_price?._data?.value || 0,
            buy_price_currency: contract.buy_price?._data?.currency || '',
            buy_price_value: contract.buy_price?._data?.value || 0,
            buy_transaction: contract.buy_transaction,
            bid_price_currency: contract.bid_price?._data?.currency || '',
            bid_price_value: contract.bid_price?._data?.value || 0,
            sell_price_currency: contract.sell_price?._data?.currency || '',
            sell_price_value: contract.sell_price?._data?.value || 0,
            sell_spot: contract.sell_spot?._data?.value || 0,
            sell_spot_time: contract.sell_spot?._data?.time?._data?.internal?.$d?.getTime() / 1000 || 0,
            sell_transaction: contract.sell_transaction,
            payout: contract.payout?.value || 0,
            payout_currency: contract.payout?.currency || '',
            profit_value: contract.profit?._data?.value || 0,
            profit_currency: contract.payout?.currency || '',
            profit_percentage: contract.profit?._data?.percentage || 0,
            profit_is_win: contract.profit?._data?.is_win || false,
            profit_sign: contract.profit?._data?.sign || 0,
            status: contract.status || '',
            longcode: contract.longcode || '',
            proposal_id: contract.proposal_id,
            balance_currency: '', // Will be populated by caller
            balance_value: '', // Will be populated by caller
            audit_details: contract.audit_details?.all_ticks,
            ticks: contract.ticks?.[0]
        };
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