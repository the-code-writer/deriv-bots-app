import { Request, Response } from 'express';

/**
 * Interface for CSP configuration
 */
interface CSPDirectives {
    defaultSrc?: string[];
    scriptSrc?: string[];
    styleSrc?: string[];
    fontSrc?: string[];
    imgSrc?: string[];
    connectSrc?: string[];
    frameSrc?: string[];
    mediaSrc?: string[];
    objectSrc?: string[];
    childSrc?: string[];
    formAction?: string[];
    frameAncestors?: string[];
    reportUri?: string;
    upgradeInsecureRequests?: boolean;
}

/**
 * Interface for SEO metadata (updated with CSP considerations)
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
    encid?: any;
    [key: string]: any;
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
    cspNonce?: string;
    [key: string]: any;
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
    [key: string]: any;
}

class TemplateRenderingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TemplateRenderingError';
    }
}

/**
 * Enhanced TemplateRenderer with CSP support
 */
class TemplateRenderer {
    private defaultSEO: Partial<SEOMetadata>;
    private defaultMeta: ResponseMeta;
    private cspDirectives: CSPDirectives;
    private useNonce: boolean;

    /**
     * Creates an instance of TemplateRenderer
     * @param {Partial<SEOMetadata>} defaultSEO - Default SEO metadata
     * @param {ResponseMeta} defaultMeta - Default response meta
     * @param {CSPDirectives} cspDirectives - Content Security Policy directives
     * @param {boolean} useNonce - Whether to generate nonces for CSP
     */
    constructor(
        defaultSEO: Partial<SEOMetadata> = {},
        defaultMeta: ResponseMeta = {},
        cspDirectives: CSPDirectives = {
            defaultSrc: ["'self'"],
            fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"]
        },
        useNonce: boolean = true
    ) {
        this.defaultSEO = defaultSEO;
        this.defaultMeta = defaultMeta;
        this.cspDirectives = cspDirectives;
        this.useNonce = useNonce;
    }

    /**
     * Generates a random nonce value
     * @private
     */
    private generateNonce(): string {
        return Buffer.from(crypto.randomBytes(16)).toString('base64');
    }

    /**
     * Builds CSP header string from directives
     * @private
     */
    private buildCSPHeader(nonce?: string): string {
        const directives: string[] = [];

        for (const [key, value] of Object.entries(this.cspDirectives)) {
            if (value === undefined) continue;

            let directiveValue: string;

            if (key === 'upgradeInsecureRequests' && value === true) {
                directives.push('upgrade-insecure-requests');
                continue;
            } else if (key === 'reportUri') {
                directives.push(`report-uri ${value}`);
                continue;
            }

            if (Array.isArray(value)) {
                directiveValue = value.join(' ');

                // Add nonce to script-src and style-src if using nonce
                if (this.useNonce && nonce) {
                    if (key === 'scriptSrc') {
                        directiveValue += ` 'nonce-${nonce}'`;
                    }
                    if (key === 'styleSrc') {
                        directiveValue += ` 'nonce-${nonce}'`;
                    }
                }
            }

            directives.push(`${key.replace(/([A-Z])/g, '-$1').toLowerCase()} ${directiveValue}`);
        }

        return directives.join('; ');
    }

    /**
     * Safely renders content with CSP headers
     * @private
     */
    private safeRender(res: Response, renderFn: () => void, nonce?: string): void {
        if (res.headersSent) {
            console.warn('Headers already sent, skipping render');
            return;
        }

        try {
            // Set CSP header
            const cspHeader = this.buildCSPHeader(nonce);
            res.setHeader('Content-Security-Policy', cspHeader);

            // Set other security headers
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

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
     * Renders a page with CSP support
     */
    renderPage(req: Request, res: Response, options: PageRenderOptions): void {
        const nonce = this.useNonce ? this.generateNonce() : undefined;

        const {
            template,
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

        const canonicalUrl = seo.canonicalUrl || `${req.protocol}://${req.get('host')}${req.path}`;

        const data: TemplateData = {
            template,
            nonce,
            session,
            cspNonce: nonce,
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
            res.status(status).render(template, {data});
        }, nonce);
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
            res.status(status).render(template, { data });
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
            res.status(statusCode).render(template, { data: mergedData });
        });
    }


}

export default TemplateRenderer;