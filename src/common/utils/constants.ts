export const CONSTANTS = {
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
  TRADE_CONFIRM: [["✅ Confirm Trade", "❌ Cancel Trade"]],






  COMMANDS: {
    START: "/start",
    CONFIRM: "/confirm",
    CANCEL: "/cancel",
    HELP: "/help",
    RESUME: "/resume",
  }
};
