import express, { Request, Response, Router } from 'express';
import { env } from '@/common/utils/envConfig';
import {  ISessionService } from '@/classes/sessions/SessionService';
import { getDerivAccountFromURLParams, getEncryptedUserAgent } from '../../common/utils/snippets';

const { DERIV_APP_OAUTH_URL, DEVICE_AGENT } = env;

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

        this.router.get('/set-session', async (req, res) => {

            await this.sessionService.updateSession(req, res, "flight", {
                ticket: 600.25
            });

            await this.sessionService.updateSession(req, res, "color", "yellow");

            await this.sessionService.updateSession(req, res, "wheels", {
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
            await this.sessionService.destroySession(req, res);
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

            const { encid } = req.query; // Extract query parameters

            console.log("### ROUTER ### encid ###", encid);

            console.log("### ROUTER ### req.session ###", req.session);

            if (!req.session) {
                
                req.session = {
                    id: '',
                    cookie: req.session?.cookie || {},
                    regenerate: req.session?.regenerate || (() => Promise.resolve()),
                    destroy: req.session?.destroy || (() => Promise.resolve()),
                    reload: req.session?.reload || (() => Promise.resolve()),
                    save: req.session?.save || (() => Promise.resolve()),
                    touch: req.session?.touch || (() => {}),
                };

            }

            // @ts-ignore
            req.session.encid = encid.replace(" ", "+");

            await this.sessionService.updateSession(req, res, "encid", encid);

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
            let sessionID: string = null;

            // @ts-ignore
            let sessionData = req.session;

            console.error('sessionData:', sessionData);
            console.error('req.sessionID:', req.sessionID);
            console.error('req.session:', req.session);

            if (!sessionData) {
                
                const { encuaKey } = getEncryptedUserAgent(req, DEVICE_AGENT);

                const sessionDataByUA = await this.sessionService.getUserSessionByEncUA(encuaKey);

                // @ts-ignore
                if (sessionDataByUA) {

                    sessionData = sessionDataByUA;

                    // @ts-ignore
                    sessionID = sessionData.sessionID;

                } else {

                    console.error('Missing session data:', sessionData);
                    return res.status(400).send('Session data is missing');

                }

            } else {

                // @ts-ignore
                sessionID = sessionData.sessionID;

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

            // Send a success response
            res.status(200).send('<h2>User logged in successfully</h2>');

            // Render the deriv-oauth-template EJS template with the data
            //res.render('deriv-oauth-template', { data });

        });

    }
    
}
