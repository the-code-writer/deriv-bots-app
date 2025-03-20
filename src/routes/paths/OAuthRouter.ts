import express, { Request, Response, Router } from 'express';
import { env } from '@/common/utils/envConfig';
import { MongoDBConnection } from '@/classes/databases/mongodb/MongoDBClass';
import { SessionManagerStorageClass } from '@/classes/sessions/SessionManagerStorageClass';
import { SessionService } from '@/classes/sessions/SessionService';

const { DERIV_APP_OAUTH_URL, DB_SERVER_SESSIONS_DATABASE_COLLECTION, DB_SERVER_SESSIONS_DATABASE_TTL } = env;

/**
 * Interface for the data object passed to EJS templates.
 */
export interface TemplateData {
    title?: string;
    nonce: string;
    derivLoginURL?: string;
    params?: { session: any };
    accounts?: any;
    encid?: string;
    encusername?: string;
}

/**
 * Interface for the organized account data extracted from query parameters.
 */
export interface OrganizedAccountData {
    [index: string]: {
        acct?: string | any;
        token?: string | any;
        cur?: string | any;
    };
}

/**
 * OAuthRouter class is responsible for generating and configuring the OAuth router.
 */
export class OAuthRouter {
    private app;
    private router: Router;
    private db: MongoDBConnection;
    private sessionService: SessionService;

    /**
     * Constructor for the OAuthRouter class.
     * Initializes the router, database connection, and session service.
     */
    constructor(app: any) {
        this.app = app;
        this.router = express.Router(); // Create a new Express router
    }

    /**
     * Configures and returns the OAuth router.
     * @returns {Router} - Configured OAuth router.
     */
    public getRouter(): Router {

        // Define routes
        this.defineRoutes();

        return this.router; // Return the configured router
    }

    /**
     * Defines all routes for the OAuth router.
     */
    private defineRoutes(): void {

        const sessionManager = this.app.get("sessionManager");

        this.router.get('/set-session', async (req, res) => {

            await sessionManager.updateSession(req, res, "flight", {
                ticket: 600.25
            });

            await sessionManager.updateSession(req, res, "color", "yellow");

            await sessionManager.updateSession(req, res, "wheels", {
                front: "17''", left: 5436, back: { a: "1", b: "2", c: "3" }, right: true,
            });

            console.log(":: URL :: /set-session ::", req.session)

            res.send(`SESSION DATA : ${JSON.stringify(req.session)}`);

        });

        this.router.get('/get-session', (req, res) => {
            console.log(":: URL :: /get-session ::", req.session)
            res.send(`SESSION DATA : ${JSON.stringify(req.session)}`);
        });

        this.router.get('/del-session', async (req, res) => {
            await sessionManager.destroySession(req, res);
            console.log(":: URL :: /del-session ::", req.session)
            res.send(`SESSION DATA : ${JSON.stringify(req.session)}`);
        });

        /**
         * Route: GET /
         * Renders the index page with a nonce and Deriv OAuth URL.
         */
        this.router.get('/', async (req: Request, res: Response) => {

            console.log('Session ID:', req.sessionID);
            console.log('Session Data:', req.session);

            const data: TemplateData = {
                title: 'Deriv Trading Bot',
                nonce: res.locals.nonce, // Nonce for CSP
                derivLoginURL: DERIV_APP_OAUTH_URL, // Deriv OAuth URL from environment
            };

            // Render the index EJS template with the data
            res.render('index', { data });
        });

        /**
         * Route: GET /deriv-oauth
         * Handles the Deriv OAuth flow and stores session data.
         */
        this.router.get('/login', async (req: Request, res: Response) => {

            const { encid, encuser } = req.query; // Extract query parameters
            // @ts-ignore
            req.session.encid = encid;
            // @ts-ignore
            req.session.encuser = encuser;
            await sessionManager.updateSession(req, res, "encid", encid);
            await sessionManager.updateSession(req, res, "encuser", encuser);

            const data: TemplateData = {
                title: 'Deriv Login',
                nonce: res.locals.nonce, // Nonce for CSP
                derivLoginURL: DERIV_APP_OAUTH_URL, // Deriv OAuth URL from environment
                params: { session: req.session }, // Pass session data to the template
            };

            // Render the deriv-oauth-template EJS template with the data
            res.render('deriv-oauth-template', { data });

        });

        /**
         * Route: GET /deriv-callback
         * Handles the Deriv OAuth callback, organizes account data, and interacts with the bot.
         */
        // @ts-ignore
        this.router.get('/callback', async (req: Request, res: Response) => {

            const queryParams = req.query; // Extract all query parameters

            console.log('req.cookies:', req.cookies.sessionID);
            console.log('req.session:', req.session);
            console.log('Session ID:', req.sessionID);

            const sessionID = req.cookies.sessionID;

            if (!sessionID) {

                console.error('Missing cookie data:', req.session);

            }

            const session = await this.db.getItem(DB_SERVER_SESSIONS_DATABASE_COLLECTION, [{ field: 'sessionID', operator: 'eq', value: sessionID }]);

            // @ts-ignore
            if (!req.session.encid || !req.session.encuser) {
                console.error('Missing session data:', req.session);
                return res.status(400).send('Session data is missing');
            }

            const organizedData: OrganizedAccountData = {}; // Initialize an object to organize account data

            // Iterate over query parameters to organize account data
            for (const key in queryParams) {
                if (key.startsWith('acct') || key.startsWith('token') || key.startsWith('cur')) {
                    // Extract the index from the key (e.g., 'acct1' -> '1')
                    // @ts-ignore
                    const index = key.match(/\d+/)[0];

                    // Initialize the object for this index if it doesn't exist
                    if (!organizedData[index]) {
                        organizedData[index] = {};
                    }

                    // Add the value to the corresponding property
                    if (key.startsWith('acct')) {
                        organizedData[index].acct = queryParams[key];
                    } else if (key.startsWith('token')) {
                        organizedData[index].token = queryParams[key];
                    } else if (key.startsWith('cur')) {
                        organizedData[index].cur = queryParams[key];
                    }
                }
            }

            // Get the bot instance from the app
            const bot = req.app.get('bot');

            // Check if the bot is initialized
            if (!bot) {
                return res.status(500).send('<h2>Telegram bot is not initialized</h2>');
            }

            const data: TemplateData = {
                nonce: res.locals.nonce, // Nonce for CSP
                accounts: organizedData, // Organized account data
                encid: session.encid, // Encrypted ID from the session
                encusername: session.encusername, // Encrypted username from the session
            };

            // Notify the bot that the user has logged in
            bot.loggedIn(data);

            // Send a success response
            res.status(200).send('<h2>User logged in successfully</h2>');

            // Render the deriv-callback-template EJS template with the data
            res.render('deriv-callback-template', { data });
        });
    }
}
