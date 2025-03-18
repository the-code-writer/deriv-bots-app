import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pino } from "pino";
import path from "path";
import cookieParser from "cookie-parser";
import crypto from "crypto";

import { openAPIRouter } from "@/api-docs/openAPIRouter";
import { healthCheckRouter } from "@/api/healthCheck/healthCheckRouter";
import { userRouter } from "@/api/user/userRouter";
import errorHandler from "@/common/middleware/errorHandler";
import rateLimiter from "@/common/middleware/rateLimiter";
import requestLogger from "@/common/middleware/requestLogger";
import { env } from "@/common/utils/envConfig";
import { AttachRoutes } from '@/routes/AttachRoutes';

const logger = pino({ name: "server start" });

const app: Express = express();

// Environment variables
const { CORS_ORIGIN, NODE_ENV } = env;

// Utility function to set up security middleware
const setupSecurityMiddleware = () => {

  app.set("trust proxy", true);
  app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
  app.use(helmet());
  app.use(rateLimiter);

};

// Utility function to set up request parsing middleware
const setupRequestParsingMiddleware = () => {

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

};

// Utility function to set up request logging middleware
const setupRequestLoggingMiddleware = () => {

  app.use(requestLogger);

};

// Utility function to set up CSP middleware
const setupCSPMiddleware = () => {

  app.use((req, res, next) => {
    const nonce = crypto.randomBytes(16).toString("base64");
    res.locals.nonce = nonce;
    next();
  });

  app.use((req, res, next) => {
    const nonce = res.locals.nonce;
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'nonce-${nonce}';`
    );
    next();
  });

};

// Utility function to set up view engine and static files
const setupViewEngineAndStaticFiles = () => {

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(express.static(path.join(__dirname, 'public')));

};

// Utility function to set up routes
const setupRoutes = () => {

  const attachRoutes = new AttachRoutes(app);

  attachRoutes.initializeRoutes();

  app.use("/health-check", healthCheckRouter);
  app.use("/users", userRouter);
  app.use(openAPIRouter);

};

// Utility function to set up error handling middleware
const setupErrorHandlingMiddleware = () => {

  app.use(errorHandler());

};

// Main function to bootstrap the server
const bootstrap = () => {

  setupSecurityMiddleware();
  setupRequestParsingMiddleware();
  setupRequestLoggingMiddleware();
  setupCSPMiddleware();
  setupViewEngineAndStaticFiles();
  setupRoutes();
  setupErrorHandlingMiddleware();

  const server = app.listen(env.PORT, () => {

    logger.info(`Server now running in (${NODE_ENV}) at : http://${env.HOST}:${env.PORT}`);

  });

  const onCloseSignal = () => {

    logger.info("sigint received, shutting down");
    server.close(() => {
      logger.info("server closed");
      process.exit();
    });

    setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after 10s

  };

  process.on("SIGINT", onCloseSignal);
  process.on("SIGTERM", onCloseSignal);

};

// Start the server
bootstrap().catch((error: any) => {
  
  logger.error("Failed to start the server:", error);
  process.exit(1);

});

export { app, logger };