import { IDerivUserAccount } from '@/classes/deriv/DerivUserAccountClass';
import { MongoDBConnection } from '../databases/mongodb/MongoDBClass';

MongoDBConnection

/**
 * Represents a user entity with all its properties
 */
export interface IUser {
    _id?: string; // Unique identifier for the user
    userId: string;
    chatId: number;
    sessionID?: string;
    accountID?: string;
    name: string;
    username?: string;
    email: string;
    derivAccount: IDerivUserAccount;
    telegramAccount: ITelegramAccount;
    createdAt?: Date;
    updatedAt?: Date;
    isActive?: boolean;
}

/**
 * Interface for Telegram account information
 */
export interface ITelegramAccount {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
}

/**
 * Interface for basic CRUD operations on user data
 */
export interface IUserRepository {
    create(user: IUser): Promise<IUser>;
    userExists(userId: string): Promise<boolean>;
    findById(userId: string): Promise<IUser | null>;
    findByQuery(query: any): Promise<IUser[]>;
    update(userId: string, updates: UserUpdateDto): Promise<IUser | null>;
    delete(userId: string): Promise<boolean|undefined>;
    findAll(): Promise<IUser[]>;
}

/**
 * Interface for more complex user operations (business logic)
 */
export interface IUserService {
    activateUser(userId: string): Promise<IUser>;
    deactivateUser(userId: string): Promise<IUser>;
    updateUserDetails(userId: string, updates: UserUpdateDto): Promise<IUser>;
    getUserBySession(sessionId: string): Promise<IUser | null>;
    getUserByChat(chatId: number): Promise<IUser | null>;
    getActiveUsers(): Promise<IUser[]>;
}

/**
 * DTO for creating a new user
 */
export interface CreateUserDto {
    userId: string;
    chatId: number;
    accountID: string;
    sessionID: string;
    name: string;
    username: string;
    email: string;
    derivAccount: IDerivUserAccount;
    telegramAccount: ITelegramAccount;
}

/**
 * DTO for updating user information
 */
export interface UserUpdateDto {
    userId?: string;
    chatId?: number;
    accountID?: string;
    sessionID?: string;
    name?: string;
    username?: string;
    email?: string;
    derivAccount?: Partial<IDerivUserAccount>;
    telegramAccount?: Partial<ITelegramAccount>;
    isActive?: boolean;
}