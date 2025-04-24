import express, { Request, Response, Router } from 'express';
import { env } from '@/common/utils/envConfig';
import { ISessionService } from '@/classes/sessions/SessionService';
import { getDerivAccountFromURLParams, getEncryptedUserAgent, serializeCookieOptions } from '../../common/utils/snippets';
import TemplateRenderer from '@/classes/templates/TemplateRenderer';


const cookieParser = require('cookie-parser');
const { DERIV_APP_OAUTH_URL, DERIV_APP_OAUTH_CALLBACK_URL, DERIV_APP_TG_URL, SPACE_CHARACTER } = env;

const templateRenderer = new TemplateRenderer();

/**
 * Interface for the data object passed to EJS templates.
 */
export interface TemplateData {
    title?: string;
    nonce: string;
    derivLoginURL?: string;
    derivCallbackURL?: string;
    telegramBotURL?: string;
    session?: any;
    sessionId?: any;
    accounts?: any;
    encid?: any;
    response?: any;
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

            let sessionDocument = null;
            let sessionID = null;

            console.log("### 1. ROUTER ### encid ###", encid);

            console.log("### 2. ROUTER ### sessionDocument ###", sessionDocument);

            if (encid) {

                res.set('X-Session-Token', String(encid));

                sessionDocument = await this.sessionService.getUserSessionByEncID(String(encid))

                if (sessionDocument) {

                    sessionID = sessionDocument.sessionID;

                    console.log("### 3. ROUTER ### sessionID, sessionDocument ###", sessionID, sessionDocument);

                    const { encuaKey, encuaData } = getEncryptedUserAgent(req.get('User-Agent'));

                    console.log("### 4. ROUTER ### encuaKey, encuaData ###", encuaKey, encuaData);

                    sessionDocument.session.encua = encuaKey;
                    sessionDocument.session.encuaData = encuaData;

                    await this.sessionService.setSession(sessionDocument.sessionID, sessionDocument);

                    this.sessionService.attachSessionToRequest(req, res, sessionID, sessionDocument);

                }

            }

            templateRenderer.render200(req, res, {
                template: 'deriv-oauth-login',
                nonce: res.locals.nonce || '',
                session: {},
                status: 200,
                pageTitle: 'Redirecting',
                pageDescription: 'If the page doesnt refresh in 1 minute navigate manually to deriv.com',
                pageButtonText: 'Login via Deriv.com',
                pageButtonURL: DERIV_APP_OAUTH_URL,
                meta: {
                    oops: SPACE_CHARACTER,
                    headingClass: "login empty",
                    encid: encid,
                    derivLoginURL: DERIV_APP_OAUTH_URL,
                }
            });

        });



        /**
         * Route: GET /deriv-oauth
         * Handles the Deriv OAuth flow and stores session data.
         */
        this.router.get('/callback-init', async (req: Request, res: Response) => {

            templateRenderer.render200(req, res, {
                template: 'deriv-oauth-callback-0',
                nonce: res.locals.nonce || '',
                session: {},
                status: 200,
                pageTitle: 'Redirecting',
                meta: {
                    derivCallbackURL: DERIV_APP_OAUTH_CALLBACK_URL,
                }
            });

        });

        /**
         * Route: GET /deriv-callback
         * Handles the Deriv OAuth callback, organizes account data, and interacts with the bot.
         */
        // @ts-ignore
        this.router.get('/callback', async (req: Request, res: Response) => {

            const queryParams: any = req.query;

            const { encid, sessionID, sessionDocument } = await this.sessionService.getSessionFromCookieQueryParams(req, res);

            const organizedData: OrganizedAccountData = getDerivAccountFromURLParams(queryParams);

            // @ts-ignore
            sessionDocument.session.bot.accounts.deriv.accountList = organizedData;

            // Get the bot instance from the app
            const bot = req.app.get('bot');

            // Check if the bot is initialized
            if (!bot) {

                templateRenderer.render500(req, res, {
                    template: 'deriv-oauth-login',
                    nonce: res.locals.nonce || '',
                    session: {},
                    status: 500,
                    pageTitle: 'Authentication Error',
                    pageDescription: 'Telegram Boit has not been initialized',
                    pageButtonText: 'Contact Support',
                    pageButtonURL: DERIV_APP_OAUTH_URL,
                    meta: {
                        oops: SPACE_CHARACTER,
                        headingClass: "login",
                        encid: encid
                    }
                });

            } else {

                // Notify the bot that the user has logged in
                bot.authorizeOauthData(sessionDocument);

                templateRenderer.render200(req, res, {
                    template: 'deriv-oauth-callback-1',
                    nonce: res.locals.nonce || '',
                    session: {},
                    status: 200,
                    pageTitle: 'Authenticated!',
                    pageDescription: 'You have logged in successfully, now you can continue trading using Telegram. Click the button below to continue.',
                    pageButtonText: 'Open Telegram',
                    pageButtonURL: DERIV_APP_TG_URL,
                    meta: {
                        oops: SPACE_CHARACTER,
                        headingClass: "login empty",
                        encid: encid,
                    }
                });

            }

        });

    }

}
