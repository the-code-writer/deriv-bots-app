import express, { Express } from 'express';
import RouterGenerator from '@/classes/RouterGenerator';
import OAuthRouter from '@/classes/OAuthRouter';

/**
 * AttachRoutes class is responsible for initializing and attaching all routes to the Express app.
 * It encapsulates the setup logic for routers, making it easier to manage and extend.
 */
class AttachRoutes {

    private routerGenerator;

    /**
     * Constructor for the AttachRoutes class.
     * @param {Express} app - The Express app instance.
     */
    constructor(app: Express) {
        
        // Initialize the RouterGenerator with the app
        this.routerGenerator = new RouterGenerator(app);

    }

    /**
     * Initializes and attaches all routes to the Express app.
     */
    public initializeRoutes(): void {

        this.initializeOAuthRouter();

        console.log('All routes have been attached successfully.');
        
    }

    /**
     * Initializes and attaches all routes to the Express app.
     */
    public initializeOAuthRouter(): void {

        // Initialize the OAuthRouter
        const oauthRouter = new OAuthRouter();

        // Get the configured OAuth router
        const oauthRouterInstance = oauthRouter.getRouter();

        // Attach the OAuth router to the app using RouterGenerator
        this.routerGenerator.attachRouter('/oauth', oauthRouterInstance);

    }

}

export default AttachRoutes;