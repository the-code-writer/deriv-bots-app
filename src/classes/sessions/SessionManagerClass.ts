const crypto = require('crypto');
const cookie = require('cookie-signature');

class SessionManager {
    constructor(secret = 'your-secret-key') {
        this.secret = secret;
        this.sessions = new Map(); // In-memory store (replace with Redis in production)
        this.cookieName = 'custom_session';
        this.maxAge = 24 * 60 * 60 * 1000; // 24 hours
    }

    // Middleware to attach to Express
    middleware() {
        return async (req, res, next) => {
            // Get session ID from cookie
            const sessionId = this.getSessionIdFromRequest(req);

            // Get or create session
            if (sessionId && this.sessions.has(sessionId)) {
                req.session = this.sessions.get(sessionId);
            } else {
                req.session = this.createNewSession();
            }

            // Save session before sending response
            const originalSend = res.send;
            res.send = (body) => {
                this.persistSession(req, res);
                return originalSend.call(res, body);
            };

            next();
        };
    }

    getSessionIdFromRequest(req) {
        const rawCookie = req.headers.cookie
            ?.split(';')
            .find(c => c.trim().startsWith(`${this.cookieName}=`));

        if (!rawCookie) return null;

        const signedValue = rawCookie.split('=')[1];
        return cookie.unsign(signedValue, this.secret);
    }

    createNewSession() {
        const sessionId = crypto.randomBytes(16).toString('hex');
        const sessionData = { id: sessionId };
        this.sessions.set(sessionId, sessionData);
        return sessionData;
    }

    persistSession(req, res) {
        if (!req.session) return;

        // Update expiration
        req.session.expires = Date.now() + this.maxAge;
        this.sessions.set(req.session.id, req.session);

        // Set cookie
        const signedSessionId = cookie.sign(req.session.id, this.secret);
        res.setHeader('Set-Cookie',
            `${this.cookieName}=${signedSessionId}; HttpOnly; Max-Age=${this.maxAge}; Path=/`);
    }

    destroySession(req, res) {
        if (!req.session?.id) return;

        this.sessions.delete(req.session.id);
        req.session = null;
        res.setHeader('Set-Cookie',
            `${this.cookieName}=; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/`);
    }
}