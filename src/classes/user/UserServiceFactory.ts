import { UserService } from './UserService';
import { DatabaseConnection } from '@/classes/databases/mongodb/MongoDBClass';
import { UserRepository } from './UserRepository';
/**
 * Factory for creating user service instances
 */
export class UserServiceFactory {
    /**
     * Creates a new UserService instance with MongoDB repository
     * @param db The database connection
     * @returns Configured UserService instance
     */
    static createUserService(db: DatabaseConnection): UserService {
        const repository = new UserRepository(db);
        return new UserService(repository);
    }
}