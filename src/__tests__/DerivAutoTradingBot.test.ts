import { expect } from 'chai';
import sinon from 'sinon';
import { WebSocket } from 'ws';
import { pino } from 'pino';
import { parseTimeToSeconds } from "@/common/utils/snippets";
import { CONSTANTS } from "@/common/utils/constants";
import { env } from "@/common/utils/envConfig";
const DerivAutoTradingBotClass = require("../classes/deriv/DerivAutoTradingBotClass.ts");

let bot: typeof DerivAutoTradingBotClass;
let sandbox: sinon.SinonSandbox;
describe('DerivAutoTradingBotClass', () => {



    beforeEach(() => {
        sandbox = sinon.createSandbox();
        bot = new DerivAutoTradingBotClass();
    });

    afterEach(() => {
        sandbox.restore();
    });

    // Helper function to simulate WebSocket connection
    const simulateWebSocketConnection = () => {
        const mockWebSocket = new WebSocket('ws://localhost');
        sandbox.stub(global, 'WebSocket').returns(mockWebSocket);
        return mockWebSocket;
    };

    describe('Constructor', () => {
        it('should initialize with default values', () => {
            expect(bot.tradingType).to.equal('Derivatives 📊');
            expect(bot.defaultMarket).to.equal('R_100');
            //expect(bot.currentStake).to.equal(env.MIN_STAKE);
            //expect(bot.baseStake).to.equal(env.MIN_STAKE);
            //expect(bot.maxStake).to.equal(env.MAX_STAKE);
            //expect(bot.minStake).to.equal(env.MIN_STAKE);
            expect(bot.isTrading).to.be.false;
        });
    });

    describe('connect', () => {
        it('should establish a WebSocket connection and initialize the API', async () => {
            // const mockWebSocket = simulateWebSocketConnection();
            await bot.connect();

            expect(mockWebSocket.onopen).to.be.a('function');
            expect(mockWebSocket.onmessage).to.be.a('function');
            expect(mockWebSocket.onerror).to.be.a('function');
            expect(mockWebSocket.onclose).to.be.a('function');

            // Simulate WebSocket open event
            mockWebSocket.onopen(new Event('open'));
            expect(bot.isConnecting).to.be.false;
        });

        it('should handle connection errors and retry', async () => {
            // const mockWebSocket = simulateWebSocketConnection();
            sandbox.stub(bot, 'reconnect').resolves();

            await bot.connect();

            // Simulate WebSocket error event
            mockWebSocket.onerror(new Event('error'));
            //expect(bot.reconnect).to.have.been.calledOnce;
        });
    });

    describe('setAccount', () => {
        it('should set the user account details and balance', async () => {
            // const mockWebSocket = simulateWebSocketConnection();
            const mockAccount = {
                balance: {
                    amount: { _data: { currency: 'USD', value: 1000 } },
                    fullname: 'Test User',
                }
            };
            const mockBasic = { account: sandbox.stub().resolves(mockAccount) };
            sandbox.stub(bot, 'api').returns({ basic: mockBasic });

            await bot.setAccount();

            expect(bot.userBalance).to.deep.equal(['USD', 1000]);
            expect(bot.userAccount.fullname).to.equal('Test User');
        });

        it('should handle errors when setting the account', async () => {
            // const mockWebSocket = simulateWebSocketConnection();
            sandbox.stub(bot, 'api').returns({ basic: { account: sandbox.stub().rejects(new Error('Account error')) } });

            try {
                await bot.setAccount();
            } catch (error: any) {
                expect(error.message).to.equal('Account error');
            }
        });
    });
});

describe('purchaseContract', () => {
    it('should purchase a contract and return trade data', async () => {
        // const mockWebSocket = simulateWebSocketConnection();
        const mockContract = {
            onUpdate: sandbox.stub(),
            buy: sandbox.stub().resolves(),
            symbol: { short: 'R_100', full: 'R_100' },
            start_time: { _data: { internal: { $d: new Date() } } },
            expiry_time: { _data: { internal: { $d: new Date() } } },
            purchase_time: { _data: { internal: { $d: new Date() } } },
            entry_spot: { _data: { value: 100, time: { _data: { internal: { $d: new Date() } } } } },
            exit_spot: { _data: { value: 105, time: { _data: { internal: { $d: new Date() } } } } },
            ask_price: { _data: { currency: 'USD', value: 10 } },
            buy_price: { _data: { currency: 'USD', value: 10 } },
            bid_price: { _data: { currency: 'USD', value: 10 } },
            sell_price: { _data: { currency: 'USD', value: 10 } },
            payout: { value: 20, currency: 'USD' },
            profit: { _data: { value: 10, percentage: 100, is_win: true, sign: 1 } },
            status: 'sold',
            longcode: 'Test Longcode',
            proposal_id: 123,
            audit_details: { all_ticks: [] },
            ticks: [1, 2, 3],
        };
        const mockBasic = { contract: sandbox.stub().resolves(mockContract) };
        sandbox.stub(bot, 'api').returns({ basic: mockBasic });

        const contractParameters = {
            amount: 10,
            basis: 'stake',
            contract_type: 'DIGITDIFF',
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol: 'R_100',
            barrier: '1',
        };

        const result = await bot.purchaseContract(contractParameters);

        expect(result.symbol_short).to.equal('R_100');
        expect(result.profit_value).to.equal(10);
        expect(result.profit_is_win).to.be.true;
    });

    it('should handle errors during contract purchase', async () => {
        // const mockWebSocket = simulateWebSocketConnection();
        sandbox.stub(bot, 'api').returns({ basic: { contract: sandbox.stub().rejects(new Error('Purchase error')) } });

        const contractParameters = {
            amount: 10,
            basis: 'stake',
            contract_type: 'DIGITDIFF',
            currency: 'USD',
            duration: 1,
            duration_unit: 't',
            symbol: 'R_100',
            barrier: '1',
        };

        try {
            await bot.purchaseContract(contractParameters);
        } catch (error: any) {
            expect(error.message).to.equal('Purchase error');
        }
    });
});

describe('startTrading', () => {
    it('should start trading and stop when take profit is reached', async () => {
        // const mockWebSocket = simulateWebSocketConnection();
        sandbox.stub(bot, 'purchaseNextContract').resolves({
            symbol_short: 'R_100',
            profit_value: 100,
            profit_sign: 1,
            profit_is_win: true,
        } as any);
        sandbox.stub(bot, 'sleep').resolves();
        sandbox.stub(bot, 'stopTrading').resolves();

        const session = {
            market: 'R_100',
            contractType: 'DIGITDIFF',
            stake: 10,
            takeProfit: 100,
            stopLoss: 50,
            tradeDuration: '1h',
            updateFrequency: '10m',
        };

        await bot.startTrading(session);

        //expect(bot.stopTrading).to.have.been.calledWith('Take Profit reached. TP[undefined 100]. Stopping trades...');
    });

    it('should stop trading when stop loss is reached', async () => {
        // const mockWebSocket = simulateWebSocketConnection();
        sandbox.stub(bot, 'purchaseNextContract').resolves({
            symbol_short: 'R_100',
            profit_value: -50,
            profit_sign: -1,
            profit_is_win: false,
        } as any);
        sandbox.stub(bot, 'sleep').resolves();
        sandbox.stub(bot, 'stopTrading').resolves();

        const session = {
            market: 'R_100',
            contractType: 'DIGITDIFF',
            stake: 10,
            takeProfit: 100,
            stopLoss: 50,
            tradeDuration: '1h',
            updateFrequency: '10m',
        };

        await bot.startTrading(session);

        //expect(bot.stopTrading).to.have.been.calledWith('Stop Loss reached. SL[undefined -50]. Stopping trades...');
    });
});

describe('stopTrading', () => {
    it('should stop trading and reset state', async () => {
        // const mockWebSocket = simulateWebSocketConnection();
        sandbox.stub(bot, 'disconnect').resolves();
        sandbox.stub(bot, 'generateTradingSummary').resolves();
        sandbox.stub(bot, 'garbageCollect').resolves();
        sandbox.stub(bot, 'resetState').resolves();

        await bot.stopTrading('Test stop trading');

        expect(bot.isTrading).to.be.false;
        //expect(bot.disconnect).to.have.been.calledOnce;
        //expect(bot.generateTradingSummary).to.have.been.calledOnce;
        //expect(bot.garbageCollect).to.have.been.calledOnce;
        //expect(bot.resetState).to.have.been.calledOnce;
    });
});
