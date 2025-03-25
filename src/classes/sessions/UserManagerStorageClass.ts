import { DatabaseConnection } from "@/classes/databases/mongodb/MongoDBClass";
import { IDerivUserAccount } from '@/classes/deriv/DerivUserAccountClass';

/**
 * Interface for UserStore.
 * This defines the contract that any user store implementation must follow.
 */
export interface IUserStore {
    /**
     * Retrieve user data by user ID.
     * @param userID - The user ID.
     * @returns The user data.
     */
    get(userID: string): Promise<Record<string, any>>;

    getWithParams(query: any): Promise<any | null>;

    getUser(query: any): Promise<IUser | any>;

    getUsers(query: any): Promise<IUser | any>;

    getAllUsers(): Promise<IUser | any>;

    /**
     * Store user data by user ID.
     * @param userID - The user ID.
     * @param key - 
     * @param value - 
     * @returns A promise that resolves when the user data is stored.
     */
    set(userID: string, key: string | any, value?: Record<string, any>): Promise<void>;

    create(userData: Record<string, any>): Promise<void>;

    /**
     * Destroy user data by user ID.
     * @param userID - The user ID.
     * @returns A promise that resolves when the user data is destroyed.
     */
    destroy(userID: string): Promise<void>;
}

export interface IUser {
    _id?: string; // Unique identifier for the user
    userId: string;
    chatId: string;
    sessionId?: string;
    name: string;
    email: string;
    derivAccount: any;
    telegramAccount: any;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
}

/**
 * Interface representing the options for the `set` method.
 */
export interface SetOptions {
    maxAge: number; // Maximum age of the user in milliseconds
}

/**
 * Class responsible for managing user storage in MongoDB.
 */
export class UserManagerStorageClass implements IUserStore {

    private db: DatabaseConnection; // Name of the database
    private collectionName: string; // Name of the collection

    /**
     * Constructor for MongoUserStore.
     * @param client - MongoDB client instance.
     * @param db - Instance of the database where users are stored.
     * @param collectionName - Name of the collection where users are stored.
     */
    constructor(db: DatabaseConnection, collectionName: string) {

        this.db = db;
        this.collectionName = collectionName;
    }

    /**
     * Retrieves user data from MongoDB.
     * @param userID - Unique identifier for the user.
     * @returns Promise resolving to the user data or null if not found.
     */
    async get(userID: string): Promise<IUser | any> {

        const userData: IUser | any = await this.db.getItem(this.collectionName, [{ field: 'userId', operator: 'eq', value: userID }]);

        // Return the user data if found, otherwise return null
        return userData;
    }

    /**
     * Retrieves user data from MongoDB.
     * @param query - Unique identifier for the user.
     * @returns Promise resolving to the user data or null if not found.
     */
    async getWithParams(query: any): Promise<IUser | any> {

        const userData: IUser | any = await this.db.getItem(this.collectionName, query);

        // Return the user data if found, otherwise return null
        return userData;
    }

    /**
     * Retrieves user data from MongoDB.
     * @param query - Unique identifier for the user.
     * @returns Promise resolving to the user data or null if not found.
     */
    async getUser(query: any): Promise<IUser | any> {

        // @ts-ignore
        const userData: IUser | any = await this.db.get(this.collectionName, query);

        // Return the user data if found, otherwise return null
        return userData;
    }

    /**
     * Retrieves user data from MongoDB.
     * @param query - Unique identifier for the user.
     * @returns Promise resolving to the user data or null if not found.
     */
    async getUsers(query: any): Promise<IUser | any> {

        // @ts-ignore
        const userData: IUser | any = await this.db.get(this.collectionName, query);

        // Return the user data if found, otherwise return null
        return userData;
    }

    /**
     * Retrieves user data from MongoDB.
     * @param query - Unique identifier for the user.
     * @returns Promise resolving to the user data or null if not found.
     */
    async getAllUsers(): Promise<IUser | any> {

        // @ts-ignore
        const userData: IUser | any = await this.db.get(this.collectionName, query);

        // Return the user data if found, otherwise return null
        return userData;
    }

    /**
     * Stores or updates user data in MongoDB.
     * @param userData - User data to be stored.
     * @returns Promise resolving when the operation is complete.
     */
    async create(userData: IUser): Promise<void> {

        await this.db.insertItem(this.collectionName, userData);

    }

    /**
     * Stores or updates user data in MongoDB.
     * @param userID - Unique identifier for the user.
     * @param data - User data to be stored.
     * @returns Promise resolving when the operation is complete.
     */
    async set(userID: string, key: string | any, value?: Record<string, any>): Promise<void> {

        let updates: Partial<any> = key;

        if (typeof key === "string" && typeof value !== undefined) {

            updates = {
                [`${key}`]: value // Use dot notation to update the nested field
            };

        }

        await this.db.updateItem(this.collectionName, [{ field: 'userId', operator: 'eq', value: userID }], updates, true);

    }

    /**
     * Deletes a user from MongoDB.
     * @param userID - Unique identifier for the user.
     * @returns Promise resolving when the operation is complete.
     */
    async destroy(userID: string): Promise<void> {

        await this.db.deleteItem(this.collectionName, [{ field: 'userId', operator: 'eq', value: userID }]);

    }
}