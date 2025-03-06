
import { env } from "@/common/utils/envConfig";

import { CONSTANTS } from "@/common/utils/constants";

import { pino } from "pino";
import { parseTimeToSeconds } from "@/common/utils/snippets";

import { ITradeData, TradeData } from '@/classes/deriv/TradingDataClass';

import { DerivUserAccount, IDerivUserAccount } from '@/classes/deriv/DerivUserAccountClass';

const { parentPort } = require("node:worker_threads");

global.WebSocket = require("ws");
const { find } = require("rxjs/operators");
const DerivAPI = require("@deriv/deriv-api/dist/DerivAPI");

const fs = require("fs");
const path = require("path");

const jsan = require("jsan");

const logger = pino({ name: "DerivTradingBot" });

const {
  CONNECTION_MAXIMUM_ATTEMPTS,
  CONNECTION_PING_TIMEOUT,
  CONNECTION_CONTRACT_CREATION_TIMEOUT,
  CONNECTION_RETRY_DELAY,
  DERIV_APP_ENDPOINT,
  DERIV_APP_ID,
  DERIV_APP_TOKEN,
  MIN_STAKE,
  MAX_STAKE,
  MAX_RECOVERY_TRADES_X2,
  MAX_RECOVERY_TRADES_X10,
} = env;

// Define types for better type safety
type PurchaseType =
  | "DIGITDIFF"
  | "DIGITOVER"
  | "DIGITUNDER"
  | "DIGITUNDER9_DIGITOVER_0"
  | "DIGITUNDER8_DIGITOVER_1"
  | "DIGITUNDER7_DIGITOVER_2"
  | "EVEN"
  | "ODD"
  | "CALL"
  | "PUT"
  | "ACCU";

const PurchaseTypeEnum = {
  DigitDiff: "DIGITDIFF",
  DigitOver: "DIGITOVER",
  DigitUnder: "DIGITUNDER",
  DigitOver0Under9: "DIGITUNDER9_DIGITOVER_0",
  DigitOver1Under8: "DIGITUNDER8_DIGITOVER_1",
  DigitOver2Under7: "DIGITUNDER7_DIGITOVER_2",
  DigitEven: "EVEN",
  DigitOdd: "ODD",
  Call: "CALL",
  Put: "PUT",
  Acc: "ACCU",
};

type TradingType = "FOREX" | "Derivatives 📊" | "CRYPTO" | "COMMODITIES";
type MarketType = "R_100" | "R_75" | "R_50" | "R_25";
type ContractResponse = {
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
};

/*
loginid (String)
user_id (String)
email (String)
country (String)
currency (String)
risk (String)
show_authentication (Boolean)
landing_company (FullName)
balance (Balance)
transactions (Transactions)
status_codes (Array<string>)
siblings (Array<any>)
contracts (Array<Contract>)
open_contracts (Array<Contract>)
closed_contracts (Array<Contract>)
api_tokens (Array<string>)
*/

type UserAccount = {
  loginid: string;
  user_id: string;
  email: string;
  country: string;
  currency: string;
  risk: string;
  show_authentication: boolean;
  landing_company: string;
  balance: BalanceParams;
  transactions: TransactionsParams;
  status_codes: Array<string>;
  siblings: Array<any>;
  contracts: Array<ContractParams>;
  open_contracts: Array<ContractParams>;
  closed_contracts: Array<ContractParams>;
  api_tokens: Array<string>;
  buy: (arg0: ContractParams) => ContractResponse;
  contract: (arg0: ContractParams) => ContractResponse;
};

/*
    contract_type (String)
    amount (Number)
    barrier (String)
    barrier2 (String)
    expiry_time ((Number | Date)) : epoch in seconds or Date
    start_time ((Number | Date)) : epoch in seconds or Date
    Currency (String?) : Default is the account currency
    basis (String) : stake or payout
    duration ((Number | String)) : duration with unit or duration in number
    duration_unit (String?) : duration unit, required if duration is number
    product_type (String?) : 'multi_barrier' or 'basic'
    */
type ContractParams = {
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
};

/*
status (String) : 'proposal', 'open', 'expired', 'sold', 'won', 'lost'
ask_price (Monetary) : Price to pay to buy a contract
type (String) : contract type
payout (Monetary) : Potential or realized payout
longcode (String)
symbol (String)
currency (String)
current_spot (Spot)
start_time (CustomDate) : Start time of the contract (estimated for proposal)
buy_price (Monetary?) : (After buy)
bid_price (Monetary?) : (After buy)
sell_price (Monetary?) : (After sell)
profit (Profit?) : Potential or realized profit (After buy)
proposal_id (Number?) : The proposal ID used to buy
id (Number?) : The contract ID (After buy)
purchase_time (CustomDate?) : (After buy)
expiry_time (CustomDate?) : (After buy)
sell_time (CustomDate?) : (After sell)
barrier_count (Number?) : (For contracts with barrier)
high_barrier (MarketValue?) : (For contracts with two barriers)
low_barrier (MarketValue?) : (For contracts with two barriers)
barrier (MarketValue?) : (For contracts with one barrier)
tick_count (Number?) : (For tick contracts)
ticks (Array<Tick>?) : (For tick contracts)
multiplier (Number?) : (For loopback contracts)
shortcode (String?)
validation_error (String?)
is_forward_starting (Boolean?)
is_intraday (Boolean?)
is_path_dependent (Boolean?)
is_valid_to_sell (Boolean?) : We still allow a sell call, let API handle the error
is_expired (Boolean?)
is_settleable (Boolean?)
is_open (Boolean?) : Is this contract still open
entry_spot (Spot?)
exit_spot (Spot?)
audit_details (Object?)
code (FullName?) : only if both short and long codes are available
*/
type ContractProps = {
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
};

/*
amount Number	[Optional] Proposed contract payout or stake, or multiplier (for lookbacks).
barrier String	[Optional] Barrier for the contract (or last digit prediction for digit contracts). Contracts less than 24 hours in duration would need a relative barrier (barriers which need +/-), where entry spot would be adjusted accordingly with that amount to define a barrier, except for Synthetic Indices as they support both relative and absolute barriers. Not needed for lookbacks.
barrier2 String	[Optional] Low barrier for the contract (for contracts with two barriers). Contracts less than 24 hours in duration would need a relative barrier (barriers which need +/-), where entry spot would be adjusted accordingly with that amount to define a barrier, except for Synthetic Indices as they support both relative and absolute barriers. Not needed for lookbacks.
barrier_range String	[Optional] Barrier range for callputspread.
basis String	[Optional] Indicates type of the amount .
cancellation String	Cancellation duration option (only for MULTUP and MULTDOWN contracts).
contract_type String	The proposed contract type
currency String	This can only be the account-holder's currency (obtained from payout_currencies call).
date_expiry Number	[Optional] Epoch value of the expiry time of the contract. Either date_expiry or duration is required.
date_start Number	[Optional] Indicates epoch value of the starting time of the contract. If left empty, the start time of the contract is now.
duration Number	[Optional] Duration quantity. Either date_expiry or duration is required.
duration_unit String	[Optional] Duration unit - s : seconds, m : minutes, h : hours, d : days, t : ticks.
limit_order Any	
multiplier Number	[Optional] The multiplier for non-binary options. E.g. lookbacks.
passthrough Any	[Optional] Used to pass data through the websocket, which may be retrieved via the echo_req output field.
product_type String	[Optional] The product type.
proposal Number	Must be 1
req_id Number	[Optional] Used to map request to response.
selected_tick Number	[Optional] The tick that is predicted to have the highest/lowest value - for TICKHIGH and TICKLOW contracts.
subscribe Number	[Optional] 1 - to initiate a realtime stream of prices. Note that tick trades (without a user-defined barrier), digit trades and less than 24 hours at-the-money contracts for the following underlying symbols are not streamed: R_10 , R_25 , R_50 , R_75 , R_100 , RDBULL , RDBEAR (this is because their price is constant).
symbol String	The short symbol name (obtained from active_symbols call).
trading_period_start Number	[Optional] Required only for multi-barrier trading. Defines the epoch value of the trading period start time.
*/
type ProposalParams = {
  amount?: number;
  barrier?: string;
  barrier2?: string;
  barrier_range: string;
  basis?: string;
  cancellation: string;
  contract_type: string;
  currency: string;
  date_expiry?: number;
  date_start?: number;
  duration?: number;
  duration_unit?: string;
  limit_order?: any;
  multiplier?: number;
  passthrough?: any;
  product_type?: string;
  proposal: number;
  req_id?: number;
  selected_tick?: number;
  subscribe?: number;
  symbol: string;
  trading_period_start?: number;
};

/*
account String	[Optional] If set to all , return the balances of all accounts one by one; if set to current , return the balance of current account; if set as an account id, return the balance of that account.
balance Number	Must be 1
passthrough Any	[Optional] Used to pass data through the websocket, which may be retrieved via the echo_req output field.
req_id Number	[Optional] Used to map request to response.
subscribe Number	[Optional] If set to 1, will send updates whenever the balance changes.
*/
type BalanceParams = {
  account: string;
  balance: number;
  passthrough?: any;
  req_id?: number;
  subscribe?: number;
};

/*
amount (Monetary)
value (Number) : numeric balance value
currency (String) : currency of the amount
display (String) : display value of amount (decimal point)
format (String) : formatted amount (decimal point, comma separated)
*/
type BalanceProps = {
  amount: Monetary;
  value: number;
  currency: string;
  display: string;
  format: string;
  onUpdate: any;
};

/*
value (Number)
currency (String)
display (String) : decimal value based on currency
format (String) : comma separated decimal value based on currency
*/
type Monetary = {
  value: number;
  currency: string;
  display: string;
  format: string;
};

/*
epoch (Number)
epoch_milliseconds (Number)
date (Date)
*/
type CustomDate = {
  epoch: number;
  epoch_milliseconds: number;
  date: Date;
};

/*
transaction.action String	
transaction.currency String	
transaction.amount Number	
transaction.balance Number	
transaction.high_barrier (String | Number)	
transaction.low_barrier (String | Number)	
transaction.barrier (String | Number)	
transaction.longcode String	
transaction.symbol String	
transaction.display_name String	Belongs to symbol
transaction.transaction_id Number	
transaction.contract_id Number	
transaction.purchase_time Number	
transaction.expiry_time Number	
transaction.transaction_time Number
*/
type TransactionsParams = {
  action?: string;
  currency?: string;
  amount?: number;
  balance?: number;
  high_barrier?: string | number;
  low_barrier?: string | number;
  barrier?: string | number;
  longcode?: string;
  symbol?: string;
  display_name?: string;
  id?: number;
  contract_id?: number;
  purchase_time?: number;
  expiry_time?: number;
  time: number;
};

/*
value (Number)
currency (String)
percentage (Number)
Properties
value (Number) : Absolute value of the profit
percentage (Number)
sign (Number) : 0: no profit, 1: positive profit, -1: loss
is_win (Boolean) : True if the initial profit is positive
currency (String)
display (String) : decimal value based on currency
format (String) : comma separated decimal value based on currency
*/
type Profit = {
  percentage?: number;
  value?: number;
  sign?: number;
  is_win?: boolean;
  currency?: string;
  display?: string;
  format?: string;
};

/*
value (Number)
pip (Number)
time (any)
Properties
pip_size (Number)
pip_sized (Number) : the pipsized value
time (CustomDate) : the spot time
*/
type Spot = {
  value?: number;
  pip?: number;
  pip_size?: number;
  pip_sized?: number;
  time?: CustomDate;
};

/*
tick.epoch (Number | String)	
tick.quote Number	
tick.ask Number	
tick.bid Number
*/
type Tick = {
  time: number | string;
  epoch: number | string;
  quote: number;
  ask: number;
  bid: number;
};

/*
value (Number)
pip (Number)
pip_size (Number)
pip_sized (Number) : the pipsized value
display (Number) : alias for pip_size
*/
type MarketValue = {
  value?: number;
  pip?: number;
  pip_size?: number;
  pip_sized?: number;
  display?: number;
};

/*
buy String	Either the ID received from a Price Proposal ( proposal call), or 1 if contract buy parameters are passed in the parameters field.
parameters Any	
passthrough Any	[Optional] Used to pass data through the websocket, which may be retrieved via the echo_req output field.
price Number	Maximum price at which to purchase the contract.
req_id Number	[Optional] Used to map request to response.
subscribe Number	[Optional] 1 to stream.
*/
type BuyParams = {
  buy: string;
  parameters: any;
  passthrough?: any;
  price: number;
  req_id?: number;
  subscribe?: number;
};

/*
buy.buy_price Monetary	
buy.balance_after Monetary	
buy.payout Monetary	
buy.start_time CustomDate	
buy.purchase_time CustomDate	
buy.contract_id Number	
buy.transaction_id Number	
buy.longcode String	
buy.shortcode String
*/
type BuyProps = {
  buy_price: Monetary;
  balance_after: Monetary;
  payout: Monetary;
  start_time: CustomDate;
  purchase_time: CustomDate;
  contract_id: number;
  transaction_id: number;
  longcode: string;
  shortcode: string;
};

/*
sell.sold_for Monetary	sell price
sell.balance_after Monetary	
sell.contract_id Number	
sell.transaction_id Number	sell transaction
sell.reference_id Number	buy transaction
*/
type SellProps = {
  sold_for?: Monetary;
  price?: Monetary;
  balance_after?: Monetary;
  contract_id?: number;
  transaction_id?: number;
  reference_id?: number;
  buy_transaction?: number;
};

/*
get_limits Number	Must be 1
passthrough Any	[Optional] Used to pass data through the websocket, which may be retrieved via the echo_req output field.
req_id Number	[Optional] Used to map request to response.
*/
type LimitsParams = {
  get_limits: number;
  passthrough?: any;
  req_id?: number;
};

/*
get_settings Number	Must be 1
passthrough Any	[Optional] Used to pass data through the websocket, which may be retrieved via the echo_req output field.
req_id Number	[Optional] Used to map request to response.
*/
type UserSettingsParams = {
  get_settings: number;
  passthrough?: any;
  req_id?: number;
};

/*
contract_type Any	Return only contracts of the specified types
date_from String	[Optional] Start date (epoch or YYYY-MM-DD)
date_to String	[Optional] End date (epoch or YYYY-MM-DD)
description Number	[Optional] If set to 1, will return full contracts description.
limit Number	[Optional] Apply upper limit to count of transactions received.
offset Number	[Optional] Number of transactions to skip.
passthrough Any	[Optional] Used to pass data through the websocket, which may be retrieved via the echo_req output field.
profit_table Number	Must be 1
req_id Number	[Optional] Used to map request to response.
sort String	[Optional] Sort direction.
*/

type ProfitTableParams = {
  contract_type: any;
  date_from: string;
  date_to: string;
  description: number;
  limit?: number;
  offset?: number;
  passthrough?: number;
  profit_table: number;
  req_id?: number;
  sort?: string;
};

/*
action_type String	[Optional] To filter the statement according to the type of transaction.
date_from Number	[Optional] Start date (epoch)
date_to Number	[Optional] End date (epoch)
description Number	[Optional] If set to 1, will return full contracts description.
limit Number	[Optional] Maximum number of transactions to receive.
offset Number	[Optional] Number of transactions to skip.
passthrough Any	[Optional] Used to pass data through the websocket, which may be retrieved via the echo_req output field.
req_id Number	[Optional] Used to map request to response.
statement Number	Must be 1
*/

type StatementParams = {
  action_type: string;
  date_from?: number;
  date_to?: number;
  description?: number;
  limit?: number;
  offset?: number;
  passthrough?: any;
  req_id?: number;
  statement: number;
};

/*
passthrough Any	[Optional] Used to pass data through the websocket, which may be retrieved via the echo_req output field.
req_id Number	[Optional] Used to map request to response.
subscribe Number	[Optional] If set to 1, will send updates whenever a new tick is received.
ticks Any	The short symbol name or array of symbols (obtained from active_symbols call).
*/

type TicksParams = {
  passthrough?: any;
  req_id?: number;
  subscribe?: number;
  ticks: string | [];
};

/*
adjust_start_time Number	[Optional] 1 - if the market is closed at the end time, or license limit is before end time, adjust interval backwards to compensate.
count Number	[Optional] An upper limit on ticks to receive.
end String	Epoch value representing the latest boundary of the returned ticks. If latest is specified, this will be the latest available timestamp.
granularity Number	[Optional] Only applicable for style: candles . Candle time-dimension width setting. (default: 60 ).
passthrough Any	[Optional] Used to pass data through the websocket, which may be retrieved via the echo_req output field.
req_id Number	[Optional] Used to map request to response.
start Number	[Optional] Epoch value representing the earliest boundary of the returned ticks.
For "style": "ticks": this will default to 1 day ago.
For "style": "candles": it will default to 1 day ago if count or granularity is undefined.
style String	[Optional] The tick-output style.
subscribe Number	[Optional] 1 - to send updates whenever a new tick is received.
ticks_history String	Short symbol name (obtained from the active_symbols call).
*/

type TickHistoryParams = {
  adjust_start_time?: number;
  count?: number;
  end: string;
  granularity: number;
  passthrough?: any;
  req_id?: number;
  start?: number;
  style?: string;
  subscribe?: number;
  ticks_history?: string;
};
class DerivAutoTradingBot {
  // Private properties with explicit types

  private _connectionAttempts:number;

  private _auditTrail: Array<any>;
  private _cachedSession: any
  private _pingIntervalID: NodeJS.Timeout | string | number | undefined | any;
  private _tradeDurationTimeoutID: NodeJS.Timeout | string | number | undefined | any;
  private _updateFrequencyTimeIntervalID: NodeJS.Timeout | string | number | undefined | any;
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

  private _cumulativeLossAmount: number;
  private _cumulativeLosses: number;
  private _numberOfWins: number;
  private _numberOfLosses: number;
  private _totalNumberOfRuns: number;

  private _tradeStartedAt: number;
  private _tradeDuration: number;
  private _updateFrequency: number;
  private _updateFrequencyLastRun: number;

  private _lastDigit: number;

  private _contractDuration: number;
  private _contractDurationUnit: string;

  private userAccount: IDerivUserAccount;

  private userAccountToken: string | null;

  private userBalance: [any, any]; //BalanceProps;

  expected_payout = process.env.EXPECTED_PAYOUT || 10.25;

  // Deriv API connection
  private connection: WebSocket | undefined;
  private isConnecting: boolean;
  private api: any;

  constructor(
    tradingType: TradingType = "Derivatives 📊",
    defaultMarket: MarketType = "R_100"
  ) {

    this._connectionAttempts = 0;

    this._auditTrail = [];
    this._cachedSession = null;

    this._pingIntervalID = undefined;

    this._tradeDurationTimeoutID = undefined

    this._updateFrequencyTimeIntervalID = undefined;

    this._tradingType = tradingType;
    this._defaultMarket = defaultMarket;

    this._currentStake = MIN_STAKE;
    this._baseStake = MIN_STAKE
    this._maxStake = MAX_STAKE;
    this._minStake = MIN_STAKE;
    this._maxRecoveryTrades = MAX_RECOVERY_TRADES_X2;
    this._recoveryTrades = 0;
    this._profit = 0;
    this._isTrading = false;
    this._takeProfit = 0;
    this._stopLoss = 0;
    this._consecutiveTrades = 0;
    this._profitPercentage = 0;
    this._originalPurchaseType = null;

    this._cumulativeLossAmount = 0;
    this._cumulativeLosses = 0;

    this._numberOfWins = 0;
    this._numberOfLosses = 0;
    this._totalNumberOfRuns = 0;

    this._tradeStartedAt = 0;
    this._tradeDuration = 0;
    this._updateFrequency = 0;
    this._updateFrequencyLastRun = 0;

    this._lastDigit = 0;

    this._contractDuration = 1;
    this._contractDurationUnit = "t";

    this._tradeDuration = 0;
    this._updateFrequency = 0;
    this._updateFrequencyLastRun = 0;

    this.userAccount = {} as IDerivUserAccount;
    this.userAccountToken = DERIV_APP_TOKEN;
    this.userBalance = ['', ''];

    this.connection = undefined;
    this.isConnecting = false;

    this.connect(()=>this.setAccount());

  }

  private async connect(callback?:any): Promise<void> {

    logger.warn(`Attempting connection: ${this._connectionAttempts} of ${CONNECTION_MAXIMUM_ATTEMPTS}`);

    if(this._connectionAttempts >= CONNECTION_MAXIMUM_ATTEMPTS){
      logger.warn("Have reached maximum connection attempts");
      return;
    }

    this._connectionAttempts++;

    logger.info("Connecting...");
    if (this.connection?.readyState === WebSocket.CONNECTING) {
      logger.warn("WebSocket.CONNECTING (0): The connection is not yet open.");
      return;
    }
    if (this.connection?.readyState === WebSocket.OPEN) {
      logger.warn("WebSocket.OPEN (1): The connection is open and ready to communicate.");
      return;
    }
    if (this.connection?.readyState === WebSocket.CLOSING) {
      logger.warn("WebSocket.CLOSING (2): The connection is in the process of closing.");
      return;
    }
    if (this.connection?.readyState === WebSocket.CLOSED) {
      logger.warn("WebSocket.CLOSED (3): The connection is closed or couldn't be opened.");
      return;
    }
    if (!this.isConnecting) {
      this.isConnecting = true;
      this.connection = new WebSocket(`${DERIV_APP_ENDPOINT}${DERIV_APP_ID}`);
      this.connection.onopen = (event) => {
        this.handleOpen(event, callback);
      }
      this.connection.onmessage = this.handleMessage.bind(this);
      this.connection.onerror = this.handleError.bind(this);
      this.connection.onclose = this.handleClose.bind(this);
    } else {
      logger.info("Already connecting...");
    }

  }
  // Event: Connection opened
  private async handleOpen(event: Event, callback?:any) {
    this.isConnecting = false;
    logger.info("WebSocket connection opened:");
    // Perform actions after connection is established
    logger.info("Initialize the Deriv API:");
    this.api = new DerivAPI({ connection: this.connection });
    logger.info("Start Ping <-> Pong:");
    this.ping();
    logger.info("Initialize the user account:");
    if(typeof callback === "function"){
      await callback(event);
    }
  }

  // Event: Message received
  private async handleMessage(response: MessageEvent) {
    this.isConnecting = false;
    console.log("Message received from server:", response.data);
    // Handle incoming data

    const data = JSON.parse(response.data);

    // Send message to TG
    // console.log("WEB SOCKET MESSAGE::", data);

    // If there's an error in the response, log the error message and disconnect
    if (data.error) {
      console.error("Error:", data.error.message);
      this.disconnect();
      setTimeout(async () => {
        await this.reconnect();
      }, CONNECTION_RETRY_DELAY);
      return;
    }

    // If the message type is 'website_status', log the relevant details
    if (data.msg_type === "website_status") {
      const websiteStatus = data.website_status;
      console.log("Website Status:", websiteStatus.site_status);
      console.log("Available Languages:", websiteStatus.supported_languages);
      console.log(
        "Terms & Conditions Version:",
        websiteStatus.terms_conditions_version
      );
      console.log("Broker Codes:", websiteStatus.broker_codes);
    }
  }

  // Event: Error occurred
  private async handleError(event: Event): Promise<void> {
    this.isConnecting = false;
    console.error("WebSocket error:", event);
    setTimeout(async () => {
      await this.reconnect();
    }, CONNECTION_RETRY_DELAY);
  }

  // Event: Connection closed
  private handleClose(event: CloseEvent) {
    this.isConnecting = false;
    console.log("WebSocket connection closed:", event);
    // Handle cleanup or reconnection
  }

  private async reconnect(): Promise<void> {
    await this.disconnect();
    this.sleep(1);
    logger.info("Reconnecting...");
    await this.connect();
  }

  private async disconnect(): Promise<void> {
    logger.info("Disconnecting...");
    this.connection?.close();
    this.connection?.removeEventListener("open", this.handleOpen);
    this.connection?.removeEventListener("message", this.handleMessage);
    this.connection?.removeEventListener("error", this.handleError);
    this.connection?.removeEventListener("close", this.handleClose);
    await this.sleep(1);
    this.connection = undefined;
    this.api = null;
    clearInterval(this._pingIntervalID);
  }

  private ping(): void {
    const basic = this.api.basic;
    // Sends a ping message every 30 seconds
    this._pingIntervalID = setInterval(() => {
      basic.ping().then((pong: any) => {
        logger.info(`Ping-Pong-Received : ${pong.req_id}`);
      });
    }, CONNECTION_PING_TIMEOUT);
  }

  private async setAccount(callBackFunction?: any, token?: string): Promise<any> {

    const basic = this.api.basic;

    if (token) {

      this.userAccountToken = token;

    }

    if (this.connection?.readyState !== WebSocket.OPEN) {
      
      setTimeout(async ()=>{

        await this.connect(()=>this.setAccount(callBackFunction, token));

      }, CONNECTION_RETRY_DELAY);

      return;
      
    }

    logger.info(`User token: ${this.userAccountToken}`);

    logger.info("this.connection.readyState", this.connection?.readyState)

    const account = await basic.account(this.userAccountToken);

    logger.info("Account initialized:");

    const balance: [any, any] = [
      account.balance.amount._data.currency,
      account.balance.amount._data.value,
    ];

    const userAccount: IDerivUserAccount = DerivUserAccount.parseDerivUserAccount(account);

    logger.info(`Welcome ${userAccount.fullname}`);

    this.userAccount = userAccount;

    this.userBalance = balance;

    logger.info(`Balance: ${this.userBalance[0]} ${this.userBalance[1]}`);

    account.balance.onUpdate((val: any) => {

      logger.info(`Balance: ${val._data.currency} ${val._data.value}`);

      this.userBalance = [val._data.currency, val._data.value];

    });

    if (typeof callBackFunction === "function") {

      callBackFunction();

    }

    this.getAccount();

    return account;

  }

  private getAccount(): IDerivUserAccount {

    console.log("USER::", this.userAccount, this.userAccountToken, this.userBalance);

    return this.userAccount;

  }

  private getBalance(): [any, any] {
    return this.userBalance;
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
  private sleep(s: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, s * 1000));
  }

  // Purchase a contract (private)
  private async purchaseNextContract(
    purchaseType: any
  ): Promise<ITradeData> {

    let response: ITradeData = {} as ITradeData;

    if (this._tradingType === CONSTANTS.TRADING_TYPES.FOREX) {
    }

    if (this._tradingType === CONSTANTS.TRADING_TYPES.COMMODITIES) {
    }

    if (this._tradingType === CONSTANTS.TRADING_TYPES.CRYPTO) {
    }

    if (this._tradingType === CONSTANTS.TRADING_TYPES.DERIVATIVES) {

      switch (purchaseType) {

        case "Auto ⬆️⬇️": {
          response = await this.purchaseAuto();
          break;
        }

        case "Rise ⬆️": {
          response = await this.purchaseCall();
          break;
        }

        case "Fall ⬇️": {
          response = await this.purchasePut();
          break;
        }

        case "Digits Auto 🎲": {
          response = await this.purchaseDigitAuto();
          break;
        }

        case "Digits Evens 1️⃣": {
          response = await this.purchaseDigitEven();
          break;
        }

        case "Digits Odds 0️⃣": {
          response = await this.purchaseDigitOdd();
          break;
        }

        case "Digits ⬇️9️⃣": {
          response = await this.purchaseDigitUnder9();

          break;
        }

        case "Digits ⬇️8️⃣": {
          response = await this.purchaseDigitUnder8();
          break;
        }

        case "Digits ⬇️7️⃣": {
          response = await this.purchaseDigitUnder7();
          break;
        }

        case "Digits ⬇️6️⃣": {
          response = await this.purchaseDigitUnder(6);
          break;
        }

        case "Digits ⬆️0️⃣": {
          response = await this.purchaseDigitOver0();
          break;
        }

        case "Digits ⬆️1️⃣": {
          response = await this.purchaseDigitOver1();
          break;
        }

        case "Digits ⬆️2️⃣": {
          response = await this.purchaseDigitOver2();
          break;
        }

        case "Digits ⬆️3️⃣": {
          response = await this.purchaseDigitOver(3);
          break;
        }

        case "Digit NOT Last 🔚": {
          response = await this.purchaseDigitDiff(this.getDigitNotLast());
          break;
        }

        case "Digit NOT Random 🎲": {
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

  // Purchase a contract (private)
  private async purchaseContract(
    contractParameters: ContractParams
  ): Promise<ITradeData> {

    const basic = this.api.basic;

    logger.info("Purchasing contract...");

    console.log(contractParameters);

    let audit: ITradeData = {} as ITradeData;

    logger.info("Trying...");

    try {

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Contract creation timed out")), CONNECTION_CONTRACT_CREATION_TIMEOUT) // 10-second timeout
      );

      logger.info("Creating contract...");

      const contractPromise = basic.contract(contractParameters);

      const contract: ContractResponse = await Promise.race([contractPromise, timeoutPromise]);

      logger.info("Contract created successfully");

      const onUpdateSubscription = contract.onUpdate(({ status, payout, bid_price }: any) => {
        switch (status) {
          case "proposal":
            return logger.info(
              `Payouts: ${payout.currency} ${payout.display}`
            );
          case "open":
            return logger.info(
              `Bidding: ${bid_price.currency} ${bid_price.display}`
            );
          default:
            break;
        }
      });

      logger.info("Before buy");

      await contract.buy();

      logger.info("After buy");

      await contract
        .onUpdate()
        .pipe(find(({ is_sold }: any) => is_sold))
        .toPromise();

      // Clean up the onUpdate subscription
      onUpdateSubscription.unsubscribe();

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

      audit = {
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

      return audit;

    } catch (error) {

      logger.fatal("Contract purchase error");

      console.log(error);

      this.handlePurchaseError(error, contractParameters);

      return {} as ITradeData;

    }

  }

  // Purchase DIGIT DIFF contract (private)
  private async purchaseDigitDiff(
    predictedDigit: number
  ): Promise<ITradeData> {
    const { currency } = this.userAccount;

    const contractParameters: ContractParams = {
      // proposal: 1,
      amount: this.currentStake,
      basis: "stake",
      contract_type: "DIGITDIFF",
      currency: currency || "USD",
      duration: this._contractDuration,
      duration_unit: this._contractDurationUnit,
      symbol: this.defaultMarket,
      barrier: predictedDigit.toString(),
    };

    // Calculate profit percentage for DIGIT DIFF
    this.profitPercentage = this.calculateProfitPercentage(
      PurchaseTypeEnum.DigitDiff,
      this.currentStake
    );

    return this.purchaseContract(contractParameters);

  }

  // Purchase DIGIT OVER contract (private)
  private async purchaseDigitOver(barrier: number): Promise<ITradeData> {
    const { currency } = this.userAccount;

    const contractParameters: ContractParams = {
      // proposal: 1,
      amount: this.currentStake,
      basis: "stake",
      contract_type: "DIGITOVER",
      currency: currency || "USD",
      duration: this._contractDuration,
      duration_unit: this._contractDurationUnit,
      symbol: this.defaultMarket,
      barrier: barrier.toString(),
    };

    // Calculate profit percentage for DIGIT OVER
    this.profitPercentage = this.calculateProfitPercentage(
      PurchaseTypeEnum.DigitOver,
      this.currentStake
    );

    return this.purchaseContract(contractParameters);
  }

  // Purchase DIGIT OVER 0 contract (private)
  private async purchaseDigitOver0(): Promise<ITradeData> {
    const { currency } = this.userAccount;

    const contractParameters: ContractParams = {
      // proposal: 1,
      amount: this.currentStake,
      basis: "stake",
      contract_type: "DIGITOVER",
      currency: currency || "USD",
      duration: this._contractDuration,
      duration_unit: this._contractDurationUnit,
      symbol: this.defaultMarket,
      barrier: 0,
    };

    // Calculate profit percentage for DIGIT UNDER 9
    this.profitPercentage = this.calculateProfitPercentage(
      PurchaseTypeEnum.DigitOver0Under9,
      this.currentStake
    );

    return this.purchaseContract(contractParameters);
  }

  // Purchase DIGIT OVER 1 contract (private)
  private async purchaseDigitOver1(): Promise<ITradeData> {
    const { currency } = this.userAccount;

    const contractParameters: ContractParams = {
      // proposal: 1,
      amount: this.currentStake,
      basis: "stake",
      contract_type: "DIGITOVER",
      currency: currency || "USD",
      duration: this._contractDuration,
      duration_unit: this._contractDurationUnit,
      symbol: this.defaultMarket,
      barrier: 1,
    };

    // Calculate profit percentage for DIGIT OVER 1
    this.profitPercentage = this.calculateProfitPercentage(
      PurchaseTypeEnum.DigitOver1Under8,
      this.currentStake
    );

    return this.purchaseContract(contractParameters);
  }

  // Purchase DIGIT OVER 2 contract (private)
  private async purchaseDigitOver2(): Promise<ITradeData> {
    const { currency } = this.userAccount;

    const contractParameters: ContractParams = {
      // proposal: 1,
      amount: this.currentStake,
      basis: "stake",
      contract_type: "DIGITOVER",
      currency: currency || "USD",
      duration: this._contractDuration,
      duration_unit: this._contractDurationUnit,
      symbol: this.defaultMarket,
      barrier: 2,
    };

    // Calculate profit percentage for DIGIT OVER 2
    this.profitPercentage = this.calculateProfitPercentage(
      PurchaseTypeEnum.DigitOver2Under7,
      this.currentStake
    );

    return this.purchaseContract(contractParameters);
  }

  // Purchase DIGIT UNDER contract (private)
  private async purchaseDigitUnder(barrier: number): Promise<ITradeData> {
    const { currency } = this.userAccount;

    const contractParameters: ContractParams = {
      // proposal: 1,
      amount: this.currentStake,
      basis: "stake",
      contract_type: "DIGITUNDER",
      currency: currency || "USD",
      duration: this._contractDuration,
      duration_unit: this._contractDurationUnit,
      symbol: this.defaultMarket,
      barrier: barrier.toString(),
    };

    // Calculate profit percentage for DIGIT UNDER
    this.profitPercentage = this.calculateProfitPercentage(
      PurchaseTypeEnum.DigitUnder,
      this.currentStake
    );

    return this.purchaseContract(contractParameters);
  }

  // Purchase DIGIT UNDER 9 contract (private)
  private async purchaseDigitUnder9(
    isRecoveryTrade = false
  ): Promise<ITradeData> {
    const { currency } = this.userAccount;

    const stake: number = isRecoveryTrade
      ? this.currentStake * 12.37345
      : this.currentStake;

    const contractParameters: ContractParams = {
      // proposal: 1,
      amount: stake,
      basis: "stake",
      contract_type: "DIGITUNDER",
      currency: currency || "USD",
      duration: this._contractDuration,
      duration_unit: this._contractDurationUnit,
      symbol: "R_100", //this.defaultMarket,
      barrier: 6,
    };

    // Calculate profit percentage for DIGIT UNDER 9
    this.profitPercentage = this.calculateProfitPercentage(
      PurchaseTypeEnum.DigitOver0Under9,
      this.currentStake
    );

    return this.purchaseContract(contractParameters);
  }

  // Purchase DIGIT UNDER 8 contract (private)
  private async purchaseDigitUnder8(): Promise<ITradeData> {
    const { currency } = this.userAccount;

    const contractParameters: ContractParams = {
      // proposal: 1,
      amount: this.currentStake,
      basis: "stake",
      contract_type: "DIGITUNDER",
      currency: currency || "USD",
      duration: this._contractDuration,
      duration_unit: this._contractDurationUnit,
      symbol: this.defaultMarket,
      barrier: 8,
    };

    // Calculate profit percentage for DIGIT UNDER 8
    this.profitPercentage = this.calculateProfitPercentage(
      PurchaseTypeEnum.DigitOver1Under8,
      this.currentStake
    );

    return this.purchaseContract(contractParameters);
  }

  // Purchase DIGIT UNDER 7 contract (private)
  private async purchaseDigitUnder7(): Promise<ITradeData> {
    const { currency } = this.userAccount;

    const contractParameters: ContractParams = {
      // proposal: 1,
      amount: this.currentStake,
      basis: "stake",
      contract_type: "DIGITUNDER",
      currency: currency || "USD",
      duration: this._contractDuration,
      duration_unit: this._contractDurationUnit,
      symbol: this.defaultMarket,
      barrier: 7,
    };

    // Calculate profit percentage for DIGIT UNDER 7
    this.profitPercentage = this.calculateProfitPercentage(
      PurchaseTypeEnum.DigitOver2Under7,
      this.currentStake
    );

    return this.purchaseContract(contractParameters);
  }

  // Purchase PUT / CALL contract (private)
  private async purchaseAuto(): Promise<ITradeData> {
    const { currency } = this.userAccount;

    const contractParameters: ContractParams = {
      // proposal: 1,
      amount: this.currentStake,
      basis: "stake",
      contract_type: "DIGITEVEN",
      currency: currency || "USD",
      duration: this._contractDuration,
      duration_unit: this._contractDurationUnit,
      symbol: this.defaultMarket,
      barrier: "EVEN",
    };

    // Calculate profit percentage for DIGIT EVEN
    this.profitPercentage = this.calculateProfitPercentage(
      PurchaseTypeEnum.DigitEven,
      this.currentStake
    );

    return this.purchaseContract(contractParameters);
  }

  // Purchase PUT / CALL contract (private)
  private async purchaseCall(): Promise<ITradeData> {
    const { currency } = this.userAccount;

    const contractParameters: ContractParams = {
      // proposal: 1,
      amount: this.currentStake,
      basis: "stake",
      contract_type: "DIGITEVEN",
      currency: currency || "USD",
      duration: this._contractDuration,
      duration_unit: this._contractDurationUnit,
      symbol: this.defaultMarket,
      barrier: "EVEN",
    };

    // Calculate profit percentage for DIGIT EVEN
    this.profitPercentage = this.calculateProfitPercentage(
      PurchaseTypeEnum.DigitEven,
      this.currentStake
    );

    return this.purchaseContract(contractParameters);
  }

  // Purchase PUT / CALL contract (private)
  private async purchasePut(): Promise<ITradeData> {
    const { currency } = this.userAccount;

    const contractParameters: ContractParams = {
      // proposal: 1,
      amount: this.currentStake,
      basis: "stake",
      contract_type: "DIGITEVEN",
      currency: currency || "USD",
      duration: this._contractDuration,
      duration_unit: this._contractDurationUnit,
      symbol: this.defaultMarket,
      barrier: "EVEN",
    };

    // Calculate profit percentage for DIGIT EVEN
    this.profitPercentage = this.calculateProfitPercentage(
      PurchaseTypeEnum.DigitEven,
      this.currentStake
    );

    return this.purchaseContract(contractParameters);
  }

  // Purchase DIGIT EVEN / ODD contract (private)
  private async purchaseDigitAuto(): Promise<ITradeData> {
    const { currency } = this.userAccount;

    const contractParameters: ContractParams = {
      // proposal: 1,
      amount: this.currentStake,
      basis: "stake",
      contract_type: "DIGITEVEN",
      currency: currency || "USD",
      duration: this._contractDuration,
      duration_unit: this._contractDurationUnit,
      symbol: this.defaultMarket,
      barrier: "EVEN",
    };

    // Calculate profit percentage for DIGIT EVEN
    this.profitPercentage = this.calculateProfitPercentage(
      PurchaseTypeEnum.DigitEven,
      this.currentStake
    );

    return this.purchaseContract(contractParameters);
  }

  // Purchase DIGIT EVEN contract (private)
  private async purchaseDigitEven(): Promise<ITradeData> {
    const { currency } = this.userAccount;

    const contractParameters: ContractParams = {
      // proposal: 1,
      amount: this.currentStake,
      basis: "stake",
      contract_type: "DIGITEVEN",
      currency: currency || "USD",
      duration: this._contractDuration,
      duration_unit: this._contractDurationUnit,
      symbol: this.defaultMarket,
      barrier: "EVEN",
    };

    // Calculate profit percentage for DIGIT EVEN
    this.profitPercentage = this.calculateProfitPercentage(
      PurchaseTypeEnum.DigitEven,
      this.currentStake
    );

    return this.purchaseContract(contractParameters);
  }

  // Purchase DIGIT ODD contract (private)
  private async purchaseDigitOdd(): Promise<ITradeData> {
    const { currency } = this.userAccount;

    const contractParameters: ContractParams = {
      // proposal: 1,
      amount: this.currentStake,
      basis: "stake",
      contract_type: "DIGITODD",
      currency: currency || "USD",
      duration: this._contractDuration,
      duration_unit: this._contractDurationUnit,
      symbol: this.defaultMarket,
      barrier: "ODD",
    };

    // Calculate profit percentage for DIGIT ODD
    this.profitPercentage = this.calculateProfitPercentage(
      PurchaseTypeEnum.DigitOdd,
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

  // Calculate the next trading amount based on previous performance (private)
  private getTradingAmount(
    resultIsWin: boolean,
    profitAfterSale: number,
    purchaseType: PurchaseType
  ): number {

    let nextStake: number = this.currentStake;

    /*

    logger.warn(`this.currentStake : ${this.currentStake}`);
    logger.warn(`this.baseStake : ${this.baseStake}`);
    logger.warn(`this.profitPercentage : ${this.profitPercentage}`);

    */

    if (resultIsWin) {
      // Reset to base stake after a win
      nextStake = this.baseStake;
      this._cumulativeLossAmount = 0;
      this._cumulativeLosses = 0;
    } else {
      // Calculate cumulative losses (L)
      this._cumulativeLossAmount += this.currentStake;
      this._cumulativeLosses++;

      const recoveryFactor = (1 + this.profitPercentage) / this.profitPercentage;


      // Calculate the next stake using the formula: S_next = (L * (1 + PP)) / PP + S
      nextStake = this._cumulativeLosses * recoveryFactor + this.baseStake;
    }

    // Ensure the stake is within the minimum and maximum limits
    const amount: number = this.clampStake(nextStake, this._minStake, this._maxStake);

    return parseFloat(amount.toFixed(2));

  }

  /* Ensures that the value of `nextStake` stays within the range defined by `minValue` and`maxValue`.
   * @param { number } nextStake - The value to be clamped.
   * @param { number } minValue - The minimum allowed value.
   * @param { number } maxValue - The maximum allowed value.
   * @returns { number } - The clamped value of`nextStake`.
   */
  private clampStake(nextStake: number, minValue: number, maxValue: number): number {
    // If nextStake is less than minValue, return minValue
    if (nextStake < minValue) {
      return minValue;
    }
    // If nextStake is greater than maxValue, return maxValue
    if (nextStake > maxValue) {
      return maxValue;
    }
    // Otherwise, return nextStake as it is within the range
    return nextStake;
  }

  // Start trading with recovery logic (public)
  async startTrading(session: any, retryAfterError = false): Promise<void> {
    // Input validation

    const dateObject: Date = new Date();

    if (retryAfterError && !this._cachedSession) {
      return this.handleErrorMessage("No cached session available for retry.");
    }

    if (retryAfterError) {
      if (!this._cachedSession) {
        return this.handleErrorMessage("No cached session available for retry.");
      }
      session = this._cachedSession;
    } else {
      this._cachedSession = session;
    }

    const { market, purchaseType, stake, takeProfit, stopLoss, tradeDuration, updateFrequency } = session;

    const errorObject = {
      error: {
        code: "InvalidParameters",
        message: "Invalid Parameters",
      },
      msg_type: "",
      meta: {
        session
      }
    };

    if (!market) {
      errorObject.error.message = "Market cannot be empty.";
      return this.handlePurchaseError(errorObject, session);
    }

    if (!purchaseType) {
      errorObject.error.message = "Purchase Type cannot be empty.";
      return this.handlePurchaseError(errorObject, session);
    }

    if (stake <= 0) {
      errorObject.error.message = "Stake must be a positive number.";
      return this.handlePurchaseError(errorObject, session);
    }

    if (takeProfit <= 0) {
      errorObject.error.message = "Take Profit must be a positive number.";
      return this.handlePurchaseError(errorObject, session);
    }

    if (stopLoss <= 0) {
      errorObject.error.message = "Stop Loss must be a positive number.";
      return this.handlePurchaseError(errorObject, session);
    }

    if (!retryAfterError) {

      this._cachedSession = session;
      this._defaultMarket = session.market;
      this._originalPurchaseType = session.purchaseType;
      this._baseStake = session.stake;
      this._currentStake = session.stake;
      this._takeProfit = session.takeProfit;
      this._stopLoss = session.stopLoss;
      this._tradeDuration = this.parseTradeDuration(tradeDuration);
      this._updateFrequency = this.parseUpdateFrequency(updateFrequency);
      this._tradeStartedAt = dateObject.getTime() / 1000;

      this._tradeDurationTimeoutID = setTimeout(async () => {
        this.stopTrading(`You have reached your trade duration limit: ${this._tradeDuration}s (${tradeDuration}) `);
      }, this._tradeDuration * 1000);

      this._updateFrequencyTimeIntervalID = setInterval(async () => {
        logger.info(`Sending a status update via telemetry... `);
        await this.generateTelemetry();
      }, this._updateFrequency * 1000);

    }

    this._isTrading = true;

    while (this.isTrading && this.connection?.readyState === WebSocket.OPEN) {

      try {

        let response: ITradeData = {} as ITradeData;

        const dateObject: Date = new Date();

        const tradingTimeNow: number = dateObject.getTime() / 1000;

        const tradingTime: number = tradingTimeNow - this._tradeStartedAt;

        if (this.recoveryTrades === 1 && this.profitPercentage > 100) {
          response = await this.purchaseDigitUnder9(true);
        } else if (this.recoveryTrades === 1 && this.profitPercentage < 10) {
          response = await this.purchaseDigitUnder9(true);
        } else if (this.recoveryTrades === 1) {
          response =
            this._lastDigit % 2 === 0
              ? await this.purchaseDigitEven()
              : await this.purchaseDigitOdd();
        } else {
          response = await this.purchaseNextContract(purchaseType);
        }

        const tradeData: TradeData = TradeData.parseTradeData(response);

        const investment: number = tradeData.buy_price_value;
        const profit: number = tradeData.profit_value * tradeData.profit_sign;
        const resultIsWin: boolean = tradeData.profit_is_win;
        const profitAfterSale: number = resultIsWin ? profit : -investment;

        logger.warn("*******************************************************************************************");

        logger.info(`DEAL: ${tradeData.longcode}`);

        logger.info(`SPOT: ${tradeData.entry_spot_value} -> ${tradeData.exit_spot_value}`);

        logger.info(`BUY : ${tradeData.buy_price_currency} ${tradeData.buy_price_value}`);

        logger.info(`BID : ${tradeData.bid_price_currency} ${tradeData.bid_price_value}`);

        logger.info(`SELL: ${tradeData.sell_price_currency} ${tradeData.sell_price_value} :: Status : ${tradeData.status}`);

        // Update profit
        this.profit += profitAfterSale;

        this._totalNumberOfRuns++;

        if (resultIsWin) {

          logger.info(`WON : ${tradeData.profit_currency} ${tradeData.profit_value} :: IS_WIN : ${tradeData.profit_is_win} :: SIGN (+VE) ${tradeData.profit_sign}`);

          this._numberOfWins++;
          this.recoveryTrades = 0;
          this.originalPurchaseType = session.purchaseType; // Reset to original purchase type

        } else {

          logger.info(`LOST: ${tradeData.profit_currency} ${tradeData.profit_value} :: IS_WIN : ${tradeData.profit_is_win} :: SIGN (-VE) ${tradeData.profit_sign}`);

          this._numberOfLosses++;
          this.recoveryTrades++;

          //TODO

          if (this.recoveryTrades >= 3) {

            logger.info(`Maximum recovery trades [${this.recoveryTrades}/3] reached. Resetting stake...`);
            this.currentStake = this.baseStake;
            this.recoveryTrades = 0;

          }

          // Stop trading if max recovery trades reached
          if (this.recoveryTrades >= this.maxRecoveryTrades) {

            this.stopTrading("Max recovery trades reached. Stopping trades...");
            break;

          }

          // Sleep for 3 seconds after a loss

          const marketVolatility = 1;
          const threshold = 1;
          const sleepDuration = marketVolatility > threshold ? 1 : 3; // Adjust based on volatility
          await this.sleep(sleepDuration);

        }

        logger.info(`SMRY: ${[this.profit]} :*: PROFIT: ${[profit]} :*: IS_WIN : ${[resultIsWin]} :*: PROFIT AFTER SALE : ${[profitAfterSale]}`);

        logger.warn("*******************************************************************************************");

        // Check if take profit is reached
        if (this.profit >= this._takeProfit) {
          this.stopTrading(`Take Profit reached. TP[${tradeData.profit_currency} ${tradeData.profit_value}]. Stopping trades...`);
          break;
        }

        // Check if stop loss is reached
        if (this.profit <= -this._stopLoss) {
          this.stopTrading(`Stop Loss reached. SL[${tradeData.profit_currency} ${tradeData.profit_value}]. Stopping trades...`);
          break;
        }

        // Calculate the next trading amount
        this.currentStake = this.getTradingAmount(
          resultIsWin,
          profitAfterSale,
          session.purchaseType
        );

        /*

        logger.fatal(`resultIsWin: ${resultIsWin}`);
        logger.fatal(`profitAfterSale: ${profitAfterSale}`);
        logger.fatal(`session.purchaseType: ${session.purchaseType}`);
        logger.fatal(`this.currentStake: ${this.currentStake}`);
        logger.fatal(`this.recoveryTrades: ${this.recoveryTrades}`);
        logger.fatal(`this._numberOfWins : ${this._numberOfWins}`);
        logger.fatal(`this._numberOfLosses: ${this._numberOfLosses}`);
        logger.fatal(`this._totalNumberOfRuns: ${this._totalNumberOfRuns}`);

        */

        const updateTimeSinceLast: number = tradingTimeNow - this._updateFrequencyLastRun;

        if (updateTimeSinceLast > this._updateFrequency) {

          this._updateFrequencyLastRun = tradingTimeNow;

          this.generateTradingSummary();

        }

        await this.sleep(3);

      } catch (err: any) {

        console.error("Error during trading:", err);

        this.handlePurchaseError(err, this._cachedSession);

        break;

      }

      //await this.sleep(1);

    }

  }

  private parseTradeDuration(tradeDuration: string): number {
    return parseTimeToSeconds(tradeDuration);
  }

  private parseUpdateFrequency(updateFrequency: string): number {
    return parseTimeToSeconds(updateFrequency);
  }

  async saveData(data: any, key: string) {
    this._auditTrail.push({
      key: key,
      data: data
    })
  }

  async stopTrading(message: string): Promise<void> {
    this._isTrading = false;
    this.disconnect();
    clearTimeout(this._tradeDurationTimeoutID);
    clearInterval(this._updateFrequencyTimeIntervalID);
    await this.handleLogMessage(`Stopping trades ::: ${message}`);
    await this.generateTradingSummary();
    await this.garbageCollect();
    await this.resetState();
  }

  async stopTrading(message: string): Promise<void> {
    this._isTrading = false;
    this.disconnect();
    clearTimeout(this._tradeDurationTimeoutID);
    clearInterval(this._updateFrequencyTimeIntervalID);
  }

  async generateTelemetry(): Promise<any> {
    //generateTelemetry
    parentPort.postMessage({ action: "generateTelemetry", text: "Generating telemetry, please wait...", meta: { user: this.userAccount, audit: this._auditTrail } });

  }

  async generateTradingStatement(): Promise<any> {
    //generateTradingStatement
    parentPort.postMessage({ action: "generateTradingStatement", message: "Generating statement, this may take a while please wait...", meta: { user: this.userAccount, audit: this._auditTrail } });

  }

  async generateTradingSummary(): Promise<any> {
    //generateSummary
    parentPort.postMessage({ action: "generateTradingSummary", message: "Generating trading summary, please wait...", meta: { user: this.userAccount, audit: this._auditTrail } });

  }

  async garbageCollect(): Promise<any> {
    //garbageCollect
  }

  async resetState(): Promise<void> {
    // Initialize private properties with explicit types

    //TODO: - Reset

  }

  async handleLogMessage(message: string): Promise<void> {
    //Send message to TG
    console.log("TELEGRAM MESSAGE::", message);
  }

  async handleErrorMessage(message: string): Promise<void> {
    //Console log message to
    console.log("ERROR MESSAGE::", message);
  }

  async handlePurchaseError(err: any, contractParams: any): Promise<void> {

    const errorCode: string = err.error.code;
    const errorMessage: string = err.error.message;
    const errorMessageType: string = err.msg_type;

    const self = this;

    logger.error(`Purchase Error: ${errorCode} - ${errorMessageType} - ${errorMessage}`, { contractParams });

    switch (errorCode) {

      case "AuthorizationRequired": {

        this.setAccount(() => {
          self.startTrading(contractParams, false);
        })

        break;

      }

      case "InvalidParameters": {

        //analyse user input, make user start again

        this.setAccount(() => {
          self.startTrading(contractParams, false);
        })

        break;

      }

      case "InsufficientBalance": {

        //adjust stake or notify user

        this.setAccount(() => {
          self.startTrading(contractParams, false);
        })

        break;

      }

      default: {


        throw err;

        //self.startTrading(null, true);

        //break;

      }

    }

  }

}

module.exports = DerivAutoTradingBot;
