import { env } from "@/common/utils/envConfig";
import { app, logger } from "@/server";
import TelegramNodeJSBot from "@/classes/telegram/TelegramNodeJSBotClass";
import session from 'express-session';
import { MongoDBConnection } from '@/classes/databases/mongodb/MongoDBClass';
import { Encryption } from "@/classes/cryptography/EncryptionClass";
const { NODE_ENV, HOST, PORT, APP_CRYPTOGRAPHIC_KEY, MONGODB_CONNECTION_STRING, MONGODB_DATABASE_NAME, DB_SERVER_SESSIONS_DATABASE_COLLECTION, DB_SERVER_SESSIONS_DATABASE_TTL } = env;

const serverUrl: string = `http://${HOST}:${PORT}`;

const util = require('util');

const MongoDBStore = require('connect-mongodb-session')(session);

// Override util.isArray to use Array.isArray
util.isArray = Array.isArray;

util.isDate = function (obj: any) {
  return Object.prototype.toString.call(obj) === '[object Date]';
};

util.isRegExp = function (obj: any) {
  return Object.prototype.toString.call(obj) === '[object RegExp]';
};

(async () => {

  const db: any = new MongoDBConnection();

  await db.connect();

  await db.createDatabase(MONGODB_DATABASE_NAME);

  app.set("db", db);

  app.set("bot", new TelegramNodeJSBot(serverUrl, db));

  app.set("crypt", new Encryption());

  const sessionStorage = new MongoDBStore(
    {
      uri: MONGODB_CONNECTION_STRING,
      databaseName: MONGODB_DATABASE_NAME,
      collection: DB_SERVER_SESSIONS_DATABASE_COLLECTION,
      // By default, sessions expire after 2 weeks. The `expires` option lets
      // you overwrite that by setting the expiration in milliseconds
      expires: (1000 * DB_SERVER_SESSIONS_DATABASE_TTL) || 1000 * 60 * 60 * 24 * 1, // 1 day in milliseconds

      // Lets you set options passed to `MongoClient.connect()`. Useful for
      // configuring connectivity or working around deprecation warnings.
      connectionOptions: {
        serverSelectionTimeoutMS: 10000
      }
    }
  );

  const sessionMiddleware: any = {
    name: DB_SERVER_SESSIONS_DATABASE_COLLECTION,
    secret: APP_CRYPTOGRAPHIC_KEY,
    resave: true,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "strict",
      maxAge: (1000 * DB_SERVER_SESSIONS_DATABASE_TTL) || 1000 * 60 * 60 * 24 * 1, // 1 day
    },
    store: sessionStorage
  };

  // Catch errors
  sessionStorage.on('error', function (error: any) {
    logger.error("Session storage error occured!");
    logger.error(error);
  });

  app.use(session(sessionMiddleware));

  const server = app.listen(env.PORT, () => {

    logger.info(`Server now running in (${NODE_ENV}) at : ${serverUrl}`);

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
