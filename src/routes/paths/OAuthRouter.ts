import express, { Request, Response, Router } from 'express';
import { env } from '@/common/utils/envConfig';
import session from 'express-session';
import { SessionService } from '@/classes/telegram/SessionService';
import { MongoDBConnection } from '@/classes/databases/mongodb/MongoDBClass';

const { DERIV_APP_OAUTH_URL } = env;

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
    constructor(app:any) {
        this.app = app;
        this.router = express.Router(); // Create a new Express router
        this.db = new MongoDBConnection(); // Initialize MongoDB connection
        this.sessionService = new SessionService(this.db); // Initialize session service
    }

    /**
     * Configures and returns the OAuth router.
     * @returns {Router} - Configured OAuth router.
     */
    public getRouter(): Router {
        // Get session middleware from the session service
        const sessionMiddleware = this.sessionService.getSessionMiddleware();

        // Configure the session object using express-session
        const sessionObject: any = session(sessionMiddleware);

        // Apply the session middleware to the OAuth router
        this.router.use(sessionObject);

        // Define routes
        this.defineRoutes();

        return this.router; // Return the configured router
    }

    /**
     * Defines all routes for the OAuth router.
     */
    private defineRoutes(): void {
        /**
         * Route: GET /
         * Renders the index page with a nonce and Deriv OAuth URL.
         */
        this.router.get('/', async (_: Request, res: Response) => {
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

            // Store encid and encuser in the session
            // @ts-ignore
            req.session.encid = encid;
            // @ts-ignore
            req.session.encuser = encuser;

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
            // @ts-ignore
            const session: any = req.session; // Extract session data

            console.log('OAUTH_ROUTER_SESSION::queryParams::', queryParams);
            console.log('OAUTH_ROUTER_SESSION::session::', session);

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
