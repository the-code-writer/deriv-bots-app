/**
 * Interface representing the structure of user information.
 */
export interface UserInfo {
    id: number; // Unique identifier for the user
    is_bot: boolean; // Indicates whether the user is a bot
    first_name: string; // First name of the user
    username: string; // Username of the user
    language_code: string; // Language code of the user
}

/**
 * Interface defining the contract for a Telegram user.
 * Provides getters, setters, and a method to update individual fields.
 */
export interface ITelegramUser {
    getId(): number; // Returns the user's ID
    getIsBot(): boolean; // Returns whether the user is a bot
    getFirstName(): string; // Returns the user's first name
    getUsername(): string; // Returns the user's username
    getLanguageCode(): string; // Returns the user's language code
    setId(id: number): void; // Sets the user's ID
    setIsBot(isBot: boolean): void; // Sets whether the user is a bot
    setFirstName(firstName: string): void; // Sets the user's first name
    setUsername(username: string): void; // Sets the user's username
    setLanguageCode(languageCode: string): void; // Sets the user's language code
    updateField<K extends keyof UserInfo>(field: K, value: UserInfo[K]): void; // Updates a specific field of the user
}

/**
 * Class representing a Telegram user.
 * Implements the ITelegramUser interface to provide getters, setters, and field updates.
 */
export class TelegramUser implements ITelegramUser {
    private id: number; // Unique identifier for the user
    private is_bot: boolean; // Indicates whether the user is a bot
    private first_name: string; // First name of the user
    private username: string; // Username of the user
    private language_code: string; // Language code of the user

    /**
     * Constructor for the TelegramUser class.
     * @param userInfo - An object of type UserInfo containing the user's information.
     */
    constructor(userInfo: UserInfo) {
        this.id = userInfo.id; // Initialize the user's ID
        this.is_bot = userInfo.is_bot; // Initialize whether the user is a bot
        this.first_name = userInfo.first_name; // Initialize the user's first name
        this.username = userInfo.username; // Initialize the user's username
        this.language_code = userInfo.language_code; // Initialize the user's language code
    }

    /**
     * Returns the user's ID.
     * @returns The user's ID as a number.
     */
    public getId(): number {
        return this.id;
    }

    /**
     * Returns whether the user is a bot.
     * @returns A boolean indicating whether the user is a bot.
     */
    public getIsBot(): boolean {
        return this.is_bot;
    }

    /**
     * Returns the user's first name.
     * @returns The user's first name as a string.
     */
    public getFirstName(): string {
        return this.first_name;
    }

    /**
     * Returns the user's username.
     * @returns The user's username as a string.
     */
    public getUsername(): string {
        return this.username;
    }

    /**
     * Returns the user's language code.
     * @returns The user's language code as a string.
     */
    public getLanguageCode(): string {
        return this.language_code;
    }

    /**
     * Sets the user's ID.
     * @param id - The new ID for the user.
     */
    public setId(id: number): void {
        this.id = id;
    }

    /**
     * Sets whether the user is a bot.
     * @param isBot - A boolean indicating whether the user is a bot.
     */
    public setIsBot(isBot: boolean): void {
        this.is_bot = isBot;
    }

    /**
     * Sets the user's first name.
     * @param firstName - The new first name for the user.
     */
    public setFirstName(firstName: string): void {
        this.first_name = firstName;
    }

    /**
     * Sets the user's username.
     * @param username - The new username for the user.
     */
    public setUsername(username: string): void {
        this.username = username;
    }

    /**
     * Sets the user's language code.
     * @param languageCode - The new language code for the user.
     */
    public setLanguageCode(languageCode: string): void {
        this.language_code = languageCode;
    }

    /**
     * Updates a specific field of the user.
     * @param field - The field to update (e.g., 'first_name', 'username').
     * @param value - The new value for the field.
     */
    public updateField<K extends keyof UserInfo>(field: K, value: UserInfo[K]): void {
        this[field] = value; // Update the specified field with the new value
    }
}

/**
 * Class responsible for parsing raw data into a UserInfo object.
 */
export class UserParser {
    /**
     * Parses raw data into a UserInfo object.
     * @param rawData - The raw data to parse.
     * @returns A UserInfo object containing the parsed data.
     */
    public static parseUserInfo(rawData: any): UserInfo {
        const {
            id, // Extract the ID from the raw data
            is_bot, // Extract the is_bot flag from the raw data
            first_name, // Extract the first name from the raw data
            username, // Extract the username from the raw data
            language_code, // Extract the language code from the raw data
        } = rawData;

        return {
            id, // Return the parsed ID
            is_bot, // Return the parsed is_bot flag
            first_name, // Return the parsed first name
            username, // Return the parsed username
            language_code, // Return the parsed language code
        };
    }
}

/*

// Example usage:

import { UserInfo, ITelegramUser, TelegramUser, UserParser } from '@/classes/telegram/TelegramUserClass';

const rawData: any = {
    id: 1, // Sample ID
    is_bot: false, // Sample is_bot flag
    first_name: 'John', // Sample first name
    username: 'john_doe', // Sample username
    language_code: 'en', // Sample language code
};

// Parse the raw data into a UserInfo object
const userInfo: UserInfo = UserParser.parseUserInfo(rawData);

// Create a TelegramUser object using the parsed data
const telegramUser: TelegramUser = new TelegramUser(userInfo);

// Log the user's first name
console.log(telegramUser.getFirstName()); // Output: John

// Update the user's first name
telegramUser.updateField('first_name', 'Jane');

// Log the updated first name
console.log(telegramUser.getFirstName()); // Output: Jane

*/
