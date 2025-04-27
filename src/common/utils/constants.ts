import { SessionStepsEnum, TradingTypesEnum, ForexTradingPairsEnum, VolatilityIndicesEnum, CryptoTradingPairsEnum, CommodityTradingPairsEnum, DerivativeDigitsEnum, NumericInputValuesEnum, DurationValuesEnum, TradeDurationUnitsEnum, TradeModeEnum, TradeConfirmationEnum, TradeManualActionEnum, CommandsEnum } from "@/classes/trader/types";
import { KeyboardButton } from "node-telegram-bot-api";

interface IForex {
  FOREX: KeyboardButton[][] | string[][];
}

interface IDerivatives {
  DERIVATIVES: KeyboardButton[][] | string[][];
}

interface ICrypto {
  CRYPTO: KeyboardButton[][] | string[][];
}

interface ICommodities {
  COMMODITIES: KeyboardButton[][] | string[][];
}

interface IContractTypes {
  GENERAL: KeyboardButton[][] | string[][];
  DERIVATIVES: KeyboardButton[][] | string[][];
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

interface ISessionSteps {
  LOGIN_ACCOUNT: string;
  SELECT_ACCOUNT_TYPE: string;
  SELECT_TRADING_TYPE: string;
  SELECT_MARKET: string;
  SELECT_CONTRACT_TYPE: string;
  ENTER_STAKE: string;
  ENTER_TAKE_PROFIT: string;
  ENTER_STOP_LOSS: string;
  SELECT_TRADE_DURATION: string;
  SELECT_UPDATE_FREQUENCY: string;
  SELECT_TICKS_OR_MINUTES: string;
  SELECT_TICKS_OR_MINUTES_DURATION: string;
  SELECT_AUTO_OR_MANUAL: string;
  CONFIRM_TRADE: string;
  MANUAL_TRADE: string;
}

interface IConstants {
  SESSION_STEPS: ISessionSteps;
  TRADING_TYPES: IForex | IDerivatives | ICrypto | ICommodities | any;
  MARKETS: IForex | IDerivatives | ICrypto | ICommodities;
  CONTRACT_TYPES: IContractTypes;
  NUMERIC_INPUTE: KeyboardButton[][] | string[][];
  DURATION: KeyboardButton[][] | string[][];
  TRADE_DURATION_U: KeyboardButton[][] | string[][];
  TRADE_DURATION_T: KeyboardButton[][] | string[][];
  TRADE_DURATION_M: KeyboardButton[][] | string[][];
  TRADE_DURATION_H: KeyboardButton[][] | string[][];
  TRADE_MANUAL_OR_AUTO: KeyboardButton[][] | string[][];
  TRADE_CONFIRM: KeyboardButton[][] | string[][];
  TRADE_MANUAL: KeyboardButton[][] | string[][];
  COMMANDS: ICommands;
}

export const CONSTANTS: IConstants = {
  SESSION_STEPS: SessionStepsEnum,
  TRADING_TYPES: TradingTypesEnum,
  MARKETS: {
    FOREX: [
      [ForexTradingPairsEnum.AUDJPY, ForexTradingPairsEnum.AUDUSD],
      [ForexTradingPairsEnum.EURAUD, ForexTradingPairsEnum.EURCAD],
      [ForexTradingPairsEnum.EURCHF, ForexTradingPairsEnum.EURGBP],
      [ForexTradingPairsEnum.EURJPY, ForexTradingPairsEnum.EURUSD],
      [ForexTradingPairsEnum.GBPAUD, ForexTradingPairsEnum.GBPJPY],
      [ForexTradingPairsEnum.GBPUSD, ForexTradingPairsEnum.USDCAD],
      [ForexTradingPairsEnum.USDCHF, ForexTradingPairsEnum.USDJPY],
    ],
    DERIVATIVES: [
      [VolatilityIndicesEnum.Volatility10, VolatilityIndicesEnum.Volatility10_1s],
      [VolatilityIndicesEnum.Volatility25, VolatilityIndicesEnum.Volatility25_1s],
      [VolatilityIndicesEnum.Volatility50, VolatilityIndicesEnum.Volatility50_1s],
      [VolatilityIndicesEnum.Volatility75, VolatilityIndicesEnum.Volatility75_1s],
      [VolatilityIndicesEnum.Volatility100, VolatilityIndicesEnum.Volatility100_1s],
    ],
    CRYPTO: [[CryptoTradingPairsEnum.BTCUSD, CryptoTradingPairsEnum.ETHUSD]],
    COMMODITIES: [
      [CommodityTradingPairsEnum.GoldUSD, CommodityTradingPairsEnum.PalladiumUSD],
      [CommodityTradingPairsEnum.PlatinumUSD, CommodityTradingPairsEnum.SilverUSD],
    ],
  },
  CONTRACT_TYPES: {
    GENERAL: [[DerivativeDigitsEnum.Auto, DerivativeDigitsEnum.Rise, DerivativeDigitsEnum.Fall]],
    DERIVATIVES: [
      [DerivativeDigitsEnum.Auto, DerivativeDigitsEnum.Rise, DerivativeDigitsEnum.Fall],
      [DerivativeDigitsEnum.DigitsAuto, DerivativeDigitsEnum.DigitsEvens, DerivativeDigitsEnum.DigitsOdds],
      [DerivativeDigitsEnum.DigitsUnder9, DerivativeDigitsEnum.DigitsUnder8],
      [DerivativeDigitsEnum.DigitsUnder7, DerivativeDigitsEnum.DigitsUnder6],
      [DerivativeDigitsEnum.DigitsOver0, DerivativeDigitsEnum.DigitsOver1],
      [DerivativeDigitsEnum.DigitsOver2, DerivativeDigitsEnum.DigitsOver3],
      [DerivativeDigitsEnum.DigitNotLast, DerivativeDigitsEnum.DigitNotRandom],
    ],
  },
  NUMERIC_INPUTE: [
    [NumericInputValuesEnum.VALUE_0_35, NumericInputValuesEnum.VALUE_0_50, NumericInputValuesEnum.VALUE_0_75],
    [NumericInputValuesEnum.VALUE_1_00, NumericInputValuesEnum.VALUE_2_00, NumericInputValuesEnum.VALUE_5_00],
    [NumericInputValuesEnum.VALUE_10_00, NumericInputValuesEnum.VALUE_15_00, NumericInputValuesEnum.VALUE_20_00],
    [NumericInputValuesEnum.VALUE_25_00, NumericInputValuesEnum.VALUE_50_00, NumericInputValuesEnum.VALUE_75_00],
    [NumericInputValuesEnum.VALUE_100_00, NumericInputValuesEnum.VALUE_200_00, NumericInputValuesEnum.VALUE_500_00],
    [NumericInputValuesEnum.VALUE_750_00, NumericInputValuesEnum.VALUE_1000_00, NumericInputValuesEnum.VALUE_2000_00],
    [NumericInputValuesEnum.VALUE_2500_00, NumericInputValuesEnum.AUTOMATIC, NumericInputValuesEnum.VALUE_5000_00],
  ],
  DURATION: [
    [DurationValuesEnum.SEC_5, DurationValuesEnum.SEC_10, DurationValuesEnum.SEC_15],
    [DurationValuesEnum.SEC_20, DurationValuesEnum.SEC_25, DurationValuesEnum.SEC_30],
    [DurationValuesEnum.SEC_40, DurationValuesEnum.SEC_50, DurationValuesEnum.SEC_60],
    [DurationValuesEnum.MIN_1, DurationValuesEnum.MIN_2, DurationValuesEnum.MIN_5],
    [DurationValuesEnum.MIN_10, DurationValuesEnum.MIN_15, DurationValuesEnum.MIN_20],
    [DurationValuesEnum.MIN_25, DurationValuesEnum.MIN_30, DurationValuesEnum.MIN_35],
    [DurationValuesEnum.MIN_40, DurationValuesEnum.MIN_45, DurationValuesEnum.MIN_50],
    [DurationValuesEnum.MIN_55, DurationValuesEnum.MIN_60],
    [DurationValuesEnum.HR_1, DurationValuesEnum.HR_2, DurationValuesEnum.HR_3],
    [DurationValuesEnum.HR_4, DurationValuesEnum.HR_5, DurationValuesEnum.HR_6],
    [DurationValuesEnum.HR_8, DurationValuesEnum.HR_10, DurationValuesEnum.HR_12],
    [DurationValuesEnum.HR_16, DurationValuesEnum.HR_18, DurationValuesEnum.HR_20],
    [DurationValuesEnum.HR_24, DurationValuesEnum.HR_48, DurationValuesEnum.HR_72],
    [DurationValuesEnum.TICK_1, DurationValuesEnum.TICK_2, DurationValuesEnum.TICK_3],
    [DurationValuesEnum.TICK_4, DurationValuesEnum.TICK_5, DurationValuesEnum.TICK_6],
    [DurationValuesEnum.TICK_7, DurationValuesEnum.TICK_8],
    [DurationValuesEnum.TICK_9, DurationValuesEnum.TICK_10]
  ],
  TRADE_DURATION_U: [
    [TradeDurationUnitsEnum.TICKS, TradeDurationUnitsEnum.MINUTES, TradeDurationUnitsEnum.HOURS],
  ],
  TRADE_DURATION_T: [
    [DurationValuesEnum.TICK_1, DurationValuesEnum.TICK_2, DurationValuesEnum.TICK_3],
    [DurationValuesEnum.TICK_4, DurationValuesEnum.TICK_5, DurationValuesEnum.TICK_6],
    [DurationValuesEnum.TICK_7, DurationValuesEnum.TICK_8],
    [DurationValuesEnum.TICK_9, DurationValuesEnum.TICK_10],
  ],
  TRADE_DURATION_M: [
    [DurationValuesEnum.MIN_1, DurationValuesEnum.MIN_2, DurationValuesEnum.MIN_5],
    [DurationValuesEnum.MIN_10, DurationValuesEnum.MIN_15, DurationValuesEnum.MIN_20],
    [DurationValuesEnum.MIN_25, DurationValuesEnum.MIN_30, DurationValuesEnum.MIN_35],
    [DurationValuesEnum.MIN_40, DurationValuesEnum.MIN_45, DurationValuesEnum.MIN_60],
  ],
  TRADE_DURATION_H: [
    [DurationValuesEnum.HR_1, DurationValuesEnum.HR_2, DurationValuesEnum.HR_3],
    [DurationValuesEnum.HR_4, DurationValuesEnum.HR_5, DurationValuesEnum.HR_6],
    [DurationValuesEnum.HR_7, DurationValuesEnum.HR_8, DurationValuesEnum.HR_9],
    [DurationValuesEnum.HR_10, DurationValuesEnum.HR_12, DurationValuesEnum.HR_14],
    [DurationValuesEnum.HR_16, DurationValuesEnum.HR_18, DurationValuesEnum.HR_20],
    [DurationValuesEnum.HR_24, DurationValuesEnum.HR_48, DurationValuesEnum.HR_72],
  ],
  TRADE_MANUAL_OR_AUTO: [[TradeModeEnum.MANUAL, TradeModeEnum.AUTO]],
  TRADE_CONFIRM: [[TradeConfirmationEnum.CONFIRM, TradeConfirmationEnum.CANCEL]],
  TRADE_MANUAL: [[TradeManualActionEnum.TRADE_AGAIN, TradeManualActionEnum.STOP_TRADING]],
  COMMANDS: CommandsEnum,
};