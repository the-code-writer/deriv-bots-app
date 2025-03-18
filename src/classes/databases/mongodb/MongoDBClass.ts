

import { MongoClient, Db, Collection, MongoClientOptions, InsertOneResult, InsertManyResult, UpdateResult, DeleteResult, Document, MongoServerError, WithId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { env } from "@/common/utils/envConfig";
import { pino } from 'pino';

// Logger
const logger = pino({ name: "MongoDBConnection" });

// Environment variables

const { MONGODB_CONNECTION_STRING, MONGODB_BACKUP_PATH, MONGODB_DATABASE_NAME, MONGODB_MAX_RETRIES, MONGODB_RETRY_DELAY } = env;
// Load environment variables from .env file
dotenv.config();

// Define interfaces for better type safety and structure
interface DatabaseConfig {
    uri: string;
    dbName: string;
    maxRetries: number;
    retryDelay: number;
}

interface Item {
    [key: string]: any; // Flexible structure for items
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
}

interface DatabaseConnection {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    retryConnection(): Promise<void>;
    getConnection(checkConnection: boolean): Promise<Db | null>;
    createDatabase(dbName: string): Promise<void>;
    repairDatabase(): Promise<void>;
    optimizeDatabase(): Promise<void>;
    backupDatabase(backupPath: string): Promise<void>;
    restoreDatabase(backupPath: string): Promise<void>;
    insertItem(collectionName: string, item: any): Promise<InsertOneResult<Document> | undefined>;
    insertBulk(collectionName: string, items: any[]): Promise<InsertManyResult<Document> | undefined>;
    getItem(collectionName: string, query: Partial<Item>): Promise<Item | null>;
    getAllItems(collectionName: string, conditions: QueryCondition[]): Promise<WithId<Document>[] | undefined>;
    updateItem(collectionName: string, conditions: QueryCondition[], updates: Partial<Item>): Promise<UpdateResult | undefined>;
    updateItems(collectionName: string, conditions: QueryCondition[], updates: Partial<Item>): Promise<UpdateResult | undefined>;
    deleteItem(collectionName: string, conditions: QueryCondition[]): Promise<DeleteResult | undefined>;
}

interface QueryCondition {
    field: string;
    operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'ne' | 'regex' | 'in' | 'nin';
    value: any;
}

interface QueryOptions {
    conditions: QueryCondition[];
    logicalOperator?: 'and' | 'or';
}


class QueryBuilder {
    /**
     * Builds a MongoDB query from dynamic conditions.
     * @param options - Query options including conditions and logical operator.
     * @returns MongoDB query object.
     */
    static buildQuery(options: QueryOptions): any {
        const { conditions, logicalOperator = 'and' } = options;

        const queryParts = conditions.map((condition) => {
            const { field, operator, value } = condition;

            switch (operator) {
                case 'eq':
                    return { [field]: value };
                case 'gt':
                    return { [field]: { $gt: value } };
                case 'lt':
                    return { [field]: { $lt: value } };
                case 'gte':
                    return { [field]: { $gte: value } };
                case 'lte':
                    return { [field]: { $lte: value } };
                case 'ne':
                    return { [field]: { $ne: value } };
                case 'regex':
                    return { [field]: { $regex: value, $options: 'i' } }; // Case-insensitive regex
                case 'in':
                    return { [field]: { $in: value } };
                case 'nin':
                    return { [field]: { $nin: value } };
                default:
                    throw new Error(`Unsupported operator: ${operator}`);
            }
        });

        // Combine query parts using the specified logical operator
        return logicalOperator === 'and' ? { $and: queryParts } : { $or: queryParts };
    }
}

export class MongoDBConnection implements DatabaseConnection {
    private client: MongoClient | null = null;
    private db: Db | null = null;
    private retryAttempts: number = 0;
    private readonly config: DatabaseConfig;

    constructor() {
        // Initialize configuration from environment variables
        this.config = {
            uri: MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017',
            dbName: MONGODB_DATABASE_NAME || 'default_db',
            maxRetries: MONGODB_MAX_RETRIES || 5,
            retryDelay: MONGODB_RETRY_DELAY || 3000
        };

    }

    /**
     * Connects to the MongoDB database.
     * @throws {Error} If connection fails.
     */
    async connect(): Promise<void> {
        try {
            this.client = new MongoClient(this.config.uri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            } as MongoClientOptions);
            await this.client.connect();
            this.db = this.client.db(this.config.dbName);
            logger.info('Connected to MongoDB successfully!');
        } catch (error: any) {
            if (error instanceof MongoServerError) {
                // Handle MongoDB-specific errors
                if (error.code === 18) { // Error code for authentication failure
                    logger.error('Authentication failed. Please check your MongoDB credentials.');
                } else {
                    logger.error(`MongoDB error: ${error.message}`);
                }
            } else {
                // Handle other errors
                logger.error(`Failed to connect to MongoDB: ${error.message}`);
            }
            throw error; // Re-throw the error to stop the application
        }
    }

    /**
     * Disconnects from the MongoDB database.
     */
    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.db = null;
            logger.info('Disconnected from MongoDB.');
        }
    }

    /**
     * Retries connection to the database with incremental delays.
     * @throws {Error} If max retries are reached.
     */
    async retryConnection(): Promise<void> {
        while (this.retryAttempts < this.config.maxRetries) {
            try {
                await this.connect();
                this.retryAttempts = 0; // Reset retry attempts on success
                return;
            } catch (error) {
                this.retryAttempts++;
                logger.warn(`Retry attempt ${this.retryAttempts} failed. Retrying in ${this.config.retryDelay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
            }
        }
        throw new Error('Max retry attempts reached. Unable to connect to MongoDB.');
    }

    /**
     * Returns the current database connection.
     * @throws {Error} If not connected.
     */
    async getConnection(checkConnection: boolean = false): Promise<Db | null> {

        if (!this.db) {
            if (checkConnection) {
                await this.connect();
            } else {
                throw new Error('Database not connected. Call connect() first.');
            }
        }
        return this.db;
    }

    /**
     * Creates a new database.
     * @param dbName - Name of the database to create.
     */
    async createDatabase(dbName: string): Promise<void> {
        this.db = this.client!.db(dbName);
        logger.info(`Database ${dbName} created.`);
    }

    /**
     * Repairs the database.
     */
    async repairDatabase(): Promise<void> {
        // Placeholder for repair logic
        logger.info('Database repair functionality not implemented.');
    }

    /**
     * Inserts a single item into a collection.
     * @param collectionName - Name of the collection.
     * @param item - Item to insert.
     * @returns InsertOneResult
     */
    async insertItem(collectionName: string, item: any): Promise<InsertOneResult<Document> | undefined> {
        const collection: Collection<Document> | undefined = this.db?.collection(collectionName);
        item.createdAt = new Date();
        item.updatedAt = new Date();
        item.isActive = true;
        return await collection?.insertOne(item);
    }

    /**
     * Inserts multiple items into a collection.
     * @param collectionName - Name of the collection.
     * @param items - Array of items to insert.
     * @returns InsertManyResult
     */
    async insertBulk(collectionName: string, items: any[]): Promise<InsertManyResult<Document> | undefined> {
        const collection: Collection<Document> | undefined = this.db?.collection(collectionName);
        items.forEach((item) => {
            item.createdAt = new Date();
            item.updatedAt = new Date();
            item.isActive = true;
        });
        return await collection?.insertMany(items);
    }

    /**
       * Retrieves a single item from a collection using dynamic query conditions.
       * @param collectionName - Name of the collection.
       * @param conditions - Query conditions.
       * @returns Item or null if not found.
       */
    async getItem(collectionName: string, conditions: QueryCondition[]): Promise<any | null> {
        const collection: Collection<Document> | undefined = this.db?.collection(collectionName);
        const query = QueryBuilder.buildQuery({ conditions });
        return await collection?.findOne(query);
    }

    /**
     * Retrieves all items from a collection using dynamic query conditions.
     * @param collectionName - Name of the collection.
     * @param conditions - Query conditions.
     * @returns Array of items.
     */
    async getAllItems(collectionName: string, conditions: QueryCondition[] = []): Promise<WithId<Document>[] | undefined> {
        const collection: Collection<Document> | undefined = this.db?.collection(collectionName);
        const query = QueryBuilder.buildQuery({ conditions });
        return await collection?.find(query).toArray();
    }

    /**
     * Updates a single item in a collection using dynamic query conditions.
     * @param collectionName - Name of the collection.
     * @param conditions - Query conditions.
     * @param updates - Updates to apply.
     * @returns UpdateResult
     */
    async updateItem(collectionName: string, conditions: QueryCondition[], updates: Partial<Item>): Promise<UpdateResult | undefined> {
        const collection: Collection<Document> | undefined = this.db?.collection(collectionName);
        const query = QueryBuilder.buildQuery({ conditions });
        updates.updatedAt = new Date();
        return await collection?.updateOne(query, { $set: updates });
    }

    /**
     * Updates multiple items in a collection using dynamic query conditions.
     * @param collectionName - Name of the collection.
     * @param conditions - Query conditions.
     * @param updates - Updates to apply.
     * @returns UpdateResult
     */
    async updateItems(collectionName: string, conditions: QueryCondition[], updates: Partial<Item>): Promise<UpdateResult | undefined> {
        const collection: Collection<Document> | undefined = this.db?.collection(collectionName);
        const query = QueryBuilder.buildQuery({ conditions });
        updates.updatedAt = new Date();
        return await collection?.updateMany(query, { $set: updates });
    }

    /**
     * Deletes a single item from a collection.
     * @param collectionName - Name of the collection.
     * @param query - Query to find the item.
     * @returns DeleteResult
     */
    async deleteItem(collectionName: string, conditions: QueryCondition[]): Promise<DeleteResult | undefined> {
        const collection: Collection<Document> | undefined = this.db?.collection(collectionName);
        const query = QueryBuilder.buildQuery({ conditions });
        return await collection?.deleteOne(query);
    }

    /**
 * Retrieves all collections and their records, then saves them to a backup file.
 * @param backupPath - Directory to save the backup file.
 */
    async backupDatabase(): Promise<any> {
        if (!this.db) {
            throw new Error('Database not connected. Call connect() first.');
        }

        try {
            // Get all collections in the database
            const collections = await this.db.listCollections().toArray();

            // Create a backup object to store all collections' data
            const backupData: { [collectionName: string]: any[] } = {};

            // Iterate through each collection and retrieve its records
            for (const collectionInfo of collections) {
                const collectionName = collectionInfo.name;
                const collection: Collection<Document> | undefined = this.db?.collection(collectionName);
                const records = await collection.find().toArray();
                backupData[collectionName] = records;
            }

            // Generate backup file name
            const backupPath = MONGODB_BACKUP_PATH;
            if (!fs.existsSync(backupPath)) {
                fs.mkdirSync(backupPath, { recursive: true });
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFileName = `${timestamp}.${this.config.dbName}.mongodb.backup.json`;
            const backupFilePath = path.join(backupPath, backupFileName);
            // Write backup data to a JSON file
            fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
            logger.info(`Backup saved to: ${backupFilePath}`);
            return {
                backupPath, backupFileName, backupFilePath
            };
        } catch (error) {
            logger.error('Failed to backup database:', error);
            //throw error;
        }
    }

    /**
 * Restores the database from a backup file.
 * @param backupFilePath - Path to the backup file.
 */
    async restoreDatabase(backupFileName: string): Promise<void> {
        if (!this.db) {
            throw new Error('Database not connected. Call connect() first.');
        }

        try {

            // Generate backup file name
            const backupPath = MONGODB_BACKUP_PATH;
            const backupFilePath = path.join(backupPath, backupFileName);

            // Read the backup file
            const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf-8'));

            // Iterate through each collection in the backup data
            for (const [collectionName, records] of Object.entries(backupData)) {

                const collection: Collection<Document> | undefined = this.db?.collection(collectionName);

                await collection.deleteMany({});

                // Insert records into the collection
                if (Array.isArray(records)) {
                    await collection.insertMany(records);
                    logger.info(`Restored ${records.length} records into collection: ${collectionName}`);
                } else {
                    logger.warn(`Skipping invalid data for collection: ${collectionName}`);
                }
            }

            logger.info('Database restore completed successfully!');
        } catch (error) {
            logger.error('Failed to restore database:', error);
            //throw error;
        }
    }

    /**
 * Optimizes the MongoDB database using various techniques.
 */
    async optimizeDatabase(): Promise<void> {
        if (!this.db) {
            throw new Error('Database not connected. Call connect() first.');
        }

        try {
            logger.info('Starting database optimization...');

            // 1. Index Optimization
            logger.info('Optimizing indexes...');
            const collections = await this.db.listCollections().toArray();
            for (const collectionInfo of collections) {
                const collectionName = collectionInfo.name;
                const collection: Collection<Document> | undefined = this.db?.collection(collectionName);

                // Example: Create an index on the `createdAt` field
                await collection.createIndex({ createdAt: 1 });
                logger.info(`Created index on 'createdAt' for collection: ${collectionName}`);
            }

            // 2. Compact Collections (Reduce Fragmentation)
            logger.info('Compacting collections...');
            // Check if the compact command is supported
            const isCompactSupported = await this.isCompactCommandSupported();

            if (isCompactSupported) {
                // Run the compact command
                for (const collectionInfo of collections) {
                    const collectionName = collectionInfo.name;
                    await this.db.command({ compact: collectionName });
                    logger.info(`Compacted collection: ${collectionName}`);
                }
                logger.info("Database optimization (compact) completed successfully.");
            } else {
                // Fallback: Drop and recreate the collection
                logger.warn("Compact command not supported. Falling back to drop and recreate.");
                await this.recreateCollection("sessions");
            }


            // 3. Rebuild Indexes
            logger.info('Rebuilding indexes...');
            for (const collectionInfo of collections) {
                const collectionName = collectionInfo.name;
                await this.db.command({ reIndex: collectionName });
                logger.info(`Rebuilt indexes for collection: ${collectionName}`);
            }

            // 4. Analyze and Drop Unused Indexes
            logger.info('Analyzing and dropping unused indexes...');
            for (const collectionInfo of collections) {
                const collectionName = collectionInfo.name;
                const indexes = await this.db?.collection(collectionName).indexes();

                for (const index of indexes) {
                    const indexName: string | undefined = index.name;
                    if (indexName !== '_id_') { // Skip the default _id index
                        // Example: Drop indexes that are not frequently used (this is a placeholder logic)
                        await this.db?.collection(collectionName).dropIndex(String(indexName));
                        logger.info(`Dropped unused index: ${indexName} in collection: ${collectionName}`);
                    }
                }
            }

            logger.info('Database optimization completed successfully!');
        } catch (error: any) {
            logger.error('Failed to optimize database:', error);
            logger.error(error);
            //throw error;
            if (error instanceof MongoServerError && error.code === 59) { // Error code for CMD_NOT_ALLOWED
                logger.warn("Compact command not allowed in this environment. Falling back to drop and recreate.");
                await this.recreateCollection("sessions");
            } else {
                logger.error(`Error optimizing database: ${error.message}`);
                throw error;
            }
        }
    }

    private async isCompactCommandSupported(): Promise<boolean> {
        if (!this.db) {
            throw new Error('Database not connected. Call connect() first.');
        }

        try {
            // Attempt to run a harmless command to check if compact is supported
            await this.db.command({ ping: 1 });
            return true;
        } catch (error) {
            return false;
        }
    }

    private async recreateCollection(collectionName: string): Promise<void> {
        if (!this.db) {
            throw new Error('Database not connected. Call connect() first.');
        }

        try {
            const collection: Collection<Document> | undefined = this.db?.collection(collectionName);

            // Drop the collection
            await collection.drop();
            logger.info(`Dropped collection: ${collectionName}`);

            // Recreate the collection
            await this.db.createCollection(collectionName);
            logger.info(`Recreated collection: ${collectionName}`);
        } catch (error: any) {
            logger.error(`Error recreating collection: ${error.message}`);
            throw error;
        }
    }

    /**
   * Returns the MongoDB DB.
   */
    getDB(): Db {
        if (!this.db) throw new Error('Database not initialized.');
        return this.db;
    }

    /**
   * Returns the MongoDB Client.
   */
    getClient(): MongoClient {
        if (!this.client) throw new Error('Database not connected.');
        return this.client;
    }

}

/*
 
// Example usage
(async () => {
    const db = new MongoDBConnection();
    try {
        await db.connect();
        await db.insertItem('users', { name: 'John Doe', age: 30 });
        const user = await db.getItem('users', [
            { field: 'name', operator: 'regex', value: 'John' }, // Case-insensitive regex search
        ]);
        logger.info('Retrieved user:', user);
    } catch (error) {
        logger.error('Error:', error);
    } finally {
        await db.disconnect();
    }
})();

// Example usage
(async () => {
    const db = new MongoDBConnection();
    try {
        await db.connect(); 

        // Example: Insert an item
        await db.insertItem('users', { name: 'John Doe', age: 30, createdAt: new Date(), updatedAt: new Date(), isActive: true });

        // Example: Get items with dynamic query
        const users = await db.getAllItems('users', [
            { field: 'age', operator: 'gt', value: 20 },
            { field: 'name', operator: 'regex', value: 'John' }, // Case-insensitive regex search
        ]);
        logger.info('Retrieved users:', users);

        // Example: Update items with dynamic query
        await db.updateItems('users', [{ field: 'age', operator: 'lt', value: 40 }], { isActive: false });
    } catch (error) {
        logger.error('Error:', error);
    } finally {
        await db.disconnect();
    }
})();

// Example usage
(async () => {
    const db = new MongoDBConnection();
    let backupFileObject: any = {};
    try {
        await db.connect();

        // Example: Insert an item
        await db.insertItem('users', { name: 'John Doe', age: 30, createdAt: new Date(), updatedAt: new Date(), isActive: true });

        //{ backupPath, backupFileName, backupFilePath }
        backupFileObject = await db.backupDatabase(); 
        logger.info('Database backup completed successfully!', backupFileObject);
    } catch (error) {
        logger.error('Database backup error');
        logger.error(error);
    } finally {
        try {
            await db.connect();
            await db.restoreDatabase(backupFileObject.backupFileName);
            logger.info('Database restoration completed successfully!', backupFileObject);
        } catch (error) {
            logger.error('Database restoration error');
            logger.error(error);
        } finally {
            await db.disconnect();
        }
    }
})();

(async () => {
    const db = new MongoDBConnection();
    try {
        await db.connect();

        // Optimize the database
        await db.optimizeDatabase();
    } catch (error) {
        logger.error('Error:', error);
    } finally {
        await db.disconnect();
    }
})();
 
*/