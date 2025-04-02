
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

class DerivAutoTradingBotClass {
  // Private properties with explicit types
  
  private _api: any;

  // @ts-ignore: see this.resetState()
  private _auditTrail: Array<any>;
  private _cachedSession: any
  private _pingIntervalID: NodeJS.Timeout | string | number | undefined | any;
  private _tradeDurationTimeoutID: NodeJS.Timeout | string | number | undefined | any;
  private _updateFrequencyTimeIntervalID: NodeJS.Timeout | string | number | undefined | any;
  // @ts-ignore: see this.resetState()
  private _tradingType: TradingType;
  // @ts-ignore: see this.resetState()
  private _defaultMarket: MarketType;
  // @ts-ignore: see this.resetState()
  private _currentStake: number;
  // @ts-ignore: see this.resetState()
  private _baseStake: number;
  // @ts-ignore: see this.resetState()
  private _maxStake: number;
  // @ts-ignore: see this.resetState()
  private _minStake: number;
  // @ts-ignore: see this.resetState()
  private _maxRecoveryTrades: number;
  // @ts-ignore: see this.resetState()
  private _currentRecoveryTradeIndex: number;
  // @ts-ignore: see this.resetState()
  private _profit: number;
  // @ts-ignore: see this.resetState()
  private _isTrading: boolean;
  // @ts-ignore: see this.resetState()
  private _takeProfit: number;
  // @ts-ignore: see this.resetState()
  private _totalStake: number;
  // @ts-ignore: see this.resetState()
  private _totalPayout: number;
  // @ts-ignore: see this.resetState()
  private _stopLoss: number;
  // @ts-ignore: see this.resetState()
  private _consecutiveTrades: number;
  // @ts-ignore: see this.resetState()
  private _profitPercentage: number;
  // @ts-ignore: see this.resetState()
  private _originalPurchaseType: PurchaseType;
  // @ts-ignore: see this.resetState()
  private _currentPurchaseType: PurchaseType;

  // @ts-ignore: see this.resetState()
  private _cumulativeLossAmount: number;
  // @ts-ignore: see this.resetState()
  private _cumulativeLosses: number;
  // @ts-ignore: see this.resetState()
  private _numberOfWins: number;
  // @ts-ignore: see this.resetState()
  private _numberOfLosses: number;
  // @ts-ignore: see this.resetState()
  private _totalNumberOfRuns: number;

  // @ts-ignore: see this.resetState()
  private _tradeStartedAt: number;
  // @ts-ignore: see this.resetState()
  private _tradeDuration: number;
  // @ts-ignore: see this.resetState()
  private _updateFrequency: number;

  // @ts-ignore: see this.resetState()
  private _lastTick: string;
  // @ts-ignore: see this.resetState()
  private _lastDigit: number;
  // @ts-ignore: see this.resetState()
  private _lastDigitsArray: [number];

  // @ts-ignore: see this.resetState()
  private _contractDuration: number;
  // @ts-ignore: see this.resetState()
  private _contractDurationUnit: string;

  // @ts-ignore: see this.resetState()
  private _userAccount: IDerivUserAccount;

  // @ts-ignore: see this.resetState()
  private _userAccountToken: string;

  // @ts-ignore: see this.resetState()
  private _userBalance: [string, string];

  // Save the BotConfig passed to the constructor
  private _botConfig: BotConfig;

  /**
   * Constructor for DerivAutoTradingBotClass.
   * @param {BotConfig} config - Optional configuration object to override default values.
   */
  constructor(config: BotConfig = {}) {
    // Save the config for future use
    this._botConfig = config;

    // Call the resetState function to initialize all properties
    this.resetState();

    // Connect to the Dervi servers via web sockets
    setTimeout(() => {
      this.connect(() => this.setAccount());
    }, 1000)

  }

  /**
   * Resets all the internal state variables to their default or initial values.
   * @param {Partial<BotConfig>} config - Optional configuration object to override specific values.
   * If not provided, the bot will use the config passed to the constructor.
   */
  private resetState(config: Partial<BotConfig> = {}): void {
    // Merge the reset config with the original config, giving preference to the reset config
    const mergedConfig: BotConfig = { ...this._botConfig, ...config };

    // Deriv API connection
    this._api = null;

    // Audit trail and session management
    this._auditTrail = [];
    this._cachedSession = null;

    // Timers and intervals
    this._pingIntervalID = undefined;
    this._tradeDurationTimeoutID = undefined;
    this._updateFrequencyTimeIntervalID = undefined;

    // Trading configuration
    this._tradingType = mergedConfig.tradingType || "Derivatives 📊";
    this._defaultMarket = mergedConfig.defaultMarket || "R_100";
    this._currentStake = mergedConfig.baseStake || MIN_STAKE;
    this._baseStake = mergedConfig.baseStake || MIN_STAKE;
    this._maxStake = mergedConfig.maxStake || MAX_STAKE;
    this._minStake = mergedConfig.minStake || MIN_STAKE;
    this._maxRecoveryTrades = mergedConfig.maxRecoveryTrades || MAX_RECOVERY_TRADES_X2;
    this._currentRecoveryTradeIndex = 0;
    this._profit = 0;
    this._isTrading = false;
    this._takeProfit = mergedConfig.takeProfit || 0;
    this._totalStake = 0;
    this._totalPayout = 0;
    this._stopLoss = mergedConfig.stopLoss || 0;
    this._consecutiveTrades = 0;
    this._profitPercentage = 0;
    this._originalPurchaseType = "CALL";
    this._currentPurchaseType = "CALL";

    // Loss and win tracking
    this._cumulativeLossAmount = 0;
    this._cumulativeLosses = 0;
    this._numberOfWins = 0;
    this._numberOfLosses = 0;
    this._totalNumberOfRuns = 0;

    // Trade timing
    this._tradeStartedAt = 0;
    this._tradeDuration = 0;
    this._updateFrequency = 0;

    // Last tick and digits
    this._lastTick = "";
    this._lastDigit = 0;
    this._lastDigitsArray = [0];

    // Contract duration
    this._contractDuration = mergedConfig.contractDuration || 1;
    this._contractDurationUnit = mergedConfig.contractDurationUnit || "t";

    // User account and balance
    this._userAccount = {} as IDerivUserAccount;
    this._userAccountToken = mergedConfig.userAccountToken || DERIV_APP_TOKEN;
    this._userBalance = ["", ""];

  }

  // Getters and Setters

  // Deriv API connection
  get api(): any {
    return this._api;
  }

  set api(value: any) {
    this._api = value;
  }

  // Audit trail and session management
  get auditTrail(): Array<any> {
    return this._auditTrail;
  }

  set auditTrail(value: Array<any>) {
    this._auditTrail = value;
  }

  get cachedSession(): any {
    return this._cachedSession;
  }

  set cachedSession(value: any) {
    this._cachedSession = value;
  }

  // Timers and intervals
  get pingIntervalID(): NodeJS.Timeout | string | number | undefined | any {
    return this._pingIntervalID;
  }

  set pingIntervalID(value: NodeJS.Timeout | string | number | undefined | any) {
    this._pingIntervalID = value;
  }

  get tradeDurationTimeoutID(): NodeJS.Timeout | string | number | undefined | any {
    return this._tradeDurationTimeoutID;
  }

  set tradeDurationTimeoutID(value: NodeJS.Timeout | string | number | undefined | any) {
    this._tradeDurationTimeoutID = value;
  }

  get updateFrequencyTimeIntervalID(): NodeJS.Timeout | string | number | undefined | any {
    return this._updateFrequencyTimeIntervalID;
  }

  set updateFrequencyTimeIntervalID(value: NodeJS.Timeout | string | number | undefined | any) {
    this._updateFrequencyTimeIntervalID = value;
  }

  // Trading configuration
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

  get currentRecoveryTradeIndex(): number {
    return this._currentRecoveryTradeIndex;
  }

  set currentRecoveryTradeIndex(value: number) {
    this._currentRecoveryTradeIndex = value;
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

  get totalStake(): number {
    return this._totalStake;
  }

  set totalStake(value: number) {
    this._totalStake = value;
  }

  get totalPayout(): number {
    return this._totalPayout;
  }

  set totalPayout(value: number) {
    this._totalPayout = value;
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

  get originalPurchaseType(): PurchaseType {
    return this._originalPurchaseType;
  }

  set originalPurchaseType(value: PurchaseType) {
    this._originalPurchaseType = value;
  }

  get currentPurchaseType(): PurchaseType {
    return this._currentPurchaseType;
  }

  set currentPurchaseType(value: PurchaseType) {
    this._currentPurchaseType = value;
  }

  // Loss and win tracking
  get cumulativeLossAmount(): number {
    return this._cumulativeLossAmount;
  }

  set cumulativeLossAmount(value: number) {
    this._cumulativeLossAmount = value;
  }

  get cumulativeLosses(): number {
    return this._cumulativeLosses;
  }

  set cumulativeLosses(value: number) {
    this._cumulativeLosses = value;
  }

  get numberOfWins(): number {
    return this._numberOfWins;
  }

  set numberOfWins(value: number) {
    this._numberOfWins = value;
  }

  get numberOfLosses(): number {
    return this._numberOfLosses;
  }

  set numberOfLosses(value: number) {
    this._numberOfLosses = value;
  }

  get totalNumberOfRuns(): number {
    return this._totalNumberOfRuns;
  }

  set totalNumberOfRuns(value: number) {
    this._totalNumberOfRuns = value;
  }

  // Trade timing
  get tradeStartedAt(): number {
    return this._tradeStartedAt;
  }

  set tradeStartedAt(value: number) {
    this._tradeStartedAt = value;
  }

  get tradeDuration(): number {
    return this._tradeDuration;
  }

  set tradeDuration(value: number) {
    this._tradeDuration = value;
  }

  get updateFrequency(): number {
    return this._updateFrequency;
  }

  set updateFrequency(value: number) {
    this._updateFrequency = value;
  }

  // Last tick and digits
  get lastTick(): string {
    return this._lastTick;
  }

  set lastTick(value: string) {
    this._lastTick = value;
  }

  get lastDigit(): number {
    return this._lastDigit;
  }

  set lastDigit(value: number) {
    this._lastDigit = value;
  }

  get lastDigitsArray(): [number] {
    return this._lastDigitsArray;
  }

  set lastDigitsArray(value: [number]) {
    this._lastDigitsArray = value;
  }

  // Contract duration
  get contractDuration(): number {
    return this._contractDuration;
  }

  set contractDuration(value: number) {
    this._contractDuration = value;
  }

  get contractDurationUnit(): string {
    return this._contractDurationUnit;
  }

  set contractDurationUnit(value: string) {
    this._contractDurationUnit = value;
  }

  // User account and balance
  get userAccount(): IDerivUserAccount {
    return this._userAccount;
  }

  set userAccount(value: IDerivUserAccount) {
    this._userAccount = value;
  }

  get userAccountToken(): string {
    return this._userAccountToken;
  }

  set userAccountToken(value: string) {
    this._userAccountToken = value;
  }

  get userBalance(): [string, string] {
    return this._userBalance;
  }

  set userBalance(value: [string, string]) {
    this._userBalance = value;
  }

  private async connect(callback?: any): Promise<void> {
    logger.info("Connecting...");
    parentPort.postMessage({ action: "sendTelegramMessage", text: "🟡 Establishing connection to Deriv server...", meta: {} });

    this.api = new DerivAPI({ endpoint: DERIV_APP_ENDPOINT_DOMAIN, app_id: DERIV_APP_ENDPOINT_APP_ID, lang: DERIV_APP_ENDPOINT_LANG });

    logger.info("Connection established via DerivAPI endpoint.");

    logger.info("Start Ping <-> Pong:");

    this.ping();

    if (typeof callback === "function") {
      await callback();
    }
  }

  private disconnect(): void {
    this.api = null;
  }

  private ping(): void {
    // Sends a ping message every 30 seconds
    this._pingIntervalID = setInterval(() => {
      this.api.basic.ping().then((pong: any) => {
        logger.info(`Ping-Pong-Received : ${pong.req_id}`);
      });
    }, CONNECTION_PING_TIMEOUT);
  }

  public getAccountToken(accounts:any, key:string, value:string) {

    // Iterate through the object
    for (const index in accounts) {

      const entry = accounts[index];

      // Check if the key is 'acct' or 'cur' and if the value matches
      if ((key === "acct" && entry.acct === value) || (key === "cur" && entry.cur === value) || (key === "token" && entry.token === value)) {
        return entry; // Return the matching entry
      }
    }
  
    // Return null if no match is found
    return null;
  }

  /**
 * Initializes the user account and sets up balance tracking.
 * @param {string} [token] - Optional user token. If not provided, the default token will be used.
 * @returns {Promise<IDerivUserAccount>} - Returns the initialized user account.
 * @throws {Error} - Throws an error if the account cannot be initialized.
 */
  public async setAccount(callBackFunction?: any, token?: string): Promise<IDerivUserAccount> {
    // Validate the token
    const userToken = token || this._userAccountToken;

    if (!userToken || typeof userToken !== "string") {
      throw new Error("Invalid user token provided.");
    }

    if(!this._userAccountToken && typeof token === "string" && token.length > 10){
      this._userAccountToken = token;
    }

    if(!this.api){

      this.connect(()=>{
        
        this.setAccount(callBackFunction, token);

      });

    }

    try {
      // Initialize the account using the Deriv API
      const account = await this.api.account(userToken);

      logger.info(`API hangs with ${userToken}`);

      // Validate the account data
      if (!account || !account.balance || !account.balance.amount) {
        throw new Error("Invalid account data received from the API.");
      }

      // Parse and set the user account
      const userAccount = DerivUserAccount.parseDerivUserAccount(account);
      this._userAccount = userAccount;

      // Set the user balance
      const balance: [string, string] = [
        account.balance.amount._data.currency || "USD", // Fallback to "USD" if currency is not provided
        account.balance.amount._data.value,
      ];
      this._userBalance = balance;

      logger.info(`Welcome, ${userAccount.fullname}`);
      logger.info(`Balance: ${balance[0]} ${balance[1]}`);

      // Set up balance updates
      account.balance.onUpdate((val: any) => {
        if (val && val._data) {
          this._userBalance = [val._data.currency, val._data.value];
          logger.info(`Balance updated: ${val._data.currency} ${val._data.value}`);
        }
      });

      if (typeof callBackFunction === "function") {

        callBackFunction(userAccount);

      }

      return userAccount;

    } catch (error) {
      logger.error("Failed to initialize user account:", error);
      console.log(error);
      throw new Error("An unexpected error occurred while initializing the account.");
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

    if (this._tradingType === CONSTANTS.TRADING_TYPES.FOREX) {
    }

    if (this._tradingType === CONSTANTS.TRADING_TYPES.COMMODITIES) {
    }

    if (this._tradingType === CONSTANTS.TRADING_TYPES.CRYPTO) {
    }

    if (this._tradingType === CONSTANTS.TRADING_TYPES.DERIVATIVES) {

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
      this._cumulativeLossAmount = 0; // Reset cumulative losses
      this._cumulativeLosses = 0; // Reset the number of consecutive losses
      return this._baseStake; // Return the base stake
    }

    // If the previous trade was a loss, update cumulative losses
    this._cumulativeLossAmount += Math.abs(profitAfterSale); // Add the loss to the cumulative loss amount
    this._cumulativeLosses++; // Increment the number of consecutive losses

    // Calculate the recovery factor based on the profit percentage
    const recoveryFactor = (1 + this._profitPercentage / 100) / (this._profitPercentage / 100);

    // Calculate the next stake to recover cumulative losses and ensure profitability
    let nextStake = this._cumulativeLossAmount * recoveryFactor + this._baseStake;

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
    return Math.min(Math.max(stake, this._minStake), this._maxStake);
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
    if (retryAfterError && !this._cachedSession) {
      errorObject.error.message = "No cached session available for retry.";
      return this.handleErrorExemption(errorObject, session);
    }

    // Use cached session if retrying after an error
    if (retryAfterError && this._cachedSession) {
      session = this._cachedSession;
    } else {
      this._cachedSession = session; // Cache the session for future retries
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
      this._cachedSession = session;
      this._defaultMarket = session.market;
      this._originalPurchaseType = session.purchaseType;
      this._baseStake = session.stake;
      this._currentStake = session.stake;
      this._takeProfit = session.takeProfit;
      this._stopLoss = session.stopLoss;
      this._tradeDuration = this.parseTradeDuration(tradeDuration);
      this._updateFrequency = this.parseUpdateFrequency(updateFrequency);
      this._tradeStartedAt = Date.now() / 1000; // Record the start time of the trade

      // Set a timeout to stop trading after the specified duration
      this._tradeDurationTimeoutID = setTimeout(async () => {
        this.stopTrading(`You have reached your trade duration limit: ${this._tradeDuration}s (${tradeDuration}) `);
      }, this._tradeDuration * 1000);

      this._updateFrequencyTimeIntervalID = setInterval(async () => {
        this.generateTelemetry();
      }, this._updateFrequency * 1000);

    }

    // Start the trading process using recursive scheduling
    this._isTrading = true;

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
    if (!this._isTrading || !this.api) {
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
      this._totalNumberOfRuns++;

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
      if (this.profit >= this._takeProfit) {
        this.stopTrading(`Take Profit reached. TP[${tradeData.profit_currency} ${tradeData.profit_value}]. Stopping trades...`);
        return;
      }

      // Check if stop loss is reached
      if (this.profit <= -this._stopLoss) {
        this.stopTrading(`Stop Loss reached. SL[${tradeData.profit_currency} ${tradeData.profit_value}]. Stopping trades...`);
        return;
      }

      // Calculate the next trading amount based on the result of the previous trade
      this.currentStake = this.getTradingAmount(resultIsWin, profitAfterSale);

      // Schedule the next trade after a short delay
      setTimeout(() => this.executeTrade(purchaseType), 3000);
    } catch (err: any) {
      console.error("Error during trading:", err);
      this.handleErrorExemption(err, this._cachedSession);
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
    this._auditTrail.push({
      key: key,
      data: data
    })
  }

  async stopTrading(message: string, generateStatistics: boolean = true): Promise<void> {
    this._isTrading = false;
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
    await clearInterval(this._pingIntervalID);
    await clearInterval(this._updateFrequencyTimeIntervalID);
    await clearTimeout(this._tradeDurationTimeoutID);
  }

  /**
   * Generates a detailed telemetry table in the specified format.
   */
  private generateTelemetry(): void {
    // Retrieve account and balance information
    const accountId = this._userAccount.loginid || "N/A";
    const currency = this._userAccount.currency || "USD";
    const totalBalance = parseFloat(this._userBalance[1] || '0').toFixed(2);

    // Calculate total profit, payout, and stake
    const totalProfit = this._profit;
    const totalPayout = this._totalPayout;
    const totalStake = this._totalStake;

    // Calculate win rate and average profit per run
    const winRate = (this._numberOfWins / this._totalNumberOfRuns) * 100;
    const averageProfitPerRun = totalProfit / this._totalNumberOfRuns;

    // Format start time, stop time, and duration
    const startTime = new Date(this._tradeStartedAt * 1000);
    const stopTime = new Date(); // Current time as stop time
    const durationSeconds = Math.floor((Date.now() / 1000) - this._tradeStartedAt);
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

    Wins:           ${this._numberOfWins.toString().padEnd(20)} 
    Losses:         ${this._numberOfLosses.toString().padEnd(20)} 
    Runs:           ${this._totalNumberOfRuns.toString().padEnd(20)} 
         
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

    parentPort.postMessage({ action: "generateTelemetry", text: telemetryTable, meta: { user: this.userAccount, audit: this._auditTrail } });

  }

  async generateTradingStatement(): Promise<any> {
    //generateTradingStatement
    parentPort.postMessage({ action: "generateTradingStatement", message: "Generating statement, this may take a while please wait...", meta: { user: this.userAccount, audit: this._auditTrail } });

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
    parentPort.postMessage({ action: "generateTradingSummary", message: "Generating trading summary, please wait...", meta: { user: this.userAccount, audit: this._auditTrail } });

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

module.exports = DerivAutoTradingBotClass;
