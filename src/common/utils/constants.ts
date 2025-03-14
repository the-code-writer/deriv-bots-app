import { KeyboardButton } from "node-telegram-bot-api";

interface IForex {
  FOREX: KeyboardButton[][] | string [][];
}

interface IDerivatives {
  DERIVATIVES: KeyboardButton[][] | string [][];
}

interface ICrypto {
  CRYPTO: KeyboardButton[][] | string [][];
}

interface ICommodities {
  COMMODITIES: KeyboardButton[][] | string [][];
}

interface IPurchaseTypes {
  GENERAL: KeyboardButton[][] | string [][];
  DERIVATIVES: KeyboardButton[][] | string [][];
}

interface ICommands {
  START: string;
  CONFIRM: string; // This command wasn't explicitly listed, but it's included here for completeness
  CANCEL: string;
  HELP: string;
  RESUME: string;
  PAUSE: string;
  STOP: string;
  WITHDRAW: string;
  DEPOSIT: string;
  WALLET: string;
  ACCOUNTS: string;
  PROFILE: string;
  SETTINGS: string;
  LOGOUT: string;
  STATUS: string;
  HISTORY: string;
  BALANCE: string;
  INFO: string;
  SUPPORT: string;
  UPDATE: string;
  NEWS: string;
  ALERTS: string;
  RISK_MANAGEMENT: string;
  STRATEGIES: string;
  FAQ: string;
  TELEMETRY: string;
  PROFITS: string;
  STATEMENT: string;
  RESET: string;
  PRICING: string;
  SUBSCRIBE: string;
  HEALTH_CHECK: string;
}

interface IContants {
  TRADING_TYPES: any;
  MARKETS: IForex | IDerivatives | ICrypto | ICommodities ;
  PURCHASE_TYPES: IPurchaseTypes;
  NUMERIC_INPUT: KeyboardButton[][] | string [][];
  DURATION: KeyboardButton[][] | string [][];
  TRADE_DURATION_U: KeyboardButton[][] | string [][];
  TRADE_DURATION_T: KeyboardButton[][] | string [][];
  TRADE_DURATION_M: KeyboardButton[][] | string [][];
  TRADE_MANUAL_OR_AUTO: KeyboardButton[][] | string [][];
  TRADE_CONFIRM: KeyboardButton[][] | string [][];
  TRADE_MANUAL: KeyboardButton[][] | string [][];
  COMMANDS: ICommands;
}

export const CONSTANTS: IContants = {
  TRADING_TYPES: {
    FOREX: "Forex 🌍",
    DERIVATIVES: "Derivatives 📊",
    CRYPTO: "Crypto ₿",
    COMMODITIES: "Commodities 🛢️",
  },
  MARKETS: {
    FOREX: [
      ["AUD/JPY 🇦🇺🇯🇵", "AUD/USD 🇦🇺🇺🇸"],
      ["EUR/AUD 🇪🇺🇦🇺", "EUR/CAD 🇪🇺🇨🇦"],
      ["EUR/CHF 🇪🇺🇨🇭", "EUR/GBP 🇪🇺🇬🇧"],
      ["EUR/JPY 🇪🇺🇯🇵", "EUR/USD 🇪🇺🇺🇸"],
      ["GBP/AUD 🇬🇧🇦🇺", "GBP/JPY 🇬🇧🇯🇵"],
      ["GBP/USD 🇬🇧🇺🇸", "USD/CAD 🇺🇸🇨🇦"],
      ["USD/CHF 🇺🇸🇨🇭", "USD/JPY 🇺🇸🇯🇵"],
    ],
    DERIVATIVES: [
      ["Volatility 10 📈", "Volatility 10(1s) 📈"],
      ["Volatility 25 📈", "Volatility 25(1s) 📈"],
      ["Volatility 50 📈", "Volatility 50(1s) 📈"],
      ["Volatility 75 📈", "Volatility 75(1s) 📈"],
      ["Volatility 100 📈", "Volatility 100(1s) 📈"],
    ],
    CRYPTO: [["BTC/USD 💵 ₿", "ETH/USD 💵 Ξ"]],
    COMMODITIES: [
      ["Gold/USD 💵 🥇", "Palladium/USD 💵 🛢️"],
      ["Platinum/USD 💵 ⚪", "Silver/USD 💵 🥈"],
    ],
  },
  PURCHASE_TYPES: {
    GENERAL: [["Auto Rise/Fall ⬆️⬇️", "Rise ⬆️", "Fall ⬇️"]],
    DERIVATIVES: [
      ["Auto ⬆️⬇️", "Rise ⬆️", "Fall ⬇️"],
      ["Digits Auto 🎲", "Digits Evens 1️⃣", "Digits Odds 0️⃣"],
      ["Digits ⬇️9️⃣", "Digits ⬇️8️⃣"],
      ["Digits ⬇️7️⃣", "Digits ⬇️6️⃣"],
      ["Digits ⬆️0️⃣", "Digits ⬆️1️⃣"],
      ["Digits ⬆️2️⃣", "Digits ⬆️3️⃣"],
      ["Digit NOT Last 🔚", "Digit NOT Random 🎲"],
    ],
  },
  NUMERIC_INPUT: [
    ["$0.35", "$0.50", "$0.75"],
    ["$1.00", "$2.00", "$5.00"],
    ["$10.00", "$15.00", "$20.00"],
    ["$25.00", "$50.00", "$75.00"],
    ["$100.00", "$200.00", "$500.00"],
    ["$750.00", "$1,000.00", "$2,000.00"],
    ["$2,500.00", "Automatic", "$5,000.00"],
  ],
  DURATION: [
    ["1min ⏱️", "2min ⏱️", "5min ⏱️", "10min ⏱️"],
    ["15min ⏱️", "30min ⏱️", "1hr ⏱️", "2hrs ⏱️"],
    ["4hrs ⏱️", "8hrs ⏱️", "12hrs ⏱️", "18hrs ⏱️"],
    ["24hrs ⏱️", "48hrs ⏱️", "72hrs ⏱️"],
    ["1 Tick", "3 Ticks", "5 Ticks", "10 Ticks"],
  ],
  TRADE_DURATION_U: [
    ["Ticks ⏱️", "Minutes ⏱️", "Hours ⏱️"],
  ],
  TRADE_DURATION_T: [
    ["1 Tick", "2 Ticks", "3 Ticks"],
    ["4 Ticks", "5 Ticks", "6 Ticks"],
    ["7 Ticks", "8 Ticks", "9 Ticks"],
    ["10 Ticks"],
  ],
  TRADE_DURATION_M: [
    ["1min ⏱️", "2min ⏱️", "5min ⏱️", "10min ⏱️"],
    ["15min ⏱️", "20min ⏱️", "25min ⏱️", "30min ⏱️"],
    ["35min ⏱️", "40min ⏱️", "45min ⏱️", "50min ⏱️"],
    ["1hr ⏱️", "2hrs ⏱️", "3hrs ⏱️", "4hrs ⏱️"],
    ["5hrs ⏱️", "6hrs ⏱️", "7hrs ⏱️", "8hrs ⏱️"],
    ["9hrs ⏱️", "10hrs ⏱️", "12hrs ⏱️", "8hrs ⏱️"],
    ["12hrs ⏱️", "16hrs ⏱️", "20hrs ⏱️", "24hrs ⏱️"],
  ],
  TRADE_MANUAL_OR_AUTO: [["📈 Manual Trading", "🎲 Auto Trading"]],
  TRADE_CONFIRM: [["✅ CONFIRM TRADE", "❌ CANCEL TRADE"]],
  TRADE_MANUAL: [["✅ TRAGE AGAIN", "❌ STOP TRADING"]],
  COMMANDS: {
    START: "/start",
    CONFIRM: "/confirm", // This command wasn't explicitly listed, but it's included here for completeness
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
  }

};
