import { env } from '@/common/utils/envConfig';
import { Encryption } from '@/classes/cryptography/EncryptionClass';
import { CONSTANTS } from './constants';
import { ContractType, MarketType, TradingType, ContractTypeEnum, MarketTypeEnum, AccountType, TradingModeType, TradingModeTypeEnum, TradingTypeEnum, ContractDurationUnitType } from '../../classes/trader/types';
import { VolatilityIndicesEnum, TradingTypesEnum, DerivativeDigitsEnum, TradeModeEnum } from '@/classes/trader/types';

const uap = require('ua-parser-js');

const { APP_CRYPTOGRAPHIC_KEY } = env;

export const isDigitOrPeriod = (str: string): boolean => {
  // Regular expression to match only digits and periods
  const regex = /^[0-9.]+$/;

  // Test the string against the regular expression
  return regex.test(str);
};

export const isCurrency = (value: string): boolean => {
  // Regex to match valid currency formats
  const currencyRegex = /^(USD|\$)?\d{1,3}(,\d{3})*(\.\d{2})?$|^(USD|\$)?\d{1,3}(\.\d{3})*(-\d{2})?$/;
  return currencyRegex.test(value);
};

export const extractAmount = (value: string): number | null => {
  // Check if the value is a valid currency
  if (!isCurrency(value)) {
    return null; // Return null if the input is not a valid currency
  }

  // Extract the numeric part (remove currency symbols, commas, and hyphens)
  const numericString = value.replace(/[^0-9.-]/g, "");

  // Replace commas with nothing and hyphens with dots for decimal places
  const cleanedString = numericString.replace(/,/g, "").replace(/-/g, ".");

  // Convert to a number
  return parseFloat(cleanedString);
};

export const formatToMoney = (value: number | bigint | any): string => {
  // Use Intl.NumberFormat to format the number as currency
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2, // Ensures 2 decimal places
  });

  return formatter.format(value);
};

export const parseTimeToSeconds = (time: string): number => {
  // Remove the emoji and trim whitespace
  time = time.replace(/⏱️/g, '').trim();

  // Check for "min" (minutes)
  if (time.includes('min')) {
    const minutes = parseInt(time.replace('min', ''), 10);
    return minutes * 60;
  }
  // Check for "hr" or "hrs" (hours)
  else if (time.includes('hr')) {
    const hours = parseInt(time.replace(/hrs?/, ''), 10);
    return hours * 3600;
  }
  // Handle the original formats (hh:mm:ss, mm:ss, ss, hh:mm)
  else {
    const parts = time.split(':');

    if (parts.length === 3) {
      // Format: hh:mm:ss
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const seconds = parseInt(parts[2], 10);
      return hours * 3600 + minutes * 60 + seconds;
    } else if (parts.length === 2) {
      // Format: mm:ss or hh:mm
      const firstPart = parseInt(parts[0], 10);
      const secondPart = parseInt(parts[1], 10);

      // If the first part is greater than 59, assume it's hh:mm
      if (firstPart > 59) {
        return firstPart * 3600 + secondPart * 60;
      } else {
        // Otherwise, assume it's mm:ss
        return firstPart * 60 + secondPart;
      }
    } else if (parts.length === 1) {
      // Format: ss
      return parseInt(parts[0], 10);
    } else {
      throw new Error('Invalid time format');
    }
  }
}

/**
 * Replaces placeholders in a string with values from an object.
 * 
 * @param str The input string containing placeholders.
 * @param variables An object containing key-value pairs to replace placeholders.
 * @returns The modified string with placeholders replaced.
 */
export const replaceStringVariables = (str: string, variables: any): string => {
  // Check if the input string is not null or undefined
  if (!str) {
    throw new Error("Input string cannot be null or undefined.");
  }

  // Check if the variables object is not null or undefined
  if (!variables) {
    throw new Error("Variables object cannot be null or undefined.");
  }

  // Use a regular expression to match placeholders in the string
  return str.replace(/{([^}]+)}/g, (match, key) => {
    // For each match, check if the key exists in the variables object
    if (key in variables) {
      // If the key exists, return its value
      return variables[key];
    } else {
      // If the key does not exist, return the original placeholder
      return match;
    }
  });
}

export const convertTimeStringToSeconds = (timeString: string | number | undefined): number => {

  const now = Date.now(); // Current epoch time in milliseconds

  if (!timeString) return now * 1000;

  timeString = sanitizeTimeString(String(timeString));

  if (typeof timeString === "number") {
    return now + timeString * 1000;
  }

  // Regular expression to extract the numeric value and unit from the input string
  const match = timeString.match(/^(\d+)\s*(s|sec|second|m|min|minute|h|hr|hour|d|day|w|wk|week|mon|month|y|yr|year)s?$/i);

  if (!match) {
    throw new Error(`Invalid time string: ${timeString}`);
  }

  const value = parseInt(match[1], 10); // Extract the numeric value
  const unit = match[2].toLowerCase(); // Extract the unit and convert to lowercase

  // Map units to their corresponding durations in milliseconds
  const durations: { [key: string]: number } = {
    s: 1000,
    sec: 1000,
    second: 1000,
    m: 60 * 1000,
    min: 60 * 1000,
    minute: 60 * 1000,
    h: 60 * 60 * 1000,
    hr: 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    wk: 7 * 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    mon: 30 * 24 * 60 * 60 * 1000, // Approximate, as months vary in length
    month: 30 * 24 * 60 * 60 * 1000, // Approximate, as months vary in length
    y: 365 * 24 * 60 * 60 * 1000, // Approximate, ignoring leap years
    yr: 365 * 24 * 60 * 60 * 1000, // Approximate, ignoring leap years
    year: 365 * 24 * 60 * 60 * 1000, // Approximate, ignoring leap years
  };

  // Get the duration in milliseconds based on the unit
  const durationInMilliseconds = durations[unit];

  if (!durationInMilliseconds) {
    throw new Error(`Invalid time unit: ${unit}`);
  }

  // Calculate the expiry time
  const expiryTime = now + value * durationInMilliseconds;
  return expiryTime;
}

export const sanitizeTimeString = (input: string): string => {
  // First remove all emojis and special characters
  let cleaned = input.replace(/[^\w\s]/g, '').trim();

  // Handle "Tick(s)" cases - convert to "sec"
  cleaned = cleaned.replace(/^(\d+)\s*ticks?$/i, '$1sec');

  // Standardize units (remove plural 's' and normalize whitespace)
  cleaned = cleaned.replace(/\s+/g, ' ') // normalize spaces
    .replace(/mins?/i, 'min')
    .replace(/hrs?/i, 'hr')
    .replace(/secs?/i, 'sec');

  return cleaned.toLowerCase();
}

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}h ${minutes}m ${secs}s`;
}

export const getDerivAccountFromURLParams = (queryParams: any) => {

  const organizedData: any = {}; // Initialize an object to organize account data

  // Iterate over query parameters to organize account data
  for (const key in queryParams) {
    if (key.startsWith('acct') || key.startsWith('token') || key.startsWith('cur')) {
      // Extract the index from the key (e.g., 'acct1' -> '1')
      // @ts-ignore
      const index = key.match(/\d+/)[0];

      // Initialize the object for this index if it doesn't exist
      if (!organizedData[index]) {
        organizedData[index] = {};
      }

      // Add the value to the corresponding property
      if (key.startsWith('acct')) {
        organizedData[index].acct = queryParams[key];
      } else if (key.startsWith('token')) {
        organizedData[index].token = queryParams[key];
      } else if (key.startsWith('cur')) {
        organizedData[index].cur = queryParams[key];
      }
    }
  }

  return organizedData;
}

/**
 * Represents the structure of query parameters where keys are strings and values are strings or arrays of strings.
 */
export type QueryParams = Record<string, string | string[]>;

/**
 * Parses a query string from a URL and converts it into an object of key-value pairs.
 * Handles both single and multiple values for the same parameter by converting them to arrays.
 * 
 * @param {string} url - The URL containing the query string to be parsed.
 * @returns {QueryParams} An object representing the parsed query parameters.
 * 
 * @example
 * const url = "http://example.com?name=John&age=30&hobby=reading&hobby=swimming";
 * const params = parseQueryString(url);
 * // Returns: { name: "John", age: "30", hobby: ["reading", "swimming"] }
 */
export const getQueryParamsFromURL = (url: string): QueryParams => {
  // Extract the query string from the URL by splitting at '?' and taking the second part
  const queryString = url.split('?')[1];

  // If there's no query string, return an empty object
  if (!queryString) {
    return {};
  }

  // Split the query string into individual key-value pairs
  const pairs = queryString.split('&');

  // Initialize an empty object to store the parsed parameters
  const result: QueryParams = {};

  // Process each key-value pair
  for (const pair of pairs) {
    // Split each pair into key and value
    const [key, value] = pair.split('=');

    // Decode URI components to handle special characters
    const decodedKey = decodeURIComponent(key);
    const decodedValue = decodeURIComponent(value);

    // If the key already exists in the result
    if (result.hasOwnProperty(decodedKey)) {
      const existingValue = result[decodedKey];

      // If the existing value is an array, push the new value
      if (Array.isArray(existingValue)) {
        existingValue.push(decodedValue);
      }
      // If it's not an array, convert it to an array with both values
      else {
        result[decodedKey] = [existingValue as string, decodedValue];
      }
    }
    // If the key doesn't exist, add it to the result
    else {
      result[decodedKey] = decodedValue;
    }
  }

  return result;
}

/**
 * Splits an array into N chunks of approximately equal size.
 * 
 * @template T - The type of elements in the array
 * @param {T[]} array - The array to be chunked
 * @param {number} numberOfChunks - How many chunks to create (must be positive integer)
 * @returns {T[][]} An array of chunks
 * @throws {Error} If numberOfChunks is not a positive integer
 * 
 * @example
 * // Returns [[1, 2], [3, 4], [5]]
 * chunkIntoN([1, 2, 3, 4, 5], 3);
 * 
 * @example
 * // Returns [['a', 'b', 'c'], ['d', 'e']]
 * chunkIntoN(['a', 'b', 'c', 'd', 'e'], 2);
 */
export const chunkIntoN: any = (array: any, numberOfChunks: number): any => {
  // Validate input
  if (!Number.isInteger(numberOfChunks) || numberOfChunks <= 0) {
    throw new Error('numberOfChunks must be a positive integer');
  }

  // Handle edge cases
  if (numberOfChunks === 1) return [array];
  if (numberOfChunks >= array.length) return array.map((item: any) => [item]);

  // Calculate base chunk size and how many chunks need an extra item
  const chunkSize = Math.floor(array.length / numberOfChunks);
  const chunksWithExtra = array.length % numberOfChunks;

  const chunks: [][] = [];
  let currentIndex = 0;

  for (let i = 0; i < numberOfChunks; i++) {
    // Determine if this chunk gets an extra element
    const thisChunkSize = i < chunksWithExtra ? chunkSize + 1 : chunkSize;

    // Slice the array for this chunk
    chunks.push(array.slice(currentIndex, currentIndex + thisChunkSize));
    currentIndex += thisChunkSize;
  }

  return chunks;
}

export const getEncryptedUserAgent = (ua: string | undefined) => {

  let userAgent, userAgentString, encuaKey, encuaData = null;

  if (ua) {

    // get user-agent header
    // @ts-ignore
    userAgent = uap(ua);

    /*
    // Since v2.0.0
    // you can also pass Client Hints data to UAParser
    // note: only works in a secure context (localhost or https://)
    // from any browsers that are based on Chrome 85+
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Sec-CH-UA
   
        const getHighEntropyValues = 'Sec-CH-UA-Full-Version-List, Sec-CH-UA-Mobile, Sec-CH-UA-Model, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version, Sec-CH-UA-Arch, Sec-CH-UA-Bitness';
        res.setHeader('Accept-CH', getHighEntropyValues);
        res.setHeader('Critical-CH', getHighEntropyValues);
        
        ua = uap(req.headers).withClientHints();
    */

    userAgentString = JSON.stringify(userAgent);

    encuaKey = Encryption.md5(userAgentString);

    encuaData = userAgent;  //Encryption.encryptAES(userAgentString, APP_CRYPTOGRAPHIC_KEY);

  }

  return { ua: ua, userAgent, userAgentString, encuaKey, encuaData };

}

// Helper function to serialize cookie options
export const serializeCookieOptions = (cookieName: string, cookieValue: string, options: any) => {
  const cookieOptions: string = Object.entries(options)
    .map(([key, value]: any) => {
      if (value === true) return `${key}`; // Flags like "HttpOnly"
      if (value === false) return '';      // Skip false flags
      if (key === 'Expires') return `Expires=${new Date(value).toUTCString()}`;
      return `${key}=${value}`;
    })
    .filter(Boolean) // Remove empty strings
    .join('; ');
  return `${cookieName}=${cookieValue}; ${cookieOptions}`;
}

export const getCookieValue = (cookieHeader: string, name: string) => {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === name) {
      return cookieValue;
    }
  }
  return null;
}

export const sanitizeAccountType = (accountType: string | undefined): AccountType => {
  return accountType as unknown as AccountType;
}

export const sanitizeTradingType = (tradingType: string | undefined): TradingType => {
  if (!tradingType) return TradingTypeEnum.Default;
  let resolvedTradingType: unknown = null;
  switch (tradingType) {
    case TradingTypesEnum.FOREX: {
      resolvedTradingType = TradingTypeEnum.Forex;
      break;
    }
    case TradingTypesEnum.COMMODITIES: {
      resolvedTradingType = TradingTypeEnum.Commodities;
      break;
    }
    case TradingTypesEnum.CRYPTO: {
      resolvedTradingType = TradingTypeEnum.Crypto;
      break;
    }
    case TradingTypesEnum.DERIVATIVES: {
      resolvedTradingType = TradingTypeEnum.Derivatives;
      break;
    }
    default: {
      break;
    }
  }
  return resolvedTradingType as TradingType;
}

export const sanitizeMarketType = (marketType: string | undefined): MarketType => {
  if (!marketType) return MarketTypeEnum.Default;
  let resolvedMarketType: unknown = null;
  switch (marketType) {
    case VolatilityIndicesEnum.Volatility10: {
      resolvedMarketType = MarketTypeEnum.R_10;
      break;
    }

    case VolatilityIndicesEnum.Volatility10_1s: {
      resolvedMarketType = MarketTypeEnum.R_10_1s;
      break;
    }

    case VolatilityIndicesEnum.Volatility25: {
      resolvedMarketType = MarketTypeEnum.R_25;
      break;
    }

    case VolatilityIndicesEnum.Volatility25_1s: {
      resolvedMarketType = MarketTypeEnum.R_25_1s;
      break;
    }

    case VolatilityIndicesEnum.Volatility50: {
      resolvedMarketType = MarketTypeEnum.R_50;
      break;
    }

    case VolatilityIndicesEnum.Volatility50_1s: {
      resolvedMarketType = MarketTypeEnum.R_50_1s;
      break;
    }

    case VolatilityIndicesEnum.Volatility75: {
      resolvedMarketType = MarketTypeEnum.R_75;
      break;
    }

    case VolatilityIndicesEnum.Volatility75_1s: {
      resolvedMarketType = MarketTypeEnum.R_75_1s;
      break;
    }

    case VolatilityIndicesEnum.Volatility100: {
      resolvedMarketType = MarketTypeEnum.R_100;
      break;
    }

    case VolatilityIndicesEnum.Volatility100_1s: {
      resolvedMarketType = MarketTypeEnum.R_100_1s;
      break;
    }
    default: {
      resolvedMarketType = MarketTypeEnum.Default
      break;
    }
  }
  return resolvedMarketType as MarketType;
}

export const sanitizeContractType = (contractType: string | undefined): ContractType => {
  if (!contractType) return ContractTypeEnum.Default;
  let resolvedContractType: unknown = null;
  switch (contractType) {
    case DerivativeDigitsEnum.Auto: {
      resolvedContractType = ContractTypeEnum.Call;
      break;
    }

    case DerivativeDigitsEnum.Auto: {
      resolvedContractType = ContractTypeEnum.Call;
      break;
    }

    case DerivativeDigitsEnum.Rise: {
      resolvedContractType = ContractTypeEnum.Call;
      break;
    }

    case DerivativeDigitsEnum.Fall: {
      resolvedContractType = ContractTypeEnum.Put;
      break;
    }

    case DerivativeDigitsEnum.DigitsAuto: {
      resolvedContractType = ContractTypeEnum.DigitAutoEvenOdd;
      break;
    }

    case DerivativeDigitsEnum.DigitsEvens: {
      resolvedContractType = ContractTypeEnum.DigitEven;
      break;
    }

    case DerivativeDigitsEnum.DigitsOdds: {
      resolvedContractType = ContractTypeEnum.DigitOdd;
      break;
    }

    case DerivativeDigitsEnum.DigitsUnder9: {
      resolvedContractType = ContractTypeEnum.DigitUnder9;

      break;
    }

    case DerivativeDigitsEnum.DigitsUnder8: {
      resolvedContractType = ContractTypeEnum.DigitUnder8;
      break;
    }

    case DerivativeDigitsEnum.DigitsUnder7: {
      resolvedContractType = ContractTypeEnum.DigitUnder7;
      break;
    }

    case DerivativeDigitsEnum.DigitsUnder6: {
      resolvedContractType = ContractTypeEnum.DigitUnder6;
      break;
    }

    case DerivativeDigitsEnum.DigitsOver0: {
      resolvedContractType = ContractTypeEnum.DigitOver0;
      break;
    }

    case DerivativeDigitsEnum.DigitsOver1: {
      resolvedContractType = ContractTypeEnum.DigitOver1;
      break;
    }

    case DerivativeDigitsEnum.DigitsOver2: {
      resolvedContractType = ContractTypeEnum.DigitOver2;
      break;
    }

    case DerivativeDigitsEnum.DigitsOver3: {
      resolvedContractType = ContractTypeEnum.DigitOver3;
      break;
    }

    case DerivativeDigitsEnum.DigitNotLast: {
      resolvedContractType = ContractTypeEnum.DigitDiff;
      break;
    }

    case DerivativeDigitsEnum.DigitNotRandom: {
      resolvedContractType = ContractTypeEnum.DigitDiff;
      break;
    }

    case DerivativeDigitsEnum.DigitDiff1326: {
      resolvedContractType = ContractTypeEnum.DigitDiff1326;
      break;
    }

    default: {
      resolvedContractType = ContractTypeEnum.Default;
      break;
    }
  }
  return resolvedContractType as ContractType;
}

export const sanitizeTradingMode = (tradingMode: string | undefined): TradingModeType => {
  if (!tradingMode) return TradingModeTypeEnum.Default;
  let resolvedTradingMode: unknown = null;
  switch (tradingMode) {
    case TradeModeEnum.MANUAL: {
      resolvedTradingMode = TradingModeTypeEnum.Manual;
      break;
    }
    case TradeModeEnum.AUTO: {
      resolvedTradingMode = TradingModeTypeEnum.Auto;
      break;
    }
    default: {
      resolvedTradingMode = TradingModeTypeEnum.Default;
      break;
    }
  }
  return resolvedTradingMode as TradingModeType;
}

/**
 * Sanitizes a string to only contain alphanumeric characters (A-Z, a-z, 0-9) and underscores
 * @param input The string to sanitize
 * @param options Optional configuration
 * @param options.replaceWith Character to replace invalid characters with (default: '_')
 * @param options.lowercase Convert output to lowercase (default: false)
 * @param options.uppercase Convert output to uppercase (default: false)
 * @returns Sanitized string
 */
export const sanitizeString = (
  input: string | undefined,
  options: {
    replaceWith?: string;
    lowercase?: boolean;
    uppercase?: boolean;
  } = {}
): string => {

  if (!input) return "";

  const { replaceWith = '_', lowercase = false, uppercase = false } = options;

  // First, replace any non-alphanumeric characters with the replacement character
  let sanitized = input.replace(/[^A-Za-z0-9_]/g, replaceWith);

  // Handle case conversion
  if (lowercase) {
    sanitized = sanitized.toLowerCase();
  } else if (uppercase) {
    sanitized = sanitized.toUpperCase();
  }

  return sanitized;
}

/**
 * Unified amount sanitization with multiple output formats
 * @param input The input value (string, number, etc.)
 * @param options Configuration options
 * @param options.mode 'number'|'currency'|'string' - output format
 * @param options.strict Whether to throw errors (default: true)
 * @returns Sanitized amount in requested format
 * @throws Error when strict=true and input is invalid
 */
export const sanitizeAmount = (
  input: number | string | undefined,
  options: {
    mode?: 'number' | 'currency' | 'string';
    strict?: boolean;
  } = {}
): number | string => {

  if (!input) return 1;

  const { mode = 'number', strict = true } = options;

  // Internal conversion function
  const convert = (value: unknown): number => {
    let num: number;

    // Handle currency mode
    if (mode === 'currency' && typeof value === 'string') {
      const cleaned = value.replace(/[^\d.-]/g, '');
      num = parseFloat(cleaned);
      if (isNaN(num) && strict) {
        throw new Error('Invalid currency amount');
      }
    }
    // Standard number conversion
    else {
      num = Number(value);
      if (isNaN(num) && strict) {
        throw new Error('Invalid numeric amount');
      }
    }

    return Math.round(num * 100) / 100;
  };

  try {
    const result = convert(input);

    // Return based on output mode
    switch (mode) {
      case 'string':
        return result.toFixed(2);
      case 'currency':
      case 'number':
      default:
        return result;
    }
  } catch (error) {
    if (strict) throw error;
    return mode === 'string' ? '0.00' : 0;
  }


  /*
  // Example usage:
  console.log('=== Number Mode (default) ===');
  console.log(sanitizeAmount("123.456"));          // 123.46
  console.log(sanitizeAmount(123.4));              // 123.4
  console.log(sanitizeAmount("123"));              // 123
  
  console.log('\n=== Currency Mode ===');
  console.log(sanitizeAmount("$1,234.56", { mode: 'currency' }));  // 1234.56
  console.log(sanitizeAmount("€1.234,56", { mode: 'currency' }));   // 1234.56
  console.log(sanitizeAmount("1.234,56", { mode: 'currency' }));    // 1234.56
  
  console.log('\n=== String Mode ===');
  console.log(sanitizeAmount(123, { mode: 'string' }));            // "123.00"
  console.log(sanitizeAmount("123.4", { mode: 'string' }));        // "123.40"
  
  console.log('\n=== Error Handling ===');
  try {
    console.log(sanitizeAmount("abc"));  // Throws error
  } catch (e) {
    console.log('Error:', e.message);    // "Invalid numeric amount"
  }
  
  console.log(sanitizeAmount("abc", { strict: false }));           // 0
  console.log(sanitizeAmount("abc", { mode: 'string', strict: false })); // "0.00"
  */

}

export const sanitizeContractDurationUnit = (units: string | undefined): ContractDurationUnitType => {

  if (!units) {
    return "t";
  }

  let cleanUnits = sanitizeString(units);

  cleanUnits = cleanUnits.split("")[0].toLowerCase();

  if (!cleanUnits) {
    return "t";
  }

  return cleanUnits as ContractDurationUnitType;

}

// Sleep function (private)
export const sleep = async(ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const roundToPrecision = (value: number, precision: number, padding:boolean): number | string => {
  const multiplier = Math.pow(10, precision);
  const result:number = Math.round(value * multiplier) / multiplier;
  return padding ? result.toFixed(precision) : result;
}

export const getRandomDigit = () => {
  return Math.min(Math.max(Math.ceil(Math.random() * 9), 0), 9);
}

export const isValidObject = (obj:any) : boolean => {
  return Object.keys(obj).every(field => obj[field] !== undefined);
}

// Add these type assertion functions at the top of the file
export const isPercentage = (value: number): any => { //value is Percentage {
  return value >= 0 && value <= 100;
}

export const isNonNegativeNumber = (value: number): any => { // value is NonNegativeNumber {
  return value >= 0;
}

export const roundToTwoDecimals = (num: number, float:boolean=false): number | string => {
  let amount: number = Math.round((num + Number.EPSILON) * 100) / 100;
  if (float) {
    return amount.toFixed(2);
  }
  return amount;
}