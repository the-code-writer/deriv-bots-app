import { Request, Response } from 'express';

/**
 * Interface for SEO metadata
 */
interface SEOMetadata {
    title: string;
    description: string;
    keywords?: string;
    canonicalUrl?: string;
    robots?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogUrl?: string;
    ogType?: string;
    twitterCard?: string;
    twitterTitle?: string;
    twitterDescription?: string;
    twitterImage?: string;
    twitterSite?: string;
    twitterCreator?: string;
}

/**
 * Interface for response meta information
 */
interface ResponseMeta {
    oops?: string;
    class?: string;
    encid?: string;
    [key: string]: any; // Allow additional meta properties
}

/**
 * Interface defining the structure of template response data
 */
interface TemplateResponse {
    status: number;
    pageTitle: string;
    pageDescription: string;
    pageButtonText?: string;
    pageButtonURL?: string;
    meta?: ResponseMeta;
}

/**
 * Interface defining the complete template data structure
 */
interface TemplateData {
    template: string;
    nonce?: string;
    session?: Record<string, any>;
    response: TemplateResponse;
    seo?: SEOMetadata;
    [key: string]: any; // Allow additional properties
}

/**
 * Configuration options for error rendering
 */
interface ErrorRenderOptions {
    template?: string;
    nonce?: string;
    session?: Record<string, any>;
    status?: number;
    pageTitle?: string;
    pageDescription?: string;
    pageButtonText?: string;
    pageButtonURL?: string;
    meta?: ResponseMeta;
    seo?: Partial<SEOMetadata>;
}

/**
 * Configuration options for page rendering
 */
interface PageRenderOptions {
    template: string;
    nonce?: string;
    session?: Record<string, any>;
    status?: number;
    pageTitle?: string;
    pageDescription?: string;
    pageButtonText?: string;
    pageButtonURL?: string;
    meta?: ResponseMeta;
    seo?: Partial<SEOMetadata>;
    [key: string]: any; // Allow additional page-specific data
}

/**
 * Custom error class for template rendering errors
 */
class TemplateRenderingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TemplateRenderingError';
    }
}

/**
 * Advanced TemplateRenderer class with SEO support and error protection
 */
class TemplateRenderer {
    private defaultSEO: Partial<SEOMetadata>;
    private defaultMeta: ResponseMeta;

    /**
     * Creates an instance of TemplateRenderer
     * @param {Partial<SEOMetadata>} defaultSEO - Default SEO metadata
     * @param {ResponseMeta} defaultMeta - Default response meta
     */
    constructor(defaultSEO: Partial<SEOMetadata> = {}, defaultMeta: ResponseMeta = {}) {
        this.defaultSEO = defaultSEO;
        this.defaultMeta = defaultMeta;
    }

    /**
     * Safely renders content while preventing multiple header sends
     * @private
     * @param {Response} res - Express response object
     * @param {Function} renderFn - The render function to execute
     */
    private safeRender(res: Response, renderFn: () => void): void {
        if (res.headersSent) {
            console.warn('Headers already sent, skipping render');
            return;
        }

        try {
            renderFn();
        } catch (error) {
            if (error instanceof Error && error.message.includes('ERR_HTTP_HEADERS_SENT')) {
                console.warn('Attempted to send headers after they were already sent');
                return;
            }
            throw new TemplateRenderingError(`Rendering failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Renders a 500 Internal Server Error page
     * @param {Request} req - Express request object
     * @param {Response} res - Express response object
     * @param {ErrorRenderOptions} options - Configuration options
     */
    render200(req: Request, res: Response, options: ErrorRenderOptions = {}): void {
        const defaultOptions: ErrorRenderOptions = {
            template: 'http-ok',
            status: 200,
            pageTitle: 'Internal Server Error',
            pageDescription: 'Something went wrong on our end. Please try again later.',
            pageButtonText: 'Try Again',
            pageButtonURL: req.originalUrl,
            meta: {
                oops: 'Oops!',
                class: 'error-500',
                ...this.defaultMeta
            },
            seo: {
                title: '500 Internal Server Error',
                description: 'An unexpected error occurred',
                robots: 'noindex',
                ...this.defaultSEO
            }
        };

        this.renderError(req, res, { ...defaultOptions, ...options });
    }

    /**
     * Renders a 404 Not Found page
     * @param {Request} req - Express request object
     * @param {Response} res - Express response object
     * @param {ErrorRenderOptions} options - Configuration options
     */
    render404(req: Request, res: Response, options: ErrorRenderOptions = {}): void {
        const defaultOptions: ErrorRenderOptions = {
            template: 'error',
            status: 404,
            pageTitle: 'Page Not Found',
            pageDescription: 'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.',
            pageButtonText: 'Go to Homepage',
            pageButtonURL: '/',
            meta: {
                oops: 'Oops!',
                class: 'error-404',
                ...this.defaultMeta
            },
            seo: {
                title: '404 Not Found',
                description: 'Page not found',
                robots: 'noindex',
                ...this.defaultSEO
            }
        };

        this.renderError(req, res, { ...defaultOptions, ...options });
    }

    /**
     * Renders a 401 Unauthorized page
     * @param {Request} req - Express request object
     * @param {Response} res - Express response object
     * @param {ErrorRenderOptions} options - Configuration options
     */
    render401(req: Request, res: Response, options: ErrorRenderOptions = {}): void {
        const defaultOptions: ErrorRenderOptions = {
            template: 'error',
            status: 401,
            pageTitle: 'Unauthorized',
            pageDescription: 'You need to authenticate to access this resource.',
            pageButtonText: 'Login',
            pageButtonURL: '/login',
            meta: {
                oops: 'Access Denied!',
                class: 'error-401',
                ...this.defaultMeta
            },
            seo: {
                title: '401 Unauthorized',
                description: 'Authentication required',
                robots: 'noindex',
                ...this.defaultSEO
            }
        };

        this.renderError(req, res, { ...defaultOptions, ...options });
    }

    /**
     * Renders a 403 Forbidden page
     * @param {Request} req - Express request object
     * @param {Response} res - Express response object
     * @param {ErrorRenderOptions} options - Configuration options
     */
    render403(req: Request, res: Response, options: ErrorRenderOptions = {}): void {
        const defaultOptions: ErrorRenderOptions = {
            template: 'error',
            status: 403,
            pageTitle: 'Forbidden',
            pageDescription: 'You don\'t have permission to access this resource.',
            pageButtonText: 'Go to Homepage',
            pageButtonURL: '/',
            meta: {
                oops: 'Forbidden!',
                class: 'error-403',
                ...this.defaultMeta
            },
            seo: {
                title: '403 Forbidden',
                description: 'Access to this resource is forbidden',
                robots: 'noindex',
                ...this.defaultSEO
            }
        };

        this.renderError(req, res, { ...defaultOptions, ...options });
    }

    /**
     * Renders a 500 Internal Server Error page
     * @param {Request} req - Express request object
     * @param {Response} res - Express response object
     * @param {ErrorRenderOptions} options - Configuration options
     */
    render500(req: Request, res: Response, options: ErrorRenderOptions = {}): void {
        const defaultOptions: ErrorRenderOptions = {
            template: 'error',
            status: 500,
            pageTitle: 'Internal Server Error',
            pageDescription: 'Something went wrong on our end. Please try again later.',
            pageButtonText: 'Try Again',
            pageButtonURL: req.originalUrl,
            meta: {
                oops: 'Oops!',
                class: 'error-500',
                ...this.defaultMeta
            },
            seo: {
                title: '500 Internal Server Error',
                description: 'An unexpected error occurred',
                robots: 'noindex',
                ...this.defaultSEO
            }
        };

        this.renderError(req, res, { ...defaultOptions, ...options });
    }

    /**
     * Renders an error page with customizable options
     * @param {Request} req - Express request object
     * @param {Response} res - Express response object
     * @param {ErrorRenderOptions} options - Configuration options
     */
    renderError(req: Request, res: Response, options: ErrorRenderOptions = {}): void {
        const {
            template = 'error',
            nonce = res.locals.nonce || '',
            session = {},
            status = 500,
            pageTitle = 'Error',
            pageDescription = 'An error occurred',
            pageButtonText,
            pageButtonURL,
            meta = {},
            seo = {}
        } = options;

        const data: TemplateData = {
            template,
            nonce,
            session,
            response: {
                status,
                pageTitle,
                pageDescription,
                ...(pageButtonText && { pageButtonText }),
                ...(pageButtonURL && { pageButtonURL }),
                meta: { ...this.defaultMeta, ...meta }
            },
            seo: { ...this.defaultSEO, ...seo }
        };

        this.safeRender(res, () => {
            res.status(status).render(template, data);
        });
    }

    /**
     * Renders a custom template with provided data
     * @param {Request} req - Express request object
     * @param {Response} res - Express response object
     * @param {string} template - Template name
     * @param {Partial<TemplateData>} data - Template data
     * @param {number} statusCode - HTTP status code
     */
    renderTemplate(
        req: Request,
        res: Response,
        template: string,
        data: Partial<TemplateData> = {},
        statusCode: number = 200
    ): void {
        const defaultData: TemplateData = {
            template,
            nonce: res.locals.nonce || '',
            session: {},
            response: {
                status: statusCode,
                pageTitle: '',
                pageDescription: '',
                meta: { ...this.defaultMeta }
            },
            seo: { ...this.defaultSEO }
        };

        const mergedData = { ...defaultData, ...data };

        this.safeRender(res, () => {
            res.status(statusCode).render(template, mergedData);
        });
    }

    /**
     * Renders a page with comprehensive SEO support
     * @param {Request} req - Express request object
     * @param {Response} res - Express response object
     * @param {PageRenderOptions} options - Page configuration
     */
    renderPage(req: Request, res: Response, options: PageRenderOptions): void {
        const {
            template,
            nonce = res.locals.nonce || '',
            session = {},
            status = 200,
            pageTitle = '',
            pageDescription = '',
            pageButtonText,
            pageButtonURL,
            meta = {},
            seo = {},
            ...additionalData
        } = options;

        // Auto-generate canonical URL if not provided
        const canonicalUrl = seo.canonicalUrl || `${req.protocol}://${req.get('host')}${req.path}`;

        const data: TemplateData = {
            template,
            nonce,
            session,
            response: {
                status,
                pageTitle,
                pageDescription,
                ...(pageButtonText && { pageButtonText }),
                ...(pageButtonURL && { pageButtonURL }),
                meta: { ...this.defaultMeta, ...meta }
            },
            seo: {
                title: seo.title || pageTitle,
                description: seo.description || pageDescription,
                canonicalUrl,
                robots: 'index, follow',
                ogTitle: seo.ogTitle || seo.title || pageTitle,
                ogDescription: seo.ogDescription || seo.description || pageDescription,
                ogImage: seo.ogImage || '/images/default-social.jpg',
                ogUrl: seo.ogUrl || canonicalUrl,
                ogType: seo.ogType || 'website',
                twitterCard: seo.twitterCard || 'summary_large_image',
                twitterTitle: seo.twitterTitle || seo.title || pageTitle,
                twitterDescription: seo.twitterDescription || seo.description || pageDescription,
                twitterImage: seo.twitterImage || '/images/default-social.jpg',
                twitterSite: seo.twitterSite || '@yourtwitterhandle',
                twitterCreator: seo.twitterCreator || '@yourtwitterhandle',
                ...this.defaultSEO,
                ...seo
            },
            ...additionalData
        };

        this.safeRender(res, () => {
            res.status(status).render(template, data);
        });
    }
}

export default TemplateRenderer;