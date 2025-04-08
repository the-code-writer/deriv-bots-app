import express from 'express';
import TemplateRenderer from './TemplateRenderer';

const app = express();
const templateRenderer = new TemplateRenderer('https://t.me/your_bot_url');

app.get('/protected', (req, res) => {
    // Simulate an error case where headers might be sent twice
    res.write('Partial content');

    // This will safely skip rendering since headers were already sent
    templateRenderer.renderError(req, res, {
        status: 500,
        title: 'This wont render',
        description: 'Because headers were already sent'
    });

    // The warning will be logged but no error will be thrown
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof TemplateRenderingError) {
        console.error('Template rendering failed:', err.message);
        if (!res.headersSent) {
            res.status(500).send('Template rendering error');
        }
    } else {
        next(err);
    }
});

app.listen(3000);