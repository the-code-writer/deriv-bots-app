/**
 * Interface representing the structure of a Deriv user account.
 */
export interface IDerivUserAccount {
  email: string; // Email address of the user
  country: string; // Country code of the user
  currency: string; // Currency used by the user
  loginID: string; // Login ID of the user
  userID: number; // User ID of the user
  fullname: string; // Full name of the user
  amount?: {
    // Nested object representing the amount details
    _data: {
      value: number; // Value of the amount
      currency: string; // Currency of the amount
      lang: string; // Language of the amount
    };
  };
  selectedAccount: any;
}

/**
 * Class representing a Deriv user account.
 */
export class DerivUserAccount {
  // Private properties
  private _email: string;
  private _country: string;
  private _currency: string;
  private _loginid: string;
  private _user_id: number;
  private _fullname: string;
  private _amount: {
    _data: {
      value: number;
      currency: string;
      lang: string;
    };
  };

  // Constructor to initialize the object
  constructor(
    email: string,
    country: string,
    currency: string,
    loginid: string,
    user_id: number,
    fullname: string,
    amount: {
      _data: {
        value: number;
        currency: string;
        lang: string;
      };
    }
  ) {
    this._email = email;
    this._country = country;
    this._currency = currency;
    this._loginid = loginid;
    this._user_id = user_id;
    this._fullname = fullname;
    this._amount = amount;
  }

  // Getters and setters for each property
  get email(): string {
    return this._email;
  }

  set email(value: string) {
    this._email = value;
  }

  get country(): string {
    return this._country;
  }

  set country(value: string) {
    this._country = value;
  }

  get currency(): string {
    return this._currency;
  }

  set currency(value: string) {
    this._currency = value;
  }

  get loginid(): string {
    return this._loginid;
  }

  set loginid(value: string) {
    this._loginid = value;
  }

  get user_id(): number {
    return this._user_id;
  }

  set user_id(value: number) {
    this._user_id = value;
  }

  get fullname(): string {
    return this._fullname;
  }

  set fullname(value: string) {
    this._fullname = value;
  }

  get amount(): {
    _data: {
      value: number;
      currency: string;
      lang: string;
    };
  } {
    return this._amount;
  }

  set amount(value: {
    _data: {
      value: number;
      currency: string;
      lang: string;
    };
  }) {
    this._amount = value;
  }

  /**
   * Parses raw data into a DerivUserAccount object.
   * @param rawData - The raw data to parse.
   * @returns A DerivUserAccount object containing the parsed data.
   */
  static parseDerivUserAccount(rawData: any): DerivUserAccount {
    const {
      email,
      country,
      currency,
      loginid,
      user_id,
      fullname,
      balance,
    } = rawData._data;

    return new DerivUserAccount(
      email,
      country,
      currency,
      loginid,
      user_id,
      fullname,
      balance._data.amount._data
    );

  }
}

/*

import { DerivUserAccount, IDerivUserAccount } from '@/classes/deriv/TradingDataClass';

// Example usage
const rawData: any = {
  _data: {
    email: 'digitalcurrencyonline@gmail.com',
    country: 'zw',
    currency: 'USD',
    loginid: 'VRTC1605087',
    user_id: 5716997,
    fullname: 'Mr Douglas Maposa',
    balance: {
      _data: {
        amount: {
          _data: {
            value: 4769.18,
            currency: 'USD',
            lang: 'EN',
          },
        },
      },
    },
  },
};

const userAccount: DerivUserAccount = new DerivUserAccount(rawData);

or

const userAccount: IDerivUserAccount = DerivUserAccount.parseDerivUserAccount(rawData);

console.log(userAccount.email); // Output: digitalcurrencyonline@gmail.com
console.log(userAccount.amount._data.value); // Output: 4769.18

*/