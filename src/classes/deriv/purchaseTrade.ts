/**
 * Executes the next contract purchase based on current trading strategy and market conditions.
 * Implements the Strategy pattern for different purchase types with proper error handling
 * and validation.
 * 
 * @param {ContractType} contractType - The type of contract to purchase
 * @returns {Promise<ITradeData>} Resolves with trade data when purchase completes
 * 
 * @throws {Error} When:
 *   - Invalid purchase type is specified
 *   - API connection is not available
 *   - Contract parameters are invalid
 *   - Purchase fails after max retries
 * 
 * @emits purchaseStarted Before attempting purchase
 * @emits purchaseCompleted After successful purchase
 * @emits purchaseError On purchase failure (before retries)
 */
private async purchaseNextContract(contractType: ContractType): Promise < ITradeData > {
    // Validate trading conditions before proceeding
    this.validateTradingConditions();

    try {
        // Notify listeners purchase is starting
        this.emit('purchaseStarted', {
            timestamp: Date.now(),
            contractType,
            currentStake: this.currentStake
        });

        // Get contract parameters based on strategy
        const contractParams = this.getContractParameters(contractType);

        // Execute the purchase with retry logic
        const tradeData = await this.executeContractPurchase(contractParams);

        // Calculate and update profit percentage
        this.updateProfitPercentage(contractType);

        // Notify listeners of successful purchase
        this.emit('purchaseCompleted', {
            timestamp: Date.now(),
            tradeData,
            profitPercentage: this.profitPercentage
        });

        return tradeData;

    } catch(error) {
        // Handle and classify the error
        const classifiedError = this.classifyPurchaseError(error);

        // Notify listeners of the error
        this.emit('purchaseError', {
            timestamp: Date.now(),
            error: classifiedError,
            contractType,
            attempt: this.currentPurchaseAttempt
        });

        // Apply error-specific handling
        await this.handlePurchaseError(classifiedError);

        throw classifiedError;
    }
}

// ======================
// SUPPORTING METHODS
// ======================

/**
 * Validates current trading conditions before purchase attempt
 * @private
 */
private validateTradingConditions(): void {
    if(!this.isTrading) {
    throw new Error('Cannot purchase contract - trading is not active');
}

if (!this.api) {
    throw new Error('API connection not established');
}

if (this.currentStake < this.minStake || this.currentStake > this.maxStake) {
    throw new Error(
        `Stake amount ${this.currentStake} outside allowed range ` +
        `[${this.minStake}-${this.maxStake}]`
    );
}
}

/**
 * Generates contract parameters based on purchase type and current strategy
 * @private
 */
private getContractParameters(contractType: ContractType): ContractParams {
    const baseParams = {
        amount: this.currentStake,
        currency: this.userAccount.currency || 'USD',
        duration: this.contractDurationValue,
        duration_unit: this.contractDurationUnits,
        basis: 'stake'
    };

    switch (this.tradingType) {
        case TradingType.DERIVATIVES:
            return this.getDerivativesContractParams(contractType, baseParams);
        case TradingType.FOREX:
            return this.getForexContractParams(contractType, baseParams);
        case TradingType.CRYPTO:
            return this.getCryptoContractParams(contractType, baseParams);
        case TradingType.COMMODITIES:
            return this.getCommoditiesContractParams(contractType, baseParams);
        default:
            throw new Error(`Unsupported trading type: ${this.tradingType}`);
    }
}

/**
 * Gets parameters for derivatives contracts
 * @private
 */
private getDerivativesContractParams(
    contractType: ContractType,
    baseParams: Partial<ContractParams>
): ContractParams {
    const params: ContractParams = { ...baseParams, symbol: this.defaultMarket };

    switch (contractType) {
        case ContractType.CALL:
        case ContractType.PUT:
            return {
                ...params,
                contract_type: contractType,
                barrier: this.calculateBarrier()
            };

        case ContractType.DIGITDIFF:
            return {
                ...params,
                contract_type: 'DIGITDIFF',
                barrier: this.getDigitPrediction()
            };

        case ContractType.DIGITOVER:
            return {
                ...params,
                contract_type: 'DIGITOVER',
                barrier: this.getDigitPrediction()
            };

        // ... other derivative contract types

        default:
            throw new Error(`Unsupported purchase type for derivatives: ${contractType}`);
    }
}

/**
 * Executes the contract purchase with retry logic
 * @private
 */
private async executeContractPurchase(params: ContractParams): Promise < ITradeData > {
    let lastError: Error | null = null;

    for(let attempt = 1; attempt <= this.maxPurchaseAttempts; attempt++) {
    this.currentPurchaseAttempt = attempt;

    try {
        const contract = await this.api.basic.contract(params);
        const tradeData = await this.monitorContract(contract);
        return TradeData.parseTradeData(tradeData);

    } catch (error) {
        lastError = error;

        // Apply retry delay (exponential backoff)
        const delay = this.calculateRetryDelay(attempt);
        await this.sleep(delay);

        // Adjust parameters for retry if needed
        if (this.shouldAdjustParameters(error)) {
            params = this.adjustRetryParameters(params, error);
        }
    }
}

throw lastError || new Error('Purchase failed after maximum attempts');
}

/**
 * Monitors contract status until completion
 * @private
 */
private async monitorContract(contract: ContractResponse): Promise < ITradeData > {
    return new Promise((resolve, reject) => {
        const updates = contract.onUpdate((update) => {
            try {
                if (update.is_sold) {
                    updates.unsubscribe();
                    resolve(this.extractTradeData(contract));
                }

                // Handle intermediate status updates
                this.handleContractUpdate(update);

            } catch (error) {
                updates.unsubscribe();
                reject(error);
            }
        });

        // Handle initial purchase
        contract.buy().catch(reject);

        // Set timeout for contract completion
        setTimeout(() => {
            updates.unsubscribe();
            reject(new Error('Contract monitoring timed out'));
        }, CONTRACT_COMPLETION_TIMEOUT);
    });
}

/**
 * Extracts standardized trade data from contract
 * @private
 */
private extractTradeData(contract: ContractResponse): ITradeData {
    return {
        symbol_short: contract.symbol.short,
        symbol_full: contract.symbol.full,
        start_time: contract.start_time._data.internal.$d.getTime() / 1000,
        expiry_time: contract.expiry_time._data.internal.$d.getTime() / 1000,
        purchase_time: contract.purchase_time._data.internal.$d.getTime() / 1000,
        entry_spot_value: contract.entry_spot._data.value,
        entry_spot_time: contract.entry_spot._data.time._data.internal.$d.getTime() / 1000,
        exit_spot_value: contract.exit_spot?._data.value || contract.sell_spot._data.value,
        exit_spot_time: contract.exit_spot?._data.time._data.internal.$d.getTime() / 1000 ||
            contract.sell_spot._data.time._data.internal.$d.getTime() / 1000,
        // ... other fields
    };
}

/**
 * Classifies purchase errors for appropriate handling
 * @private
 */
private classifyPurchaseError(error: any): Error {
    if (error.message.includes('Insufficient balance')) {
        return new InsufficientBalanceError(error.message);
    }

    if (error.message.includes('Connection')) {
        return new ConnectionError(error.message);
    }

    if (error.message.includes('Invalid parameters')) {
        return new InvalidParametersError(error.message);
    }

    return error instanceof Error ? error : new Error(String(error));
}

/**
 * Handles purchase errors according to their type
 * @private
 */
private async handlePurchaseError(error: Error): Promise < void> {
    if(error instanceof InsufficientBalanceError) {
    await this.stopTrading('Insufficient balance');
}

if (error instanceof ConnectionError) {
    await this.attemptReconnection();
}

// For parameter errors, wait before retrying
if (error instanceof InvalidParametersError) {
    await this.sleep(3000);
}
}

/**
 * Updates profit percentage based on current strategy
 * @private
 */
private updateProfitPercentage(contractType: ContractType): void {
    this.profitPercentage = this.calculateProfitPercentage(
        contractType,
        this.currentStake
    );
}

// ======================
// ERROR CLASSES
// ======================

class InsufficientBalanceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InsufficientBalanceError';
    }
}

class ConnectionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConnectionError';
    }
}

class InvalidParametersError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidParametersError';
    }
}