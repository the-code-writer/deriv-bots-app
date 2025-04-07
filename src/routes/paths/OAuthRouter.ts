import express, { Request, Response, Router } from 'express';
import { env } from '@/common/utils/envConfig';
import { ISessionService } from '@/classes/sessions/SessionService';
import { getDerivAccountFromURLParams, getEncryptedUserAgent, serializeCookieOptions } from '../../common/utils/snippets';
const cookieParser = require('cookie-parser');
const { DERIV_APP_OAUTH_LOGIN_URL, DERIV_APP_OAUTH_CALLBACK_URL } = env;

/**
 * Interface for the data object passed to EJS templates.
 */
export interface TemplateData {
    title?: string;
    nonce: string;
    derivLoginURL?: string;
    derivCallbackURL?: string;
    session?: any;
    accounts?: any;
    encid?: any;
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
    private router: Router;
    private sessionService: ISessionService;

    /**
     * Constructor for the OAuthRouter class.
     * Initializes the router, database connection, and session service.
     */
    constructor(sessionService: ISessionService) {
        this.sessionService = sessionService;
        this.router = express.Router(); // Create a new Express router
        this.router.use(cookieParser());
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
                derivLoginURL: DERIV_APP_OAUTH_LOGIN_URL, // Deriv OAuth URL from environment
            };

            // Render the index EJS template with the data
            res.render('index', { data });
        });



        /**
         * Route: GET /deriv-oauth
         * Handles the Deriv OAuth flow and stores session data.
         */
        this.router.get('/login', async (req: Request, res: Response) => {

            const { encid } = req.query; // Extract query parameters

            let sessionData = null;
            let sessionID = null;

            console.log("### 1. ROUTER ### encid ###", encid);

            console.log("### 2. ROUTER ### sessionData ###", sessionData);

            if (encid) {

                res.set('X-Session-Token', String(encid));

                sessionData = await this.sessionService.getUserSessionByEncID(String(encid))

                if (!sessionData) {

                    return res.status(400).send('Session data is missing');

                } else {

                    sessionID = sessionData.sessionID;

                    console.log("### 3. ROUTER ### sessionID, sessionData ###", sessionID, sessionData);

                    const { encuaKey, encuaData } = getEncryptedUserAgent(req.get('User-Agent'));

                    console.log("### 4. ROUTER ### encuaKey, encuaData ###", encuaKey, encuaData);

                    sessionData.session.encua = encuaKey;
                    sessionData.session.encuaData = encuaData;

                    await this.sessionService.setSession(sessionData.sessionID, sessionData);

                    this.sessionService.attachSessionToRequest(req, res, sessionID, sessionData);

                }

            }

            const data: TemplateData = {
                title: 'Deriv Login',
                nonce: res.locals.nonce, // Nonce for CSP
                encid: String(encid),
                derivLoginURL: DERIV_APP_OAUTH_LOGIN_URL, // Deriv OAuth URL from environment
                session: sessionData
            };

            // Render the deriv-oauth-template EJS template with the data
            res.render('deriv-oauth-login', { data });

        });



        /**
         * Route: GET /deriv-oauth
         * Handles the Deriv OAuth flow and stores session data.
         */
        this.router.get('/callback-init', async (req: Request, res: Response) => {

            const data: TemplateData = {
                title: 'Authenticating...',
                nonce: res.locals.nonce,
                encid: "",
                derivCallbackURL: DERIV_APP_OAUTH_CALLBACK_URL,
                session: {}
            };

            // Render the deriv-oauth-template EJS template with the data
            res.render('deriv-oauth-callback-0', { data });

        });

        /**
         * Route: GET /deriv-callback
         * Handles the Deriv OAuth callback, organizes account data, and interacts with the bot.
         */
        // @ts-ignore
        this.router.get('/callback', async (req: Request, res: Response) => {

            const queryParams = req.query; // Extract all query parameters

            if (queryParams && typeof queryParams !== undefined && ("id" in queryParams)) {

                const encid = queryParams.id;

                const sessionData = await this.sessionService.getUserSessionByEncID(String(encid));

                if(!sessionData){

                    console.error('Missing session data:', sessionData);
                    return res.status(400).send('Session data is missing');

                }
                
                const sessionID = sessionData.sessionID;

                if (!sessionID && !sessionData) {

                    console.error('Missing session data:', sessionData);
                    return res.status(400).send('Session data is missing');

                }

                const organizedData: OrganizedAccountData = getDerivAccountFromURLParams(queryParams);

                // @ts-ignore
                sessionData.session.bot.accounts.deriv.accountList = organizedData;

                // Get the bot instance from the app
                const bot = req.app.get('bot');

                // Check if the bot is initialized
                if (!bot) {

                    return res.status(500).send('<h2>Telegram bot is not initialized</h2>');

                }

                // Notify the bot that the user has logged in
                bot.authorizeOauthData(sessionData);

                const data: TemplateData = {
                    title: 'Authenticated!',
                    nonce: res.locals.nonce,
                    encid: encid,
                    derivCallbackURL: DERIV_APP_OAUTH_CALLBACK_URL,
                    session: sessionData
                };
    
                // Render the deriv-oauth-template EJS template with the data
                res.render('deriv-oauth-callback-1', { data });
    
            } else {

                return res.status(500).send('<h2>Session not initialized or missing id</h2>');

            }

        });

    }

}
