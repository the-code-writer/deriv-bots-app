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

export const calculateExpiry = (timeString: string | number): number => {
  const now = Date.now(); // Current epoch time in milliseconds

  console.log("TIME_STRING", timeString, typeof timeString)

  if (typeof timeString === "number") {
    return now + timeString * 1000;
  }

  // Regular expression to extract the numeric value and unit from the input string
  const match = timeString.match(/^(\d+)\s*(sec|second|min|minute|hr|hour|day|week|month|year)s?$/i);

  if (!match) {
    throw new Error(`Invalid time string: ${timeString}`);
  }

  const value = parseInt(match[1], 10); // Extract the numeric value
  const unit = match[2].toLowerCase(); // Extract the unit and convert to lowercase

  // Map units to their corresponding durations in milliseconds
  const durations: { [key: string]: number } = {
    sec: 1000,
    second: 1000,
    min: 60 * 1000,
    minute: 60 * 1000,
    hr: 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000, // Approximate, as months vary in length
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
export const chunkIntoN:any = (array: any, numberOfChunks: number): any => {
  // Validate input
  if (!Number.isInteger(numberOfChunks) || numberOfChunks <= 0) {
    throw new Error('numberOfChunks must be a positive integer');
  }

  // Handle edge cases
  if (numberOfChunks === 1) return [array];
  if (numberOfChunks >= array.length) return array.map((item:any) => [item]);

  // Calculate base chunk size and how many chunks need an extra item
  const chunkSize = Math.floor(array.length / numberOfChunks);
  const chunksWithExtra = array.length % numberOfChunks;

  const chunks: T[][] = [];
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