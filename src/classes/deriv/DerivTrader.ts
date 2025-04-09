
import { DerivUserAccount, IDerivUserAccount } from "@/classes/deriv/DerivUserAccountClass";

import { pino } from "pino";

import { env } from "@/common/utils/envConfig";

import { CONSTANTS } from "@/common/utils/constants";

import { parseTimeToSeconds } from "@/common/utils/snippets";

import { ITradeData, TradeData } from "@/classes/deriv/TradingDataClass";

const { parentPort } = require("node:worker_threads");

global.WebSocket = require("ws");
const { find } = require("rxjs/operators");
const DerivAPI = require("@deriv/deriv-api/dist/DerivAPI");

const jsan = require("jsan");

const logger = pino({ name: "DerivTradingBot" });

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

// ==============================
// INTERFACES AND TYPES
// ==============================

/**
 * Represents the configuration for the trading bot
 */
interface BotConfig {
    tradingType?: TradingType;
    defaultMarket?: MarketType;
    baseStake?: number;
    maxStake?: number;
    minStake?: number;
    maxRecoveryTrades?: number;
    takeProfit?: number;
    stopLoss?: number;
    contractDuration?: number;
    contractDurationUnit?: string;
    userAccountToken?: string;
}

/**
 * Represents a monetary value with currency information
 */
interface Monetary {
    value: number;
    currency: string;
    display: string;
    format: string;
}

/**
 * Represents a custom date with epoch and milliseconds
 */
interface CustomDate {
    epoch: number;
    epoch_milliseconds: number;
    date: Date;
}

/**
 * Represents spot price information
 */
interface Spot {
    value?: number;
    pip?: number;
    pip_size?: number;
    pip_sized?: number;
    time?: CustomDate;
}

/**
 * Represents tick data
 */
interface Tick {
    time: number | string;
    epoch: number | string;
    quote: number;
    ask: number;
    bid: number;
}

/**
 * Represents market value information
 */
interface MarketValue {
    value?: number;
    pip?: number;
    pip_size?: number;
    pip_sized?: number;
    display?: number;
}

/**
 * Represents profit information
 */
interface Profit {
    percentage?: number;
    value?: number;
    sign?: number;
    is_win?: boolean;
    currency?: string;
    display?: string;
    format?: string;
}

/**
 * Represents contract properties
 */
interface ContractProps {
    status: string;
    ask_price: Monetary;
    type: string;
    payout: Monetary;
    longcode: string;
    symbol: string;
    currency: string;
    current_spot: Spot;
    start_time: CustomDate;
    buy_price?: Monetary;
    bid_price?: Monetary;
    sell_price?: Monetary;
    profit?: Profit;
    proposal_id?: number;
    id?: number;
    purchase_time?: CustomDate;
    expiry_time?: CustomDate;
    sell_time?: CustomDate;
    barrier_count?: number;
    high_barrier?: MarketValue;
    low_barrier?: MarketValue;
    barrier?: MarketValue;
    tick_count?: number;
    ticks?: Array<Tick>;
    multiplier?: number;
    shortcode?: string;
    validation_error?: string;
    is_forward_starting?: boolean;
    is_intraday?: boolean;
    is_path_dependent?: boolean;
    is_valid_to_sell?: boolean;
    is_expired?: boolean;
    is_settleable?: boolean;
    is_open?: boolean;
    entry_spot?: Spot;
    exit_spot?: Spot;
    audit_details?: any;
    code?: string;
}

/**
 * Represents contract parameters
 */
interface ContractParams {
    proposal?: number;
    contract_type?: string;
    amount?: number | string;
    barrier?: number | string;
    barrier2?: string;
    expiry_time?: number | Date;
    start_time?: number | Date;
    currency?: string;
    symbol?: string;
    basis?: string;
    duration?: number | string;
    duration_unit?: string;
    product_type?: string;
}

/**
 * Represents a contract response
 */
interface ContractResponse {
    symbol: any;
    start_time: any;
    expiry_time: any;
    purchase_time: any;
    entry_spot: any;
    exit_spot: any;
    ask_price: any;
    buy_price: any;
    buy_transaction: any;
    bid_price: any;
    sell_price: any;
    sell_spot: any;
    sell_transaction: any;
    payout: any;
    profit: any;
    status: any;
    longcode: any;
    proposal_id: any;
    audit_details: any;
    ticks: any;
    onUpdate: any;
    buy: any;
}

/**
 * Represents trade data
 */
interface ITradeData {
    symbol_short: string;
    symbol_full: string;
    start_time: number;
    expiry_time: number;
    purchase_time: number;
    entry_spot_value: number;
    entry_spot_time: number;
    exit_spot_value: number;
    exit_spot_time: number;
    ask_price_currency: string;
    ask_price_value: number;
    buy_price_currency: string;
    buy_price_value: number;
    buy_transaction: any;
    bid_price_currency: string;
    bid_price_value: number;
    sell_price_currency: string;
    sell_price_value: number;
    sell_spot: number;
    sell_spot_time: number;
    sell_transaction: any;
    payout: number;
    payout_currency: string;
    profit_value: number;
    profit_currency: string;
    profit_percentage: number;
    profit_is_win: boolean;
    profit_sign: number;
    status: string;
    longcode: string;
    proposal_id: number;
    balance_currency: string;
    balance_value: string;
    audit_details: any;
    ticks: any;
}

// ==============================
// ENUMS
// ==============================

/**
 * Enum for purchase types
 */
enum PurchaseType {
    DIGITDIFF = "DIGITDIFF",
    DIGITOVER = "DIGITOVER",
    DIGITUNDER = "DIGITUNDER",
    DIGITUNDER9_DIGITOVER_0 = "DIGITUNDER9_DIGITOVER_0",
    DIGITUNDER8_DIGITOVER_1 = "DIGITUNDER8_DIGITOVER_1",
    DIGITUNDER7_DIGITOVER_2 = "DIGITUNDER7_DIGITOVER_2",
    EVEN = "EVEN",
    ODD = "ODD",
    CALL = "CALL",
    PUT = "PUT",
    ACCU = "ACCU"
}

/**
 * Enum for trading types
 */
enum TradingType {
    FOREX = "FOREX",
    DERIVATIVES = "Derivatives 📊",
    CRYPTO = "CRYPTO",
    COMMODITIES = "COMMODITIES"
}

/**
 * Enum for market types
 */
enum MarketType {
    R_100 = "R_100",
    R_75 = "R_75",
    R_50 = "R_50",
    R_25 = "R_25"
}

// ==============================
// SERVICES
// ==============================

// ==============================
// EVENT TYPES
// ==============================

type ConnectionEvent = 'connect' | 'disconnect' | 'reconnect' | 'error';
type ConnectionEventListener = (event: ConnectionEvent, data?: any) => void;

// ==============================
// API SERVICE WITH RECONNECT LOGIC
// ==============================

class DerivAPIService {
    private api: any;
    private pingIntervalID?: NodeJS.Timeout;
    private retryCount: number = 0;
    private maxRetries: number = 5;
    private baseDelay: number = 1000; // 1 second base delay
    private isConnected: boolean = false;
    private listeners: ConnectionEventListener[] = [];
    private connectionParams: {
        endpoint: string;
        appId: string;
        lang: string;
        token?: string;
    };

    constructor(
        endpoint: string,
        appId: string,
        lang: string,
        options?: { maxRetries?: number; baseDelay?: number }
    ) {
        this.connectionParams = { endpoint, appId, lang };
        this.maxRetries = options?.maxRetries ?? this.maxRetries;
        this.baseDelay = options?.baseDelay ?? this.baseDelay;

        // Setup automatic reconnection on close
        this.setupConnectionMonitoring();
    }

    /**
     * Adds an event listener
     */
    on(event: ConnectionEvent, listener: ConnectionEventListener): void {
        this.listeners.push(listener);
    }

    /**
     * Removes an event listener
     */
    off(event: ConnectionEvent, listener: ConnectionEventListener): void {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    /**
     * Emits an event to all listeners
     */
    private emit(event: ConnectionEvent, data?: any): void {
        this.listeners.forEach(listener => listener(event, data));
    }

    /**
     * Sets up connection monitoring
     */
    private setupConnectionMonitoring(): void {
        if (typeof this.api?.connection?.on === 'function') {
            this.api.connection.on('close', () => {
                this.handleDisconnection();
            });
        }
    }

    /**
     * Handles disconnection and initiates reconnection
     */
    private handleDisconnection(): void {
        if (this.isConnected) {
            this.isConnected = false;
            this.emit('disconnect');
            this.attemptReconnection();
        }
    }

    /**
     * Attempts to reconnect with exponential backoff
     */
    private async attemptReconnection(): Promise<void> {
        if (this.retryCount >= this.maxRetries) {
            this.emit('error', {
                message: 'Max reconnection attempts reached',
                retryCount: this.retryCount
            });
            return;
        }

        const delay = this.calculateBackoffDelay();
        this.retryCount++;

        logger.warn(`Attempting reconnection (${this.retryCount}/${this.maxRetries}) in ${delay}ms...`);
        this.emit('reconnect', { attempt: this.retryCount, delay });

        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            await this.connect();
            this.retryCount = 0; // Reset on successful reconnect
        } catch (error) {
            logger.error(`Reconnection attempt ${this.retryCount} failed:`, error);
            this.attemptReconnection(); // Continue retrying
        }
    }

    /**
     * Calculates exponential backoff delay
     */
    private calculateBackoffDelay(): number {
        return Math.min(
            this.baseDelay * Math.pow(2, this.retryCount),
            30000 // Max 30 seconds
        );
    }

    /**
     * Connects to the Deriv API
     */
    async connect(token?: string): Promise<void> {
        try {
            if (token) {
                this.connectionParams.token = token;
            }

            // Clear existing connection if present
            if (this.api) {
                this.disconnect();
            }

            logger.info("Attempt connecting ...");
            this.api = new DerivAPI({
                endpoint: this.connectionParams.endpoint,
                app_id: this.connectionParams.appId,
                lang: this.connectionParams.lang
            });
            logger.info("Attempt connecting : success...");

            logger.info("CXN : #001");


            // Setup connection monitoring
            this.setupConnectionMonitoring();

            logger.info("CXN : #002");

            // Test connection with a ping
            await this.api.basic.ping();

            logger.info("CXN : #003");

            this.isConnected = true;
            this.startPing(1000);

            logger.info("CXN : #004");

            //this.emit('connect');

            logger.info("CXN : #005");

            logger.info("Successfully connected to Deriv API");

        } catch (error) {
            this.isConnected = false;
            this.emit('error', {
                message: 'Initial connection failed',
                error
            });
            throw error;
        }
    }

    /**
     * Starts ping-pong to keep connection alive
     */
    private startPing(interval: number): void {
        this.pingIntervalID = setInterval(async () => {
            try {
                logger.debug(`Send Ping: ${pong.req_id}`);
                const pong = await this.api.basic.ping();
                logger.debug(`Ping-Pong-Received: ${pong.req_id}`);
            } catch (error) {
                logger.error("Ping failed, connection might be down:", error);
                this.handleDisconnection();
            }
        }, interval);
    }

    /**
     * Disconnects from the Deriv API
     */
    disconnect(): void {
        if (this.pingIntervalID) {
            clearInterval(this.pingIntervalID);
            this.pingIntervalID = undefined;
        }

        if (this.api?.disconnect) {
            this.api.disconnect();
        } else {
            this.api = null;
        }

        this.isConnected = false;
        this.emit('disconnect');
        logger.info("Disconnected from Deriv API");
    }

    /**
     * Gets the API instance
     */
    getAPI(): any {
        if (!this.isConnected) {
            throw new Error('API is not connected');
        }
        return this.api;
    }

    /**
     * Checks connection status
     */
    getConnectionStatus(): { isConnected: boolean; retryCount: number } {
        return {
            isConnected: this.isConnected,
            retryCount: this.retryCount
        };
    }
}

/**
 * Service for handling user accounts with account instance reuse
 */
class UserAccountService {

    private accountInstance: any = null;
    private userBalance: any = null;

    constructor(private readonly derivAPIService: DerivAPIService) { }

    /**
     * Initializes and maintains the user account instance
     * @param token - User token
     */
    async initializeAccount(token: string): Promise<any> {
        if (!this.accountInstance) {
            this.accountInstance = await this.derivAPIService.getAPI().account(token);

            // Set up balance updates listener
            this.accountInstance.balance.onUpdate((val: any) => {
                if (val && val._data) {
                    const newBalance: [string, string] = [val._data.currency, val._data.value];
                    logger.info(`Balance updated: ${newBalance[0]} ${newBalance[1]}`);
                    // You could also emit an event here if other parts of the app need to know
                }
            });
        }
        return DerivUserAccount.parseDerivUserAccount(this.accountInstance);
    }

    /**
   * Gets the current balance
   */
    async getBalance(): Promise<void> {
        try {
            this.userBalance = await this.derivAPIService.getAPI().getBalance();
            logger.info(`Current balance: ${this.userBalance[0]} ${this.userBalance[1]}`);
        } catch (error) {
            logger.error("Failed to get balance:", error);
            throw error;
        }
    }

    /**
     * Clears the account instance (for disconnection/logout)
     */
    clearAccount(): void {
        this.accountInstance = null;
    }

}

/**
 * Service for handling trading operations
 */
class TradingService {
    constructor(
        private readonly derivAPIService: DerivAPIService,
        private readonly userAccountService: UserAccountService
    ) { }

    /**
* Purchases a contract based on the provided parameters and returns the trade data.
* This function handles the entire contract purchase process, including proposal creation,
* contract buying, and real-time updates on the contract status.
*
* @param {ContractParams} contractParameters - The parameters for the contract to be purchased.
* @returns {Promise<ITradeData>} - A promise that resolves to the trade data after the contract is purchased and settled.
* @throws {Error} - Throws an error if the contract purchase fails or times out.
*/
    private async purchaseContract(contractParameters: ContractParams): Promise<ITradeData> {
        // Validate the contract parameters to ensure all required fields are present
        if (!contractParameters || !contractParameters.amount || !contractParameters.contract_type) {
            throw new Error("Invalid contract parameters provided.");
        }

        // Log the start of the contract purchase process
        logger.info("Starting contract purchase process...");

        // Initialize the trade data object to store the result of the contract purchase
        let tradeData: ITradeData = {} as ITradeData;

        try {
            // Create a timeout promise to handle cases where the contract creation takes too long
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Contract creation timed out")), CONNECTION_CONTRACT_CREATION_TIMEOUT)
            );

            // Log the attempt to create the contract
            logger.info("Creating contract with parameters:", contractParameters);

            // Create the contract using the Deriv API
            const contractPromise = this.api.basic.contract(contractParameters);

            // Race between the contract creation and the timeout promise
            const contract: ContractResponse = await Promise.race([contractPromise, timeoutPromise]);

            // Log successful contract creation
            logger.info("Contract created successfully.");

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

            // Log the attempt to buy the contract
            logger.info("Attempting to buy the contract...");

            // Buy the contract
            await contract.buy();

            // Log successful contract purchase
            logger.info("Contract purchased successfully.");

            // Wait for the contract to be sold (i.e., the trade is completed)
            await contract.onUpdate()
                .pipe(find(({ is_sold }: any) => is_sold))
                .toPromise();

            // Unsubscribe from contract updates to clean up resources
            onUpdateSubscription.unsubscribe();

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
            tradeData = {
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
                balance_currency: this.userBalance[0],
                balance_value: this.userBalance[1],
                audit_details: audit_details.all_ticks,
                ticks: ticks[0]
            };

            // Log the trade data for auditing purposes
            logger.info("Trade data successfully extracted:", tradeData);

            // Return the trade data
            return tradeData;

        } catch (error) {
            // Log the error and handle it appropriately
            logger.fatal("Contract purchase failed:", error);

            // Handle the purchase error and rethrow if necessary
            this.handleErrorExemption(error, contractParameters);

            // Return an empty trade data object in case of failure
            return {} as ITradeData;

        }
    }

}

// ==============================
// FACTORIES
// ==============================

/**
 * Factory for creating trade data objects
 */
class TradeDataFactory {
    static createFromContract(contract: ContractResponse): ITradeData {
        return {
            symbol_short: contract.symbol.short,
            symbol_full: contract.symbol.full,
            start_time: contract.start_time._data.internal.$d.getTime() / 1000,
            expiry_time: contract.expiry_time._data.internal.$d.getTime() / 1000,
            purchase_time: contract.purchase_time._data.internal.$d.getTime() / 1000,
            entry_spot_value: contract.entry_spot._data.value,
            entry_spot_time: contract.entry_spot._data.time._data.internal.$d.getTime() / 1000,
            exit_spot_value: contract.exit_spot._data.value || sell_spot._data.value,
            exit_spot_time: contract.exit_spot._data.time._data.internal.$d.getTime() / 1000,
            ask_price_currency: contract.ask_price._data.currency,
            ask_price_value: contract.ask_price._data.value,
            buy_price_currency: contract.buy_price._data.currency,
            buy_price_value: contract.buy_price._data.value,
            buy_transaction: contract.buy_transaction,
            bid_price_currency: contract.bid_price._data.currency,
            bid_price_value: contract.bid_price._data.value,
            sell_price_currency: contract.sell_price._data.currency,
            sell_price_value: contract.sell_price._data.value,
            sell_spot: contract.sell_spot._data.value,
            sell_spot_time: contract.sell_spot._data.time._data.internal.$d.getTime() / 1000,
            sell_transaction: contract.sell_transaction,
            payout: contract.payout.value,
            payout_currency: contract.payout.currency,
            profit_value: contract.profit._data.value,
            profit_currency: contract.payout.currency,
            profit_percentage: contract.profit._data.percentage,
            profit_is_win: contract.profit._data.is_win,
            profit_sign: contract.profit._data.sign,
            status: contract.status,
            longcode: contract.longcode,
            proposal_id: contract.proposal_id,
            balance_currency: this.userBalance[0],
            balance_value: this.userBalance[1],
            audit_details: contract.audit_details.all_ticks,
            ticks: contract.ticks[0]
        } as ITradeData;
    }
}

/**
 * Factory for creating contract parameters
 */
class ContractParamsFactory {
    static createDigitDiffParams(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string,
        predictedDigit: number
    ): ContractParams {
        return {
            amount: stake,
            basis: "stake",
            contract_type: "DIGITDIFF",
            currency: currency,
            duration: duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: predictedDigit.toString()
        };
    }

    static createDigitOverParams(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string,
        barrier: number
    ): ContractParams {
        return {
            amount: stake,
            basis: "stake",
            contract_type: "DIGITOVER",
            currency: currency,
            duration: duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: barrier.toString()
        };
    }

    static createDigitUnderParams(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string,
        barrier: number
    ): ContractParams {
        return {
            amount: stake,
            basis: "stake",
            contract_type: "DIGITUNDER",
            currency: currency,
            duration: duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: barrier.toString()
        };
    }

    static createDigitEvenParams(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string
    ): ContractParams {
        return {
            amount: stake,
            basis: "stake",
            contract_type: "DIGITEVEN",
            currency: currency,
            duration: duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: "EVEN"
        };
    }

    static createDigitOddParams(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string
    ): ContractParams {
        return {
            amount: stake,
            basis: "stake",
            contract_type: "DIGITODD",
            currency: currency,
            duration: duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: "ODD"
        };
    }

    // Specific digit methods
    static createDigitOver0Params(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string
    ): ContractParams {
        return this.createDigitOverParams(stake, currency, duration, durationUnit, market, 0);
    }

    static createDigitOver1Params(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string
    ): ContractParams {
        return this.createDigitOverParams(stake, currency, duration, durationUnit, market, 1);
    }

    static createDigitOver2Params(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string
    ): ContractParams {
        return this.createDigitOverParams(stake, currency, duration, durationUnit, market, 2);
    }

    static createDigitUnder9Params(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string
    ): ContractParams {
        return this.createDigitUnderParams(stake, currency, duration, durationUnit, market, 9);
    }

    static createDigitUnder8Params(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string
    ): ContractParams {
        return this.createDigitUnderParams(stake, currency, duration, durationUnit, market, 8);
    }

    static createDigitUnder7Params(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string
    ): ContractParams {
        return this.createDigitUnderParams(stake, currency, duration, durationUnit, market, 7);
    }

    // Special case for recovery trade
    static createRecoveryDigitUnderParams(
        stake: number,
        currency: string,
        duration: number,
        durationUnit: string,
        market: string,
        barrier: number
    ): ContractParams {
        return {
            amount: stake * 12.37345, // Recovery multiplier
            basis: "stake",
            contract_type: "DIGITUNDER",
            currency: currency,
            duration: duration,
            duration_unit: durationUnit,
            symbol: market,
            barrier: barrier.toString()
        };
    }
}

// ==============================
// MAIN BOT CLASS (REFACTORED)
// ==============================

class DerivAutoTradingBot {
    private readonly derivAPIService: DerivAPIService;
    private readonly userAccountService: UserAccountService;
    private readonly tradingService: TradingService;

    private auditTrail: Array<any> = [];
    private cachedSession: any = null;

    // Trading state
    private tradingType: TradingType = TradingType.DERIVATIVES;
    private defaultMarket: MarketType = MarketType.R_100;
    private currentStake: number = 0;
    private baseStake: number = 0;
    private maxStake: number = 0;
    private minStake: number = 0;
    private maxRecoveryTrades: number = 0;
    private currentRecoveryTradeIndex: number = 0;
    private profit: number = 0;
    private isTrading: boolean = false;
    private takeProfit: number = 0;
    private totalStake: number = 0;
    private totalPayout: number = 0;
    private stopLoss: number = 0;
    private consecutiveTrades: number = 0;
    private profitPercentage: number = 0;
    private originalPurchaseType: PurchaseType = PurchaseType.CALL;
    private currentPurchaseType: PurchaseType = PurchaseType.CALL;

    // Statistics
    private cumulativeLossAmount: number = 0;
    private cumulativeLosses: number = 0;
    private numberOfWins: number = 0;
    private numberOfLosses: number = 0;
    private totalNumberOfRuns: number = 0;

    // Timing
    private tradeStartedAt: number = 0;
    private tradeDuration: number = 0;
    private updateFrequency: number = 0;

    // Market data
    private lastTick: string = "";
    private lastDigit: number = 0;
    private lastDigitsArray: [number] = [0];

    // Contract settings
    private contractDuration: number = 1;
    private contractDurationUnit: string = "t";

    // User data
    private userAccount: IDerivUserAccount = {} as IDerivUserAccount;
    private userAccountToken: string = "";
    private userBalance: [string, string] = ["", ""];

    constructor(config: BotConfig = {}) {
        // Initialize services
        this.derivAPIService = new DerivAPIService(
            env.DERIV_APP_ENDPOINT_DOMAIN,
            env.DERIV_APP_ENDPOINT_APP_ID,
            env.DERIV_APP_ENDPOINT_LANG
        );

        this.userAccountService = new UserAccountService(this.derivAPIService);
        this.tradingService = new TradingService(
            this.derivAPIService,
            this.userAccountService
        );

        // Initialize state
        this.resetState(config);

        // Connect to Deriv servers
        setTimeout(() => {
            this.connect(() => this.setAccount());
        }, 1000);
    }

    /**
     * Resets the bot state
     * @param config - Configuration to override defaults
     */
    private resetState(config: Partial<BotConfig> = {}): void {
        const mergedConfig: BotConfig = { ...this.botConfig, ...config };

        // Reset all state properties
        this.currentStake = mergedConfig.baseStake || env.MIN_STAKE;
        this.baseStake = mergedConfig.baseStake || env.MIN_STAKE;
        this.maxStake = mergedConfig.maxStake || env.MAX_STAKE;
        this.minStake = mergedConfig.minStake || env.MIN_STAKE;
        this.maxRecoveryTrades = mergedConfig.maxRecoveryTrades || env.MAX_RECOVERY_TRADES_X2;
        this.contractDuration = mergedConfig.contractDuration || 1;
        this.contractDurationUnit = mergedConfig.contractDurationUnit || "t";
        this.userAccountToken = mergedConfig.userAccountToken || env.DERIV_APP_TOKEN;

        // Reset other state variables
        this.currentRecoveryTradeIndex = 0;
        this.profit = 0;
        this.isTrading = false;
        this.takeProfit = mergedConfig.takeProfit || 0;
        this.totalStake = 0;
        this.totalPayout = 0;
        this.stopLoss = mergedConfig.stopLoss || 0;
        this.consecutiveTrades = 0;
        this.profitPercentage = 0;
        this.originalPurchaseType = PurchaseType.CALL;
        this.currentPurchaseType = PurchaseType.CALL;
        this.cumulativeLossAmount = 0;
        this.cumulativeLosses = 0;
        this.numberOfWins = 0;
        this.numberOfLosses = 0;
        this.totalNumberOfRuns = 0;
        this.tradeStartedAt = 0;
        this.tradeDuration = 0;
        this.updateFrequency = 0;
        this.lastTick = "";
        this.lastDigit = 0;
        this.lastDigitsArray = [0];
        this.userAccount = {} as IDerivUserAccount;
        this.userBalance = ["", ""];
    }

    /**
     * Connects to Deriv API
     * @param callback - Optional callback after connection
     */
    private async connect(callback?: () => void): Promise<void> {
        logger.info("Connecting...");
        parentPort.postMessage({
            action: "sendTelegramMessage",
            text: "🟡 Establishing connection to Deriv server...",
            meta: {}
        });

        await this.derivAPIService.connect();
        logger.info("Connected!");
        parentPort.postMessage({
            action: "sendTelegramMessage",
            text: "🟢 Connection to Deriv server established!",
            meta: {}
        });
        this.derivAPIService.startPing(env.CONNECTION_PING_TIMEOUT);

        if (typeof callback === "function") {
            await callback();
        }
    }

    /**
     * Sets up the user account
     * @param token - Optional user token
     */
    public async setAccount(token?: string): Promise<IDerivUserAccount> {
        const userToken = token || this.userAccountToken;

        try {
            this.userAccount = await this.userAccountService.initializeAccount(userToken);
            this.userBalance = await this.userAccountService.getBalance(userToken);

            logger.info(`Welcome, ${this.userAccount.fullname}`);
            logger.info(`Balance: ${this.userBalance[0]} ${this.userBalance[1]}`);

            return this.userAccount;
        } catch (error) {
            logger.error("Failed to initialize user account:", error);
            throw error;
        }
    }

    // Sleep function (private)
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Purchase a contract (private)
    private async purchaseNextContract(
        purchaseType: any
    ): Promise<ITradeData> {

        let response: ITradeData = {} as ITradeData;

        if (this.tradingType === CONSTANTS.TRADING_TYPES.FOREX) {
        }

        if (this.tradingType === CONSTANTS.TRADING_TYPES.COMMODITIES) {
        }

        if (this.tradingType === CONSTANTS.TRADING_TYPES.CRYPTO) {
        }

        if (this.tradingType === CONSTANTS.TRADING_TYPES.DERIVATIVES) {

            switch (purchaseType) {

                case CONSTANTS.PURCHASE_TYPES.DERIVATIVES[0][0]: {
                    response = await this.purchaseAuto();
                    break;
                }

                case CONSTANTS.PURCHASE_TYPES.DERIVATIVES[0][1]: {
                    response = await this.purchaseCall();
                    break;
                }

                case CONSTANTS.PURCHASE_TYPES.DERIVATIVES[0][2]: {
                    response = await this.purchasePut();
                    break;
                }

                case CONSTANTS.PURCHASE_TYPES.DERIVATIVES[1][0]: {
                    response = await this.purchaseDigitAuto();
                    break;
                }

                case CONSTANTS.PURCHASE_TYPES.DERIVATIVES[1][1]: {
                    response = await this.purchaseDigitEven();
                    break;
                }

                case CONSTANTS.PURCHASE_TYPES.DERIVATIVES[1][2]: {
                    response = await this.purchaseDigitOdd();
                    break;
                }

                case CONSTANTS.PURCHASE_TYPES.DERIVATIVES[2][0]: {
                    response = await this.purchaseDigitUnder9();

                    break;
                }

                case CONSTANTS.PURCHASE_TYPES.DERIVATIVES[2][1]: {
                    response = await this.purchaseDigitUnder8();
                    break;
                }

                case CONSTANTS.PURCHASE_TYPES.DERIVATIVES[3][0]: {
                    response = await this.purchaseDigitUnder7();
                    break;
                }

                case CONSTANTS.PURCHASE_TYPES.DERIVATIVES[3][1]: {
                    response = await this.purchaseDigitUnder(6);
                    break;
                }

                case CONSTANTS.PURCHASE_TYPES.DERIVATIVES[4][0]: {
                    response = await this.purchaseDigitOver0();
                    break;
                }

                case CONSTANTS.PURCHASE_TYPES.DERIVATIVES[4][1]: {
                    response = await this.purchaseDigitOver1();
                    break;
                }

                case CONSTANTS.PURCHASE_TYPES.DERIVATIVES[5][0]: {
                    response = await this.purchaseDigitOver2();
                    break;
                }

                case CONSTANTS.PURCHASE_TYPES.DERIVATIVES[5][1]: {
                    response = await this.purchaseDigitOver(3);
                    break;
                }

                case CONSTANTS.PURCHASE_TYPES.DERIVATIVES[6][0]: {
                    response = await this.purchaseDigitDiff(this.getDigitNotLast());
                    break;
                }

                case CONSTANTS.PURCHASE_TYPES.DERIVATIVES[6][1]: {
                    response = await this.purchaseDigitDiff(this.getDigitRandom());
                    break;
                }

                default: {
                    response = await this.purchaseDigitDiff(this.getDigitRandom());
                    break;
                }
            }
        }

        return response;

    }

    private getDigitRandom(): number {
        return 1;
    }

    private getDigitNotLast(): number {
        return 1;
    }

    /**
   * Purchases a contract based on the provided parameters and returns the trade data.
   * This function handles the entire contract purchase process, including proposal creation,
   * contract buying, and real-time updates on the contract status.
   *
   * @param {ContractParams} contractParameters - The parameters for the contract to be purchased.
   * @returns {Promise<ITradeData>} - A promise that resolves to the trade data after the contract is purchased and settled.
   * @throws {Error} - Throws an error if the contract purchase fails or times out.
   */
    private async purchaseContract(contractParameters: ContractParams): Promise<ITradeData> {
        // Validate the contract parameters to ensure all required fields are present
        if (!contractParameters || !contractParameters.amount || !contractParameters.contract_type) {
            throw new Error("Invalid contract parameters provided.");
        }

        // Log the start of the contract purchase process
        logger.info("Starting contract purchase process...");

        // Initialize the trade data object to store the result of the contract purchase
        let tradeData: ITradeData = {} as ITradeData;

        try {
            // Create a timeout promise to handle cases where the contract creation takes too long
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Contract creation timed out")), CONNECTION_CONTRACT_CREATION_TIMEOUT)
            );

            // Log the attempt to create the contract
            logger.info("Creating contract with parameters:", contractParameters);

            // Create the contract using the Deriv API
            const contractPromise = this.api.basic.contract(contractParameters);

            // Race between the contract creation and the timeout promise
            const contract: ContractResponse = await Promise.race([contractPromise, timeoutPromise]);

            // Log successful contract creation
            logger.info("Contract created successfully.");

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

            // Log the attempt to buy the contract
            logger.info("Attempting to buy the contract...");

            // Buy the contract
            await contract.buy();

            // Log successful contract purchase
            logger.info("Contract purchased successfully.");

            // Wait for the contract to be sold (i.e., the trade is completed)
            await contract.onUpdate()
                .pipe(find(({ is_sold }: any) => is_sold))
                .toPromise();

            // Unsubscribe from contract updates to clean up resources
            onUpdateSubscription.unsubscribe();

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
            tradeData = {
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
                balance_currency: this.userBalance[0],
                balance_value: this.userBalance[1],
                audit_details: audit_details.all_ticks,
                ticks: ticks[0]
            };

            // Log the trade data for auditing purposes
            logger.info("Trade data successfully extracted:", tradeData);

            // Return the trade data
            return tradeData;

        } catch (error) {
            // Log the error and handle it appropriately
            logger.fatal("Contract purchase failed:", error);

            // Handle the purchase error and rethrow if necessary
            this.handleErrorExemption(error, contractParameters);

            // Return an empty trade data object in case of failure
            return {} as ITradeData;

        }
    }

    // Purchase DIGIT DIFF contract (private)
    private async purchaseDigitDiff(predictedDigit: number): Promise<ITradeData> {
        const { currency } = this.userAccount;

        const contractParameters = this.constructor.createDigitDiffParams(
            this.currentStake,
            currency || "USD",
            this.contractDuration,
            this.contractDurationUnit,
            this.defaultMarket,
            predictedDigit
        );

        this.profitPercentage = this.calculateProfitPercentage(
            PurchaseType.DIGITDIFF,
            this.currentStake
        );

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT OVER contract (private)
    private async purchaseDigitOver(barrier: number): Promise<ITradeData> {
        const { currency } = this.userAccount;

        const contractParameters = this.constructor.createDigitOverParams(
            this.currentStake,
            currency || "USD",
            this.contractDuration,
            this.contractDurationUnit,
            this.defaultMarket,
            barrier
        );

        this.profitPercentage = this.calculateProfitPercentage(
            PurchaseType.DIGITOVER,
            this.currentStake
        );

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT OVER 0 contract (private)
    private async purchaseDigitOver0(): Promise<ITradeData> {
        const { currency } = this.userAccount;

        const contractParameters = this.constructor.createDigitOver0Params(
            this.currentStake,
            currency || "USD",
            this.contractDuration,
            this.contractDurationUnit,
            this.defaultMarket
        );

        this.profitPercentage = this.calculateProfitPercentage(
            PurchaseType.DIGITUNDER9_DIGITOVER_0,
            this.currentStake
        );

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT OVER 1 contract (private)
    private async purchaseDigitOver1(): Promise<ITradeData> {
        const { currency } = this.userAccount;

        const contractParameters = this.constructor.createDigitOver1Params(
            this.currentStake,
            currency || "USD",
            this.contractDuration,
            this.contractDurationUnit,
            this.defaultMarket
        );

        this.profitPercentage = this.calculateProfitPercentage(
            PurchaseType.DIGITUNDER8_DIGITOVER_1,
            this.currentStake
        );

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT OVER 2 contract (private)
    private async purchaseDigitOver2(): Promise<ITradeData> {
        const { currency } = this.userAccount;

        const contractParameters = this.constructor.createDigitOver2Params(
            this.currentStake,
            currency || "USD",
            this.contractDuration,
            this.contractDurationUnit,
            this.defaultMarket
        );

        this.profitPercentage = this.calculateProfitPercentage(
            PurchaseType.DIGITUNDER7_DIGITOVER_2,
            this.currentStake
        );

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT UNDER contract (private)
    private async purchaseDigitUnder(barrier: number): Promise<ITradeData> {
        const { currency } = this.userAccount;

        const contractParameters = this.constructor.createDigitUnderParams(
            this.currentStake,
            currency || "USD",
            this.contractDuration,
            this.contractDurationUnit,
            this.defaultMarket,
            barrier
        );

        this.profitPercentage = this.calculateProfitPercentage(
            PurchaseType.DIGITUNDER,
            this.currentStake
        );

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT UNDER 9 contract (private)
    private async purchaseDigitUnder9(isRecoveryTrade = false): Promise<ITradeData> {
        const { currency } = this.userAccount;

        const contractParameters = isRecoveryTrade
            ? this.constructor.createRecoveryDigitUnderParams(
                this.currentStake,
                currency || "USD",
                this.contractDuration,
                this.contractDurationUnit,
                "R_100", // Special market for recovery
                6 // Special barrier for recovery
            )
            : this.constructor.createDigitUnder9Params(
                this.currentStake,
                currency || "USD",
                this.contractDuration,
                this.contractDurationUnit,
                this.defaultMarket
            );

        this.profitPercentage = this.calculateProfitPercentage(
            PurchaseType.DIGITUNDER9_DIGITOVER_0,
            this.currentStake
        );

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT UNDER 8 contract (private)
    private async purchaseDigitUnder8(): Promise<ITradeData> {
        const { currency } = this.userAccount;

        const contractParameters = this.constructor.createDigitUnder8Params(
            this.currentStake,
            currency || "USD",
            this.contractDuration,
            this.contractDurationUnit,
            this.defaultMarket
        );

        this.profitPercentage = this.calculateProfitPercentage(
            PurchaseType.DIGITUNDER8_DIGITOVER_1,
            this.currentStake
        );

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT UNDER 7 contract (private)
    private async purchaseDigitUnder7(): Promise<ITradeData> {
        const { currency } = this.userAccount;

        const contractParameters = this.constructor.createDigitUnder7Params(
            this.currentStake,
            currency || "USD",
            this.contractDuration,
            this.contractDurationUnit,
            this.defaultMarket
        );

        this.profitPercentage = this.calculateProfitPercentage(
            PurchaseType.DIGITUNDER7_DIGITOVER_2,
            this.currentStake
        );

        return this.purchaseContract(contractParameters);
    }

    // Purchase PUT / CALL contract (private)
    private async purchaseAuto(): Promise<ITradeData> {
        const { currency } = this.userAccount;

        const contractParameters = this.constructor.createDigitEvenParams(
            this.currentStake,
            currency || "USD",
            this.contractDuration,
            this.contractDurationUnit,
            this.defaultMarket
        );

        this.profitPercentage = this.calculateProfitPercentage(
            PurchaseType.EVEN,
            this.currentStake
        );

        return this.purchaseContract(contractParameters);
    }

    // Purchase PUT / CALL contract (private)
    private async purchaseCall(): Promise<ITradeData> {
        return this.purchaseAuto(); // Same as purchaseAuto
    }

    // Purchase PUT / CALL contract (private)
    private async purchasePut(): Promise<ITradeData> {
        return this.purchaseAuto(); // Same as purchaseAuto
    }

    // Purchase DIGIT EVEN / ODD contract (private)
    private async purchaseDigitAuto(): Promise<ITradeData> {
        return this.purchaseAuto(); // Same as purchaseAuto
    }

    // Purchase DIGIT EVEN contract (private)
    private async purchaseDigitEven(): Promise<ITradeData> {
        return this.purchaseAuto(); // Same as purchaseAuto
    }

    // Purchase DIGIT ODD contract (private)
    private async purchaseDigitOdd(): Promise<ITradeData> {
        const { currency } = this.userAccount;

        const contractParameters = this.constructor.createDigitOddParams(
            this.currentStake,
            currency || "USD",
            this.contractDuration,
            this.contractDurationUnit,
            this.defaultMarket
        );

        this.profitPercentage = this.calculateProfitPercentage(
            PurchaseType.ODD,
            this.currentStake
        );

        return this.purchaseContract(contractParameters);
    }

    // Calculate profit percentage based on purchase type and prediction (private)
    private calculateProfitPercentage(
        purchaseType: PurchaseType | string,
        stake: number
    ): number {
        let rewardPercentage = 0;

        // Define the reward percentages for Even
        const evenRewards = [
            { stake: 0.35, reward: 0.8857 },
            { stake: 0.5, reward: 0.92 },
            { stake: 0.75, reward: 0.9467 },
            { stake: 1, reward: 0.95 },
            { stake: 2, reward: 0.955 },
            { stake: 3, reward: 0.9533 },
            { stake: 4, reward: 0.9525 },
            { stake: 5, reward: 0.954 },
        ];

        // Define the reward percentages for Digit Differs
        const digitDiffersRewards = [
            { stake: 0.35, reward: 0.0571 },
            { stake: 0.5, reward: 0.06 },
            { stake: 0.75, reward: 0.08 },
            { stake: 1, reward: 0.09 },
            { stake: 2, reward: 0.095 },
            { stake: 3, reward: 0.0967 },
            { stake: 4, reward: 0.0975 },
            { stake: 5, reward: 0.0967 },
        ];

        // Define the rewards for Digit Over/Under conditions
        const digitOverUnderRewards = [
            { stake: 0.35, reward: 0.0571 },
            { stake: 0.5, reward: 0.06 },
            { stake: 0.75, reward: 0.08 },
            { stake: 1, reward: 0.09 },
            { stake: 2, reward: 0.095 },
            { stake: 3, reward: 0.0967 },
            { stake: 4, reward: 0.0975 },
            { stake: 5, reward: 0.0967 },
        ];

        const digitOver1Under8Rewards = [
            { stake: 0.35, reward: 0.1714 },
            { stake: 0.5, reward: 0.2 },
            { stake: 0.75, reward: 0.2133 },
            { stake: 1, reward: 0.23 },
            { stake: 2, reward: 0.23 },
            { stake: 3, reward: 0.23 },
            { stake: 4, reward: 0.2325 },
            { stake: 5, reward: 0.232 },
        ];

        const digitOver2Under7Rewards = [
            { stake: 0.35, reward: 0.3429 },
            { stake: 0.5, reward: 0.38 },
            { stake: 0.75, reward: 0.3867 },
            { stake: 1, reward: 0.4 },
            { stake: 2, reward: 0.405 },
            { stake: 3, reward: 0.4033 },
            { stake: 4, reward: 0.405 },
            { stake: 5, reward: 0.404 },
        ];

        // Determine the appropriate rewards based on purchaseType and stakes
        if (
            purchaseType === PurchaseTypeEnum.DigitEven ||
            purchaseType === PurchaseTypeEnum.DigitOdd
        ) {
            if (stake < evenRewards[evenRewards.length - 1].stake) {
                for (const entry of evenRewards) {
                    if (stake < entry.stake) {
                        break;
                    }
                    rewardPercentage = entry.reward;
                }
                return rewardPercentage * 100; // Return percentage as a whole number
            } else {
                return evenRewards[evenRewards.length - 1].reward * 100; // Return percentage as a whole number
            }
        }

        if (purchaseType === PurchaseTypeEnum.DigitDiff) {
            if (stake < digitDiffersRewards[digitDiffersRewards.length - 1].stake) {
                for (const entry of digitDiffersRewards) {
                    if (stake < entry.stake) {
                        break;
                    }
                    rewardPercentage = entry.reward;
                }
                return rewardPercentage * 100; // Return percentage as a whole number
            } else {
                return digitDiffersRewards[digitDiffersRewards.length - 1].reward * 100; // Return percentage as a whole number
            }
        }

        if (purchaseType === PurchaseTypeEnum.DigitOver0Under9) {
            if (
                stake < digitOverUnderRewards[digitOverUnderRewards.length - 1].stake
            ) {
                for (const entry of digitOverUnderRewards) {
                    if (stake < entry.stake) {
                        break;
                    }
                    rewardPercentage = entry.reward;
                }
                return rewardPercentage * 100; // Return percentage as a whole number
            } else {
                return (
                    digitOverUnderRewards[digitOverUnderRewards.length - 1].reward * 100
                ); // Return percentage as a whole number
            }
        }

        if (purchaseType === PurchaseTypeEnum.DigitOver1Under8) {
            if (
                stake <
                digitOver1Under8Rewards[digitOver1Under8Rewards.length - 1].stake
            ) {
                for (const entry of digitOver1Under8Rewards) {
                    if (stake < entry.stake) {
                        break;
                    }
                    rewardPercentage = entry.reward;
                }
                return rewardPercentage * 100; // Return percentage as a whole number
            } else {
                return (
                    digitOver1Under8Rewards[digitOver1Under8Rewards.length - 1].reward *
                    100
                ); // Return percentage as a whole number
            }
        }

        if (purchaseType === PurchaseTypeEnum.DigitOver2Under7) {
            if (
                stake <
                digitOver2Under7Rewards[digitOver2Under7Rewards.length - 1].stake
            ) {
                for (const entry of digitOver2Under7Rewards) {
                    if (stake < entry.stake) {
                        break;
                    }
                    rewardPercentage = entry.reward;
                }
                return rewardPercentage * 100; // Return percentage as a whole number
            } else {
                return (
                    digitOver2Under7Rewards[digitOver2Under7Rewards.length - 1].reward *
                    100
                ); // Return percentage as a whole number
            }
        }

        return -1; // In case of an unsupported purchase type
    }

    /**
   * Calculates the next trading amount based on the result of the previous trade.
   * If the previous trade was a loss, the next stake is calculated to recover the cumulative losses
   * and ensure profitability. If the previous trade was a win, the stake is reset to the base stake.
   *
   * @param {boolean} resultIsWin - Whether the previous trade was a win.
   * @param {number} profitAfterSale - The profit or loss from the previous trade.
   * @returns {number} - The next stake amount.
   */
    private getTradingAmount(
        resultIsWin: boolean,
        profitAfterSale: number
    ): number {
        // If the previous trade was a win, reset the stake to the base stake
        if (resultIsWin) {
            this.cumulativeLossAmount = 0; // Reset cumulative losses
            this.cumulativeLosses = 0; // Reset the number of consecutive losses
            return this.baseStake; // Return the base stake
        }

        // If the previous trade was a loss, update cumulative losses
        this.cumulativeLossAmount += Math.abs(profitAfterSale); // Add the loss to the cumulative loss amount
        this.cumulativeLosses++; // Increment the number of consecutive losses

        // Calculate the recovery factor based on the profit percentage
        const recoveryFactor = (1 + this.profitPercentage / 100) / (this.profitPercentage / 100);

        // Calculate the next stake to recover cumulative losses and ensure profitability
        let nextStake = this.cumulativeLossAmount * recoveryFactor + this.baseStake;

        // Ensure the stake is within the minimum and maximum limits
        nextStake = this.clampStake(nextStake);

        // Round the stake to 2 decimal places for precision
        return parseFloat(nextStake.toFixed(2));
    }

    /**
     * Ensures that the stake is within the specified minimum and maximum limits.
     * @param {number} stake - The calculated stake amount.
     * @returns {number} - The clamped stake amount.
     */
    private clampStake(stake: number): number {
        return Math.min(Math.max(stake, this.minStake), this.maxStake);
    }

    /**
   * Starts the trading process with recovery logic using recursive scheduling.
   * This function handles the main trading loop, including purchasing contracts,
   * managing recovery trades, and stopping trading based on take profit or stop loss conditions.
   * 
   * @param {any} session - The trading session configuration containing market, purchaseType, stake, etc.
   * @param {boolean} retryAfterError - Whether this is a retry after an error occurred.
   * @returns {Promise<void>} - Resolves when trading is stopped.
   */
    async startTrading(session: any, retryAfterError: boolean = false): Promise<void> {

        // Validate session parameters
        const errorObject = {
            error: {
                code: "InvalidParameters",
                message: "Invalid Parameters",
            },
            msg_type: "",
            meta: { session },
        };

        // Input validation and error handling
        if (retryAfterError && !this.cachedSession) {
            errorObject.error.message = "No cached session available for retry.";
            return this.handleErrorExemption(errorObject, session);
        }

        // Use cached session if retrying after an error
        if (retryAfterError && this.cachedSession) {
            session = this.cachedSession;
        } else {
            this.cachedSession = session; // Cache the session for future retries
        }

        // Destructure session parameters for easier access
        const { market, purchaseType, stake, takeProfit, stopLoss, tradeDuration, updateFrequency } = session;

        if (!market) {
            errorObject.error.message = "Market cannot be empty.";
            return this.handleErrorExemption(errorObject, session);
        }

        if (!purchaseType) {
            errorObject.error.message = "Purchase Type cannot be empty.";
            return this.handleErrorExemption(errorObject, session);
        }

        if (stake <= 0) {
            errorObject.error.message = "Stake must be a positive number.";
            return this.handleErrorExemption(errorObject, session);
        }

        if (takeProfit <= 0) {
            errorObject.error.message = "Take Profit must be a positive number.";
            return this.handleErrorExemption(errorObject, session);
        }

        if (stopLoss <= 0) {
            errorObject.error.message = "Stop Loss must be a positive number.";
            return this.handleErrorExemption(errorObject, session);
        }

        if (tradeDuration === "") {
            errorObject.error.message = "Trade duration must be set.";
            return this.handleErrorExemption(errorObject, session);
        }

        if (updateFrequency === "") {
            errorObject.error.message = "Update frequency must be set.";
            return this.handleErrorExemption(errorObject, session);
        }

        // Initialize trading session if not retrying after an error
        if (!retryAfterError) {
            this.cachedSession = session;
            this.defaultMarket = session.market;
            this.originalPurchaseType = session.purchaseType;
            this.baseStake = session.stake;
            this.currentStake = session.stake;
            this.takeProfit = session.takeProfit;
            this.stopLoss = session.stopLoss;
            this.tradeDuration = this.parseTradeDuration(tradeDuration);
            this.updateFrequency = this.parseUpdateFrequency(updateFrequency);
            this.tradeStartedAt = Date.now() / 1000; // Record the start time of the trade

            // Set a timeout to stop trading after the specified duration
            this.tradeDurationTimeoutID = setTimeout(async () => {
                this.stopTrading(`You have reached your trade duration limit: ${this.tradeDuration}s (${tradeDuration}) `);
            }, this.tradeDuration * 1000);

            this.updateFrequencyTimeIntervalID = setInterval(async () => {
                this.generateTelemetry();
            }, this.updateFrequency * 1000);

        }

        // Start the trading process using recursive scheduling
        this.isTrading = true;

        await this.executeTrade(purchaseType);

    }

    /**
     * Executes a single trade and schedules the next trade if trading is still active.
     * This function is called recursively to avoid using a blocking `while` loop.
     * 
     * @param {string} purchaseType - The type of contract to purchase (e.g., "CALL", "PUT").
     * @returns {Promise<void>} - Resolves when the trade is completed and the next trade is scheduled.
     */
    private async executeTrade(purchaseType: string): Promise<void> {
        // Stop trading if the flag is false or the connection is closed
        if (!this.isTrading || !this.api) {
            return;
        }

        try {
            let response: ITradeData = {} as ITradeData;

            // Purchase the next contract based on the purchase type
            response = await this.purchaseNextContract(purchaseType);

            // Parse and validate the trade data
            const tradeData: TradeData = TradeData.parseTradeData(response);

            const investment: number = tradeData.buy_price_value;
            const profit: number = tradeData.profit_value * tradeData.profit_sign;
            const resultIsWin: boolean = tradeData.profit_is_win;
            const profitAfterSale: number = resultIsWin ? profit : -investment;
            const tradeValid: boolean = profit === profitAfterSale;

            // Update total stake and payout
            this.totalStake += tradeData.buy_price_value;
            this.totalPayout += tradeData.sell_price_value;

            // Update profit
            this.profit += profitAfterSale;

            // Increment the total number of trades
            this.totalNumberOfRuns++;

            // Log trade details
            logger.warn("*******************************************************************************************");
            logger.info(`DEAL: ${tradeData.longcode}`);
            logger.info(`SPOT: ${tradeData.entry_spot_value} -> ${tradeData.exit_spot_value}`);
            logger.info(`BUY : ${tradeData.buy_price_currency} ${tradeData.buy_price_value}`);
            logger.info(`BID : ${tradeData.bid_price_currency} ${tradeData.bid_price_value}`);
            logger.info(`SELL: ${tradeData.sell_price_currency} ${tradeData.sell_price_value} :: Status : ${tradeData.status}`);
            logger.info(`${resultIsWin ? 'WON' : 'LOST'} : ${tradeData.profit_currency} ${tradeData.profit_value * tradeData.profit_sign} :: IS_WIN : ${resultIsWin}`);
            logger.info(`VALIDITY: ${tradeValid} :*: PROFIT: ${[profit]} :*: IS_WIN : ${[resultIsWin]}`);
            logger.warn("*******************************************************************************************");

            // Handle win/loss logic
            if (resultIsWin) {
                this.numberOfWins++;
                this.currentRecoveryTradeIndex = 0; // Reset recovery trades on a win
                this.currentPurchaseType = this.originalPurchaseType; // Reset to original purchase type
            } else {
                this.numberOfLosses++;
                this.currentRecoveryTradeIndex++;

                // Stop trading if max recovery trades reached
                if (this.currentRecoveryTradeIndex >= this.maxRecoveryTrades) {
                    this.stopTrading("Maximum recovery trades reached. Stopping trades...");
                    return;
                }

                // Sleep for a short duration after a loss to avoid rapid consecutive trades
                const marketVolatility = 1; // Placeholder for market volatility calculation
                const threshold = 1; // Placeholder for volatility threshold
                const sleepDuration = marketVolatility > threshold ? 1000 : 3000; // Adjust sleep duration based on volatility
                await this.sleep(sleepDuration);
            }

            // Check if take profit is reached
            if (this.profit >= this.takeProfit) {
                this.stopTrading(`Take Profit reached. TP[${tradeData.profit_currency} ${tradeData.profit_value}]. Stopping trades...`);
                return;
            }

            // Check if stop loss is reached
            if (this.profit <= -this.stopLoss) {
                this.stopTrading(`Stop Loss reached. SL[${tradeData.profit_currency} ${tradeData.profit_value}]. Stopping trades...`);
                return;
            }

            // Calculate the next trading amount based on the result of the previous trade
            this.currentStake = this.getTradingAmount(resultIsWin, profitAfterSale);

            // Schedule the next trade after a short delay
            setTimeout(() => this.executeTrade(purchaseType), 3000);
        } catch (err: any) {
            console.error("Error during trading:", err);
            this.handleErrorExemption(err, this.cachedSession);
            this.stopTrading("Error occurred. Stopping trades...");
        }
    }

    private parseTradeDuration(tradeDuration: string): number {
        return parseTimeToSeconds(tradeDuration);
    }

    private parseUpdateFrequency(updateFrequency: string): number {
        return parseTimeToSeconds(updateFrequency);
    }

    async saveData(data: any, key: string) {
        this.auditTrail.push({
            key: key,
            data: data
        })
    }

    async stopTrading(message: string, generateStatistics: boolean = true): Promise<void> {
        this.isTrading = false;
        parentPort.postMessage(
            {
                action: "sendTelegramMessage",
                text: message,
                meta: {}
            }
        );
        this.sleep(1000);
        if (generateStatistics) {
            this.generateTelemetry();
            this.generateTradingSummary();
            this.generateTradingStatement();
        }
        this.disconnect();
        await this.garbageCollect();
        await this.resetState();
    }

    async clearTimers(): Promise<void> {
        await clearInterval(this.pingIntervalID);
        await clearInterval(this.updateFrequencyTimeIntervalID);
        await clearTimeout(this.tradeDurationTimeoutID);
    }

    /**
     * Generates a detailed telemetry table in the specified format.
     */
    private generateTelemetry(): void {
        // Retrieve account and balance information
        const accountId = this.userAccount.loginid || "N/A";
        const currency = this.userAccount.currency || "USD";
        const totalBalance = parseFloat(this.userBalance[1] || '0').toFixed(2);

        // Calculate total profit, payout, and stake
        const totalProfit = this.profit;
        const totalPayout = this.totalPayout;
        const totalStake = this.totalStake;

        // Calculate win rate and average profit per run
        const winRate = (this.numberOfWins / this.totalNumberOfRuns) * 100;
        const averageProfitPerRun = totalProfit / this.totalNumberOfRuns;

        // Format start time, stop time, and duration
        const startTime = new Date(this.tradeStartedAt * 1000);
        const stopTime = new Date(); // Current time as stop time
        const durationSeconds = Math.floor((Date.now() / 1000) - this.tradeStartedAt);
        const duration = `${Math.floor(durationSeconds / 3600)}h ${Math.floor((durationSeconds % 3600) / 60)}m ${durationSeconds % 60}s`;

        // Format start and stop times into two lines (date and time)
        const startDate = startTime.toLocaleDateString();
        const startTimeFormatted = startTime.toLocaleTimeString();
        const stopDate = stopTime.toLocaleDateString();
        const stopTimeFormatted = stopTime.toLocaleTimeString();

        // Create the telemetry table
        const telemetryTable = `

    =========================
    Trading Telemetry Summary
    =========================

    Account:        ${accountId.padEnd(20)} 
    Currency:       ${currency.padEnd(20)} 

    Wins:           ${this.numberOfWins.toString().padEnd(20)} 
    Losses:         ${this.numberOfLosses.toString().padEnd(20)} 
    Runs:           ${this.totalNumberOfRuns.toString().padEnd(20)} 
         
    Total Payout:   $${totalPayout.toFixed(2).padEnd(20)} 
    Total Stake:    $${totalStake.toFixed(2).padEnd(20)} 
    Total Profit:   $${totalProfit.toFixed(2).padEnd(20)} 
    Avg Profit/Run: $${averageProfitPerRun.toFixed(2).padEnd(20)} 
    Total Balance:  $${totalBalance.padEnd(20)} 

    Win Rate %:     ${winRate.toFixed(2)}%${" ".padEnd(17)} 

    Start Date:     ${startDate.padEnd(20)} 
    Start Time:     ${startTimeFormatted.padEnd(20)} 

    Stop Date:      ${stopDate.padEnd(20)} 
    Stop Time:      ${stopTimeFormatted.padEnd(20)} 

    Duration:       ${duration.padEnd(20)} 

  `;

        // Log the telemetry table
        console.log(telemetryTable);

        parentPort.postMessage({ action: "generateTelemetry", text: telemetryTable, meta: { user: this.userAccount, audit: this.auditTrail } });

    }

    async generateTradingStatement(): Promise<any> {
        //generateTradingStatement
        parentPort.postMessage({ action: "generateTradingStatement", message: "Generating statement, this may take a while please wait...", meta: { user: this.userAccount, audit: this.auditTrail } });

    }

    /**
    * Generates a summary table of all trades with perfect alignment.
    */
    private async generateTradingSummary(): Promise<void> {
        // Calculate total profit
        const totalProfit = this.auditTrail.reduce((sum: number, trade: any) => sum + trade.profit, 0);

        // Define the table headers
        const header = `
 +-----+---------+----------+
 | Run |  Stake  |  Profit  |
 +-----+---------+----------+
   `;

        // Define the table rows
        const rows = this.auditTrail
            .map((trade: any) => {
                const run = String(trade.run).padStart(3); // Right-aligned, 3 characters
                const stake = `$${trade.stake.toFixed(2)}`.padStart(7); // Right-aligned, 7 characters
                const profit = `${trade.profit >= 0 ? "+" : "-"}${Math.abs(trade.profit).toFixed(2)}`.padStart(8); // Right-aligned, 8 characters
                return `| ${run} | ${stake} | ${profit} |`;
            })
            .join("\n");

        // Define the total profit row
        const totalRow = `
 +-----+---------+----------+
 | TOTAL PROFIT  | ${totalProfit >= 0 ? "+" : "-"}${Math.abs(totalProfit).toFixed(2).padStart(8)} |
 +-----+---------+----------+
   `;

        // Combine the table
        const tradeSummary = `${header}\n${rows}\n${totalRow}`;

        // Log the trade summary
        console.log(tradeSummary);

        //generateSummary
        parentPort.postMessage({ action: "generateTradingSummary", message: "Generating trading summary, please wait...", meta: { user: this.userAccount, audit: this.auditTrail } });

    }

    async garbageCollect(): Promise<any> {
        //garbageCollect
        //clear logs
        //destroy workers
    }

    async handleErrorExemption(err: any, contractParams: any): Promise<void> {

        const errorCode: string = err.error.code;
        const errorMessage: string = err.error.message;
        const errorMessageType: string = err.msg_type;

        const self = this;

        logger.error(`Purchase Error: ${errorCode} - ${errorMessageType} - ${errorMessage}`);

        switch (errorCode) {

            case "AuthorizationRequired": {

                this.setAccount(() => {
                    self.startTrading(contractParams, false);
                })

                break;

            }

            case "InvalidParameters": {

                this.stopTrading("Invalid parameters, please try again.", false);

                console.log("InvalidParameters", err, contractParams);

                break;

            }

            case "InsufficientBalance": {

                //TODO: get the current balance vs stake, the better to take the one from the server.

                this.stopTrading("Insufficient balance, please topup your account to continue.", false);

                console.log("InsufficientBalance", err);

                break;

            }

            default: {

                this.stopTrading("An unknoen error occured. Please try again later.", false);

                console.log("Unknown error", err, contractParams);

            }

        }

    }
    
}

// ==============================
// EXPORTS
// ==============================

export {
    DerivAutoTradingBot,
    DerivAPIService,
    BotConfig,
    PurchaseType,
    TradingType,
    MarketType,
    Monetary,
    CustomDate,
    Spot,
    Tick,
    MarketValue,
    Profit,
    ContractProps,
    ContractParams,
    ContractResponse,
    ITradeData
};