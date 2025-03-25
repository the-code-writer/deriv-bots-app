import { v4 as uuidv4 } from 'uuid'; // For generating unique session IDs
import { ISessionStore, ISession, IBotAccounts, ITelegramAccount, IDerivUserAccount } from './SessionManagerStorageClass';
import { Encryption } from '../cryptography/EncryptionClass';
import session from 'express-session';
import { calculateExpiry } from '@/common/utils/snippets';
import { env } from '@/common/utils/envConfig';
import { UserManagerStorageClass } from './UserManagerStorageClass';

const { NODE_ENV, HOST, PORT, MONGODB_DATABASE_NAME, DB_SERVER_SESSIONS_DATABASE_COLLECTION, DB_SERVER_SESSIONS_DATABASE_TTL, DB_USER_ACCOUNT_DATABASE_COLLECTION } = env;

/**
 * Interface for SessionService.
 * This defines the contract for managing user sessions, including middleware for handling sessions
 * and methods for destroying sessions.
 */
export interface ISessionService {
    /**
     * Middleware for handling session management.
     * This middleware attaches session data to the request object and ensures
     * session data is persisted when the response is sent.
     * @param req - The HTTP request object.
     * @param res - The HTTP response object.
     * @param next - The next middleware function in the stack.
     * @returns A promise that resolves when the middleware completes.
     */
    middleware(req: any, res: any, next: () => void): Promise<void>;

    /**
     * Destroys the session for the current request.
     * This removes the session data from the store and clears the session cookie.
     * @param req - The HTTP request object.
     * @param res - The HTTP response object.
     * @returns A promise that resolves when the session is destroyed.
     */
    destroySession(req: any, res: any): Promise<void>;

    getUserSessionByChatId(chatId: number): Promise<ISession | any>;

    getSession(sessionID: number): Promise<ISession | any>;

    updateSession(req: any, _: any, key: string, value: any): Promise<void>;

    updateSessionWithChatId(chatId: number, session: any): Promise<void>;

    cleanupInactiveSessions(): Promise<void>;

    deleteSession(sessionID: string): Promise<void>;

}

/**
 * SessionService manages user sessions using a session store.
 * It provides middleware for handling sessions and methods for destroying sessions.
 */
export class SessionService implements ISessionService {
    private sessionStore: ISessionStore;
    private userStore: any;
    private cookieName: string;
    private maxAge: string | number;

    /**
     * Constructor for SessionService.
     * @param sessionStore - An implementation of the session store interface.
     * @param cookieName - The name of the cookie used to store the session ID.
     * @param maxAge - The maximum age of the session cookie in milliseconds.
     */
    constructor(sessionStore: ISessionStore, cookieName: string = 'sessionID', maxAge: string | number = 86400, userStore:any) {
        if (!sessionStore || typeof sessionStore.get !== 'function' || typeof sessionStore.set !== 'function' || typeof sessionStore.destroy !== 'function') {
            throw new Error('sessionStore must implement ISessionStore interface');
        }
        this.sessionStore = sessionStore;
        this.userStore = userStore;
        this.cookieName = cookieName;
        this.maxAge = maxAge ? calculateExpiry(maxAge) : DB_SERVER_SESSIONS_DATABASE_TTL;
    }

    /**
     * Middleware for handling session management.
     * This middleware attaches session data to the request object and ensures
     * session data is persisted when the response is sent.
     * @param req - The HTTP request object.
     * @param res - The HTTP response object.
     * @param next - The next middleware function in the stack.
     */
    async middleware(req: any, res: any, next: () => void): Promise<void> {
        // Retrieve the session ID from the request cookies
        let sessionID: string = req.cookies[this.cookieName];

        // If no session ID exists, generate a new one and set it in the response cookie
        if (!sessionID) {
            sessionID = uuidv4();
            res.cookie(this.cookieName, sessionID, this.getCookieObject());
        }

        // Retrieve session data from the session store
        const { sessionData, data } = await this.validateSession(sessionID);

        const now = Date.now();

        if (now > parseInt(this.maxAge.toString())) {
            console.log("SESSION EXPIRED");
            res.send("SESSION EXPIRED");
        } else if (now > parseInt(data.maxAge.toString())) {
            // Destroy the session in the session store
            await this.sessionStore.destroy(sessionID);

            // Clear the session cookie
            res.clearCookie(this.cookieName);

            // Remove session data from the request object
            delete req.session;
            delete req.sessionID;
            res.send("SESSION EXPIRED");
        } else {

            // Attach session data and session ID to the request object
            req.session = sessionData;
            req.sessionID = sessionID;

            // Ensure session data is persisted when the response is finished
            res.on('finish', async () => {
                if (req.session) {
                    //await this.sessionStore.set(sessionID, req.session);
                    console.log(":: SESSION ON FINITO ::", req.session);
                }
            });

        }

        // Proceed to the next middleware
        next();

    }

    /**
     * Destroys the session for the current request.
     * This removes the session data from the store and clears the session cookie.
     * @param req - The HTTP request object.
     * @param res - The HTTP response object.
     */
    async destroySession(req: any, res: any): Promise<void> {
        const sessionID: string = req.sessionID;
        if (sessionID) {
            // Destroy the session in the session store
            await this.sessionStore.destroy(sessionID);

            // Clear the session cookie
            res.clearCookie(this.cookieName);

            // Remove session data from the request object
            delete req.session;
            delete req.sessionID;
        }
    }

    getCookieObject(): any {

        const cookie: any = {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "strict",
            originalMaxAge: this.maxAge,
            maxAge: this.maxAge,
            expires: this.maxAge,
            path: "/",
            domain: null,
            priority: null,
            partitioned: null,
        };

        return cookie;

    }

    initializeSessionObject(sessionID: string, chatId:number=0): any {

        const session: any = {
            sessionID: sessionID
        };

        chatId > 0 ? session.chatId = chatId : undefined;

        const sessionData = {
            _id: sessionID,
            maxAge: this.maxAge,
            cookie: this.getCookieObject(),
            session
        };

        return sessionData;

    }

    async validateSession(sessionID: string): Promise<any> {

        // Retrieve session data from the session store
        let sessionData: Record<string, any> = await this.sessionStore.get(sessionID);

        console.log("::::::::: VALIDATE_SESSION ::::: validateSession :::: 00000 :::::::::", sessionID, sessionData);

        // If no session data exists, initialize an empty session and store it
        if (!sessionData) {
            
            console.log("::::::::: VALIDATE_SESSION ::::: NOT FOUND!!!!!!!! :::::::::", sessionID, sessionData);

            sessionData = this.initializeSessionObject(sessionID);

            console.log("::::::::: VALIDATE_SESSION ::::: initializeSessionObject :::::::::", sessionID, sessionData);

            await this.sessionStore.set(sessionID, sessionData);

        }

        return { sessionData: sessionData.session, data: sessionData, sessionID: sessionID };

    }

    async validateSessionWithChatId(chatId: number): Promise<any> {

        const sessionID: string = uuidv4();

        // Retrieve session data from the session store
        let sessionData: Record<string, any> = await this.getUserSessionByChatId(chatId);

        // If no session data exists, initialize an empty session and store it
        if (!sessionData) {
            sessionData = this.initializeSessionObject(sessionID, chatId);
            await this.sessionStore.set(sessionID, sessionData);
        }

        return { sessionData: sessionData.session, data: sessionData, sessionID: sessionID };

    }

    /**
     * Destroys the session for the current request.
     * This removes the session data from the store and clears the session cookie.
     * @param req - The HTTP request object.
     * @param res - The HTTP response object.
     */
    async createSession(chatId:number, session:any): Promise<void> {

        const sessionID: string = uuidv4();

        // Retrieve session data from the session store
        const sessionData = this.initializeSessionObject(sessionID, chatId);

        sessionData.session.bot = session;

        console.log("::::::::: SESSION_DATA :: CREATE ::::::::: XXXXXX :::::::::", sessionID, sessionData);

        await this.sessionStore.create(sessionData);

    }

    /**
     * Destroys the session for the current request.
     * This removes the session data from the store and clears the session cookie.
     * @param req - The HTTP request object.
     * @param res - The HTTP response object.
     */
    async updateSession(req: any, _: any, key: string, value: any): Promise<void> {

        const sessionID: string = req.sessionID;

        try {

            // Retrieve session data from the session store
            const { sessionData } = await this.validateSession(sessionID);

            console.log("::::::::: UPDATE_SESSION ::::: updateSession :::: 00001 :::::::::", req.session, req.cookies, sessionID, sessionData);

            sessionData[key] = value;

            req.session[key] = value;

            await this.sessionStore.set(sessionID, key, value);

        } catch (error) {
            
            console.log("::::::::: UPDATE_SESSION_ERROR ::::: updateSession :::: 00001 :::::::::", req.session, req.sessionID, error);

        }

        

    }

    /**
     * Destroys the session for the current request.
     * This removes the session data from the store and clears the session cookie.
     * @param req - The HTTP request object.
     * @param res - The HTTP response object.
     */
    async updateSessionWithChatId(chatId: number, session: any): Promise<void> {

        // Retrieve session data from the session store
        const { sessionData, data, sessionID } = await this.validateSessionWithChatId(chatId);

        console.log("::::::::: SESSION_DATA :: updateSessionWithChatId ::::::::: 000", sessionData, data);

        if (session) {

            await this.sessionStore.set(sessionID, "bot", session);

            console.log("::::::::: SESSION_DATA :: updateSessionWithChatId ::::::::: 001", sessionID, session);

        }

    }

    async getUserSessionByChatId(chatId: number): Promise<ISession | any> {
        return await this.sessionStore.getWithParams([
            { field: "session.chatId", operator: "eq", value: chatId }
        ]);
    }

    async saveUser(user: any): Promise<void> {
        return await this.userStore.create(user);
    }

    async getUserAccountById(chatId: number): Promise<ISession | any> {
        return await this.userStore.getWithParams([
            { field: "userId", operator: "eq", value: chatId }
        ]);
    }

    async getUserAccountByChatId(chatId: number): Promise<ISession | any> {
        return await this.userStore.getWithParams([
            { field: "telegramAccount.chatId", operator: "eq", value: chatId }
        ]);
    }

    async getUserAccountByDerivAccountNumber(accountId: number): Promise<ISession | any> {
        return await this.userStore.getWithParams([
            { field: "derivAccount.accountId", operator: "eq", value: accountId }
        ]);
    }

    async getSession(sessionID: number): Promise<ISession | any> {
        return await this.sessionStore.getWithParams([
            { field: "session.sessionID", operator: "eq", value: sessionID }
        ]);
    }

    async cleanupInactiveSessions(): Promise<void> {
        const now = Date.now();
        const sessions: Array<ISession | any> = await this.sessionStore.getAllSessions(); //TODO : toArray()

        for (const session of sessions) {
            if (now - (session.timestamp || 0) > 30 * 60 * 1000) {
                await this.sessionStore.destroy(session.session.sessionID);
            }
        }
    }

    async deleteSession(sessionID: string): Promise<void> {
        await this.sessionStore.destroy(sessionID);
    }

}

export { ISession, IBotAccounts, ITelegramAccount, IDerivUserAccount }