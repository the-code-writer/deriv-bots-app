import { MongoDBConnection } from '@/classes/databases/mongodb/MongoDBClass';

import { pino } from 'pino';

// Logger
const logger = pino({ name: "TelegramServiceExample" });

 
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
