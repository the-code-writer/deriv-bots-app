import { MongoDBConnection } from '@/classes/databases/mongodb/MongoDBClass';
import { pino } from 'pino';

// Logger
const logger = pino({ name: "TradeStorageService" });

interface Trade {
    amount: number;
    basis: string;
    currency: string;
    duration: number;
    duration_unit: string;
    symbol: string;
    contract_type: string;
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
    buy_transaction: number;
    bid_price_currency: string;
    bid_price_value: number;
    sell_price_currency: string;
    sell_price_value: number;
    sell_spot: number;
    sell_spot_time: number;
    sell_transaction: number;
    payout: number;
    payout_currency: string;
    profit_value: number;
    profit_currency: string;
    profit_percentage: number;
    profit_is_win: boolean;
    profit_sign: number;
    safeProfit: number;
    status: 'won' | 'lost';
    longcode: string;
    proposal_id: string;
    userAccount: {
        email: string;
        country: string;
        currency: string;
        loginid: string;
        user_id: number;
        fullname: string;
        token: string;
    };
    audit_details: Array<{
        epoch: number;
        tick?: number;
        tick_display_value?: string;
        flag?: string;
        name?: string;
    }>;
    ticks: any;
}

interface DateRange {
    start?: number; // timestamp
    end?: number;   // timestamp
}

interface TradeStats {
    totalProfit: number;
    totalLoss: number;
    netProfit: number;
    winRate: number;
    highestStake: number;
    lowestStake: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
}

export class TradeStorageService {
    // @ts-ignore
    private db: MongoDBConnection;
    private collectionName: string = 'ndtx_trade_data';

    constructor() {}

    async init() {
        this.db = new MongoDBConnection();
        await this.db.connect();
    }

    /**
     * Inserts a trade record into the database
     * @param trade Trade object to insert
     */
    async insertTrade(trade: Trade): Promise<void> {
        try {
            await this.db.insertItem(this.collectionName, trade);
            logger.info(`Trade inserted for user ${trade.userAccount.email}`);
        } catch (error) {
            logger.error('insertTrade:', trade);
            logger.error('Error inserting trade:', error);
            throw error;
        }
    }

    /**
     * Computes profit for a specific user and period
     * @param identifier User identifier (loginid, user_id, or email)
     * @param range Date range to consider
     * @returns Total profit
     */
    async computeProfit(identifier: { loginid?: string, user_id?: number, email?: string }, range?: DateRange): Promise<number> {
        const conditions = this.buildUserAndDateConditions(identifier, range);
        conditions.push({ field: 'profit_is_win', operator: 'eq', value: true });

        const trades = await this.db.getAllItems(this.collectionName, conditions);
        return trades?.reduce((sum, trade) => sum + trade.profit_value, 0) || 0;
    }

    /**
     * Computes losses for a specific user and period
     * @param identifier User identifier (loginid, user_id, or email)
     * @param range Date range to consider
     * @returns Total losses (absolute value)
     */
    async computeLosses(identifier: { loginid?: string, user_id?: number, email?: string }, range?: DateRange): Promise<number> {
        const conditions = this.buildUserAndDateConditions(identifier, range);
        conditions.push({ field: 'profit_is_win', operator: 'eq', value: false });

        const trades = await this.db.getAllItems(this.collectionName, conditions);
        return trades?.reduce((sum, trade) => sum + Math.abs(trade.profit_value), 0) || 0;
    }

    /**
     * Gets the highest stake for a specific user and period
     * @param identifier User identifier (loginid, user_id, or email)
     * @param range Date range to consider
     * @returns Highest stake amount
     */
    async getHighestStake(identifier?: { loginid?: string, user_id?: number, email?: string }, range?: DateRange): Promise<number> {
        const conditions = identifier ? this.buildUserAndDateConditions(identifier, range) : [];

        const trades = await this.db.getAllItems(this.collectionName, conditions);
        if (!trades || trades.length === 0) return 0;

        return Math.max(...trades.map(trade => trade.amount));
    }

    /**
     * Gets the lowest stake for a specific user and period
     * @param identifier User identifier (loginid, user_id, or email)
     * @param range Date range to consider
     * @returns Lowest stake amount
     */
    async getLowestStake(identifier?: { loginid?: string, user_id?: number, email?: string }, range?: DateRange): Promise<number> {
        const conditions = identifier ? this.buildUserAndDateConditions(identifier, range) : [];

        const trades = await this.db.getAllItems(this.collectionName, conditions);
        if (!trades || trades.length === 0) return 0;

        return Math.min(...trades.map(trade => trade.amount));
    }

    /**
     * Gets worst losses for a specific user and period
     * @param limit Number of worst losses to return
     * @param identifier User identifier (loginid, user_id, or email)
     * @param range Date range to consider
     * @returns Array of worst losses
     */
    async getWorstLosses(limit: number = 5, identifier?: { loginid?: string, user_id?: number, email?: string }, range?: DateRange): Promise<Trade[]> {
        const conditions = identifier ? this.buildUserAndDateConditions(identifier, range) : [];
        conditions.push({ field: 'profit_is_win', operator: 'eq', value: false });

        const trades = await this.db.getAllItems(this.collectionName, conditions);
        if (!trades) return [];

        return trades
            .sort((a, b) => Math.abs(a.profit_value) - Math.abs(b.profit_value))
            .slice(0, limit);
    }

    /**
     * Gets best gains for a specific user and period
     * @param limit Number of best gains to return
     * @param identifier User identifier (loginid, user_id, or email)
     * @param range Date range to consider
     * @returns Array of best gains
     */
    async getBestGains(limit: number = 5, identifier?: { loginid?: string, user_id?: number, email?: string }, range?: DateRange): Promise<Trade[]> {
        const conditions = identifier ? this.buildUserAndDateConditions(identifier, range) : [];
        conditions.push({ field: 'profit_is_win', operator: 'eq', value: true });

        const trades = await this.db.getAllItems(this.collectionName, conditions);
        if (!trades) return [];

        return trades
            .sort((a, b) => b.profit_value - a.profit_value)
            .slice(0, limit);
    }

    /**
     * Gets comprehensive trade statistics for a user and period
     * @param identifier User identifier (loginid, user_id, or email)
     * @param range Date range to consider
     * @returns Trade statistics object
     */
    async getTradeStats(identifier: { loginid?: string, user_id?: number, email?: string }, range?: DateRange): Promise<TradeStats> {
        const conditions = this.buildUserAndDateConditions(identifier, range);

        const trades = await this.db.getAllItems(this.collectionName, conditions);
        if (!trades || trades.length === 0) {
            return {
                totalProfit: 0,
                totalLoss: 0,
                netProfit: 0,
                winRate: 0,
                highestStake: 0,
                lowestStake: 0,
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0
            };
        }

        const winningTrades = trades.filter(trade => trade.profit_is_win);
        const losingTrades = trades.filter(trade => !trade.profit_is_win);

        const totalProfit = winningTrades.reduce((sum, trade) => sum + trade.profit_value, 0);
        const totalLoss = losingTrades.reduce((sum, trade) => sum + Math.abs(trade.profit_value), 0);
        const netProfit = totalProfit - totalLoss;
        const winRate = (winningTrades.length / trades.length) * 100;

        return {
            totalProfit,
            totalLoss,
            netProfit,
            winRate,
            highestStake: Math.max(...trades.map(trade => trade.amount)),
            lowestStake: Math.min(...trades.map(trade => trade.amount)),
            totalTrades: trades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length
        };
    }

    /**
     * Retrieves trades by symbol_short
     * @param symbol_short Symbol to filter by
     * @param range Optional date range
     * @returns Array of matching trades
     */
    async getTradesBySymbol(symbol_short: string, range?: DateRange): Promise<Trade[]> {
        const conditions: any[] = [{ field: 'symbol_short', operator: 'eq', value: symbol_short }];

        if (range) {
            if (range.start) {
                conditions.push({ field: 'purchase_time', operator: 'gte', value: range.start });
            }
            if (range.end) {
                conditions.push({ field: 'purchase_time', operator: 'lte', value: range.end });
            }
        }

        return await this.db.getAllItems(this.collectionName, conditions) || [];
    }

    /**
     * Retrieves trades by contract_type
     * @param contract_type Contract type to filter by
     * @param range Optional date range
     * @returns Array of matching trades
     */
    async getTradesByContractType(contract_type: string, range?: DateRange): Promise<Trade[]> {
        const conditions: any[] = [{ field: 'contract_type', operator: 'eq', value: contract_type }];

        if (range) {
            if (range.start) {
                conditions.push({ field: 'purchase_time', operator: 'gte', value: range.start });
            }
            if (range.end) {
                conditions.push({ field: 'purchase_time', operator: 'lte', value: range.end });
            }
        }

        return await this.db.getAllItems(this.collectionName, conditions) || [];
    }

    /**
     * Retrieves trades by status (won/lost)
     * @param status Status to filter by ('won' or 'lost')
     * @param range Optional date range
     * @returns Array of matching trades
     */
    async getTradesByStatus(status: 'won' | 'lost', range?: DateRange): Promise<Trade[]> {
        const conditions: any[] = [{ field: 'status', operator: 'eq', value: status }];

        if (range) {
            if (range.start) {
                conditions.push({ field: 'purchase_time', operator: 'gte', value: range.start });
            }
            if (range.end) {
                conditions.push({ field: 'purchase_time', operator: 'lte', value: range.end });
            }
        }

        return await this.db.getAllItems(this.collectionName, conditions) || [];
    }

    /**
     * Retrieves trades by loginid
     * @param loginid Login ID to filter by
     * @param range Optional date range
     * @returns Array of matching trades
     */
    async getTradesByLoginId(loginid: string, range?: DateRange): Promise<Trade[]> {
        const conditions: any[] = [{ field: 'userAccount.loginid', operator: 'eq', value: loginid }];

        if (range) {
            if (range.start) {
                conditions.push({ field: 'purchase_time', operator: 'gte', value: range.start });
            }
            if (range.end) {
                conditions.push({ field: 'purchase_time', operator: 'lte', value: range.end });
            }
        }

        return await this.db.getAllItems(this.collectionName, conditions) || [];
    }

    /**
     * Retrieves trades by user_id
     * @param user_id User ID to filter by
     * @param range Optional date range
     * @returns Array of matching trades
     */
    async getTradesByUserId(user_id: number, range?: DateRange): Promise<Trade[]> {
        const conditions: any[] = [{ field: 'userAccount.user_id', operator: 'eq', value: user_id }];

        if (range) {
            if (range.start) {
                conditions.push({ field: 'purchase_time', operator: 'gte', value: range.start });
            }
            if (range.end) {
                conditions.push({ field: 'purchase_time', operator: 'lte', value: range.end });
            }
        }

        return await this.db.getAllItems(this.collectionName, conditions) || [];
    }

    /**
     * Retrieves trades by email
     * @param email Email to filter by
     * @param range Optional date range
     * @returns Array of matching trades
     */
    async getTradesByEmail(email: string, range?: DateRange): Promise<Trade[]> {
        const conditions: any[] = [{ field: 'userAccount.email', operator: 'eq', value: email }];

        if (range) {
            if (range.start) {
                conditions.push({ field: 'purchase_time', operator: 'gte', value: range.start });
            }
            if (range.end) {
                conditions.push({ field: 'purchase_time', operator: 'lte', value: range.end });
            }
        }

        return await this.db.getAllItems(this.collectionName, conditions) || [];
    }

    /**
     * Retrieves trades by country
     * @param country Country to filter by
     * @param range Optional date range
     * @returns Array of matching trades
     */
    async getTradesByCountry(country: string, range?: DateRange): Promise<Trade[]> {
        const conditions: any[] = [{ field: 'userAccount.country', operator: 'eq', value: country }];

        if (range) {
            if (range.start) {
                conditions.push({ field: 'purchase_time', operator: 'gte', value: range.start });
            }
            if (range.end) {
                conditions.push({ field: 'purchase_time', operator: 'lte', value: range.end });
            }
        }

        return await this.db.getAllItems(this.collectionName, conditions) || [];
    }

    /**
     * Helper method to build user and date conditions
     * @param identifier User identifier
     * @param range Date range
     * @returns Array of query conditions
     */
    private buildUserAndDateConditions(identifier: { loginid?: string, user_id?: number, email?: string }, range?: DateRange): any[] {
        const conditions: any[] = [];

        if (identifier.loginid) {
            conditions.push({ field: 'userAccount.loginid', operator: 'eq', value: identifier.loginid });
        } else if (identifier.user_id) {
            conditions.push({ field: 'userAccount.user_id', operator: 'eq', value: identifier.user_id });
        } else if (identifier.email) {
            conditions.push({ field: 'userAccount.email', operator: 'eq', value: identifier.email });
        }

        if (range) {
            if (range.start) {
                conditions.push({ field: 'purchase_time', operator: 'gte', value: range.start });
            }
            if (range.end) {
                conditions.push({ field: 'purchase_time', operator: 'lte', value: range.end });
            }
        }

        return conditions;
    }
}

// Example usage:
/*
(async () => {
    const db = new MongoDBConnection();
    await db.connect();
    
    const tradeManager = new TradeStorageService(db);
    
    // Example: Insert a trade
    const trade = {
        // ... trade data ...
    };
    await tradeManager.insertTrade(trade);
    
    // Example: Compute profit for a user
    const profit = await tradeManager.computeProfit({ email: 'digitalcurrencyonline@gmail.com' }, {
        start: Date.now() - 30 * 24 * 60 * 60 * 1000, // Last 30 days
        end: Date.now()
    });
    console.log('Total profit:', profit);
    
    // Example: Get trade statistics
    const stats = await tradeManager.getTradeStats({ email: 'digitalcurrencyonline@gmail.com' });
    console.log('Trade statistics:', stats);
    
    await db.disconnect();
})();
*/