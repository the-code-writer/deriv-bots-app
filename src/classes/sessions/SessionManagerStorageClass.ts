import { DatabaseConnection } from "@/classes/databases/mongodb/MongoDBClass";

/**
 * Interface for SessionStore.
 * This defines the contract that any session store implementation must follow.
 */
export interface ISessionStore {
    /**
     * Retrieve session data by session ID.
     * @param sessionID - The session ID.
     * @returns The session data.
     */
    get(sessionID: string): Promise<Record<string, any>>;

    getWithParams(query: any): Promise<any | null>;

    getSession(query: any): Promise<ISession | any>;

    getSessions(query: any): Promise<ISession | any>;

    getAllSessions(): Promise<ISession | any>;

    /**
     * Store session data by session ID.
     * @param sessionID - The session ID.
     * @param key - 
     * @param value - 
     * @returns A promise that resolves when the session data is stored.
     */
    set(sessionID: string, key: string | any, value?: Record<string, any>): Promise<void>;

    /**
     * Destroy session data by session ID.
     * @param sessionID - The session ID.
     * @returns A promise that resolves when the session data is destroyed.
     */
    destroy(sessionID: string): Promise<void>;
}

/**
 * Interface representing a session object stored in MongoDB.
 */

export interface ICookie {
    secure: boolean;
    httpOnly: boolean;
    sameSite: "strict" | "lax" | "none";
    originalMaxAge: number | null;
    maxAge: number | null;
    expires: number | null;
    path: string;
    domain: string | null;
    priority: string | null;
    partitioned: boolean | null;
}

export interface ISession {
    _id?: string; // Unique identifier for the session
    data?: any; // Session data (can be any type)
    expires?: Date; // Expiration date of the session
    maxAge: number;
    cookie: ICookie;
    session: Record<string, any>; // Generic session object

}

/**
 * Interface representing the options for the `set` method.
 */
export interface SetOptions {
    maxAge: number; // Maximum age of the session in milliseconds
}

/**
 * Class responsible for managing session storage in MongoDB.
 */
export class SessionManagerStorageClass implements ISessionStore {

    private db: DatabaseConnection; // Name of the database
    private collectionName: string; // Name of the collection

    /**
     * Constructor for MongoSessionStore.
     * @param client - MongoDB client instance.
     * @param db - Instance of the database where sessions are stored.
     * @param collectionName - Name of the collection where sessions are stored.
     */
    constructor(db: DatabaseConnection, collectionName: string) {

        this.db = db;
        this.collectionName = collectionName;
    }

    /**
     * Retrieves session data from MongoDB.
     * @param sessionID - Unique identifier for the session.
     * @returns Promise resolving to the session data or null if not found.
     */
    async get(sessionID: string): Promise<ISession | any> {

        const sessionData: ISession | any = await this.db.getItem(this.collectionName, [{ field: '_id', operator: 'eq', value: sessionID }]);

        console.log("::SESSION_DATA::GET::", sessionData);

        // Return the session data if found, otherwise return null
        return sessionData;
    }

    /**
     * Retrieves session data from MongoDB.
     * @param query - Unique identifier for the session.
     * @returns Promise resolving to the session data or null if not found.
     */
    async getWithParams(query: any): Promise<ISession | any> {

        const sessionData: ISession | any = await this.db.getItem(this.collectionName, query);

        console.log("::SESSION_DATA::GET::DEEP::SEARCH::QUERY", query);

        console.log("::SESSION_DATA::GET::DEEP::SEARCH::RESULT", sessionData);

        // Return the session data if found, otherwise return null
        return sessionData;
    }

    /**
     * Retrieves session data from MongoDB.
     * @param query - Unique identifier for the session.
     * @returns Promise resolving to the session data or null if not found.
     */
    async getSession(query: any): Promise<ISession | any> {

        // @ts-ignore
        const sessionData: ISession | any = await this.db.get(this.collectionName, query);

        console.log("::SESSION_DATA::GET::DEEP::SEARCH::QUERY", query);

        console.log("::SESSION_DATA::GET::DEEP::SEARCH::RESULT", sessionData);

        // Return the session data if found, otherwise return null
        return sessionData;
    }

    /**
     * Retrieves session data from MongoDB.
     * @param query - Unique identifier for the session.
     * @returns Promise resolving to the session data or null if not found.
     */
    async getSessions(query: any): Promise<ISession | any> {

        // @ts-ignore
        const sessionData: ISession | any = await this.db.get(this.collectionName, query);

        console.log("::SESSION_DATA::GET::DEEP::SEARCH::QUERY", query);

        console.log("::SESSION_DATA::GET::DEEP::SEARCH::RESULT", sessionData);

        // Return the session data if found, otherwise return null
        return sessionData;
    }

    /**
     * Retrieves session data from MongoDB.
     * @param query - Unique identifier for the session.
     * @returns Promise resolving to the session data or null if not found.
     */
    async getAllSessions(): Promise<ISession | any> {

        // @ts-ignore
        const sessionData: ISession | any = await this.db.get(this.collectionName, query);

        console.log("::SESSION_DATA::GET::DEEP::SEARCH::RESULT", sessionData);

        // Return the session data if found, otherwise return null
        return sessionData;
    }

    /**
     * Stores or updates session data in MongoDB.
     * @param sessionID - Unique identifier for the session.
     * @param data - Session data to be stored.
     * @returns Promise resolving when the operation is complete.
     */
    async set(sessionID: string, key: string | any, value?: Record<string, any>): Promise<void> {

        let updates: Partial<any> = key;

        if (typeof key === "string" && typeof value !== undefined) {

            updates = {
                [`session.${key}`]: value // Use dot notation to update the nested field
            };

        }

        console.log("::: UPDATES :::", updates);

        await this.db.updateItems(this.collectionName, [{ field: '_id', operator: 'eq', value: sessionID }], updates);

    }

    /**
     * Deletes a session from MongoDB.
     * @param sessionID - Unique identifier for the session.
     * @returns Promise resolving when the operation is complete.
     */
    async destroy(sessionID: string): Promise<void> {

        await this.db.deleteItem(this.collectionName, [{ field: '_id', operator: 'eq', value: sessionID }]);

    }
}