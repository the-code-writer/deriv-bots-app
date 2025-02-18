global.WebSocket = require('ws');
const { find } = require('rxjs/operators');
const DerivAPI = require('@deriv/deriv-api/dist/DerivAPI');

import 'dotenv/config';

// Define types for better type safety
type PurchaseType = 'DIGITDIFF' | 'DIGITUNDEROVER' | 'DIGITUNDER';
type Prediction = 'UNDER' | 'OVER';
type ContractResponse = {
    buy?: {
        profit: number;
    };
};

class DerivAutoTradingBot {
    // Private properties with explicit types
    private _defaultMarket: string;
    private _currentStake: number;
    private _baseStake: number;
    private _maxStake: number;
    private _minStake: number;
    private _maxRecoveryTrades: number;
    private _recoveryTrades: number;
    private _profit: number;
    private _isTrading: boolean;
    private _takeProfit: number;
    private _stopLoss: number;
    private _consecutiveTrades: number;
    private _profitPercentage: number;
    private _originalPurchaseType: PurchaseType | null;

    // Deriv API connection
    private connection: WebSocket;
    private api: any;

    expected_payout = process.env.EXPECTED_PAYOUT || 19;

    constructor(defaultMarket: string = 'R_100') {
        // Initialize Deriv API
        this.connection = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

        this.connection.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.reconnect();
        };

        this.api = new DerivAPI({ connection: this.connection });

        const config = {
            minStake: parseFloat(process.env.MIN_STAKE || '0.35'),
            maxStake: parseFloat(process.env.MAX_STAKE || '1000'),
            profitPercentage: parseFloat(process.env.PROFIT_PERCENTAGE || '0.0964'),
        };

        // Initialize private properties with explicit types
        this._defaultMarket = defaultMarket;
        this._currentStake = 0.35;
        this._baseStake = 0.35;
        this._maxStake = 1000;
        this._minStake = 0.35;
        this._maxRecoveryTrades = 5;
        this._recoveryTrades = 0;
        this._profit = 0;
        this._isTrading = false;
        this._takeProfit = 0;
        this._stopLoss = 0;
        this._consecutiveTrades = 1;
        this._profitPercentage = 0;
        this._originalPurchaseType = null;

        this.ping();

        this.getAccount();

    }

    private reconnect(): void {
        console.log('Reconnecting...');
        this.connection = new WebSocket(process.env.DERIV_SOCKET_ENDPOINT!);
        this.api = new DerivAPI({ connection: this.connection });
    }

    private ping(): void {
        const basic = this.api.basic;
        basic.ping().then(console.log);
    }

    private async getAccount(): Promise<void> {

        const account = await this.api.account(process.env.DERIV_BOT_TOKEN);

        const { balance, currency } = account;

        console.log(`Your current balance is: ${balance.currency} ${balance.display}`);

        balance.onUpdate(() => {
            console.log(`Your new balance is: ${balance.currency} ${balance.display}`);
        });

    }


    // Getters and Setters for private properties
    get defaultMarket(): string {
        return this._defaultMarket;
    }

    set defaultMarket(value: string) {
        this._defaultMarket = value;
    }

    get currentStake(): number {
        return this._currentStake;
    }

    set currentStake(value: number) {
        this._currentStake = value;
    }

    get baseStake(): number {
        return this._baseStake;
    }

    set baseStake(value: number) {
        this._baseStake = value;
    }

    get maxStake(): number {
        return this._maxStake;
    }

    set maxStake(value: number) {
        this._maxStake = value;
    }

    get minStake(): number {
        return this._minStake;
    }

    set minStake(value: number) {
        this._minStake = value;
    }

    get maxRecoveryTrades(): number {
        return this._maxRecoveryTrades;
    }

    set maxRecoveryTrades(value: number) {
        this._maxRecoveryTrades = value;
    }

    get recoveryTrades(): number {
        return this._recoveryTrades;
    }

    set recoveryTrades(value: number) {
        this._recoveryTrades = value;
    }

    get profit(): number {
        return this._profit;
    }

    set profit(value: number) {
        this._profit = value;
    }

    get isTrading(): boolean {
        return this._isTrading;
    }

    set isTrading(value: boolean) {
        this._isTrading = value;
    }

    get takeProfit(): number {
        return this._takeProfit;
    }

    set takeProfit(value: number) {
        this._takeProfit = value;
    }

    get stopLoss(): number {
        return this._stopLoss;
    }

    set stopLoss(value: number) {
        this._stopLoss = value;
    }

    get consecutiveTrades(): number {
        return this._consecutiveTrades;
    }

    set consecutiveTrades(value: number) {
        this._consecutiveTrades = value;
    }

    get profitPercentage(): number {
        return this._profitPercentage;
    }

    set profitPercentage(value: number) {
        this._profitPercentage = value;
    }

    get originalPurchaseType(): PurchaseType | null {
        return this._originalPurchaseType;
    }

    set originalPurchaseType(value: PurchaseType | null) {
        this._originalPurchaseType = value;
    }

    // Sleep function (private)
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Purchase a contract (private)
    private async purchaseContract(contractParameters: any): Promise<ContractResponse> {
        try {
            const response: ContractResponse = await this.api.buy(contractParameters);
            console.log('Contract Purchase Response:', response);
            return response;
        } catch (error) {
            console.error('Error purchasing contract:', error);
            throw error;
        }
    }

    // Purchase DIGIT DIFF contract (private)
    private async purchaseDigitDiff(predictedDigit: number): Promise<ContractResponse> {
        const contractParameters = {
            proposal: 1,
            amount: this.currentStake.toString(),
            basis: 'stake',
            contract_type: 'DIGITDIFF',
            currency: 'USD',
            duration: 5,
            duration_unit: 't',
            symbol: this.defaultMarket,
            barrier: predictedDigit.toString(),
        };

        // Calculate profit percentage for DIGIT DIFF
        this.profitPercentage = this.calculateProfitPercentage('DIGITDIFF');

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT UNDER/OVER contract (private)
    private async purchaseDigitUnderOver(prediction: Prediction, barrier: number): Promise<ContractResponse> {
        const contractParameters = {
            proposal: 1,
            amount: this.currentStake.toString(),
            basis: 'stake',
            contract_type: prediction === 'UNDER' ? 'DIGITUNDER' : 'DIGITOVER',
            currency: 'USD',
            duration: 5,
            duration_unit: 't',
            symbol: this.defaultMarket,
            barrier: barrier.toString(),
        };

        // Calculate profit percentage for DIGIT UNDER/OVER
        this.profitPercentage = this.calculateProfitPercentage('DIGITUNDEROVER', prediction);

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT UNDER 9 contract (for recovery) (private)
    private async purchaseDigitUnder9(): Promise<ContractResponse> {
        const contractParameters = {
            proposal: 1,
            amount: this.currentStake.toString(),
            basis: 'stake',
            contract_type: 'DIGITUNDER',
            currency: 'USD',
            duration: 5,
            duration_unit: 't',
            symbol: this.defaultMarket,
            barrier: '9',
        };

        // Calculate profit percentage for DIGIT UNDER 9
        this.profitPercentage = this.calculateProfitPercentage('DIGITUNDER');

        return this.purchaseContract(contractParameters);
    }

    private async fetchProfitPercentage(purchaseType: PurchaseType): Promise<number> {
        const response = await this.api.getContractTypes();
        return response[purchaseType].profitPercentage;
    }

    // Calculate profit percentage based on purchase type and prediction (private)
    private calculateProfitPercentage(purchaseType: PurchaseType, prediction?: Prediction): number {
        switch (purchaseType) {
            case 'DIGITDIFF':
                return 0.0964; // 9.64%
            case 'DIGITUNDEROVER':
                return prediction === 'UNDER' ? 0.85 : 0.90; // 85% or 90%
            case 'DIGITUNDER':
                return 0.95; // 95%
            default:
                console.log('Unknown purchase type. Using default profit percentage.');
                return 0.0964; // Default to 9.64%
        }
    }

    // Calculate the next trading amount based on previous performance (private)
    private getTradingAmount(resultIsWin: boolean, profitAfterSale: number, purchaseType: PurchaseType): number {
        let nextStake: number = this.currentStake;

        if (resultIsWin) {
            // Reset to base stake after a win
            nextStake = this.baseStake;
        } else {
            // Calculate cumulative losses (L)
            const cumulativeLosses: number = this.currentStake;


            const recoveryFactor = (1 + this.profitPercentage) / this.profitPercentage;
            nextStake = cumulativeLosses * recoveryFactor + this.baseStake;

            // Calculate the next stake using the formula: S_next = (L * (1 + PP)) / PP + S
            const maxRecoveryStake = 1000; // Set a maximum recovery stake
            nextStake = Math.min((cumulativeLosses * (1 + this.profitPercentage)) / this.profitPercentage + this.baseStake, maxRecoveryStake);
        }

        

        // Ensure the stake is within the minimum and maximum limits
        return Math.min(Math.max(nextStake, this.minStake), this.maxStake);
    }

    // Start trading with recovery logic (public)
    async startTrading(market: string, stake: number, takeProfit: number, stopLoss: number): Promise<void> {

        // Input validation
        if (stake <= 0) throw new Error('Stake must be a positive number.');
        if (!market) throw new Error('Market cannot be empty.');

        this.defaultMarket = market;
        this.baseStake = stake;
        this.currentStake = stake;
        this.takeProfit = takeProfit;
        this.stopLoss = stopLoss;
        this.isTrading = true;

        while (this.isTrading) {
            try {
                // Determine the purchase type
                let purchaseType: PurchaseType = this.originalPurchaseType || 'DIGITDIFF';
                let response: ContractResponse;




                //TODO
                /*

                const riskRewardRatio = potentialProfit / potentialLoss;

                if (riskRewardRatio < 2) {
                    console.log('Risk-Reward ratio too low. Skipping trade.');
                    return;
                }\
                */


                if (this.recoveryTrades > 0) {
                    // Switch to DIGIT UNDER 9 for recovery
                    purchaseType = 'DIGITUNDER';
                    response = await this.purchaseDigitUnder9();
                } else {
                    // Use the original purchase type
                    if (purchaseType === 'DIGITDIFF') {
                        response = await this.purchaseDigitDiff(7); // Example: Predict digit 7
                    } else if (purchaseType === 'DIGITUNDEROVER') {
                        response = await this.purchaseDigitUnderOver('UNDER', 5); // Example: Predict UNDER 5
                    } else {
                        throw new Error('Unknown purchase type.');
                    }
                }

                // Check if the trade was successful
                const resultIsWin: boolean = (response.buy?.profit ?? 0) > 0;
                const profitAfterSale: number = resultIsWin ? response.buy!.profit : -this.currentStake;

                // Update profit
                this.profit += profitAfterSale;

                const individualStopLoss = 10; // Example: Stop loss of $10 per trade
                if (profitAfterSale <= -individualStopLoss) {
                    console.log('Individual Stop Loss reached. Stopping trade.');
                    this.stopTrading();
                    break;
                }

                // Calculate the next trading amount
                this.currentStake = this.getTradingAmount(resultIsWin, profitAfterSale, purchaseType);

                // Check if take profit is reached
                if (this.profit >= takeProfit) {
                    console.log('Take Profit reached. Stopping trading.');
                    this.stopTrading();
                    break;
                }

                // Check if stop loss is reached
                if (this.profit <= -stopLoss) {
                    console.log('Stop Loss reached. Stopping trading.');
                    this.stopTrading();
                    break;
                }

                // Reset recovery trades counter if a trade is successful
                if (resultIsWin) {
                    this.recoveryTrades = 0;
                    this.originalPurchaseType = null; // Reset to original purchase type
                } else {
                    this.recoveryTrades++;

                    //TODO

                    // Stop trading if max recovery trades reached
                    if (this.recoveryTrades >= this.maxRecoveryTrades) {
                        console.log('Max recovery trades reached. Stopping trading.');
                        this.stopTrading();
                        break;
                    }

                    if (this.recoveryTrades >= 3) {
                        console.log('Max recovery trades reached. Resetting stake.');
                        this.currentStake = this.baseStake;
                        this.recoveryTrades = 0;
                    }

                    // Sleep for 3 seconds after a loss

                    const marketVolatility = 1;
                    const threshold = 1;
                    const sleepDuration = marketVolatility > threshold ? 1000 : 3000; // Adjust based on volatility
                    await this.sleep(sleepDuration);

                }
            } catch (error) {
                console.error('Error during trading:', error);
                this.stopTrading();
                break;
            }
        }
    }


    async checkContract() {

        try {
            const account = await this.api.account('BOT TOKEN');

            const { balance, currency } = account;

            console.log(`Your current balance is: ${balance.currency} ${balance.display}`);

            balance.onUpdate(() => {
                console.log(`Your new balance is: ${balance.currency} ${balance.display}`);
            });

            const contract = await this.api.contract({
                contract_type: 'CALL',
                currency,
                amount: 10,
                duration: 15,
                duration_unit: 'm',
                symbol: 'frxUSDJPY',
                basis: 'stake',
            });

            contract.onUpdate(({ status, payout, bid_price }: any) => {
                switch (status) {
                    case 'proposal':
                        return console.log(
                            `Current payout: ${payout.currency} ${payout.display}`,
                        );
                    case 'open':
                        return console.log(
                            `Current bid price: ${bid_price.currency} ${bid_price.display}`,
                        );
                    default:
                        break;
                }
            });

            // Wait until payout is greater than USD 19
            await contract.onUpdate()
                .pipe(find(({ payout }: any) => payout.value >= this.expected_payout)).toPromise();

            const buy = await contract.buy();

            console.log(`Buy price is: ${buy.price.currency} ${buy.price.display}`);

            // Wait until the contract is sold
            await contract.onUpdate().pipe(find(({ is_sold }: any) => is_sold)).toPromise();

            const { profit, status } = contract;

            console.log(`You ${status}: ${profit.currency} ${profit.display}`);
        } catch (err) {
            console.error(err);
        } finally {
            // Close the connection and exit
            this.api.basic.disconnect();
        }

    }


    // Stop trading (public)
    async stopTrading(): Promise<void> {
        console.log('Stopping trading...');
        this.isTrading = false;
        this.connection.close();
    }
}

export default DerivAutoTradingBot;