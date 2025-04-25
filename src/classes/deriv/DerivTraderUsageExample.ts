// Create the service with reconnection options
const apiService = new DerivAPIService(
    env.DERIV_APP_ENDPOINT_DOMAIN,
    env.DERIV_APP_ENDPOINT_APP_ID,
    env.DERIV_APP_ENDPOINT_LANG,
    {
        maxRetries: 5,
        baseDelay: 2000
    }
);

// Add event listeners
apiService.on('connect', () => {
    logger.info('Connected to Deriv API');
    parentPort.postMessage({ action: 'connectionStatus', status: 'connected' });
});

apiService.on('disconnect', () => {
    logger.warn('Disconnected from Deriv API');
    parentPort.postMessage({ action: 'connectionStatus', status: 'disconnected' });
});

apiService.on('reconnect', ({ attempt, delay }) => {
    logger.warn(`Reconnecting (attempt ${attempt}) in ${delay}ms...`);
    parentPort.postMessage({
        action: 'reconnectionAttempt',
        attempt,
        delay
    });
});

apiService.on('error', (error) => {
    logger.error('Connection error:', error);
    parentPort.postMessage({
        action: 'connectionError',
        error
    });
});

// Connect with automatic retries
apiService.connect(DERIV_APP_TOKEN)
    .catch(error => {
        logger.error('Initial connection failed after retries:', error);
    });

// Later in your code, you can check connection status
const status = apiService.getConnectionStatus();

try {
    const tradeData = await bot.purchaseNextContract(ContractType.CALLE);
    console.log('Trade completed:', tradeData);
} catch (error) {
    if (error instanceof InsufficientBalanceError) {
        console.error('Balance too low - please deposit funds');
    } else {
        console.error('Trade failed:', error.message);
    }
}