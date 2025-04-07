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

            this.api = new DerivAPI({
                endpoint: this.connectionParams.endpoint,
                app_id: this.connectionParams.appId,
                lang: this.connectionParams.lang
            });

            // Setup connection monitoring
            this.setupConnectionMonitoring();

            // Test connection with a ping
            await this.api.basic.ping();

            this.isConnected = true;
            this.startPing(env.CONNECTION_PING_TIMEOUT);
            this.emit('connect');

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

    constructor(private readonly derivAPIService: DerivAPIService) { }

    /**
     * Initializes and maintains the user account instance
     * @param token - User token
     */
    async initializeAccount(token: string): Promise<IDerivUserAccount> {
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
     * Gets account balance from the maintained account instance
     */
    async getBalance(): Promise<[string, string]> {
        if (!this.accountInstance) {
            throw new Error("Account not initialized. Call initializeAccount first.");
        }

        try {
            const balance = this.accountInstance.balance.amount._data;
            return [balance.currency || "USD", balance.value];
        } catch (error) {
            logger.error("Failed to get balance:", error);
            throw new Error("Failed to retrieve balance from account instance");
        }
    }

    /**
     * Gets the current balance synchronously (if updates are being tracked)
     */
    getCurrentBalance(): [string, string] | null {
        if (!this.accountInstance || !this.accountInstance.balance.amount._data) {
            return null;
        }
        const balance = this.accountInstance.balance.amount._data;
        return [balance.currency || "USD", balance.value];
    }

    /**
     * Clears the account instance (for disconnection/logout)
     */
    clearAccount(): void {
        this.accountInstance = null;
    }




    ////////////////


    /**
   * Gets the current balance
   */
    async getBalance(): Promise<void> {
        try {
            this.userBalance = await this.userAccountService.getBalance();
            logger.info(`Current balance: ${this.userBalance[0]} ${this.userBalance[1]}`);
        } catch (error) {
            logger.error("Failed to get balance:", error);
            throw error;
        }
    }

    /**
     * Gets the current balance synchronously
     */
    getCurrentBalance(): [string, string] | null {
        return this.userAccountService.getCurrentBalance();
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
     * Purchases a contract
     * @param contractParameters - Contract parameters
     */
    async purchaseContract(contractParameters: ContractParams): Promise<ITradeData> {
        const api = this.derivAPIService.getAPI();
        const contract = await api.basic.contract(contractParameters);

        // Handle contract updates and purchase
        // ... (implementation similar to original purchaseContract method)

        return {} as ITradeData; // Return actual trade data
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
            // ... other properties
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

    // ... other factory methods for different contract types
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
        const mergedConfig: BotConfig = { ...this._botConfig, ...config };

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

    // ... (other methods refactored similarly)
}

// ==============================
// UTILITY FUNCTIONS
// ==============================

/**
 * Parses time string to seconds
 * @param timeString - Time string (e.g., "1h 30m")
 */
function parseTimeToSeconds(timeString: string): number {
    // Implementation...
}

// ==============================
// EXPORTS
// ==============================

export {
    DerivAutoTradingBot,
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