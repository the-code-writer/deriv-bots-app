import { IUser, IUserRepository } from './UserInterfaces';
import { DatabaseConnection } from '@/classes/databases/mongodb/MongoDBClass';
import { InsertOneResult } from 'mongodb';
/**
 * MongoDB implementation of the user repository
 */
export class UserRepository implements IUserRepository {
    private readonly collection: string = 'users';

    constructor(private db: DatabaseConnection) { }

    /**
     * Creates a new user in the database
     * @param user The user data to create
     * @returns The created user with _id
     */
    async create(user: IUser): Promise<IUser> {

        const now = new Date();

        const newUser: IUser = {
            ...user,
            createdAt: now,
            updatedAt: now,
            isActive: true
        };

        const insertResult = await this.db.insertItem(this.collection, newUser);

        if (!insertResult || !insertResult.acknowledged) {
            throw new Error('Failed to create user');
        }

        // If we get MongoDB's InsertOneResult, combine with our data
        if ('insertedId' in insertResult) {
            return {
                ...newUser,
                _id: insertResult.insertedId.toString()
            };
        }

        throw new Error('Unexpected response from database');

    }

    /**
     * Finds a user by their unique userId
     * @param userId The user's unique identifier
     * @returns The user or null if not found
     */
    async userExists(userId: string): Promise<boolean> {
        const user = await this.db.getItem(this.collection, [
            { field: 'userId', operator: 'eq', value: userId }
        ]);
        return typeof user !== null && typeof user !== undefined;
    }

    /**
     * Finds a user by their unique userId
     * @param userId The user's unique identifier
     * @returns The user or null if not found
     */
    async findById(userId: string): Promise<IUser | null> {
        const user = await this.db.getItem(this.collection, [
            { field: 'userId', operator: 'eq', value: userId }
        ]);
        return user as IUser | null;
    }

    /**
     * Finds users matching a query
     * @param query The query conditions
     * @returns Array of matching users
     */
    async findByQuery(query: any): Promise<IUser[]> {
        const users = await this.db.getItem(this.collection, query);
        return users as IUser[];
    }

    /**
     * Updates a user's information
     * @param userId The user's unique identifier
     * @param updates Partial user data to update
     * @returns The updated user or null if not found
     */
    async update(userId: string, updates: Partial<IUser>): Promise<IUser | null> {
        const updateData = {
            ...updates,
            updatedAt: new Date()
        };

        await this.db.updateItem(
            this.collection,
            [{ field: 'userId', operator: 'eq', value: userId }],
            updateData,
            true
        );

        return this.findById(userId);
    }

    /**
     * Deletes a user from the database
     * @param userId The user's unique identifier
     * @returns True if deletion was successful, false otherwise
     */
    async delete(userId: string): Promise<boolean | undefined> {
        const result = await this.db.deleteItem(this.collection, [
            { field: 'userId', operator: 'eq', value: userId }
        ]);
        return result?.acknowledged && result.deletedCount > 0;
    }

    /**
     * Retrieves all users from the database
     * @returns Array of all users
     */
    async findAll(): Promise<IUser[]> {
        const users = await this.db.getAllItems(this.collection, {});
        return users as IUser[];
    }
}