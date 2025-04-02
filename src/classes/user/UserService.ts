import { v4 as uuidv4 } from 'uuid';
import { IUser, UserUpdateDto, IUserService, IUserRepository, ITelegramAccount, CreateUserDto } from "@/classes/user/UserInterfaces";
import { IDerivUserAccount } from '@/classes/deriv/DerivUserAccountClass';
import { Encryption } from '../cryptography/EncryptionClass';
/**
 * Service layer for user operations containing business logic
 */
export class UserService implements IUserService {

    constructor(private userRepository: IUserRepository) { }

    async createUserWelcomeMessage(user: IUser) : Promise<string> {

        const message: string = `Account Details:\n================\nFirst Name:${user.name}`;

        return message;

    }

    async createUserWithCallback(chatId: number, sessionData: any, userAccount: any, selectedAccount: any, callBack: any): Promise<void> {

        const userData:any = {
            userId: Encryption.md5(`${chatId}`),
            chatId: chatId,
            sessionID: sessionData.sessionID,
            accountID: Encryption.md5(`${userAccount._user_id}`),
            name: userAccount._fullname,
            username: userAccount._email.split("@")[0],
            email: userAccount._email,
            derivAccount: {
                email: userAccount._email,
                country: userAccount._country,
                currency: userAccount._currency,
                loginID: userAccount._loginid,
                userID: userAccount._user_id,
                fullname: userAccount._fullname,
                selectedAccount: selectedAccount,
            },
            telegramAccount: sessionData.bot.accounts.telegram,
        };
        
        const newUser = await this.create(userData);

        if(typeof callBack === "function"){

            callBack(newUser);

        }

    }

    /**
 * Creates a new user with validated data and generated userId
 * @param userData The user data to create
 * @returns The created user object
 * @throws Error if validation fails
 */
    async create(userData: CreateUserDto): Promise<IUser> {
        // Validate required fields
        if (!userData.chatId || !userData.name || !userData.email) {
            throw new Error('Missing required fields: chatId, name, and email are required');
        }

        // Validate email format
        if (!this.validateEmail(userData.email)) {
            throw new Error('Invalid email format');
        }

        // Validate name length
        if (userData.name.length < 2 || userData.name.length > 100) {
            throw new Error('Name must be between 2 and 100 characters');
        }

        // Validate derivAccount if provided
        if (userData.derivAccount && !this.validateDerivAccount(userData.derivAccount)) {
            throw new Error('Invalid derivAccount data');
        }

        // Validate telegramAccount if provided
        if (userData.telegramAccount && !this.validateTelegramAccount(userData.telegramAccount)) {
            throw new Error('Invalid telegramAccount data');
        }

        // Generate UUID for userId if not provided
        const userId = userData.userId || uuidv4();

        // Create the user object with generated/validated data
        const userToCreate: IUser = {
            userId,
            chatId: userData.chatId,
            accountID: userData.accountID || '',
            name: userData.name.trim(),
            username: userData.name.trim() || '',
            email: userData.email.toLowerCase().trim(),
            derivAccount: userData.derivAccount || {},
            telegramAccount: userData.telegramAccount || {},
            sessionID: userData.sessionID,
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true
        };

        // Save to repository
        const createdUser = await this.userRepository.create(userToCreate);
        return createdUser;
    }

    /**
     * Validates a Deriv account structure
     * @param account The deriv account to validate
     * @returns True if valid, false otherwise
     */
    private validateDerivAccount(account: IDerivUserAccount): boolean {
        // Add your specific validation logic for deriv accounts here
        // Example basic validation:
        return !!account.currency;
    }

    /**
     * Validates a Telegram account structure
     * @param account The telegram account to validate
     * @returns True if valid, false otherwise
     */
    private validateTelegramAccount(account: ITelegramAccount): boolean {
        // Basic validation - at minimum should have id and first_name
        return !!account.id && !!account.first_name;
    }

    /**
     * Activates a user account
     * @param userId The user's unique identifier
     * @returns The activated user
     * @throws Error if user not found
     */
    async userExists(userId: string): Promise<boolean> {
        const exists = await this.userRepository.userExists(userId);
        return exists;
    }

    /**
     * Activates a user account
     * @param userId The user's unique identifier
     * @returns The activated user
     * @throws Error if user not found
     */
    async activateUser(userId: string): Promise<IUser> {
        const user = await this.userRepository.update(userId, { isActive: true });
        if (!user) {
            throw new Error(`User with ID ${userId} not found`);
        }
        return user;
    }

    /**
     * Deactivates a user account
     * @param userId The user's unique identifier
     * @returns The deactivated user
     * @throws Error if user not found
     */
    async deactivateUser(userId: string): Promise<IUser> {
        const user = await this.userRepository.update(userId, { isActive: false });
        if (!user) {
            throw new Error(`User with ID ${userId} not found`);
        }
        return user;
    }

    /**
     * Updates user details with validation
     * @param userId The user's unique identifier
     * @param updates The fields to update
     * @returns The updated user
     * @throws Error if user not found or validation fails
     */
    async updateUserDetails(userId: string, updates: UserUpdateDto): Promise<IUser> {
        // Validate email if provided
        if (updates.email && !this.validateEmail(updates.email)) {
            throw new Error('Invalid email format');
        }

        const user = await this.userRepository.update(userId, updates);
        if (!user) {
            throw new Error(`User with ID ${userId} not found`);
        }
        return user;
    }

    /**
     * Finds a user by their session ID
     * @param sessionId The session identifier
     * @returns The user or null if not found
     */
    async getUserBySession(sessionId: string): Promise<IUser | null> {
        const users = await this.userRepository.findByQuery([
            { field: 'sessionId', operator: 'eq', value: sessionId }
        ]);
        return users && users.length > 0 ? users[0] : null;
    }

    /**
     * Finds a user by their chat ID
     * @param chatId The chat identifier
     * @returns The user or null if not found
     */
    async getUserByChat(chatId: number): Promise<IUser | null> {
        const users = await this.userRepository.findByQuery([
            { field: 'chatId', operator: 'eq', value: chatId }
        ]);
        return users && users.length > 0 ? users[0] : null;
    }

    /**
     * Finds a user by their email
     * @param email The email identifier
     * @returns The user or null if not found
     */
    async getUserByEmail(email: string): Promise<IUser | null> {
        const users = await this.userRepository.findByQuery([
            { field: 'email', operator: 'eq', value: email }
        ]);
        return users && users.length > 0 ? users[0] : null;
    }

    /**
     * Finds a user by their username
     * @param username The username identifier
     * @returns The user or null if not found
     */
    async getUserByUsername(username: string): Promise<IUser | null> {
        const users = await this.userRepository.findByQuery([
            { field: 'username', operator: 'eq', value: username }
        ]);
        return users && users.length > 0 ? users[0] : null;
    }

    /**
     * Retrieves all active users
     * @returns Array of active users
     */
    async getActiveUsers(): Promise<IUser[]> {
        return this.userRepository.findByQuery([
            { field: 'isActive', operator: 'eq', value: true }
        ]);
    }

    /**
     * Retrieves all active users
     * @returns Array of active users
     */
    async isUserActive(userId: string): Promise<boolean> {
        const users: IUser[] = await this.userRepository.findByQuery([
            { field: 'userId', operator: 'eq', value: userId },
            { field: 'isActive', operator: 'eq', value: true }
        ]);
        return users && users.length > 0;
    }

    /**
     * Validates an email address format
     * @param email The email to validate
     * @returns True if valid, false otherwise
     */
    private validateEmail(email: string): boolean {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
}