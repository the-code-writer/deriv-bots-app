import { v4 as uuidv4 } from 'uuid'; // For generating unique session IDs
import { ISessionStore, ISession, IBotAccounts, ITelegramAccount } from '@/classes/sessions/SessionManagerStorageClass';
import { Encryption } from '@/classes/cryptography/EncryptionClass';
import { calculateExpiry, getEncryptedUserAgent } from '@/common/utils/snippets';
import { env } from '@/common/utils/envConfig';
import { pino } from "pino";
const cookie = require('cookie-signature');
const http = require('http');
const uap = require('ua-parser-js');

// Logger
const logger = pino({ name: "SessionService" });

const { NODE_ENV, DB_SERVER_SESSIONS_DATABASE_TTL, APP_CRYPTOGRAPHIC_KEY, APP_DOMAIN, DEVICE_AGENT } = env;

/**
 * Interface for SessionService.
 * Defines the contract for managing user sessions, including middleware for handling sessions
 * and methods for creating, updating, and destroying sessions.
 */
export interface ISessionService {

    /**
     * Middleware for handling session management.
     * @param req - The HTTP request object.
     * @param res - The HTTP response object.
     * @param next - The next middleware function in the stack.
     * @returns A promise that resolves when the middleware completes.
     */
    middleware(req: any, res: any, next: () => void): Promise<void>;

    /**
     * Destroys the session for the current request.
     * @param req - The HTTP request object.
     * @param res - The HTTP response object.
     * @returns A promise that resolves when the session is destroyed.
     */
    destroySession(req: any, res: any): Promise<void>;

    /**
     * Retrieves a user session by Telegram chat ID.
     * @param chatId - The Telegram chat ID to search for.
     * @returns A promise that resolves with the session data or null if not found.
     */
    getUserSessionByChatId(chatId: number): Promise<ISession | undefined>;

    /**
     * Retrieves a user session by session ID.
     * @param sessionId - The session ID to search for.
     * @returns A promise that resolves with the session data or null if not found.
     */
    getUserSessionBySessionId(sessionId: string): Promise<ISession | undefined>;

    /**
     * Retrieves a user session by encrypted telegram id.
     * @param encua - The encrypted user agent string to search for.
     * @returns A promise that resolves with the session data or null if not found.
     */
    getUserSessionByEncID(encid: string): Promise<ISession | undefined>;

    /**
     * Retrieves a user session by encrypted user agent.
     * @param encua - The encrypted user agent string to search for.
     * @returns A promise that resolves with the session data or null if not found.
     */
    getUserSessionByEncUA(encua: string): Promise<ISession | undefined>;

    /**
     * Retrieves session data by session ID.
     * @param sessionID - The session ID to retrieve.
     * @returns A promise that resolves with the session data or null if not found.
     */
    getSession(sessionID: string): Promise<ISession | undefined>;

    /**
     * Updates a session with new key-value data.
     * @param req - The HTTP request object.
     * @param _ - Unused parameter (placeholder).
     * @param key - The key to update in the session.
     * @param value - The value to set for the key.
     * @returns A promise that resolves when the update is complete.
     */
    updateSession(req: any, _: any, key: string, value: any): Promise<void>;

    /**
     * Updates a session identified by chat ID with new session data.
     * @param chatId - The Telegram chat ID of the session to update.
     * @param session - The new session data to merge.
     * @returns A promise that resolves with the updated session data.
     */
    updateSessionWithChatId(chatId: number, session: any): Promise<ISession | undefined>;

    /**
     * Cleans up inactive sessions that have exceeded the timeout period.
     * @returns A promise that resolves when cleanup is complete.
     */
    cleanupInactiveSessions(): Promise<void>;

    /**
     * Deletes a session by session ID.
     * @param sessionID - The session ID to delete.
     * @returns A promise that resolves when the session is deleted.
     */
    deleteSession(sessionID: string): Promise<void>;

    /**
     * Creates a new session for a given chat ID and Telegram user data.
     * @param chatId - The Telegram chat ID for the new session.
     * @param telegramUser - The Telegram user data to associate with the session.
     * @returns A promise that resolves when the session is created.
     */
    createSession(chatId: number, telegramUser: any): Promise<void>;
}

/**
 * SessionService manages user sessions using a session store.
 * Provides middleware for handling sessions and methods for creating, updating, and destroying sessions.
 */
export class SessionService implements ISessionService {
    private sessionStore: ISessionStore;
    private cookieName: string;
    private maxAge: string | number;

    /**
     * Creates a new SessionService instance.
     * @param sessionStore - An implementation of the session store interface.
     * @param cookieName - The name of the cookie used to store the session ID (default: 'sessionID').
     * @param maxAge - The maximum age of the session cookie in milliseconds (default: 86400).
     */
    constructor(
        sessionStore: ISessionStore,
        cookieName: string = 'sessionID',
        maxAge: string | number = 86400
    ) {
        if (!sessionStore || typeof sessionStore.get !== 'function' ||
            typeof sessionStore.set !== 'function' ||
            typeof sessionStore.destroy !== 'function') {
            throw new Error('sessionStore must implement ISessionStore interface');
        }
        this.sessionStore = sessionStore;
        this.cookieName = cookieName;
        this.maxAge = maxAge ? calculateExpiry(maxAge) : DB_SERVER_SESSIONS_DATABASE_TTL;
    }


    getSessionIdFromRequest(req: any) {
        const rawCookie = req.headers.cookie
            ?.split(';')
            .find((c: any) => c.trim().startsWith(`${this.cookieName}=`));
        if (!rawCookie) return null;
        const signedValue = rawCookie.split('=')[1];
        return cookie.unsign(signedValue, APP_CRYPTOGRAPHIC_KEY);
    }


    persistSession(req: any, res: any, sessionID: string) {

        if (!req.session) return;

        req.session.id = sessionID;

        req.session.sessionID = sessionID;

        console.log("::: persistSession ::: req.session :::", req.session)

        // Update expiration
        req.session.expires = this.maxAge;

        this.updateSessionMaxAge(sessionID, this.maxAge);

        console.log("::: persistSession :::", [sessionID, APP_CRYPTOGRAPHIC_KEY])

        // Set cookie
        const signedSessionId = cookie.sign(sessionID, APP_CRYPTOGRAPHIC_KEY);

        // TODO - render this from the getCookieObject

        // Set the new session cookie
        res.cookie(this.cookieName, sessionID, this.getCookieObject());

        // or

        res.setHeader('Set-Cookie', `${this.cookieName}=${signedSessionId}; HttpOnly; Max-Age=${this.maxAge}; Path=/`);
        
    }

    /**
     * Middleware for handling session management with two main routes:
     * 1. /login?encid= - Handles initial login with encrypted chat ID
     * 2. /callback - Handles OAuth/social login callbacks
     * 
     * The middleware checks for existing sessions in this order:
     * 1. Checks for session cookie in request
     * 2. If no cookie, checks for encid parameter in URL
     * 3. If neither exists, creates a new session
     * 
     * @param req - The HTTP request object.
     * @param res - The HTTP response object.
     * @param next - The next middleware function in the stack.
     * @returns A promise that resolves when the middleware completes.
     */
    async middleware(req: any, res: any, next: () => void): Promise<void> {

        try {

            const { encid } = req.query; // Extract query parameters

            if (!encid) {
                // 1. Check for existing session cookie
                let sessionID: string = req.sessionID;  //this.getSessionIdFromRequest(req); // req.cookies[this.cookieName];
                let sessionData = req.session;

                console.log("Session check - Initial session ID:", [sessionID, sessionData], [req.session, req.sessionID, req.query, req.protocol, req.originalUrl]);

                if (!sessionID || !sessionData) {

                    console.log("!!!! This request has no session" );
                    console.log("################## req.cookies.encid", req.headers.cookie)
                    if (!sessionData && req.cookies.has("encid")) {

                        
                        
                    }

                } else {
                    
                    // Existing session found - retrieve session data
                    sessionData = await this.handleSessionIdSession(req, res, sessionID);
                    console.log("Existing session found:", { sessionID, sessionData });


                }
                
                if(true){

                    req.session = sessionData;

                    // 2. Validate session expiration
                    await this.validateSessionExpiration(req, res, sessionID, sessionData);

                    // 3. Attach session data to request object
                    this.attachSessionToRequest(req, sessionID, sessionData);

                    // 4. Set up response finish handler to log final session state
                    this.setupResponseFinishHandler(req, res);

                    // 5. Handle the nonce
                    this.setupNonce(res);

                    // 6. Persist session

                    // Save session before sending response
                    const originalSend = res.send;
                    res.send = (body: any) => {
                        this.persistSession(req, res, sessionID);
                        return originalSend.call(res, body);
                    };

                    console.log("Middleware completed - Final session state:", { sessionID, sessionData });

                    console.log("Middleware completed - Final req state:", { sessionID: req.sessionID, sessionData: req.sessionData });

                    console.log("Middleware completed - Final locals state:", { locals: req.locals });

                }
                
            }

            next();

        } catch (error) {
            console.error("Session middleware error:", error);
            res.status(500).send("Internal Server Error");
        }
    }

    /**
     * Handles session creation/retrieval when encid parameter is present.
     * @param req - The HTTP request object.
     * @param res - The HTTP response object.
     * @param encid - Encrypted chat ID from URL.
     * @returns A promise that resolves with the session data.
     */
    private async handleEncidSession(req: any, res: any, encid: string): Promise<any> {
        // Decrypt the chat ID from the encid parameter
        const chatId = parseInt(
            Encryption.decryptAES(
                String(encid).replace(/ /g, '+'),
                APP_CRYPTOGRAPHIC_KEY
            )
        );

        console.log("Decrypted chatId from encid, chatId:", encid, chatId);

        // Try to get existing session for this chat
        let sessionData: any = await this.getUserSessionByChatId(chatId);
        console.log("Session data from encid, chatId:", sessionData);

        // If no session exists for this chat, create a new one
        if (!sessionData) {
            sessionData = await this.handleNewSession(req, res, chatId);
        }

        // Store encid in session and response locals
        if (sessionData) {
            sessionData.encid = encid;
            res.locals.encid = encid;
            await this.updateSession(req, res, "session.encid", encid);
        }

        return sessionData;

    }

    /**
     * Handles session retrieval when session ID is present.
     * @param req - The HTTP request object.
     * @param res - The HTTP response object.
     * @param sessionID - The session ID to retrieve.
     * @returns A promise that resolves with the session data.
     */
    private async handleSessionIdSession(req: any, res: any, sessionID: string): Promise<any> {

        // Try to get existing session for this sessionID
        let sessionData = await this.getUserSessionBySessionId(sessionID);
        console.log("Session data from sessionID:", sessionData);

        return sessionData;
    }

    /**
     * Sets up CSP nonce for response headers.
     * @param res - The HTTP response object.
     * @returns The generated nonce value.
     */
    private setupNonce(res: any): string {

        const nonce = res.locals.nonce;

        if (!nonce) {

            const nonce = Encryption.generateRandomKey(16);
            res.locals.nonce = nonce;

        }

        res.setHeader(
            "Content-Security-Policy",
            `default-src 'self'; script-src 'self' 'nonce-${nonce}';`
        );

        return nonce;

    }

    /**
     * Handles creation of a brand new session.
     * @param req - The HTTP request object.
     * @param res - The HTTP response object.
     * @returns A promise that resolves with the new session data.
     */
    private async handleNewSession(req: any, res: any, chatId: number = 0): Promise<any> {
        const sessionID = uuidv4();
        console.log("Creating brand new session with ID:", sessionID);

        // Initialize empty session
        const sessionData = await this.initializeSessionObject(sessionID, chatId);

        req.session = sessionData;

        return sessionData;

    }

    /**
    * Validates session expiration and handles expired sessions.
    * @param req - The HTTP request object.
    * @param res - The HTTP response object.
    * @param sessionID - Current session ID.
    * @param sessionData - Current session data.
    * @returns A promise that resolves when validation is complete.
    */
    private async validateSessionExpiration(
        req: any,
        res: any,
        sessionID: string,
        sessionData: any
    ): Promise<void> {
        const now = Date.now();

        // Check if middleware's maxAge is expired (global session expiration)
        if (now > parseInt(this.maxAge.toString())) {
            console.log("Global session expiration reached");
            res.send("SESSION EXPIRED");
            return;
        }

        // Check if session's maxAge is expired (individual session expiration)
        if (sessionData && now > parseInt(sessionData.maxAge.toString())) {
            console.log("Session data expired - cleaning up:", sessionID);

            // Destroy expired session
            await this.sessionStore.destroy(sessionID);
            res.clearCookie(this.cookieName);

            // Clean up request object
            delete req.encid;
            delete req.session;
            delete req.sessionID;

            res.send("SESSION DATA EXPIRED");
        }
    }

    /**
    * Attaches session data to the request object.
    * @param req - The HTTP request object.
    * @param sessionID - Current session ID.
    * @param sessionData - Current session data.
    */
    private attachSessionToRequest(
        req: any,
        sessionID: string,
        sessionData: any
    ): void {
        req.session = sessionData;
        req.session.id = sessionID
        req.sessionID = sessionID;
        req.cookieName = this.cookieName;

        // Also store in locals for template rendering if needed
        req.locals = req.locals || {};
        req.locals.session = sessionData;
        req.locals.sessionID = sessionID;
        req.locals.cookieName = this.cookieName;
    }

    /**
     * Sets up handler to log final session state when response finishes.
     * @param req - The HTTP request object.
     * @param res - The HTTP response object.
     */
    private setupResponseFinishHandler(req: any, res: any): void {
        res.on('finish', async () => {
            if (req.session) {
                console.log("Final session state at response finish:", req.session);
            }
        });
    }

    /**
     * Destroys the session for the current request.
     * @param req - The HTTP request object.
     * @param res - The HTTP response object.
     * @returns A promise that resolves when the session is destroyed.
     */
    async destroySession(req: any, res: any): Promise<void> {
        const sessionID: string = req.sessionID;
        if (sessionID) {
            // Destroy the session in the session store
            await this.sessionStore.destroy(sessionID);

            // Clear the session cookie
            res.clearCookie(this.cookieName);

            req.locals = null;

            req.session = null;

            res.setHeader('Set-Cookie', `${this.cookieName}=; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/`);

            delete req.session;
            delete req.sessionID;
            delete req.cookieName;

        }
    }

    /**
     * Gets the cookie configuration object.
     * @returns The cookie configuration object.
     */
    getCookieObject(): any {

        const cookie: any = {
            secure: NODE_ENV === "production",
            httpOnly: true,
            sameSite: "strict",
            maxAge: this.maxAge,
            expires: new Date(this.maxAge),
            path: "/",
            domain: APP_DOMAIN,
            priority: "high",
            partitioned: undefined,
        };

        return cookie;

    }

    /**
     * Creates a new session object structure.
     * @param chatId - The Telegram chat ID.
     * @param sessionID - Optional session ID (will generate if not provided).
     * @param telegramUser - Telegram user data to include in session.
     * @returns The session object.
     */
    getSessionObject(chatId: number, sessionID?: string, telegramUser: any = {}): any {

        const session: any = {
            sessionID: sessionID,
            chatId: chatId,
            bot: {
                chatId: chatId,
                timestamp: new Date(),
                tradingOptions: {
                    step: ""
                },
                accounts: {
                    telegram: telegramUser,
                    deriv: {
                        accountList: {},
                        accountDetails: {}
                    }
                },

            },
            encid: "",
            encua: "",
            encuaData: {}
        };

        if (telegramUser) {
            session.bot.accounts.telegram = telegramUser;
        }

        return session;

    }

    /**
     * Creates a complete cookie session object.
     * @param chatId - The Telegram chat ID.
     * @param sessionID - Optional session ID (will generate if not provided).
     * @param telegramUser - Telegram user data to include in session.
     * @returns The complete session object or null if chatId is 0.
     */
    getCookieSessionObject(chatId: number = 0, sessionID: string = '', telegramUser: any = {}): any {

        if (chatId === 0) {

            return null;

        }

        if (sessionID.length < 5) {

            sessionID = uuidv4();

        }

        const sessionData: any = {
            _id: sessionID,
            sessionID: sessionID,
            chatId: chatId,
            maxAge: this.maxAge,
            cookie: this.getCookieObject(),
            session: this.getSessionObject(chatId, sessionID, telegramUser),
        };

        return sessionData;

    }

    /**
     * Initializes a new session object and stores it.
     * @param sessionID - The session ID to initialize.
     * @param chatId - The Telegram chat ID.
     * @param telegramUser - Telegram user data to include in session.
     * @returns A promise that resolves with the initialized session data.
     */
    async initializeSessionObject(sessionID: string, chatId: number = 0, telegramUser: any = {}): Promise<any> {

        let sessionAlreadySaved: boolean = false;

        let session: any = await this.getUserSessionBySessionId(sessionID);

        if (session) {
            sessionAlreadySaved = true;
        }

        //console.log("::::::::: INITIALIZE SESSION OBJECT ::::: getUserSessionBySessionId ::::  000", session);

        if (!session) {

            session = await this.getUserSessionByChatId(chatId);

            if (session) {
                sessionAlreadySaved = true;
            }

            //console.log("::::::::: INITIALIZE SESSION OBJECT ::::: getUserSessionByChatId ::::  111", session);

        }

        if (!session) {

            session = await this.getCookieSessionObject(chatId, sessionID, telegramUser);

            //console.log("::::::::: INITIALIZE SESSION OBJECT ::::: getCookieSessionObject ::::  222", session);

        }

        if (!sessionAlreadySaved) {

            await this.sessionStore.create(session);

        }

        let newSession = await this.getUserSessionBySessionId(sessionID);

        console.log("::::::::: INITIALIZE SESSION OBJECT ::::: newSession ::::  444", newSession);

        logger.warn(JSON.stringify(newSession));

        return newSession;

    }

    /**
     * Validates and retrieves a session by session ID.
     * @param sessionID - The session ID to validate.
     * @param chatId - Optional Telegram chat ID for new session creation.
     * @returns A promise that resolves with the session validation result.
     */
    async validateSession(sessionID: string, chatId: number = 0): Promise<any> {

        // Retrieve session data from the session store
        let sessionData: any = await this.getSession(sessionID);

        // If no session data exists, initialize an empty session and store it
        if (!sessionData) {

            sessionData = this.initializeSessionObject(sessionID, chatId);

            await this.sessionStore.set(sessionID, sessionData);

        }

        if (!sessionData) {

            return;

        }

        return { session: sessionData.session, sessionData: sessionData, sessionID: sessionData.sessionID, chatId: sessionData.chatId };

    }

    /**
     * Validates and retrieves a session by chat ID.
     * @param chatId - The Telegram chat ID to validate.
     * @returns A promise that resolves with the session validation result.
     */
    async validateSessionWithChatId(chatId: number): Promise<any> {

        const sessionID: string = uuidv4();

        // Retrieve session data from the session store
        let sessionData: any = await this.getUserSessionByChatId(chatId);

        // If no session data exists, initialize an empty session and store it
        if (!sessionData) {
            sessionData = this.initializeSessionObject(sessionID, chatId);
            await this.sessionStore.set(sessionID, sessionData);
        }

        return { sessionData: sessionData.session, data: sessionData, sessionID: sessionID };

    }

    /**
    * Creates a new session for a given chat ID and Telegram user data.
    * @param chatId - The Telegram chat ID for the new session.
    * @param telegramUser - The Telegram user data to associate with the session.
    * @returns A promise that resolves when the session is created.
    */
    async createSession(chatId: number, telegramUser: any): Promise<void> {

        const sessionID: string = uuidv4();

        return this.initializeSessionObject(sessionID, chatId, telegramUser);

    }

    /**
    * Update the session data.
    * @param sessionID - 
    * @param maxAge - 
    * @returns A promise that resolves when the session is created.
    */
    async updateSessionMaxAge(sessionID: string, maxAge: number | string): Promise<void> {

        await this.sessionStore.set(sessionID, "maxAge", maxAge);

    }

    /**
    * Update the session data.
    * @param sessionID - 
    * @param maxAge - 
    * @returns A promise that resolves when the session is created.
    */
    async updateSessionEncId(sessionID: string, encid: number | string): Promise<void> {

        await this.sessionStore.set(sessionID, "session.encid", encid);

    }

    /**
     * Updates a session with new key-value data.
     * @param req - The HTTP request object.
     * @param _ - Unused parameter (placeholder).
     * @param key - The key to update in the session.
     * @param value - The value to set for the key.
     * @returns A promise that resolves when the update is complete.
     */
    async updateSession(req: any, _: any, key: string, value: any): Promise<void> {

        const sessionID: string = req.sessionID;

        if (sessionID) {

            try {

                const { session } = await this.validateSession(sessionID);

                if (session) {

                    session[key] = value;

                    req.session = session;

                    await this.sessionStore.set(sessionID, key, value);

                    return session;

                }

            } catch (error) {

                console.log("::::::::: UPDATE_SESSION_ERROR ::::: updateSession :::: 00001 :::::::::", req.session, req.sessionID, error);

            }

        }



    }

    /**
    * Updates a session identified by chat ID with new session data.
    * @param chatId - The Telegram chat ID of the session to update.
    * @param session - The new session data to merge.
    * @returns A promise that resolves with the updated session data.
    */
    async updateSessionWithChatId(chatId: number, session: any): Promise<ISession | undefined> {

        const sessionData = await this.getUserSessionByChatId(chatId);

        if (!sessionData) {
            return;
        };

        const sessionID = sessionData.session.sessionID || sessionData.sessionID;

        return await this.doUpdateSessionWithSessionId(sessionID, session);

    }

    /**
     * Updates a session identified by session ID with new session data.
     * @param sessionID - The session ID of the session to update.
     * @param session - The new session data to merge.
     * @returns A promise that resolves with the updated session data.
     */
    async updateSessionWithSessionId(sessionID: string, session: any): Promise<ISession | undefined> {

        const sessionData = await this.getUserSessionBySessionId(sessionID);

        if (!sessionData) {
            return;
        };

        return await this.doUpdateSessionWithSessionId(sessionID, session);

    }

    /**
        * Performs the actual session update by session ID.
        * @param sessionID - The session ID to update.
        * @param sessionData - The new session data.
        * @returns A promise that resolves with the updated session data.
        */
    private async doUpdateSessionWithSessionId(sessionID: string, sessionData: any): Promise<any> {

        if (sessionData && sessionID) {

            await this.sessionStore.set(sessionID, "session", sessionData);

            const sessionDataUpdated: any = await this.getUserSessionBySessionId(sessionID);

            logger.info(JSON.stringify(sessionDataUpdated))

            return sessionDataUpdated.session;

        }

    }

    /**
     * Retrieves a user session by session ID.
     * @param sessionID - The session ID to search for.
     * @returns A promise that resolves with the session data or null if not found.
     */
    async getUserSessionBySessionId(sessionID: string): Promise<ISession | undefined> {
        return await this.sessionStore.getWithParams([
            { field: "_id", operator: "eq", value: sessionID },
            { field: "sessionID", operator: "eq", value: sessionID },
            { field: "session.sessionID", operator: "eq", value: sessionID },
        ]);
    }

    /**
     * Retrieves a user session by Telegram chat ID.
     * @param chatId - The Telegram chat ID to search for.
     * @returns A promise that resolves with the session data or null if not found.
     */
    async getUserSessionByChatId(chatId: number): Promise<ISession | undefined> {
        return await this.sessionStore.getWithParams([
            { field: "session.chatId", operator: "eq", value: chatId }
        ]);
    }

    /**
     * Retrieves a user session by encrypted user agent.
     * @param encid - The encrypted user agent string to search for.
     * @returns A promise that resolves with the session data or null if not found.
     */
    async getUserSessionByEncID(encua: string): Promise<ISession | undefined> {
        return await this.sessionStore.getWithParams([
            { field: "session.encid", operator: "eq", value: encua }
        ]);
    }

    /**
     * Retrieves a user session by encrypted user agent.
     * @param encua - The encrypted user agent string to search for.
     * @returns A promise that resolves with the session data or null if not found.
     */
    async getUserSessionByEncUA(encua: string): Promise<ISession | undefined> {
        return await this.sessionStore.getWithParams([
            { field: "session.encua", operator: "eq", value: encua }
        ]);
    }

    /**
     * Retrieves session data by session ID.
     * @param sessionID - The session ID to retrieve.
     * @returns A promise that resolves with the session data or null if not found.
     */
    async getSession(sessionID: string): Promise<ISession | undefined> {
        return await this.sessionStore.getWithParams([
            { field: "session.sessionID", operator: "eq", value: sessionID }
        ]);
    }

    /**
     * Retrieves session data by session ID.
     * @param sessionID - The session ID to retrieve.
     * @returns A promise that resolves with the session data or null if not found.
     */
    async setSession(sessionID: string, sessionData: any): Promise<ISession | undefined> {
        await this.sessionStore.setSessionRecord(sessionID, sessionData);
        return await this.getSession(sessionID);
    }

    /**
     * Cleans up inactive sessions that have exceeded the timeout period.
     * @returns A promise that resolves when cleanup is complete.
     */
    async cleanupInactiveSessions(): Promise<void> {

        const now = Date.now();

        const sessions: Array<ISession | any> = await this.sessionStore.getAllSessions(); //TODO : toArray()

        for (const session of sessions) {
            if (now - (session.timestamp || 0) > 30 * 60 * 1000) {
                await this.sessionStore.destroy(session.session.sessionID);
            }
        }

    }

    /**
     * Deletes a session by session ID.
     * @param sessionID - The session ID to delete.
     * @returns A promise that resolves when the session is deleted.
     */
    async deleteSession(sessionID: string): Promise<void> {

        await this.sessionStore.destroy(sessionID);
    }

}

export { ISession, IBotAccounts, ITelegramAccount }