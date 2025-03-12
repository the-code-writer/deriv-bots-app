/**
 * Interface representing the structure of trade data.
 */
export interface ITradeData {
    symbol_short: string; // Short symbol of the trade
    symbol_full: string; // Full symbol of the trade
    start_time: number; // Start time of the trade (epoch)
    expiry_time: number; // Expiry time of the trade (epoch)
    purchase_time: number; // Purchase time of the trade (epoch)
    entry_spot_value: number; // Entry spot value of the trade
    entry_spot_time: number; // Entry spot time of the trade (epoch)
    exit_spot_value: number; // Exit spot value of the trade
    exit_spot_time: number; // Exit spot time of the trade (epoch)
    ask_price_currency: string; // Currency of the ask price
    ask_price_value: number; // Value of the ask price
    buy_price_currency: string; // Currency of the buy price
    buy_price_value: number; // Value of the buy price
    buy_transaction: number; // Buy transaction ID
    bid_price_currency: string; // Currency of the bid price
    bid_price_value: number; // Value of the bid price
    sell_price_currency: string; // Currency of the sell price
    sell_price_value: number; // Value of the sell price
    sell_spot: number; // Sell spot value
    sell_spot_time: number; // Sell spot time (epoch)
    sell_transaction: number; // Sell transaction ID
    payout: number; // Payout value
    payout_currency: string; // Currency of the payout
    profit_value: number; // Profit value
    profit_currency: number; // Currency of the profit
    profit_percentage: number; // Percentage of the profit
    profit_is_win: boolean; // Indicates if the trade is a win
    profit_sign: number; // Sign of the profit (e.g., 1 for positive, -1 for negative)
    status: string; // Status of the trade
    longcode: string; // Long code of the trade
    proposal_id: string; // Proposal ID of the trade
    balance_currency: string; // Currency of the balance
    balance_value: number | string; // Value of the balance
    audit_details: Array<{ // Array of audit details
        epoch: number; // Epoch time of the audit
        tick?: number; // Optional tick value
        tick_display_value?: string; // Optional tick display value
        flag?: string; // Optional flag
        name?: string; // Optional name
    }>;
    ticks: any;
}

/**
 * Class representing trade data.
 */
export class TradeData {
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
    private _ticks: any;

    // Constructor to initialize the object
    constructor(
        symbol_short: string,
        symbol_full: string,
        start_time: number,
        expiry_time: number,
        purchase_time: number,
        entry_spot_value: number,
        entry_spot_time: number,
        exit_spot_value: number,
        exit_spot_time: number,
        ask_price_currency: string,
        ask_price_value: number,
        buy_price_currency: string,
        buy_price_value: number,
        buy_transaction: number,
        bid_price_currency: string,
        bid_price_value: number,
        sell_price_currency: string,
        sell_price_value: number,
        sell_spot: number,
        sell_spot_time: number,
        sell_transaction: number,
        payout: number,
        payout_currency: string,
        profit_value: number,
        profit_currency: number,
        profit_percentage: number,
        profit_is_win: boolean,
        profit_sign: number,
        status: string,
        longcode: string,
        proposal_id: string,
        balance_currency: string,
        balance_value: number,
        audit_details: Array<{
            epoch: number;
            tick?: number;
            tick_display_value?: string;
            flag?: string;
            name?: string;
        }>,
        ticks: any
    ) {
        this._symbol_short = symbol_short;
        this._symbol_full = symbol_full;
        this._start_time = start_time;
        this._expiry_time = expiry_time;
        this._purchase_time = purchase_time;
        this._entry_spot_value = entry_spot_value;
        this._entry_spot_time = entry_spot_time;
        this._exit_spot_value = exit_spot_value;
        this._exit_spot_time = exit_spot_time;
        this._ask_price_currency = ask_price_currency;
        this._ask_price_value = ask_price_value;
        this._buy_price_currency = buy_price_currency;
        this._buy_price_value = buy_price_value;
        this._buy_transaction = buy_transaction;
        this._bid_price_currency = bid_price_currency;
        this._bid_price_value = bid_price_value;
        this._sell_price_currency = sell_price_currency;
        this._sell_price_value = sell_price_value;
        this._sell_spot = sell_spot;
        this._sell_spot_time = sell_spot_time;
        this._sell_transaction = sell_transaction;
        this._payout = payout;
        this._payout_currency = payout_currency;
        this._profit_value = profit_value;
        this._profit_currency = profit_currency;
        this._profit_percentage = profit_percentage;
        this._profit_is_win = profit_is_win;
        this._profit_sign = profit_sign;
        this._status = status;
        this._longcode = longcode;
        this._proposal_id = proposal_id;
        this._balance_currency = balance_currency;
        this._balance_value = balance_value;
        this._audit_details = audit_details;
        this._ticks = ticks;
    }

    // Getters and setters for each property
    get symbol_short(): string {
        return this._symbol_short;
    }

    set symbol_short(value: string) {
        this._symbol_short = value;
    }

    get symbol_full(): string {
        return this._symbol_full;
    }

    set symbol_full(value: string) {
        this._symbol_full = value;
    }

    get start_time(): number {
        return this._start_time;
    }

    set start_time(value: number) {
        this._start_time = value;
    }

    get expiry_time(): number {
        return this._expiry_time;
    }

    set expiry_time(value: number) {
        this._expiry_time = value;
    }

    get purchase_time(): number {
        return this._purchase_time;
    }

    set purchase_time(value: number) {
        this._purchase_time = value;
    }

    get entry_spot_value(): number {
        return this._entry_spot_value;
    }

    set entry_spot_value(value: number) {
        this._entry_spot_value = value;
    }

    get entry_spot_time(): number {
        return this._entry_spot_time;
    }

    set entry_spot_time(value: number) {
        this._entry_spot_time = value;
    }

    get exit_spot_value(): number {
        return this._exit_spot_value;
    }

    set exit_spot_value(value: number) {
        this._exit_spot_value = value;
    }

    get exit_spot_time(): number {
        return this._exit_spot_time;
    }

    set exit_spot_time(value: number) {
        this._exit_spot_time = value;
    }

    get ask_price_currency(): string {
        return this._ask_price_currency;
    }

    set ask_price_currency(value: string) {
        this._ask_price_currency = value;
    }

    get ask_price_value(): number {
        return this._ask_price_value;
    }

    set ask_price_value(value: number) {
        this._ask_price_value = value;
    }

    get buy_price_currency(): string {
        return this._buy_price_currency;
    }

    set buy_price_currency(value: string) {
        this._buy_price_currency = value;
    }

    get buy_price_value(): number {
        return this._buy_price_value;
    }

    set buy_price_value(value: number) {
        this._buy_price_value = value;
    }

    get buy_transaction(): number {
        return this._buy_transaction;
    }

    set buy_transaction(value: number) {
        this._buy_transaction = value;
    }

    get bid_price_currency(): string {
        return this._bid_price_currency;
    }

    set bid_price_currency(value: string) {
        this._bid_price_currency = value;
    }

    get bid_price_value(): number {
        return this._bid_price_value;
    }

    set bid_price_value(value: number) {
        this._bid_price_value = value;
    }

    get sell_price_currency(): string {
        return this._sell_price_currency;
    }

    set sell_price_currency(value: string) {
        this._sell_price_currency = value;
    }

    get sell_price_value(): number {
        return this._sell_price_value;
    }

    set sell_price_value(value: number) {
        this._sell_price_value = value;
    }

    get sell_spot(): number {
        return this._sell_spot;
    }

    set sell_spot(value: number) {
        this._sell_spot = value;
    }

    get sell_spot_time(): number {
        return this._sell_spot_time;
    }

    set sell_spot_time(value: number) {
        this._sell_spot_time = value;
    }

    get sell_transaction(): number {
        return this._sell_transaction;
    }

    set sell_transaction(value: number) {
        this._sell_transaction = value;
    }

    get payout(): number {
        return this._payout;
    }

    set payout(value: number) {
        this._payout = value;
    }

    get payout_currency(): string {
        return this._payout_currency;
    }

    set payout_currency(value: string) {
        this._payout_currency = value;
    }

    get profit_value(): number {
        return this._profit_value;
    }

    set profit_value(value: number) {
        this._profit_value = value;
    }

    get profit_currency(): number {
        return this._profit_currency;
    }

    set profit_currency(value: number) {
        this._profit_currency = value;
    }


    get profit_percentage(): number {
        return this._profit_percentage;
    }

    set profit_percentage(value: number) {
        this._profit_percentage = value;
    }
    get profit_is_win(): boolean {
        return this._profit_is_win;
    }

    set profit_is_win(value: boolean) {
        this._profit_is_win = value;
    }

    get profit_sign(): number {
        return this._profit_sign;
    }

    set profit_sign(value: number) {
        this._profit_sign = value;
    }

    get status(): string {
        return this._status;
    }

    set status(value: string) {
        this._status = value;
    }

    get longcode(): string {
        return this._longcode;
    }

    set longcode(value: string) {
        this._longcode = value;
    }

    get proposal_id(): string {
        return this._proposal_id;
    }

    set proposal_id(value: string) {
        this._proposal_id = value;
    }

    get balance_currency(): string {
        return this._balance_currency;
    }

    set balance_currency(value: string) {
        this._balance_currency = value;
    }

    get balance_value(): number {
        return this._balance_value;
    }

    set balance_value(value: number) {
        this._balance_value = value;
    }

    get audit_details(): Array<{
        epoch: number;
        tick?: number;
        tick_display_value?: string;
        flag?: string;
        name?: string;
    }> {
        return this._audit_details;
    }

    set audit_details(
        value: Array<{
            epoch: number;
            tick?: number;
            tick_display_value?: string;
            flag?: string;
            name?: string;
        }>
    ) {
        this._audit_details = value;
    }

    
    get ticks(): any {
        return this._ticks;
    }

    set ticks(value: any) {
        this._ticks = value;
    }


    /**
     * Parses raw trade data into a TradeData object.
     * @param rawData - The raw data to parse.
     * @returns A TradeData object containing the parsed data.
     */
    static parseTradeData(rawData: any): TradeData {
        const {
            symbol_short,
            symbol_full,
            start_time,
            expiry_time,
            purchase_time,
            entry_spot_value,
            entry_spot_time,
            exit_spot_value,
            exit_spot_time,
            ask_price_currency,
            ask_price_value,
            buy_price_currency,
            buy_price_value,
            buy_transaction,
            bid_price_currency,
            bid_price_value,
            sell_price_currency,
            sell_price_value,
            sell_spot,
            sell_spot_time,
            sell_transaction,
            payout,
            payout_currency,
            profit_value,
            profit_currency,
            profit_percentage,
            profit_is_win,
            profit_sign,
            status,
            longcode,
            proposal_id,
            balance_currency,
            balance_value,
            audit_details,
            ticks,
        } = rawData;

        return new TradeData(
            symbol_short,
            symbol_full,
            start_time,
            expiry_time,
            purchase_time,
            entry_spot_value,
            entry_spot_time,
            exit_spot_value,
            exit_spot_time,
            ask_price_currency,
            ask_price_value,
            buy_price_currency,
            buy_price_value,
            buy_transaction,
            bid_price_currency,
            bid_price_value,
            sell_price_currency,
            sell_price_value,
            sell_spot,
            sell_spot_time,
            sell_transaction,
            payout,
            payout_currency,
            profit_value,
            profit_currency,
            profit_percentage,
            profit_is_win,
            profit_sign,
            status,
            longcode,
            proposal_id,
            balance_currency,
            balance_value,
            audit_details,
            ticks
        );
    }
}

/*

import { TradeData, parseTradeData } from '@/classes/deriv/TradingDataClass';

// Example usage
const rawData: any = {
  symbol_short: 'BTCUSD',
  symbol_full: 'Bitcoin vs US Dollar',
  start_time: 1698768000,
  expiry_time: 1698854400,
  purchase_time: 1698768100,
  entry_spot_value: 35000,
  entry_spot_time: 1698768000,
  exit_spot_value: 36000,
  exit_spot_time: 1698854400,
  ask_price_currency: 'USD',
  ask_price_value: 35050,
  buy_price_currency: 'USD',
  buy_price_value: 35050,
  buy_transaction: 123456,
  bid_price_currency: 'USD',
  bid_price_value: 35000,
  sell_price_currency: 'USD',
  sell_price_value: 36000,
  sell_spot: 36000,
  sell_spot_time: 1698854400,
  sell_transaction: 654321,
  payout: 1000,
  payout_currency: 'USD',
  profit_value: 1000,
  profit_currency: 1000,
  profit_percentage: 96,
  profit_is_win: true,
  profit_sign: 1,
  status: 'won',
  longcode: 'You bought a contract.',
  proposal_id: 'proposal_123',
  balance_currency: 'USD',
  balance_value: 5000,
  audit_details: [
    {
      epoch: 1698768000,
      tick: 1,
      tick_display_value: '1',
      flag: 'start',
      name: 'Trade Start',
    },
  ],
  ticks: []
};

const tradeData: TradeData = new TradeData(rawData);

or

const tradeData: TradeData = TradeData.parseTradeData(rawData);

console.log(tradeData.symbol_short); // Output: BTCUSD
*/
