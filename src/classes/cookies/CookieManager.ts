/**
 * Interface representing the MaxAge property in a cookie
 */
interface CookieMaxAge {
    /** The maximum age of the cookie in milliseconds (as a string to support long numbers) */
    $numberLong: string;
}

/**
 * Interface representing the Expires property in a cookie
 */
interface CookieExpires {
    /** The expiration date of the cookie in ISO string format */
    $date: string;
}

/**
 * Interface representing a cookie configuration object
 */
interface CookieConfig {
    /** Whether the cookie should only be transmitted over secure protocols */
    secure: boolean;
    /** Whether the cookie is inaccessible to client-side JavaScript */
    httpOnly: boolean;
    /** Controls whether cookies are sent with cross-origin requests */
    sameSite: 'strict' | 'lax' | 'none';
    /** Maximum age of the cookie in milliseconds */
    maxAge: CookieMaxAge;
    /** Expiration date of the cookie */
    expires: CookieExpires;
    /** URL path that must exist in the requested URL to send the Cookie header */
    path: string;
    /** Domain that the cookie applies to */
    domain: string;
    /** Cookie priority to help browsers decide which cookies to remove when space is needed */
    priority: 'low' | 'medium' | 'high';
    /** Whether the cookie is partitioned (null if not partitioned) */
    partitioned: boolean | null;
}

/**
 * Class for managing cookie configurations
 */
class CookieManager {
    private cookieConfig: CookieConfig;

    /**
     * Creates a new CookieManager instance
     * @param initialConfig Optional initial cookie configuration
     */
    constructor(initialConfig?: Partial<CookieConfig>) {
        // Default configuration
        this.cookieConfig = {
            secure: false,
            httpOnly: true,
            sameSite: 'strict',
            maxAge: { $numberLong: '1744283449998' },
            expires: { $date: '2025-04-10T11:10:49.998Z' },
            path: '/',
            domain: 'localhost',
            priority: 'high',
            partitioned: null,
            ...initialConfig
        };
    }

    /**
     * Gets the current cookie configuration
     * @returns The complete cookie configuration object
     */
    public getConfig(): CookieConfig {
        return { ...this.cookieConfig };
    }

    /**
     * Updates the cookie configuration
     * @param updates Partial configuration to update
     */
    public updateConfig(updates: Partial<CookieConfig>): void {
        this.cookieConfig = { ...this.cookieConfig, ...updates };
    }

    /**
     * Sets the secure flag for the cookie
     * @param secure Whether the cookie should only be sent over HTTPS
     */
    public setSecure(secure: boolean): void {
        this.cookieConfig.secure = secure;
    }

    /**
     * Sets the HttpOnly flag for the cookie
     * @param httpOnly Whether JavaScript should be prevented from accessing the cookie
     */
    public setHttpOnly(httpOnly: boolean): void {
        this.cookieConfig.httpOnly = httpOnly;
    }

    /**
     * Sets the SameSite attribute for the cookie
     * @param sameSite The SameSite policy ('strict', 'lax', or 'none')
     */
    public setSameSite(sameSite: 'strict' | 'lax' | 'none'): void {
        this.cookieConfig.sameSite = sameSite;
    }

    /**
     * Sets the maximum age of the cookie
     * @param maxAgeMs The maximum age in milliseconds
     */
    public setMaxAge(maxAgeMs: number): void {
        this.cookieConfig.maxAge = { $numberLong: maxAgeMs.toString() };
        // Also update expires based on maxAge
        this.updateExpiresFromMaxAge();
    }

    /**
     * Sets the expiration date of the cookie
     * @param date The expiration date as a Date object
     */
    public setExpires(date: Date): void {
        this.cookieConfig.expires = { $date: date.toISOString() };
    }

    /**
     * Sets the path for the cookie
     * @param path The URL path that must exist in the requested URL
     */
    public setPath(path: string): void {
        this.cookieConfig.path = path;
    }

    /**
     * Sets the domain for the cookie
     * @param domain The domain that the cookie applies to
     */
    public setDomain(domain: string): void {
        this.cookieConfig.domain = domain;
    }

    /**
     * Sets the priority for the cookie
     * @param priority The cookie priority ('low', 'medium', or 'high')
     */
    public setPriority(priority: 'low' | 'medium' | 'high'): void {
        this.cookieConfig.priority = priority;
    }

    /**
     * Sets whether the cookie is partitioned
     * @param partitioned Whether the cookie is partitioned (or null)
     */
    public setPartitioned(partitioned: boolean | null): void {
        this.cookieConfig.partitioned = partitioned;
    }

    /**
     * Updates the expires property based on the current maxAge
     */
    private updateExpiresFromMaxAge(): void {
        const maxAgeMs = parseInt(this.cookieConfig.maxAge.$numberLong);
        const expiresDate = new Date(Date.now() + maxAgeMs);
        this.setExpires(expiresDate);
    }

    /**
     * Converts the cookie configuration to a string suitable for Set-Cookie header
     * @returns The cookie string
     */
    public toString(): string {
        const parts: string[] = [];

        // Add basic attributes
        if (this.cookieConfig.path) parts.push(`Path=${this.cookieConfig.path}`);
        if (this.cookieConfig.domain) parts.push(`Domain=${this.cookieConfig.domain}`);

        // Add flags
        if (this.cookieConfig.secure) parts.push('Secure');
        if (this.cookieConfig.httpOnly) parts.push('HttpOnly');

        // Add SameSite
        parts.push(`SameSite=${this.cookieConfig.sameSite.charAt(0).toUpperCase()}${this.cookieConfig.sameSite.slice(1)}`);

        // Add Priority if not default
        if (this.cookieConfig.priority !== 'medium') {
            parts.push(`Priority=${this.cookieConfig.priority.charAt(0).toUpperCase()}${this.cookieConfig.priority.slice(1)}`);
        }

        // Add Partitioned if set
        if (this.cookieConfig.partitioned) {
            parts.push('Partitioned');
        }

        // Add Expires
        const expiresDate = new Date(this.cookieConfig.expires.$date);
        parts.push(`Expires=${expiresDate.toUTCString()}`);

        // Add Max-Age
        parts.push(`Max-Age=${Math.floor(parseInt(this.cookieConfig.maxAge.$numberLong) / 1000}`);

        return parts.join('; ');
    }
}

// Example usage:
// const cookieManager = new CookieManager();
// cookieManager.setDomain('example.com');
// cookieManager.setSecure(true);
// console.log(cookieManager.toString());
