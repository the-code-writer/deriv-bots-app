import { DatabaseConnection } from "@/classes/databases/mongodb/MongoDBClass";
import { IDerivUserAccount } from '@/classes/deriv/DerivUserAccountClass';
import { ISessionDocument } from "./SessionInterfaces";

/**
 * Interface defining the contract for session storage operations.
 * Provides methods for CRUD operations on session data with MongoDB.
 */
export interface ISessionStore {
    /**
     * Retrieves a session document by its unique identifier.
     * @param {string} sessionID - The unique session identifier to search for
     * @returns {Promise<ISessionDocument | null>} A promise that resolves with:
     *   - The session document if found
     *   - null if no matching session exists
     * @throws {Error} If there's a database access error
     */
    get(sessionID: string): Promise<ISessionDocument | null>;

    /**
     * Retrieves a session document using custom query parameters.
     * @param {any} query - The query criteria (typically an array of filter objects)
     * @returns {Promise<ISessionDocument | null>} A promise that resolves with:
     *   - The first matching session document
     *   - null if no matching session exists
     * @throws {Error} If there's a database access error
     */
    getWithParams(query: any): Promise<ISessionDocument | null>;

    /**
     * Retrieves a session document using a flexible query object.
     * @param {any} query - The query object (MongoDB-style filter conditions)
     * @returns {Promise<ISessionDocument | null>} A promise that resolves with:
     *   - The matching session document
     *   - null if no matching session exists
     * @throws {Error} If there's a database access error
     */
    getSession(query: any): Promise<ISessionDocument | null>;

    /**
     * Retrieves multiple session documents matching the query criteria.
     * @param {any} query - The query object (MongoDB-style filter conditions)
     * @returns {Promise<ISessionDocument[] | null>} A promise that resolves with:
     *   - An array of matching session documents
     *   - null if no matches found
     * @throws {Error} If there's a database access error
     */
    getSessions(query: any): Promise<ISessionDocument[] | null>;

    /**
     * Retrieves all session documents in the collection.
     * @returns {Promise<ISessionDocument[] | null>} A promise that resolves with:
     *   - An array of all session documents
     *   - null if the collection is empty
     * @throws {Error} If there's a database access error
     */
    getAllSessions(): Promise<ISessionDocument[] | null>;

    /**
     * Creates a new session document in the storage.
     * @param {Record<string, any>} sessionDocument - The complete session data to store
     * @returns {Promise<void>} A promise that resolves when the operation completes
     * @throws {Error} If:
     *   - The document validation fails
     *   - There's a database access error
     *   - A duplicate session ID is detected
     */
    create(sessionDocument: Record<string, any>): Promise<void>;

    /**
     * Updates specific fields in a session document.
     * @param {string} sessionID - The session identifier to update
     * @param {string | any} key - Either:
     *   - A string representing the field name to update
     *   - An object containing multiple field updates
     * @param {any} [value] - The value to set (required if key is a string)
     * @returns {Promise<void>} A promise that resolves when the operation completes
     * @throws {Error} If:
     *   - The session doesn't exist
     *   - There's a database access error
     *   - The update validation fails
     */
    set(sessionID: string, key: string | any, value?: any): Promise<void>;

    /**
     * Updates multiple fields in a session document atomically.
     * @param {string} sessionID - The session identifier to update
     * @param {any} updates - An object containing all fields to update
     * @returns {Promise<void>} A promise that resolves when the operation completes
     * @throws {Error} If:
     *   - The session doesn't exist
     *   - There's a database access error
     *   - The update validation fails
     */
    setSessionRecord(sessionID: string, updates: any): Promise<void>;

    /**
     * Permanently removes a session document from storage.
     * @param {string} sessionID - The session identifier to delete
     * @returns {Promise<void>} A promise that resolves when the operation completes
     * @throws {Error} If there's a database access error
     */
    destroy(sessionID: string): Promise<void>;
}

/**
 * Interface representing the options for the `set` method.
 */
export interface SetOptions {
    maxAge: number; // Maximum age of the session in milliseconds
}

/**
 * Class responsible for managing session storage in MongoDB.
 * Implements ISessionStore interface for consistent session management operations.
 */
export class SessionManagerStorageClass implements ISessionStore {
    private db: DatabaseConnection; // Database connection instance
    private collectionName: string; // Name of the collection where sessions are stored

    /**
     * Constructor for SessionManagerStorageClass.
     * @param {DatabaseConnection} db - Instance of the database connection.
     * @param {string} collectionName - Name of the collection where sessions are stored.
     */
    constructor(db: DatabaseConnection, collectionName: string) {
        this.db = db;
        this.collectionName = collectionName;
    }

    /**
     * Retrieves a single session document by session ID.
     * @param {string} sessionID - Unique identifier for the session.
     * @returns {Promise<ISessionDocument | null>} Promise resolving to the session data or null if not found.
     */
    async get(sessionID: string): Promise<ISessionDocument | null> {
        const sessionDocument: ISessionDocument | null = await this.db.getItem(
            this.collectionName,
            [{ field: 'sessionID', operator: 'eq', value: sessionID }]
        );
        return sessionDocument;
    }

    /**
     * Retrieves a single session document using custom query parameters.
     * @param {any} query - Query parameters to find the session.
     * @returns {Promise<ISessionDocument | null>} Promise resolving to the session data or null if not found.
     */
    async getWithParams(query: any): Promise<ISessionDocument | null> {
        const sessionDocument: ISessionDocument | null = await this.db.getItem(
            this.collectionName,
            query
        );
        return sessionDocument;
    }

    /**
     * Retrieves a single session document using a query object.
     * @param {any} query - Query object to find the session.
     * @returns {Promise<ISessionDocument | null>} Promise resolving to the session data or null if not found.
     */
    async getSession(query: any): Promise<ISessionDocument | null> {
        const sessionDocument: ISessionDocument | null = await this.db.getItem(
            this.collectionName,
            query
        );
        return sessionDocument;
    }

    /**
     * Retrieves multiple session documents matching the query.
     * @param {any} query - Query object to find sessions.
     * @returns {Promise<ISessionDocument[] | null>} Promise resolving to array of session documents or null if none found.
     */
    async getSessions(query: any): Promise<ISessionDocument[] | null> {
        const sessionDocuments: ISessionDocument[] | null = await this.db.getItem(
            this.collectionName,
            query
        );
        return sessionDocuments;
    }

    /**
     * Retrieves all session documents in the collection.
     * @returns {Promise<ISessionDocument[] | null>} Promise resolving to array of all session documents or null if none found.
     */
    async getAllSessions(): Promise<ISessionDocument[] | null> {
        const sessionDocuments: ISessionDocument[] | null = await this.db.getAllItems(
            this.collectionName,
            {} // Empty query to get all documents
        );
        return sessionDocuments;
    }

    /**
     * Creates a new session document in the collection.
     * @param {Record<string, any>} sessionDocument - Session data to be stored.
     * @returns {Promise<void>} Promise resolving when the operation is complete.
     */
    async create(sessionDocument: Record<string, any>): Promise<void> {
        await this.db.insertItem(
            this.collectionName,
            sessionDocument
        );
    }

    /**
     * Updates specific fields of a session document.
     * @param {string} sessionID - Unique identifier for the session.
     * @param {string | any} key - Either a field name to update or an object containing multiple updates.
     * @param {any} [value] - The value to set if key is a string.
     * @returns {Promise<void>} Promise resolving when the operation is complete.
     */
    async set(sessionID: string, key: string | any, value?: any): Promise<void> {
        let updates: Partial<any> = key;

        // If key is a string and value is provided, create an update object
        if (typeof key === 'string' && value !== undefined && value !== null) {
            updates = {
                [key]: value
            };
        }

        await this.db.updateItem(
            this.collectionName,
            [{ field: 'sessionID', operator: 'eq', value: sessionID }],
            updates,
            true
        );
    }

    /**
     * Updates a session document with the provided updates.
     * @param {string} sessionID - Unique identifier for the session.
     * @param {any} updates - Object containing fields to update.
     * @returns {Promise<void>} Promise resolving when the operation is complete.
     */
    async setSessionRecord(sessionID: string, updates: any): Promise<void> {
        if (sessionID && updates) {
            await this.db.updateItem(
                this.collectionName,
                [{ field: 'sessionID', operator: 'eq', value: sessionID }],
                updates,
                true
            );
        }
    }

    /**
     * Deletes a session document from the collection.
     * @param {string} sessionID - Unique identifier for the session to delete.
     * @returns {Promise<void>} Promise resolving when the operation is complete.
     */
    async destroy(sessionID: string): Promise<void> {
        await this.db.deleteItem(
            this.collectionName,
            [{ field: 'sessionID', operator: 'eq', value: sessionID }]
        );
    }
}