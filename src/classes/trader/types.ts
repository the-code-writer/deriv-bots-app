// types.ts - Contains all type definitions and interfaces
/**
 * @file Contains all type definitions and interfaces for the Deriv trading bot
 */

export type PurchaseType =
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

export const PurchaseTypeEnum = {
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
} as const;

export type TradingType = "FOREX" | "Derivatives 📊" | "CRYPTO" | "COMMODITIES";
export type MarketType = "R_100" | "R_75" | "R_50" | "R_25";

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

export interface BotConfig {
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