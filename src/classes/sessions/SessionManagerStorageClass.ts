
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
export interface Session {
    _id: string; // Unique identifier for the session
    data: any; // Session data (can be any type)
    expires: Date; // Expiration date of the session
}

/**
 * Interface representing the MongoDB collection.
 */
export interface MongoCollection {
    findOne(query: any): Promise<Session | null>; // Method to find a single document
    updateOne(query: any, update: any, options: any): Promise<any>; // Method to update a document
    deleteOne(query: any): Promise<any>; // Method to delete a document
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

    private db: any; // Name of the database
    private collectionName: string; // Name of the collection

    /**
     * Constructor for MongoSessionStore.
     * @param client - MongoDB client instance.
     * @param db - Instance of the database where sessions are stored.
     * @param collectionName - Name of the collection where sessions are stored.
     */
    constructor(db: any, collectionName: string) {

        this.db = db;
        this.collectionName = collectionName;
    }

    /**
     * Retrieves session data from MongoDB.
     * @param sessionID - Unique identifier for the session.
     * @returns Promise resolving to the session data or null if not found.
     */
    async get(sessionID: string): Promise<any | null> {

        const sessionData: Session | null = await this.db.getItem(this.collectionName, [{ field: '_id', operator: 'eq', value: sessionID }]);

        console.log("::SESSION_DATA::GET::", sessionData);

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

        await this.db.updateItems(this.collectionName, [{ field: '_id', operator: 'eq', value: sessionID }], updates, true);

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