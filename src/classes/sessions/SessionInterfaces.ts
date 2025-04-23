/**
 * Represents a date in MongoDB format
 */
export interface IMongoDBDate {
    /** ISO date string */
    $date: string;
}

/**
 * Represents cookie configuration
 */
export interface ISessionCookie {
    /** Whether the cookie requires HTTPS */
    secure: boolean;
    /** Whether the cookie is inaccessible to client-side JS */
    httpOnly: boolean;
    /** Same-site policy for the cookie */
    sameSite: "strict";
    /** Maximum age in milliseconds */
    maxAge: number;
    /** Expiration date */
    expires: IMongoDBDate;
    /** Path where the cookie is valid */
    path: string;
    /** Domain where the cookie is valid */
    domain: string;
    /** Cookie priority */
    priority: "high";
    /** Whether cookie is partitioned */
    partitioned: null;
}

/**
 * Represents trading options configuration
 */
export interface ITradingOptions {
    /** Current step in trading process */
    step: string;
    /** Selected account type */
    accountType: string;
    /** Type of trading */
    tradingType: string;
    /** Market being traded */
    market: string;
    /** Purchase direction */
    contractType: string;
    /** Amount being risked */
    stake: number;
    /** Profit target percentage */
    takeProfit: number;
    /** Loss limit percentage */
    stopLoss: number;
    /** Duration of trade */
    tradeDuration: string;
    /** Update frequency */
    updateFrequency: string;
    /** Contract duration units */
    contractDurationUnits: string;
    /** Contract duration value */
    contractDurationValue: string;
    /** Trading mode */
    tradingMode: string;
}

/**
 * Represents a single Deriv account
 */
export interface IDerivAccount {
    /** Account number/identifier */
    acct: string;
    /** Authentication token */
    token: string;
    /** Account currency */
    cur: string;
}

/**
 * Represents Deriv platform accounts
 */
export interface IDerivAccounts {
    /** List of available accounts */
    accountList: Record<string, IDerivAccount>;
    /** Additional account details */
    accountDetails: Record<string, unknown>;
}

/**
 * Represents Telegram account information
 */
export interface ITelegramAccount {
    /** User ID */
    id: number;
    /** Whether this is a bot account */
    is_bot: boolean;
    /** User's first name */
    first_name: string;
    /** Telegram username */
    username: string;
    /** Language preference */
    language_code: string;
}

/**
 * Represents connected accounts
 */
export interface IUserAccounts {
    /** Telegram account info */
    telegram: ITelegramAccount;
    /** Deriv trading accounts */
    deriv: IDerivAccounts;
}

/**
 * Represents browser engine information
 */
export interface IBrowserEngine {
    /** Engine name */
    name: string;
    /** Engine version */
    version: string;
}

/**
 * Represents operating system information
 */
export interface IOperatingSystem {
    /** OS name */
    name: string;
    /** OS version */
    version: string;
}

/**
 * Represents device information
 */
export interface IDeviceInfo {
    /** Device type */
    type: null;
    /** Device model */
    model: string;
    /** Device vendor */
    vendor: string;
}

/**
 * Represents CPU information
 */
export interface ICPUInfo {
    /** CPU architecture */
    architecture: null;
}

/**
 * Represents browser information
 */
export interface IBrowserInfo {
    /** Browser name */
    name: string;
    /** Full version */
    version: string;
    /** Major version */
    major: string;
    /** Browser type */
    type: null;
}

/**
 * Represents user agent data
 */
export interface IUserAgentData {
    /** Full user agent string */
    ua: string;
    /** Browser details */
    browser: IBrowserInfo;
    /** CPU details */
    cpu: ICPUInfo;
    /** Device details */
    device: IDeviceInfo;
    /** Engine details */
    engine: IBrowserEngine;
    /** OS details */
    os: IOperatingSystem;
}

/**
 * Represents bot session data
 */
export interface IBotSession {
    /** Associated chat ID */
    chatId: number;
    /** Timestamp of last activity */
    timestamp: IMongoDBDate;
    /** Trading configuration */
    tradingOptions: ITradingOptions;
    /** Connected accounts */
    accounts: IUserAccounts;
}

/**
 * Represents the main session data
 */
export interface ISessionData {
    /** Session ID */
    sessionID: string;
    /** Associated chat ID */
    chatId: number;
    /** Bot-related data */
    bot: IBotSession;
    /** Encrypted ID */
    encid: string;
    /** Encrypted user agent hash */
    encua: string;
    /** User agent data */
    encuaData: IUserAgentData;
}

/**
 * Main session document interface
 */
export interface ISessionDocument {
    /** Unique document ID */
    _id: string;
    /** Session ID */
    sessionID: string;
    /** Associated chat ID */
    chatId: number;
    /** Maximum session age */
    maxAge: number;
    /** Session cookie */
    cookie: ISessionCookie;
    /** Session data */
    session: ISessionData;
    /** Creation timestamp */
    createdAt: IMongoDBDate;
    /** Last update timestamp */
    updatedAt: IMongoDBDate;
    /** Whether session is active */
    isActive: boolean;
}