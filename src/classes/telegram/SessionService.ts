import { pino } from "pino";
import { env } from "@/common/utils/envConfig";
import { MongoDBConnection } from '@/classes/databases/mongodb/MongoDBClass';
import session from "express-session";
import { calculateExpiry } from "@/common/utils/snippets";
const MongoDBStore = require('connect-mongodb-session')(session);
const MongoStore = require('connect-mongo');
// Logger
const logger = pino({ name: "SessionService" });

// Environment variables
const { DERIV_APP_OAUTH_URL, APP_CRYPTOGRAPHIC_KEY, MONGODB_DATABASE_NAME, DB_SERVER_SESSIONS_DATABASE_COLLECTION, DB_TG_BOT_SESSIONS_DATABASE_COLLECTION, DB_SERVER_SESSIONS_DATABASE_TTL, MONGODB_CONNECTION_STRING } = env;

/**
 * Interface representing a user session
 */
export interface Session {
    chatId: number;
    username?: any;
    step: string;
    currentInput?: string;
    tradingType?: string;
    market?: string;
    purchaseType?: string;
    stake?: number;
    takeProfit?: number;
    stopLoss?: number;
    tradeDuration?: string;
    updateFrequency?: string;
    timestamp?: number;
    [key: string]: any;
}


/**
 * Interface for session service
 */
export interface ISessionService {
    initializeSession(chatId: number): void;
    getSessionMiddleware(sessionId:string): any;
    updateSession(chatId: number, session: Session): Promise<void>;
    cleanupInactiveSessions(): Promise<void>;
    getSession(chatId: number): Promise<Session | null>;
}


/**
 * Session service
 */
export class SessionService implements ISessionService {
    private db: MongoDBConnection;

    constructor(db: MongoDBConnection) {
        this.db = db;
        logger.info("Session Service started!");
    }

    async initializeSession(chatId: number): Promise<void> {
        const session: Session = { chatId, step: "login_account", timestamp: Date.now() };
        await this.updateSession(chatId, session);
    }

    getSessionMiddleware(): any {

        const sessionStoragex = new MongoDBStore({
            uri: MONGODB_CONNECTION_STRING,
            databaseName: MONGODB_DATABASE_NAME,
            collection: DB_SERVER_SESSIONS_DATABASE_COLLECTION,
        });

        const sessionStorage = MongoStore.create({
            mongoUrl: `${MONGODB_CONNECTION_STRING}${MONGODB_DATABASE_NAME}`, // MongoDB connection URL
            collectionName: DB_SERVER_SESSIONS_DATABASE_COLLECTION, // Collection to store sessions in MongoDB
            ttl: 14 * 24 * 60 * 60, // Session TTL (time to live) in seconds (14 days)
        });

        const sessionMiddleware: any = {
            name: DB_SERVER_SESSIONS_DATABASE_COLLECTION,
            secret: APP_CRYPTOGRAPHIC_KEY,
            resave: false,
            saveUninitialized: true,
            cookie: this.generateCookieParams(),
            store: sessionStorage
        };

        return session(sessionMiddleware);

    }

    generateCookieParams(): any {

        const expiryTime: number = calculateExpiry("1 week");

        return {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "strict",
            originalMaxAge: expiryTime || DB_SERVER_SESSIONS_DATABASE_TTL,
            maxAge: expiryTime || DB_SERVER_SESSIONS_DATABASE_TTL,
            expires: expiryTime || DB_SERVER_SESSIONS_DATABASE_TTL,
            path: "/",
            domain: null,
            priority: null,
            partitioned: null,
        }

    }

    generateCookieSessionID(encid: any): any {

        const cookieSessionId = encid; // Generate a unique session ID

        return { cookieSessionId, cookieParams: this.generateCookieParams() }

    }

    async updateSession(chatId: number, session: Session): Promise<void> {
        await this.db.updateItems(DB_TG_BOT_SESSIONS_DATABASE_COLLECTION, [{ field: 'chatId', operator: 'eq', value: chatId }], { $set: session });
    }

    async cleanupInactiveSessions(): Promise<void> {
        const now = Date.now();
        const sessions = await this.db.getAllItems(DB_TG_BOT_SESSIONS_DATABASE_COLLECTION, []); //TODO : toArray()

        for (const session of sessions) {
            if (now - (session.timestamp || 0) > 30 * 60 * 1000) {
                await this.db.deleteItem(DB_TG_BOT_SESSIONS_DATABASE_COLLECTION, [{ field: 'chatId', operator: 'eq', value: session.chatId }]);
            }
        }
    }

    async deleteSession(chatId: number): Promise<void> {
        await this.db.deleteItem(DB_TG_BOT_SESSIONS_DATABASE_COLLECTION, [{ field: 'chatId', operator: 'eq', value: chatId }]);
    }

    async getSession(chatId: number): Promise<Session | null> {
        return await this.db.getItem(DB_TG_BOT_SESSIONS_DATABASE_COLLECTION, [{ field: 'chatId', operator: 'eq', value: chatId }]);
    }
}
