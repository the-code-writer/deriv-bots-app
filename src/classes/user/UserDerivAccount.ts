import { CurrencyType } from '../trader/types';
import { env } from '@/common/utils/envConfig';

const jsan = require("jsan");

const DerivAPI = require("@deriv/deriv-api/dist/DerivAPI");

/**
 * Interface representing a Deriv user account
 */
export interface IDerivUserAccount {
    email: string;
    country: string;
    currency: CurrencyType;
    loginid: string;
    user_id: string;
    fullname: string;
    token?: string;
    balance?: any;
    initialBalance?: any;
    status?: any;
}

/**
 * Interface representing the Deriv API client
 */
interface IDerivApiClient {
    account: (token: string) => Promise<unknown>;
}

/**
 * Interface representing the raw user data structure from Deriv API
 */
interface IRawUserData {
    _data: {
        email: string;
        country: string;
        currency: string;
        loginid: string;
        user_id: string;
        fullname: string;
    };
}

/**
 * Class for managing Deriv user accounts
 */
export class DerivUserAccount {
    /**
     * Retrieves user account information from Deriv API
     * @param {IDerivApiClient} api - The Deriv API client instance
     * @param {string} userAccountToken - The user's authentication token
     * @param {boolean} includeBalance - The user's authentication token
     * @returns {Promise<IDerivUserAccount | null>} A promise that resolves to the user account object or null if not found
     */
    static async getUserAccount(
        userAccountToken: string,
        api?: IDerivApiClient,
        onBalanceCallback?: any
    ): Promise<IDerivUserAccount | null> {
        // Initialize empty user account object
        let userAccount: IDerivUserAccount | null = null;

        let derivUserAccount:any = {};

        try {

            if (userAccountToken !== '') {
                    
                if (api) {
                    
                    derivUserAccount = await api.account(userAccountToken) as IDerivUserAccount | null;

                } else {
                    
                const derivAPI = new DerivAPI({ endpoint: env.DERIV_APP_ENDPOINT_DOMAIN, app_id: env.DERIV_APP_ENDPOINT_APP_ID, lang: env.DERIV_APP_ENDPOINT_LANG });
                
                    derivUserAccount = await derivAPI.account(userAccountToken) as IDerivUserAccount | null;

                }

                if (typeof onBalanceCallback === "function") {
                    derivUserAccount.balance.on_update((balance: any) => {
                        onBalanceCallback(balance);
                    })
                }

                userAccount = {
                    email: derivUserAccount._data.email,
                    country: derivUserAccount._data.country,
                    currency: derivUserAccount._data.currency,
                    loginid: derivUserAccount._data.loginid,
                    user_id: derivUserAccount._data.user_id,
                    fullname: derivUserAccount._data.fullname,
                    balance: derivUserAccount._data.balance._data.amount._data,
                    status: derivUserAccount.status_codes,
                    token: derivUserAccount.token
                }

            } else {

                console.error('User token error:', [userAccountToken]);

                throw("Missing account Token");

            }

        } catch (error) {

            if (error.error.code === "") {
                
            } else {
                
            console.error('Error fetching user account:', [userAccountToken, error]);

            throw new Error('Failed to fetch user account');

            }

        }

        return userAccount;

    }
    /**
     * Retrieves user account balance from Deriv API
     * @param {IDerivApiClient} api - The Deriv API client instance
     * @param {string} userAccountToken - The user's authentication token
     * @returns {Promise<any | null>} A promise that resolves to the user account object or null if not found
     */
    static async getUserBalance(
        userAccountToken: string,
    ): Promise<any | null> {

        try { 

            const api = new DerivAPI({ endpoint: env.DERIV_APP_ENDPOINT_DOMAIN, app_id: env.DERIV_APP_ENDPOINT_APP_ID, lang: env.DERIV_APP_ENDPOINT_LANG });
            
            const account = await api.account(userAccountToken);

            return account;

        } catch (error) {

            console.error('Error fetching user account:', error);

            throw new Error('Failed to fetch user account');

        }

        return null;

    }

    /**
     * Validates if a user account object contains all required fields
     * @param {unknown} account - The account object to validate
     * @returns {boolean} True if the account is valid, false otherwise
     */
    static isValidAccount(account: unknown): account is IDerivUserAccount {
        if (typeof account !== 'object' || account === null) {
            return false;
        }

        const requiredFields = [
            'email',
            'country',
            'currency',
            'loginid',
            'user_id',
            'fullname',
            'token',
        ];

        return requiredFields.every((field) => field in account);
    }

    /**
     * Creates a sanitized copy of the user account with sensitive information removed
     * @param {IDerivUserAccount} account - The user account to sanitize
     * @returns {Omit<IDerivUserAccount, 'token' | 'user_id'>} A sanitized user account without sensitive data
     */
    static sanitizeAccount(
        account: IDerivUserAccount
    ): Omit<IDerivUserAccount, 'token' | 'user_id'> {
        const { token, user_id, ...sanitizedAccount } = account;
        return sanitizedAccount;
    }

    /**
     * Checks if two user accounts are the same by comparing their login IDs
     * @param {IDerivUserAccount} account1 - First account to compare
     * @param {IDerivUserAccount} account2 - Second account to compare
     * @returns {boolean} True if accounts have the same login ID, false otherwise
     */
    static isSameAccount(
        account1: IDerivUserAccount,
        account2: IDerivUserAccount
    ): boolean {
        return account1.loginid === account2.loginid;
    }

    /**
     * Extracts the currency from a user account
     * @param {IDerivUserAccount} account - The user account
     * @returns {string} The account currency
     */
    static getAccountCurrency(account: IDerivUserAccount): string {
        return account.currency;
    }

    /**
     * Creates a display name from the user's full name
     * @param {IDerivUserAccount} account - The user account
     * @returns {string} A formatted display name
     */
    static getDisplayName(account: IDerivUserAccount): string {
        return account.fullname.trim();
    }

    /**
     * Extracts the email from a user account
     * @param {IDerivUserAccount} account - The user account
     * @returns {string} A formatted display name
     */
    static getAccountEmailAddress(account: IDerivUserAccount): string {
        return account.email.trim();
    }

}