import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pino } from "pino";

import { openAPIRouter } from "@/api-docs/openAPIRouter";
import { healthCheckRouter } from "@/api/healthCheck/healthCheckRouter";
import { userRouter } from "@/api/user/userRouter";
import errorHandler from "@/common/middleware/errorHandler";
import rateLimiter from "@/common/middleware/rateLimiter";
import requestLogger from "@/common/middleware/requestLogger";
import { env } from "@/common/utils/envConfig";
import { AttachRoutes } from '@/routes/AttachRoutes';
import { MongoDBConnection } from '@/classes/databases/mongodb/MongoDBClass';
import { SessionService } from '@/classes/telegram/SessionService';
import { SessionManagerStorageClass } from "@/classes/sessions/SessionManagerStorageClass";
import { SessionManagerClass } from "@/classes/sessions/SessionManagerClass";

const path = require('path');

const cookieParser = require('cookie-parser');

const crypto = require("crypto");

const logger = pino({ name: "server start" });
const app: Express = express();

const { NODE_ENV, HOST, PORT, MONGODB_DATABASE_NAME, DB_SERVER_SESSIONS_DATABASE_COLLECTION, DB_SERVER_SESSIONS_DATABASE_TTL, TELEGRAM_BOT_TOKEN } = env;

(async () => {
  

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

  // Initialize MongoDB connection and set it on the app
  const db = new MongoDBConnection();
  await db.connect();
  await db.createDatabase(MONGODB_DATABASE_NAME);
  app.set("db", db); 

  const sessionStore = new SessionManagerStorageClass(db, DB_SERVER_SESSIONS_DATABASE_COLLECTION);
  const sessionManager = new SessionManagerClass(sessionStore, DB_SERVER_SESSIONS_DATABASE_COLLECTION, DB_SERVER_SESSIONS_DATABASE_TTL );

  app.use(sessionManager.middleware.bind(sessionManager));

  app.set("sessionStore", sessionStore); 

  app.set("sessionManager", sessionManager); 

  app.get('/set-session', async (req, res) => {

    await sessionManager.updateSession(req, res, "flight", {
      ticket: 600.25
    });

    await sessionManager.updateSession(req, res, "color", "yellow");

    await sessionManager.updateSession(req, res, "wheels", {
      front: "17''", left: 5436, back: {a: "1", b: "2", c: "3"}, right: true,
    });

    console.log(":: URL :: /set-session ::", req.session)

    res.send(`SESSION DATA : ${JSON.stringify(req.session)}`);

  });

  app.get('/get-session', (req, res) => {
    console.log(":: URL :: /get-session ::", req.session)
    res.send(`SESSION DATA : ${JSON.stringify(req.session)}`);
  });

  app.get('/del-session', async (req, res) => {
    await sessionManager.destroySession(req, res);
    console.log(":: URL :: /del-session ::", req.session)
    res.send(`SESSION DATA : ${JSON.stringify(req.session)}`);
  });


  // Setup session middleware
  const setupSessionMiddleware = (sessionService: SessionService) => {

    const sessionMiddleware = sessionService.getSessionMiddleware();

    //app.use(sessionMiddleware);

  };

  // Routes

  // Initialize the AttachRoutes class with the app
  const attachRoutes = new AttachRoutes(app);

  // Attach all routes to the app
  attachRoutes.initializeRoutes();

  app.use("/health-check", healthCheckRouter);

  app.use("/users", userRouter);

  // Swagger UI
  app.use(openAPIRouter);

  // Error handlers
  app.use(errorHandler());

})();

export { app, logger };
