global.WebSocket = require("ws");

interface Observer {
  closed: boolean;
  currentObservers: any[] | null;
  observers: any[][];
  isStopped: boolean;
  hasError: boolean;
  thrownError: any | null;
}

interface ApiBasic {
  events: any[];
  connection: WebSocket[];
  lang: string;
  reqId: number;
  connected: any[];
  sanityErrors: any[];
  middleware: Record<string, any>;
  pendingRequests: Record<string, any>;
  expect_response_types: Record<string, any>;
  subscription_manager: any;
  reconnect_timeout: boolean;
  keep_alive_interval: boolean;
  is_request_blocked: boolean;
  excluded_request_block: any[];
  cache: any;
}

interface Api {
  basic: ApiBasic;
}

interface Options {
  amount: number;
  basis: string;
  contract_type: string;
  currency: string;
  duration: number;
  duration_unit: string;
  symbol: string;
  barrier: number;
}

interface ActiveSymbol {
  allow_forward_starting: number;
  display_name: string;
  display_order: number;
  exchange_is_open: number;
  is_trading_suspended: number;
  market: string;
  market_display_name: string;
  pip: number;
  subgroup: string;
  subgroup_display_name: string;
  submarket: string;
  submarket_display_name: string;
  symbol: string;
  symbol_type: string;
}

interface SymbolData {
  short: string;
  full: string;
  _data: Record<string, any>;
}

interface Data {
  active_symbol: ActiveSymbol;
  type: string;
  symbol: SymbolData;
  currency: string;
  status: string;
  ask_price: any;
  start_time: any;
  longcode: string;
  payout: any;
  current_spot: any;
  proposal_id: string;
  id: number;
  buy_transaction: number;
  buy_price: any;
  purchase_time: any;
  shortcode: string;
  code: SymbolData;
  is_expired: boolean;
  is_forward_starting: boolean;
  is_intraday: boolean;
  is_path_dependent: boolean;
  is_settleable: boolean;
  is_sold: boolean;
  is_valid_to_sell: boolean;
  validation_error: string;
  barrier: any;
  high_barrier: any;
  low_barrier: any;
  bid_price: any;
  sell_price: any;
  profit: any;
  entry_spot: any;
  exit_spot: any;
  sell_spot: any;
  expiry_time: any;
  sell_time: any;
  ticks: any[][];
  multiplier: undefined;
  tick_count: number;
  barrier_count: number;
  audit_details: { all_ticks: any[] };
  sell_transaction: number;
}

interface ParsedData {
  on_update: Observer;
  before_update: Observer;
  api: Api;
  options: Options;
  _data: Data;
}

function parseData(data: any): ParsedData {
  return {
    on_update: data.on_update,
    before_update: data.before_update,
    api: data.api,
    options: data.options,
    _data: data._data,
  };
}

// Example usage:
const rawData = {
  on_update: {
    closed: false,
    currentObservers: null,
    observers: [[{}]],
    isStopped: false,
    hasError: false,
    thrownError: null,
  },
  before_update: {
    closed: false,
    currentObservers: [[{}]],
    observers: [[{}]],
    isStopped: false,
    hasError: false,
    thrownError: null,
  },
  api: {
    basic: {
      events: [{}],
      connection: [new WebSocket('ws://example.com')],
      lang: 'EN',
      reqId: 10,
      connected: [{}],
      sanityErrors: [{}],
      middleware: {},
      pendingRequests: {},
      expect_response_types: {},
      subscription_manager: {},
      reconnect_timeout: false,
      keep_alive_interval: false,
      is_request_blocked: false,
      excluded_request_block: [],
      cache: {},
    },
  },
  options: {
    amount: 15,
    basis: 'stake',
    contract_type: 'DIGITUNDER',
    currency: 'USD',
    duration: 1,
    duration_unit: 't',
    symbol: 'R_100',
    barrier: 9,
  },
  _data: {
    active_symbol: {
      allow_forward_starting: 1,
      display_name: 'Volatility 100 Index',
      display_order: 0,
      exchange_is_open: 1,
      is_trading_suspended: 0,
      market: 'synthetic_index',
      market_display_name: 'Derived',
      pip: 0.01,
      subgroup: 'synthetics',
      subgroup_display_name: 'Synthetics',
      submarket: 'random_index',
      submarket_display_name: 'Continuous Indices',
      symbol: 'R_100',
      symbol_type: 'stockindex',
    },
    type: 'DIGITUNDER',
    symbol: { short: 'R_100', full: 'Volatility 100 Index', _data: {} },
    currency: 'USD',
    status: 'lost',
    ask_price: { _data: {} },
    start_time: { _data: {} },
    longcode: 'Win payout if the last digit of Volatility 100 Index is strictly lower than 9 after 1 ticks.',
    payout: { _data: {} },
    current_spot: { pip: 0.01, _data: {} },
    proposal_id: '97e4e753-221d-c59d-a563-6c46cc4e939f',
    id: 273552772428,
    buy_transaction: 545329915328,
    buy_price: { _data: {} },
    purchase_time: { _data: {} },
    shortcode: 'DIGITUNDER_R_100_16.45_1740429375_1T_9_0',
    code: {
      short: 'DIGITUNDER_R_100_16.45_1740429375_1T_9_0',
      full: 'Win payout if the last digit of Volatility 100 Index is strictly lower than 9 after 1 ticks.',
      _data: {},
    },
    is_expired: true,
    is_forward_starting: false,
    is_intraday: true,
    is_path_dependent: false,
    is_settleable: true,
    is_sold: true,
    is_valid_to_sell: false,
    validation_error: 'This contract has been sold.',
    barrier: { pip: 0.01, _data: {} },
    high_barrier: { pip: 0.01, _data: {} },
    low_barrier: { pip: 0.01, _data: {} },
    bid_price: { _data: {} },
    sell_price: { _data: {} },
    profit: { _data: {} },
    entry_spot: { pip: 0.01, _data: {} },
    exit_spot: { pip: 0.01, _data: {} },
    sell_spot: { pip: 0.01, _data: {} },
    expiry_time: { _data: {} },
    sell_time: { _data: {} },
    ticks: [[{}]],
    multiplier: undefined,
    tick_count: 1,
    barrier_count: 1,
    audit_details: { all_ticks: [[]] },
    sell_transaction: 545329919508,
  },
};

export default parseData;