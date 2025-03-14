import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pino } from "pino";

import { oauthRouter } from "@/deriv-app/oauthRouter";
import { openAPIRouter } from "@/api-docs/openAPIRouter";
import { healthCheckRouter } from "@/api/healthCheck/healthCheckRouter";
import { userRouter } from "@/api/user/userRouter";
import errorHandler from "@/common/middleware/errorHandler";
import rateLimiter from "@/common/middleware/rateLimiter";
import requestLogger from "@/common/middleware/requestLogger";
import { env } from "@/common/utils/envConfig";

const path = require('path');

const cookieParser = require('cookie-parser');

const crypto = require("crypto");

const logger = pino({ name: "server start" });
const app: Express = express();

// Set the application to trust the reverse proxy
app.set("trust proxy", true);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(helmet());
app.use(rateLimiter);

// Request logging
app.use(requestLogger);

// Parse Cookies
app.use(cookieParser());

// Middleware to generate a nonce for each request
app.use((req, res, next) => {
    const nonce = crypto.randomBytes(16).toString("base64");
    res.locals.nonce = nonce;
    next();
});
  
  // Set CSP header with nonce
  app.use((req, res, next) => {
    const nonce = res.locals.nonce;
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'nonce-${nonce}';`
    );
    next();
  });

// Set EJS as the templating engine
app.set("view engine", "ejs");

// Set the directory for views (optional, defaults to "views" folder)
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use("/health-check", healthCheckRouter);
app.use("/users", userRouter);

// Swagger UI
app.use(openAPIRouter);

// OAuth Router
app.use(oauthRouter);

// Error handlers
app.use(errorHandler());

export { app, logger };
