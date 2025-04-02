const express = require('express');
const app = express();

// Initialize session manager
const sessionManager = new SessionManager('your-strong-secret-here');

// Apply session middleware
app.use(sessionManager.middleware());

// Example router
const router = express.Router();

router.get('/login', (req, res) => {
    // Set session data
    req.session.user = { id: 123, name: 'John Doe' };
    res.send('Logged in!');
});

router.get('/profile', (req, res) => {
    // Access session data
    if (!req.session?.user) {
        return res.status(401).send('Not authenticated');
    }
    res.json(req.session.user);
});

router.get('/logout', (req, res) => {
    // Destroy session
    sessionManager.destroySession(req, res);
    res.send('Logged out!');
});

app.use('/', router);

app.listen(3000, () => console.log('Server running'));