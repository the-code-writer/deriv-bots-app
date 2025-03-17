import { Express, Router } from 'express';

/**
 * RouterGenerator class is responsible for attaching routers to the Express app.
 * It is a clean, reusable function that configures the app directly.
 */
export class RouterGenerator {
    private app: Express;

    /**
     * Constructor for the RouterGenerator class.
     * @param {Express} app - The Express app instance.
     */
    constructor(app: Express) {
        this.app = app; // Initialize the Express app
    }

    /**
     * Attaches a router to the app at the specified base path.
     * @param {string} basePath - The base path for the router.
     * @param {Router} router - The router to attach.
     */
    public attachRouter(basePath: string, router: Router): void {
        this.app.use(basePath, router); // Attach the router to the app
    }

    /**
 * Extracts and returns a list of all registered routes in the Express app.
 * @param {Express} app - The Express app instance.
 * @returns {Array<{ method: string, path: string }>} - An array of objects containing the HTTP method and path of each route.
 */
    public getRegisteredRoutes(): Array<{ method: string; path: string }> {
        const routes: Array<{ method: string; path: string }> = [];

        // Helper function to recursively extract routes from a router
        const extractRoutes = (layer: any, basePath: string = '') => {
            if (layer.route) {
                // This is a route layer
                const route = layer.route;
                const methods = Object.keys(route.methods).filter((method) => route.methods[method]);
                methods.forEach((method) => {
                    routes.push({
                        method: method.toUpperCase(),
                        path: basePath + route.path,
                    });
                });
            } else if (layer.name === 'router' && layer.handle.stack) {
                // This is a router layer (sub-router)
                const routerPath = basePath + (layer.regexp.source.replace('\\/?(?=\\/|$)', '') || '');
                layer.handle.stack.forEach((sublayer: any) => {
                    extractRoutes(sublayer, routerPath);
                });
            }
        };

        // Iterate through the app's middleware stack
        this.app._router.stack.forEach((layer: any) => {
            extractRoutes(layer);
        });

        return routes;
    }
}
