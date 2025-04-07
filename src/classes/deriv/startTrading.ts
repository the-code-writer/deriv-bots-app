/**
 * Starts the automated trading process with configurable parameters and recovery logic.
 * Manages the entire trading lifecycle including session initialization, trade execution,
 * profit/loss tracking, and automatic stop conditions.
 * 
 * @param {Object} session - Configuration object for the trading session
 * @param {string} session.market - The market symbol to trade (e.g., 'R_100')
 * @param {PurchaseType} session.purchaseType - The type of contract to purchase
 * @param {number} session.stake - Base stake amount for trades
 * @param {number} session.takeProfit - Profit target at which to stop trading
 * @param {number} session.stopLoss - Maximum acceptable loss before stopping
 * @param {string} session.tradeDuration - Duration string (e.g., '1h 30m') for how long to trade
 * @param {string} session.updateFrequency - How often to generate telemetry updates
 * @param {boolean} [retryAfterError=false] - Flag indicating if this is a retry after failure
 * @returns {Promise<void>} Resolves when trading completes or rejects on critical error
 * 
 * @throws {Error} When invalid parameters are provided or unrecoverable errors occur
 * 
 * @emits tradeStarted When trading begins
 * @emits tradeStopped When trading ends (normally or due to stop condition)
 * @emits tradeUpdate On significant trading events (wins/losses, balance changes)
 */
async startTrading(
    session: {
    market: MarketType;
    purchaseType: PurchaseType;
    stake: number;
    takeProfit: number;
    stopLoss: number;
    tradeDuration: string;
    updateFrequency: string;
},
    retryAfterError: boolean = false
): Promise < void> {
    // Validate input parameters
    this.validateSessionParameters(session);

    try {
        // Initialize or restore trading session
        if(!retryAfterError) {
            await this.initializeTradingSession(session);
            this.emit('tradeStarted', {
                timestamp: Date.now(),
                sessionConfig: session
            });
        } else if(!this.cachedSession) {
    throw new Error('No cached session available for retry');
}

// Main trading loop
while (this.isTrading) {
    try {
        // Execute trade and handle result
        const tradeResult = await this.executeTrade(session.purchaseType);

        // Update statistics and check stop conditions
        this.updateTradingStatistics(tradeResult);

        if (this.shouldStopTrading(tradeResult)) {
            await this.stopTrading(this.getStopReason(tradeResult));
            break;
        }

        // Prepare for next trade
        this.prepareNextTrade(tradeResult);

        // Brief pause between trades (adjustable based on market conditions)
        await this.sleep(this.calculateTradeInterval());

    } catch (tradeError) {
        // Handle trade-level errors (doesn't stop entire session)
        await this.handleTradeError(tradeError);
    }
}

  } catch (error) {
    // Handle session-level errors (stops trading)
    await this.handleSessionError(error);
    throw error; // Re-throw for caller to handle
}
}

// ======================
// SUPPORTING METHODS
// ======================

/**
 * Validates all required session parameters
 * @private
 */
private validateSessionParameters(session: any): void {
    const errors: string[] = [];

    if(!session.market || !Object.values(MarketType).includes(session.market)) {
    errors.push(`Invalid market: ${session.market}`);
}

if (!session.purchaseType || !Object.values(PurchaseType).includes(session.purchaseType)) {
    errors.push(`Invalid purchaseType: ${session.purchaseType}`);
}

if (typeof session.stake !== 'number' || session.stake <= 0) {
    errors.push(`Stake must be positive number, got: ${session.stake}`);
}

if (errors.length > 0) {
    throw new Error(`Invalid session parameters: ${errors.join(', ')}`);
}
}

/**
 * Initializes a new trading session
 * @private
 */
private async initializeTradingSession(session: any): Promise < void> {
    // Cache the session for potential recovery
    this.cachedSession = session;

    // Set core trading parameters
    this.defaultMarket = session.market;
    this.originalPurchaseType = session.purchaseType;
    this.currentPurchaseType = session.purchaseType;
    this.baseStake = session.stake;
    this.currentStake = session.stake;
    this.takeProfit = session.takeProfit;
    this.stopLoss = session.stopLoss;

    // Parse and set durations
    this.tradeDuration = this.parseTimeToSeconds(session.tradeDuration);
    this.updateFrequency = this.parseTimeToSeconds(session.updateFrequency);

    // Initialize tracking variables
    this.tradeStartedAt = Date.now() / 1000;
    this.totalStake = 0;
    this.totalPayout = 0;
    this.profit = 0;
    this.consecutiveTrades = 0;
    this.currentRecoveryTradeIndex = 0;

    // Setup timed operations
    this.setupTimedOperations();

    // Verify account balance
    await this.verifyAccountBalance();
}

/**
 * Sets up timed operations (duration timeout and telemetry updates)
 * @private
 */
private setupTimedOperations(): void {
    // Set timeout for trade duration
    this.tradeDurationTimeoutID = setTimeout(async () => {
        await this.stopTrading(`Duration limit reached (${this.cachedSession.tradeDuration})`);
    }, this.tradeDuration * 1000);

    // Setup periodic telemetry updates
    this.updateFrequencyTimeIntervalID = setInterval(async () => {
        this.generateTelemetry();
        this.emit('tradeUpdate', this.getTradingStatus());
    }, this.updateFrequency * 1000);
}

/**
 * Verifies account has sufficient balance before trading
 * @private
 */
private async verifyAccountBalance(): Promise < void> {
    const [currency, balance] = this.userBalance;
    const requiredBalance = this.baseStake * 5; // Require enough for 5 base trades

    if(parseFloat(balance) < requiredBalance) {
    throw new Error(
        `Insufficient balance: ${currency} ${balance}. ` +
        `Required at least ${currency} ${requiredBalance.toFixed(2)}`
    );
}
}

/**
 * Executes a single trade based on current parameters
 * @private
 */
private async executeTrade(purchaseType: PurchaseType): Promise < ITradeData > {
    this.consecutiveTrades++;
    this.totalNumberOfRuns++;

    logger.info(`Executing trade #${this.totalNumberOfRuns} (${purchaseType})`);

    const tradeData = await this.purchaseNextContract(purchaseType);
    this.auditTrail.push(tradeData);

    this.emit('tradeExecuted', {
        timestamp: Date.now(),
        tradeData,
        sessionStats: this.getTradingStatus()
    });

    return tradeData;
}

/**
 * Updates statistics after each trade
 * @private
 */
private updateTradingStatistics(tradeData: ITradeData): void {
    const profitAmount = tradeData.profit_value * tradeData.profit_sign;

    // Update totals
    this.totalStake += tradeData.buy_price_value;
    this.totalPayout += tradeData.sell_price_value;
    this.profit += profitAmount;

    // Update win/loss counts
    if(tradeData.profit_is_win) {
    this.numberOfWins++;
    this.consecutiveLosses = 0;
} else {
    this.numberOfLosses++;
    this.consecutiveLosses++;
    this.cumulativeLossAmount += Math.abs(profitAmount);
}

// Update balance
this.userBalance = [
    tradeData.balance_currency,
    tradeData.balance_value
];
}

/**
 * Determines if trading should stop based on conditions
 * @private
 */
private shouldStopTrading(tradeData: ITradeData): boolean {
    // Check take profit
    if (this.profit >= this.takeProfit) {
        return true;
    }

    // Check stop loss
    if (this.profit <= -this.stopLoss) {
        return true;
    }

    // Check max recovery trades
    if (this.currentRecoveryTradeIndex >= this.maxRecoveryTrades) {
        return true;
    }

    // Check consecutive losses
    if (this.consecutiveLosses >= this.maxConsecutiveLosses) {
        return true;
    }

    return false;
}

/**
 * Prepares parameters for the next trade
 * @private
 */
private prepareNextTrade(tradeData: ITradeData): void {
    if(tradeData.profit_is_win) {
    // Reset to base parameters after win
    this.currentStake = this.baseStake;
    this.currentPurchaseType = this.originalPurchaseType;
    this.currentRecoveryTradeIndex = 0;
} else {
    // Recovery logic for losses
    this.currentRecoveryTradeIndex++;
    this.currentStake = this.calculateRecoveryStake();

    // Optional: Switch strategy after consecutive losses
    if (this.currentRecoveryTradeIndex > 2) {
        this.currentPurchaseType = this.getAlternativeStrategy();
    }
}
}

/**
 * Handles trade-level errors without stopping entire session
 * @private
 */
private async handleTradeError(error: any): Promise < void> {
    logger.error(`Trade error: ${error.message}`);

    // Implement error-specific handling
    if(error.message.includes('Insufficient balance')) {
    await this.stopTrading("Insufficient balance - stopping trading");
    throw error; // Convert to session error
}

// Exponential backoff for API errors
const delay = Math.min(1000 * Math.pow(2, this.consecutiveErrors), 30000);
await this.sleep(delay);

this.emit('tradeError', {
    error,
    retryIn: delay,
    sessionStats: this.getTradingStatus()
});
}

/**
 * Handles session-level errors and cleans up
 * @private
 */
private async handleSessionError(error: any): Promise < void> {
    logger.error(`Trading session error: ${error.message}`);

    await this.stopTrading(`Session error: ${error.message}`);

    this.emit('tradeError', {
        error,
        fatal: true,
        sessionStats: this.getTradingStatus()
    });
}

/**
 * Gets current trading status snapshot
 * @private
 */
private getTradingStatus() {
    return {
        timestamp: Date.now(),
        profit: this.profit,
        totalStake: this.totalStake,
        totalPayout: this.totalPayout,
        wins: this.numberOfWins,
        losses: this.numberOfLosses,
        currentStake: this.currentStake,
        consecutiveTrades: this.consecutiveTrades,
        balance: this.userBalance,
        duration: (Date.now() / 1000) - this.tradeStartedAt
    };
}