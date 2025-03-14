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
