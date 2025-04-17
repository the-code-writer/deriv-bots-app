// types.ts - Contains all type definitions and interfaces
/**
 * @file Contains all type definitions and interfaces for the Deriv trading bot
 */

export type Step = "LOGIN_ACCOUNT" | "SELECT_ACCOUNT_TYPE" | "ACCOUNT_TYPE_SELECTION" | "SELECT_TRADING_TYPE" | "TRADING_TYPE_SELECTION" | "SELECT_MARKET" | "MARKET_SELECTION" | "SELECT_PURCHASE_TYPE" | "PURCHASE_TYPE_SELECTION" | "ENTER_STAKE" | "STAKE_INPUT" | "ENTER_TAKE_PROFIT" | "TAKE_PROFIT_INPUT" | "ENTER_STOP_LOSS" | "STOP_LOSS_INPUT" | "SELECT_TRADE_DURATION" | "TRADE_DURATION_SELECTION" | "SELECT_UPDATE_FREQUENCY" | "UPDATE_FREQUENCY_SELECTION" | "SELECT_TICKS_OR_MINUTES" | "UPDATE_CONTRACT_DURATION_UNIT_SSELECTION" | "SELECT_TICKS_OR_MINUTES_DURATION" | "UPDATE_CONTRACT_DURATION_VALUE_SELECTION" | "SELECT_AUTO_OR_MANUAL" | "AUTO_MANUAL_TRADING" | "CONFIRM_TRADE" | "TRADE_CONFIRMATION" | "MANUAL_TRADE" | "TRADE_MANUAL";

export const StepType = {
    Default: "LOGIN_ACCOUNT" as Step,
    loginAccount: "LOGIN_ACCOUNT" as Step,
    selectAccountType: "SELECT_ACCOUNT_TYPE" as Step,
    accountTypeSelection: "ACCOUNT_TYPE_SELECTION" as Step,
    selectTradingType: "SELECT_TRADING_TYPE" as Step,
    tradingTypeSelection: "TRADING_TYPE_SELECTION" as Step,
    selectMarket: "SELECT_MARKET" as Step,
    marketSelection: "MARKET_SELECTION" as Step,
    selectPurchaseType: "SELECT_PURCHASE_TYPE" as Step,
    purchaseTypeSelection: "PURCHASE_TYPE_SELECTION" as Step,
    enterStake: "ENTER_STAKE" as Step,
    stakeInput: "STAKE_INPUT" as Step,
    enterTakeProfit: "ENTER_TAKE_PROFIT" as Step,
    takeProfitInput: "TAKE_PROFIT_INPUT" as Step,
    enterStopLoss: "ENTER_STOP_LOSS" as Step,
    stopLossInput: "STOP_LOSS_INPUT" as Step,
    selectTradeDuration: "SELECT_TRADE_DURATION" as Step,
    tradeDurationSelection: "TRADE_DURATION_SELECTION" as Step,
    selectUpdateFrequency: "SELECT_UPDATE_FREQUENCY" as Step,
    updateFrequencySelection: "UPDATE_FREQUENCY_SELECTION" as Step,
    selectTicksOrMinutes: "SELECT_TICKS_OR_MINUTES" as Step,
    updateContractDurationUnitSelection: "UPDATE_CONTRACT_DURATION_UNIT_SSELECTION" as Step,
    selectTicksOrMinutesDuration: "SELECT_TICKS_OR_MINUTES_DURATION" as Step,
    updateContractDurationValueSelection: "UPDATE_CONTRACT_DURATION_VALUE_SELECTION" as Step,
    selectAutoOrManual: "SELECT_AUTO_OR_MANUAL" as Step,
    autoManualTrading: "AUTO_MANUAL_TRADING" as Step,
    confirmTrade: "CONFIRM_TRADE" as Step,
    tradeConfirmation: "TRADE_CONFIRMATION" as Step,
    manualTrade: "MANUAL_TRADE" as Step,
    tradeManual: "TRADE_MANUAL" as Step,
} as const;

export type PurchaseType =
    | "DIGITDIFF"
    | "DIGITOVER"
    | "DIGITUNDER"
    | "DIGITUNDER9_DIGITOVER_0"
    | "DIGITUNDER8_DIGITOVER_1"
    | "DIGITUNDER7_DIGITOVER_2"
    | "DIGITUNDER6_DIGITOVER_3"
    | "EVEN_ODD"
    | "EVEN"
    | "ODD"
    | "CALL"
    | "PUT"
    | "ACCU";

export const PurchaseTypeEnum = {
    Default: "DIGITUNDER" as PurchaseType,
    DigitDiff: "DIGITDIFF" as PurchaseType,
    DigitOver: "DIGITOVER" as PurchaseType,
    DigitUnder: "DIGITUNDER" as PurchaseType,
    DigitOver0: "DIGITUNDER9_DIGITOVER_0" as PurchaseType,
    DigitOver1: "DIGITUNDER8_DIGITOVER_1" as PurchaseType,
    DigitOver2: "DIGITUNDER7_DIGITOVER_2" as PurchaseType,
    DigitOver3: "DIGITUNDER6_DIGITOVER_3" as PurchaseType,
    DigitUnder9: "DIGITUNDER9_DIGITOVER_0" as PurchaseType,
    DigitUnder8: "DIGITUNDER8_DIGITOVER_1" as PurchaseType,
    DigitUnder7: "DIGITUNDER7_DIGITOVER_2" as PurchaseType,
    DigitUnder6: "DIGITUNDER6_DIGITOVER_3" as PurchaseType,
    DigitOver0Under9: "DIGITUNDER9_DIGITOVER_0" as PurchaseType,
    DigitOver1Under8: "DIGITUNDER8_DIGITOVER_1" as PurchaseType,
    DigitOver2Under7: "DIGITUNDER7_DIGITOVER_2" as PurchaseType,
    DigitOver3Under6: "DIGITUNDER6_DIGITOVER_3" as PurchaseType,
    DigitAutoEvenOdd: "EVEN_ODD" as PurchaseType,
    DigitEven: "EVEN" as PurchaseType,
    DigitOdd: "ODD" as PurchaseType,
    Call: "CALL" as PurchaseType,
    Put: "PUT" as PurchaseType,
    Acc: "ACCU" as PurchaseType,
} as const;

export type TradingType = "FOREX" | "DERIVATIVES" | "CRYPTO" | "COMMODITIES";

export const TradingTypeEnum = {
    Default: "DERIVATIVES" as TradingType,
    Forex: "FOREX" as TradingType,
    Derivatives: "DERIVATIVES" as TradingType,
    Crypto: "CRYPTO" as TradingType,
    Commodities: "COMMODITIES" as TradingType
} as const;

export type MarketType = "R_100" | "R_75" | "R_50" | "R_25" | "R_10" | "R_100 (1s)" | "R_75 (1s)" | "R_50 (1s)" | "R_25 (1s)" | "R_10 (1s)";

export const MarketTypeEnum = {
    Default: "R_100" as MarketType,
    R_100: "R_100" as MarketType,
    R_75: "R_75" as MarketType,
    R_50: "R_50" as MarketType,
    R_25: "R_25" as MarketType,
    R_10: "R_10" as MarketType,
    R_100_1s: "R_100 (1s)" as MarketType,
    R_75_1s: "R_75 (1s)" as MarketType,
    R_50_1s: "R_50 (1s)" as MarketType,
    R_25_1s: "R_25 (1s)" as MarketType,
    R_10_1s: "R_10 (1s)" as MarketType,
} as const;

export type TradingModeType = "MANUAL" | "AUTO";

export const TradingModeTypeEnum = {
    Default: "AUTO" as TradingModeType,
    Manual: "MANUAL" as TradingModeType,
    Auto: "AUTO" as TradingModeType,
} as const;

export const VolatilityIndicesEnum = {
    Volatility10: "Volatility 10 📈",
    Volatility10_1s: "Volatility 10(1s) 📈",
    Volatility25: "Volatility 25 📈",
    Volatility25_1s: "Volatility 25(1s) 📈",
    Volatility50: "Volatility 50 📈",
    Volatility50_1s: "Volatility 50(1s) 📈",
    Volatility75: "Volatility 75 📈",
    Volatility75_1s: "Volatility 75(1s) 📈",
    Volatility100: "Volatility 100 📈",
    Volatility100_1s: "Volatility 100(1s) 📈"
} as const;

export const DerivativeDigitsEnum = {
    // Auto/Rise/Fall
    Auto: "Auto ⬆️⬇️",
    Rise: "Rise ⬆️",
    Fall: "Fall ⬇️",

    // Digits Auto/Evens/Odds
    DigitsAuto: "Digits Auto 🎲",
    DigitsEvens: "Digits Evens 1️⃣",
    DigitsOdds: "Digits Odds 0️⃣",

    // Digits Down (9-6)
    DigitsUnder9: "Digits ⬇️9️⃣",
    DigitsUnder8: "Digits ⬇️8️⃣",
    DigitsUnder7: "Digits ⬇️7️⃣",
    DigitsUnder6: "Digits ⬇️6️⃣",

    // Digits Up (0-3)
    DigitsOver0: "Digits ⬆️0️⃣",
    DigitsOver1: "Digits ⬆️1️⃣",
    DigitsOver2: "Digits ⬆️2️⃣",
    DigitsOver3: "Digits ⬆️3️⃣",

    // Digit NOT options
    DigitNotLast: "Digit NOT Last 🔚",
    DigitNotRandom: "Digit NOT Random 🎲",
} as const;

export const CryptoTradingPairsEnum = {
    BTCUSD: "BTC/USD 💵 ₿",
    ETHUSD: "ETH/USD 💵 Ξ",
} as const;

export const CommodityTradingPairsEnum = {
    GoldUSD: "Gold/USD 💵 🥇",
    PalladiumUSD: "Palladium/USD 💵 🛢️",
    PlatinumUSD: "Platinum/USD 💵 ⚪",
    SilverUSD: "Silver/USD 💵 🥈",
} as const;

export const ForexTradingPairsEnum = {
    // AUD Pairs
    AUDJPY: "AUD/JPY 🇦🇺🇯🇵",
    AUDUSD: "AUD/USD 🇦🇺🇺🇸",

    // EUR Pairs (Group 1)
    EURAUD: "EUR/AUD 🇪🇺🇦🇺",
    EURCAD: "EUR/CAD 🇪🇺🇨🇦",

    // EUR Pairs (Group 2)
    EURCHF: "EUR/CHF 🇪🇺🇨🇭",
    EURGBP: "EUR/GBP 🇪🇺🇬🇧",

    // EUR Pairs (Group 3)
    EURJPY: "EUR/JPY 🇪🇺🇯🇵",
    EURUSD: "EUR/USD 🇪🇺🇺🇸",

    // GBP Pairs
    GBPAUD: "GBP/AUD 🇬🇧🇦🇺",
    GBPJPY: "GBP/JPY 🇬🇧🇯🇵",
    GBPUSD: "GBP/USD 🇬🇧🇺🇸",

    // USD Pairs
    USDCAD: "USD/CAD 🇺🇸🇨🇦",
    USDCHF: "USD/CHF 🇺🇸🇨🇭",
    USDJPY: "USD/JPY 🇺🇸🇯🇵",
} as const;


export const TradingTypesEnum = {
    FOREX: "Forex 🌍",
    DERIVATIVES: "Derivatives 📊",
    CRYPTO: "Crypto ₿",
    COMMODITIES: "Commodities 🛢️",
} as const;

export const TradeModeEnum = {
    MANUAL: "📈 Manual Trading",
    AUTO: "🎲 Auto Trading"
} as const;

export const TradeConfirmationEnum = {
    CONFIRM: "✅ CONFIRM TRADE",
    CANCEL: "❌ CANCEL TRADE"
} as const;

export const TradeManualActionEnum = {
    TRADE_AGAIN: "✅ TRADE AGAIN",
    STOP_TRADING: "❌ STOP TRADING"
} as const;

// Session Steps
export const SessionStepsEnum = {
    LOGIN_ACCOUNT: "LOGIN_ACCOUNT",
    SELECT_ACCOUNT_TYPE: "ACCOUNT_TYPE_SELECTION",
    SELECT_TRADING_TYPE: "TRADING_TYPE_SELECTION",
    SELECT_MARKET: "MARKET_SELECTION",
    SELECT_PURCHASE_TYPE: "PURCHASE_TYPE_SELECTION",
    ENTER_STAKE: "STAKE_INPUT",
    ENTER_TAKE_PROFIT: "TAKE_PROFIT_INPUT",
    ENTER_STOP_LOSS: "STOP_LOSS_INPUT",
    SELECT_TRADE_DURATION: "TRADE_DURATION_SELECTION",
    SELECT_UPDATE_FREQUENCY: "UPDATE_FREQUENCY_SELECTION",
    SELECT_TICKS_OR_MINUTES: "UPDATE_CONTRACT_DURATION_UNIT_SSELECTION",
    SELECT_TICKS_OR_MINUTES_DURATION: "UPDATE_CONTRACT_DURATION_VALUE_SELECTION",
    SELECT_AUTO_OR_MANUAL: "AUTO_MANUAL_TRADING",
    CONFIRM_TRADE: "TRADE_CONFIRMATION",
    MANUAL_TRADE: "TRADE_MANUAL",
  } as const;
  
  // Numeric Input Values
  export const NumericInputValuesEnum = {
    VALUE_0_35: "$0.35",
    VALUE_0_50: "$0.50",
    VALUE_0_75: "$0.75",
    VALUE_1_00: "$1.00",
    VALUE_2_00: "$2.00",
    VALUE_5_00: "$5.00",
    VALUE_10_00: "$10.00",
    VALUE_15_00: "$15.00",
    VALUE_20_00: "$20.00",
    VALUE_25_00: "$25.00",
    VALUE_50_00: "$50.00",
    VALUE_75_00: "$75.00",
    VALUE_100_00: "$100.00",
    VALUE_200_00: "$200.00",
    VALUE_500_00: "$500.00",
    VALUE_750_00: "$750.00",
    VALUE_1000_00: "$1,000.00",
    VALUE_2000_00: "$2,000.00",
    VALUE_2500_00: "$2,500.00",
    VALUE_5000_00: "$5,000.00",
    AUTOMATIC: "Automatic",
  } as const;
  
  // Duration Values
  export const DurationValuesEnum = {
    SEC_5: "5sec ⏱️",
    SEC_10: "10sec ⏱️",
    SEC_15: "15sec ⏱️",
    SEC_20: "20sec ⏱️",
    SEC_25: "25sec ⏱️",
    SEC_30: "30sec ⏱️",
    SEC_40: "40sec ⏱️",
    SEC_50: "50sec ⏱️",
    SEC_60: "60sec ⏱️",
    MIN_1: "1min ⏱️",
    MIN_2: "2min ⏱️",
    MIN_5: "5min ⏱️",
    MIN_10: "10min ⏱️",
    MIN_15: "15min ⏱️",
    MIN_20: "20min ⏱️",
    MIN_25: "25min ⏱️",
    MIN_30: "30min ⏱️",
    MIN_35: "35min ⏱️",
    MIN_40: "40min ⏱️",
    MIN_45: "45min ⏱️",
    MIN_50: "50min ⏱️",
    MIN_55: "55min ⏱️",
    MIN_60: "60min ⏱️",
    HR_1: "1hr ⏱️",
    HR_2: "2hrs ⏱️",
    HR_3: "3hrs ⏱️",
    HR_4: "4hrs ⏱️",
    HR_5: "5hrs ⏱️",
    HR_6: "6hrs ⏱️",
    HR_7: "7hrs ⏱️",
    HR_8: "8hrs ⏱️",
    HR_9: "9hrs ⏱️",
    HR_10: "10hrs ⏱️",
    HR_12: "12hrs ⏱️",
    HR_14: "14hrs ⏱️",
    HR_16: "16hrs ⏱️",
    HR_18: "18hrs ⏱️",
    HR_20: "20hrs ⏱️",
    HR_24: "24hrs ⏱️",
    HR_48: "48hrs ⏱️",
    HR_72: "72hrs ⏱️",
    TICK_1: "1 Tick",
    TICK_2: "2 Ticks",
    TICK_3: "3 Ticks",
    TICK_4: "4 Ticks",
    TICK_5: "5 Ticks",
    TICK_6: "6 Ticks",
    TICK_7: "7 Ticks",
    TICK_8: "8 Ticks",
    TICK_9: "9 Ticks",
    TICK_10: "10 Ticks",
  } as const;
  
  // Trade Duration Units
  export const TradeDurationUnitsEnum = {
    TICKS: "Ticks ⏱️",
    MINUTES: "Minutes ⏱️",
    HOURS: "Hours ⏱️",
  } as const;
  
  // Trade Duration Units
  export const TradeDurationUnitsOptimizedEnum = {
    Ticks: "t",
    Minutes: "m",
    Hours: "h",
  } as const;
  
  // Commands
  export const CommandsEnum = {
    START: "/start",
    CONFIRM: "/confirm",
    CANCEL: "/cancel",
    HELP: "/help",
    RESUME: "/resume",
    PAUSE: "/pause",
    STOP: "/stop",
    WITHDRAW: "/withdraw",
    DEPOSIT: "/deposit",
    WALLET: "/wallet",
    ACCOUNTS: "/accounts",
    PROFILE: "/profile",
    SETTINGS: "/settings",
    LOGOUT: "/logout",
    STATUS: "/status",
    HISTORY: "/history",
    BALANCE: "/balance",
    INFO: "/info",
    SUPPORT: "/support",
    UPDATE: "/update",
    NEWS: "/news",
    ALERTS: "/alerts",
    RISK_MANAGEMENT: "/risk-management",
    STRATEGIES: "/strategies",
    FAQ: "/faq",
    TELEMETRY: "/telemetry",
    PROFITS: "/profits",
    STATEMENT: "/statement",
    RESET: "/reset",
    PRICING: "/pricing",
    SUBSCRIBE: "/subscribe",
    HEALTH_CHECK: "/health-check",
  } as const;

export type BotSessionDataType = {
    step: string,
    accountType?: string,
    tradingType?: string,
    market?: string,
    purchaseType?: string,
    stake?: number | string,
    takeProfit?: number | string,
    stopLoss?: number | string,
    tradeDuration?: string,
    updateFrequency?: string,
    contractDurationUnits?: string,
    contractDurationValue?: string,
    tradingMode?: string
};

export type AccountType = {
    acct: string;
    token: string;
    curr: string;
}

export type TradingSessionDataType = {
    step: Step,
    accountType: AccountType,
    tradingType: TradingType,
    market: MarketType,
    purchaseType: PurchaseType,
    stake: number,
    takeProfit: number,
    stopLoss: number,
    tradeDuration: number,
    updateFrequency: number,
    contractDurationUnits: string,
    contractDurationValue: number,
    tradingMode: string
};

export type BotConfig = {
    accountType?: AccountType,
    tradingType?: TradingType,
    market?: MarketType,    
    defaultMarket?: MarketType;
    purchaseType?: PurchaseType,    
    baseStake?: number;
    stake?: number,
    takeProfit?: number,
    stopLoss?: number,
    tradeDuration?: number,
    updateFrequency?: number,
    contractDurationUnits?: string,
    contractDurationValue?: number,
    tradingMode?: string
    userAccountToken?: string;
    maxStake?: number;
    minStake?: number;
    maxRecoveryTrades?: number;
};

export interface ContractResponse {
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

export interface UserAccount {
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
    status_codes: string[];
    siblings: any[];
    contracts: ContractParams[];
    open_contracts: ContractParams[];
    closed_contracts: ContractParams[];
    api_tokens: string[];
    buy: (arg0: ContractParams) => ContractResponse;
    contract: (arg0: ContractParams) => ContractResponse;
}

export interface ContractParams {
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

export interface ContractProps {
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
    ticks?: Tick[];
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

export interface ProposalParams {
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
}

export interface BalanceParams {
    account: string;
    balance: number;
    passthrough?: any;
    req_id?: number;
    subscribe?: number;
}

export interface BalanceProps {
    amount: Monetary;
    value: number;
    currency: string;
    display: string;
    format: string;
    onUpdate: any;
}

export interface Monetary {
    value: number;
    currency: string;
    display: string;
    format: string;
}

export interface CustomDate {
    epoch: number;
    epoch_milliseconds: number;
    date: Date;
}

export interface TransactionsParams {
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
}

export interface Profit {
    percentage?: number;
    value?: number;
    sign?: number;
    is_win?: boolean;
    currency?: string;
    display?: string;
    format?: string;
}

export interface Spot {
    value?: number;
    pip?: number;
    pip_size?: number;
    pip_sized?: number;
    time?: CustomDate;
}

export interface Tick {
    time: number | string;
    epoch: number | string;
    quote: number;
    ask: number;
    bid: number;
}

export interface MarketValue {
    value?: number;
    pip?: number;
    pip_size?: number;
    pip_sized?: number;
    display?: number;
}

export interface BuyParams {
    buy: string;
    parameters: any;
    passthrough?: any;
    price: number;
    req_id?: number;
    subscribe?: number;
}

export interface BuyProps {
    buy_price: Monetary;
    balance_after: Monetary;
    payout: Monetary;
    start_time: CustomDate;
    purchase_time: CustomDate;
    contract_id: number;
    transaction_id: number;
    longcode: string;
    shortcode: string;
}

export interface SellProps {
    sold_for?: Monetary;
    price?: Monetary;
    balance_after?: Monetary;
    contract_id?: number;
    transaction_id?: number;
    reference_id?: number;
    buy_transaction?: number;
}

export interface LimitsParams {
    get_limits: number;
    passthrough?: any;
    req_id?: number;
}

export interface UserSettingsParams {
    get_settings: number;
    passthrough?: any;
    req_id?: number;
}

export interface ProfitTableParams {
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
}

export interface StatementParams {
    action_type: string;
    date_from?: number;
    date_to?: number;
    description?: number;
    limit?: number;
    offset?: number;
    passthrough?: any;
    req_id?: number;
    statement: number;
}

export interface TicksParams {
    passthrough?: any;
    req_id?: number;
    subscribe?: number;
    ticks: string | [];
}

export interface TickHistoryParams {
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
}

/*


 // Private properties
    private _symbol_short: string;
    private _symbol_full: string;
    private _start_time: number;
    private _expiry_time: number;
    private _purchase_time: number;
    private _entry_spot_value: number;
    private _entry_spot_time: number;
    private _exit_spot_value: number;
    private _exit_spot_time: number;
    private _ask_price_currency: string;
    private _ask_price_value: number;
    private _buy_price_currency: string;
    private _buy_price_value: number;
    private _buy_transaction: number;
    private _bid_price_currency: string;
    private _bid_price_value: number;
    private _sell_price_currency: string;
    private _sell_price_value: number;
    private _sell_spot: number;
    private _sell_spot_time: number;
    private _sell_transaction: number;
    private _payout: number;
    private _payout_currency: string;
    private _profit_value: number;
    private _profit_currency: number;
    private _profit_percentage: number;
    private _profit_is_win: boolean;
    private _profit_sign: number;
    private _status: string;
    private _longcode: string;
    private _proposal_id: string;
    private _balance_currency: string;
    private _balance_value: number;
    private _audit_details: Array<{
        epoch: number;
        tick?: number;
        tick_display_value?: string;
        flag?: string;
        name?: string;
    }>;

    */

export interface ITradeData {
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
    proposal_id: any;
    balance_currency: string;
    balance_value: string;
    audit_details: any;
    ticks: any;
}

export interface IDerivUserAccount {
    loginid: string;
    user_id: string;
    email: string;
    country: string;
    currency: string;
    balance: BalanceProps;
    transactions: TransactionsParams;
    contracts: ContractParams[];
    open_contracts: ContractParams[];
    closed_contracts: ContractParams[];
}