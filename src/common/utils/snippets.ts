export const isDigitOrPeriod = (str:string) : boolean => {
    // Regular expression to match only digits and periods
    const regex = /^[0-9.]+$/;

    // Test the string against the regular expression
    return regex.test(str);
}

export const isCurrency = (value: string): boolean => {
    // Regex to match valid currency formats
    const currencyRegex = /^(USD|\$)?\d{1,3}(,\d{3})*(\.\d{2})?$|^(USD|\$)?\d{1,3}(\.\d{3})*(-\d{2})?$/;
    return currencyRegex.test(value);
}

export const extractAmount = (value: string): number | null => {
    // Check if the value is a valid currency
    if (!isCurrency(value)) {
        return null; // Return null if the input is not a valid currency
    }

    // Extract the numeric part (remove currency symbols, commas, and hyphens)
    const numericString = value.replace(/[^0-9.-]/g, '');

    // Replace commas with nothing and hyphens with dots for decimal places
    const cleanedString = numericString.replace(/,/g, '').replace(/-/g, '.');

    // Convert to a number
    return parseFloat(cleanedString);
}

export const formatToMoney = (value: number | bigint | any): string => {
    // Use Intl.NumberFormat to format the number as currency
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2, // Ensures 2 decimal places
    });

    return formatter.format(value);
}
