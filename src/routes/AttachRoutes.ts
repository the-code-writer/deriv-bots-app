import { Express } from 'express';
import { RouterGenerator } from "@/routes/RouterGenerator";
import { OAuthRouter } from "@/routes/paths/OAuthRouter";
import { ISessionService } from "@/classes/sessions/SessionService";


/**
 * AttachRoutes class is responsible for initializing and attaching all routes to the Express app.
 * It encapsulates the setup logic for routers, making it easier to manage and extend.
 */
export class AttachRoutes {

    private routerGenerator;

    private app;

    private sessionService: ISessionService;

    /**
     * Constructor for the AttachRoutes class.
     * @param {Express} app - The Express app instance.
     */
    constructor(app: Express, sessionService:ISessionService) {
        
        this.app = app;

        this.sessionService = sessionService;

        // Initialize the RouterGenerator with the app
        this.routerGenerator = new RouterGenerator(this.app);

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
        const oauthRouter = new OAuthRouter(this.sessionService);

        // Get the configured OAuth router
        const oauthRouterInstance = oauthRouter.getRouter();

        // Attach the OAuth router to the app using RouterGenerator
        this.routerGenerator.attachRouter('/oauth', oauthRouterInstance);

        const routes = this.routerGenerator.getRegisteredRoutes();

        console.log("ROUTES", routes);

    }

}
