global.WebSocket = require('ws');
const { find } = require('rxjs/operators');
const DerivAPI = require('@deriv/deriv-api/dist/DerivAPI');

import 'dotenv/config';

// Define types for better type safety
const PurchaseTypeEnum = {
    DigitDiff: 'DIGITDIFF',
    DigitOver: 'DIGITOVER',
    DigitUnder: 'DIGITUNDER',
    DigitOver0Under9: 'DIGITUNDER9_DIGITOVER_0',
    DigitOver1Under8: 'DIGITUNDER8_DIGITOVER_1',
    DigitOver2Under7: 'DIGITUNDER7_DIGITOVER_2',
    DigitEven: 'EVEN',
    DigitOdd: 'ODD'
};
type PurchaseType = 'DIGITDIFF' | 'DIGITOVER' | 'DIGITUNDER' | 'DIGITUNDER9_DIGITOVER_0' | 'DIGITUNDER8_DIGITOVER_1' | 'DIGITUNDER7_DIGITOVER_2' | 'EVEN' | 'ODD' | PurchaseTypeEnum;
type TradingType = 'FOREX' | 'VOLATILITY' | 'CRYPTO' | 'COMMODITIES';
type MarketType = 'R_100';
type Prediction = 'UNDER' | 'OVER';
type ContractResponse = {
    buy?: {
        profit: number;
    };
};

class DerivAutoTradingBot {
    // Private properties with explicit types
    private _tradingType: TradingType;
    private _defaultMarket: MarketType;
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

    expected_payout = process.env.EXPECTED_PAYOUT || 10.25;

    constructor(tradingType: TradingType = 'VOLATILITY', defaultMarket: MarketType = 'R_100') {
        // Initialize Deriv API
        this.connection = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

        this.connection.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.reconnect();
        };

        this.api = new DerivAPI({ connection: this.connection });

        // Initialize private properties with explicit types
        this._tradingType = tradingType;
        this._defaultMarket = defaultMarket;
        this._currentStake = parseFloat(process.env.MIN_STAKE || '0.35');
        this._baseStake = parseFloat(process.env.MIN_STAKE || '0.35');
        this._maxStake = parseFloat(process.env.MAX_STAKE || '1000');
        this._minStake = parseFloat(process.env.MIN_STAKE || '0.35');
        this._maxRecoveryTrades = parseInt(process.env.MAX_RECOVERY_TRADES || '5');
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

        const { balance } = account;

        console.log(`Balance:`, [balance.currency, parseFloat(balance.display)]);

        balance.onUpdate((val:any) => {
            console.log(`Balance:`, [val.currency, parseFloat(val.value)]);
        });

        return account;

    }


    // Getters and Setters for private properties
    get tradingType(): TradingType {
        return this._tradingType;
    }

    set tradingType(value: TradingType) {
        this._tradingType = value;
    }

    get defaultMarket(): MarketType {
        return this._defaultMarket;
    }

    set defaultMarket(value: MarketType) {
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
            duration: 1,
            duration_unit: 't',
            symbol: this.defaultMarket,
            barrier: predictedDigit.toString(),
        };

        // Calculate profit percentage for DIGIT DIFF
        this.profitPercentage = this.calculateProfitPercentage(PurchaseTypeEnum.DigitDiff, this.currentStake);

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT OVER contract (private)
    private async purchaseDigitOver(barrier: number): Promise<ContractResponse> {
        const contractParameters = {
            proposal: 1,
            amount: this.currentStake.toString(),
            basis: 'stake',
            contract_type: 'DIGITOVER',
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol: this.defaultMarket,
            barrier: barrier.toString(),
        };

        // Calculate profit percentage for DIGIT OVER
        this.profitPercentage = this.calculateProfitPercentage(PurchaseTypeEnum.DigitOver, this.currentStake);

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT OVER 0 contract (private)
    private async purchaseDigitOver0(): Promise<ContractResponse> {
        const contractParameters = {
            proposal: 1,
            amount: this.currentStake.toString(),
            basis: 'stake',
            contract_type: 'DIGITOVER',
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol: this.defaultMarket,
            barrier: 0,
        };

        // Calculate profit percentage for DIGIT UNDER 9
        this.profitPercentage = this.calculateProfitPercentage(PurchaseTypeEnum.DigitOver0Under9, this.currentStake);

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT OVER 1 contract (private)
    private async purchaseDigitOver1(): Promise<ContractResponse> {
        const contractParameters = {
            proposal: 1,
            amount: this.currentStake.toString(),
            basis: 'stake',
            contract_type: 'DIGITOVER',
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol: this.defaultMarket,
            barrier: 1,
        };

        // Calculate profit percentage for DIGIT OVER 1
        this.profitPercentage = this.calculateProfitPercentage(PurchaseTypeEnum.DigitOver1Under8, this.currentStake);

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT OVER 2 contract (private)
    private async purchaseDigitOver2(): Promise<ContractResponse> {
        const contractParameters = {
            proposal: 1,
            amount: this.currentStake.toString(),
            basis: 'stake',
            contract_type: 'DIGITOVER',
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol: this.defaultMarket,
            barrier: 2,
        };

        // Calculate profit percentage for DIGIT OVER 2
        this.profitPercentage = this.calculateProfitPercentage(PurchaseTypeEnum.DigitOver2Under7, this.currentStake);

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT UNDER contract (private)
    private async purchaseDigitUnder(barrier: number): Promise<ContractResponse> {
        const contractParameters = {
            proposal: 1,
            amount: this.currentStake.toString(),
            basis: 'stake',
            contract_type: 'DIGITUNDER',
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol: this.defaultMarket,
            barrier: barrier.toString(),
        };

        // Calculate profit percentage for DIGIT UNDER
        this.profitPercentage = this.calculateProfitPercentage(PurchaseTypeEnum.DigitUnder, this.currentStake);

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT UNDER 9 contract (private)
    private async purchaseDigitUnder9(): Promise<ContractResponse> {
        const contractParameters = {
            proposal: 1,
            amount: this.currentStake.toString(),
            basis: 'stake',
            contract_type: 'DIGITUNDER',
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol: this.defaultMarket,
            barrier: 9,
        };

        // Calculate profit percentage for DIGIT UNDER 9
        this.profitPercentage = this.calculateProfitPercentage(PurchaseTypeEnum.DigitOver0Under9, this.currentStake);

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT UNDER 8 contract (private)
    private async purchaseDigitUnder8(): Promise<ContractResponse> {
        const contractParameters = {
            proposal: 1,
            amount: this.currentStake.toString(),
            basis: 'stake',
            contract_type: 'DIGITUNDER',
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol: this.defaultMarket,
            barrier: 8,
        };

        // Calculate profit percentage for DIGIT UNDER 8
        this.profitPercentage = this.calculateProfitPercentage(PurchaseTypeEnum.DigitOver1Under8, this.currentStake);

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT UNDER 7 contract (private)
    private async purchaseDigitUnder7(): Promise<ContractResponse> {
        const contractParameters = {
            proposal: 1,
            amount: this.currentStake.toString(),
            basis: 'stake',
            contract_type: 'DIGITUNDER',
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol: this.defaultMarket,
            barrier: 7,
        };

        // Calculate profit percentage for DIGIT UNDER 7
        this.profitPercentage = this.calculateProfitPercentage(PurchaseTypeEnum.DigitOver2Under7, this.currentStake);

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT EVEN contract (private)
    private async purchaseDigitEven(): Promise<ContractResponse> {
        const contractParameters = {
            proposal: 1,
            amount: this.currentStake.toString(),
            basis: 'stake',
            contract_type: 'DIGITEVEN',
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol: this.defaultMarket,
            barrier: 'EVEN',
        };

        // Calculate profit percentage for DIGIT EVEN
        this.profitPercentage = this.calculateProfitPercentage(PurchaseTypeEnum.DigitEven, this.currentStake);

        return this.purchaseContract(contractParameters);
    }

    // Purchase DIGIT ODD contract (private)
    private async purchaseDigitOdd(): Promise<ContractResponse> {
        const contractParameters = {
            proposal: 1,
            amount: this.currentStake.toString(),
            basis: 'stake',
            contract_type: 'DIGITODD',
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol: this.defaultMarket,
            barrier: 'ODD',
        };

        // Calculate profit percentage for DIGIT ODD
        this.profitPercentage = this.calculateProfitPercentage(PurchaseTypeEnum.DigitOdd, this.currentStake);

        return this.purchaseContract(contractParameters);
    }

    private async fetchProfitPercentage(purchaseType: PurchaseType): Promise<number> {
        const response = await this.api.getContractTypes();
        return response[purchaseType].profitPercentage;
    }

    // Calculate profit percentage based on purchase type and prediction (private)
    private calculateProfitPercentage(purchaseType: PurchaseType, stake: number): number {

        let rewardPercentage: number = 0;

        // Define the reward percentages for Even
        const evenRewards = [
            { stake: 0.35, reward: 0.8857 },
            { stake: 0.50, reward: 0.92 },
            { stake: 0.75, reward: 0.9467 },
            { stake: 1, reward: 0.95 },
            { stake: 2, reward: 0.955 },
            { stake: 3, reward: 0.9533 },
            { stake: 4, reward: 0.9525 },
            { stake: 5, reward: 0.954 }
        ];

        // Define the reward percentages for Digit Differs
        const digitDiffersRewards = [
            { stake: 0.35, reward: 0.0571 },
            { stake: 0.50, reward: 0.06 },
            { stake: 0.75, reward: 0.08 },
            { stake: 1, reward: 0.09 },
            { stake: 2, reward: 0.095 },
            { stake: 3, reward: 0.0967 },
            { stake: 4, reward: 0.0975 },
            { stake: 5, reward: 0.0967 }
        ];

        // Define the rewards for Digit Over/Under conditions
        const digitOverUnderRewards = [
            { stake: 0.35, reward: 0.0571 },
            { stake: 0.50, reward: 0.06 },
            { stake: 0.75, reward: 0.08 },
            { stake: 1, reward: 0.09 },
            { stake: 2, reward: 0.095 },
            { stake: 3, reward: 0.0967 },
            { stake: 4, reward: 0.0975 },
            { stake: 5, reward: 0.0967 }
        ];

        const digitOver1Under8Rewards = [
            { stake: 0.35, reward: 0.1714 },
            { stake: 0.50, reward: 0.20 },
            { stake: 0.75, reward: 0.2133 },
            { stake: 1, reward: 0.23 },
            { stake: 2, reward: 0.23 },
            { stake: 3, reward: 0.23 },
            { stake: 4, reward: 0.2325 },
            { stake: 5, reward: 0.232 }
        ];

        const digitOver2Under7Rewards = [
            { stake: 0.35, reward: 0.3429 },
            { stake: 0.50, reward: 0.38 },
            { stake: 0.75, reward: 0.3867 },
            { stake: 1, reward: 0.40 },
            { stake: 2, reward: 0.405 },
            { stake: 3, reward: 0.4033 },
            { stake: 4, reward: 0.405 },
            { stake: 5, reward: 0.404 }
        ];

        // Determine the appropriate rewards based on purchaseType and stakes
        if (purchaseType === PurchaseTypeEnum.DigitEven || purchaseType === PurchaseTypeEnum.DigitOdd) {
            if (stake < evenRewards[evenRewards.length - 1].stake) {
                for (const entry of evenRewards) {
                    if (stake < entry.stake) {
                        break;
                    }
                    rewardPercentage = entry.reward;
                }
                return (rewardPercentage * 100); // Return percentage as a whole number

            } else {
                return (evenRewards[evenRewards.length - 1].reward * 100); // Return percentage as a whole number
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
                return (rewardPercentage * 100); // Return percentage as a whole number
            } else {
                return (digitDiffersRewards[digitDiffersRewards.length - 1].reward * 100); // Return percentage as a whole number
            }
        }

        if (purchaseType === PurchaseTypeEnum.DigitOver0Under9) {
            if (stake < digitOverUnderRewards[digitOverUnderRewards.length - 1].stake) {
                for (const entry of digitOverUnderRewards) {
                    if (stake < entry.stake) {
                        break;
                    }
                    rewardPercentage = entry.reward;
                }
                return (rewardPercentage * 100); // Return percentage as a whole number
            } else {
                return (digitOverUnderRewards[digitOverUnderRewards.length - 1].reward * 100); // Return percentage as a whole number
            }
        }

        if (purchaseType === PurchaseTypeEnum.DigitOver1Under8) {
            if (stake < digitOver1Under8Rewards[digitOver1Under8Rewards.length - 1].stake) {
                for (const entry of digitOver1Under8Rewards) {
                    if (stake < entry.stake) {
                        break;
                    }
                    rewardPercentage = entry.reward;
                }
                return (rewardPercentage * 100); // Return percentage as a whole number
            } else {
                return (digitOver1Under8Rewards[digitOver1Under8Rewards.length - 1].reward * 100); // Return percentage as a whole number
            }
        }

        if (purchaseType === PurchaseTypeEnum.DigitOver2Under7) {
            if (stake < digitOver2Under7Rewards[digitOver2Under7Rewards.length - 1].stake) {
                for (const entry of digitOver2Under7Rewards) {
                    if (stake < entry.stake) {
                        break;
                    }
                    rewardPercentage = entry.reward;
                }
                return (rewardPercentage * 100); // Return percentage as a whole number
            } else {
                return (digitOver2Under7Rewards[digitOver2Under7Rewards.length - 1].reward * 100); // Return percentage as a whole number
            }
        }

        return -1; // In case of an unsupported purchase type
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
    async startTrading(market: MarketType, purchaseType: PurchaseType, stake: number, takeProfit: number, stopLoss: number): Promise<void> {

        // Input validation
        if (stake <= 0) throw new Error('Stake must be a positive number.');
        if (!market) throw new Error('Market cannot be empty.');

        this.defaultMarket = market;
        this.originalPurchaseType = purchaseType;
        this.baseStake = stake;
        this.currentStake = stake;
        this.takeProfit = takeProfit;
        this.stopLoss = stopLoss;
        this.isTrading = true;

        while (this.isTrading) {
            try {

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

                    if (this.recoveryTrades >= 3) {
                        console.log('Max recovery trades reached. Resetting stake.');
                        this.currentStake = this.baseStake;
                        this.recoveryTrades = 0;
                    }

                    // Stop trading if max recovery trades reached
                    if (this.recoveryTrades >= this.maxRecoveryTrades) {
                        console.log('Max recovery trades reached. Stopping trading.');
                        this.stopTrading();
                        break;
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
            const account = await this.api.account(process.env.DERIV_BOT_TOKEN);

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