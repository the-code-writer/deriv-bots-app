import { env } from "@/common/utils/envConfig";
import { app, logger } from "@/server";
import TelegramNodeJSBot from "./classes/telegram/TelegramNodeJSBotClass";
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { MongoDBConnection } from '@/classes/databases/mongodb/MongoDBClass';
const { NODE_ENV, HOST, PORT, APP_CRYPTOGRAPHIC_KEY } = env;

const serverUrl: string = `http://${HOST}:${PORT}`;

const util = require('util');

// Override util.isArray to use Array.isArray
util.isArray = Array.isArray;

util.isDate = function (obj:any) {
  return Object.prototype.toString.call(obj) === '[object Date]';
};

util.isRegExp = function (obj:any) {
  return Object.prototype.toString.call(obj) === '[object RegExp]';
};

(async () => {

  app.set("bot", new TelegramNodeJSBot(serverUrl));

  const db: any = new MongoDBConnection();

  await db.connect();

  await db.createDatabase("sessions_db");

  app.set("db", db);

  // Configure session middleware
  const sessionMiddleware: any = session({
    store: MongoStore.create({
      client: db.getClient(), // Use the MongoDB client
      dbName: "sessions_db",
      collectionName: "sessions",
      ttl: 60 * 60 * 24, // 1 day
      autoRemove: "native", // Automatically remove expired sessions
    }),
    secret: APP_CRYPTOGRAPHIC_KEY,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "strict",
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  });

  // Apply the session middleware to the app
  app.use(sessionMiddleware);

  const server = app.listen(env.PORT, () => {

    logger.info(`Server (${NODE_ENV}) running on : ${serverUrl}`);

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


})();
