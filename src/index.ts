import { env } from "@/common/utils/envConfig";
import { app, logger } from "@/server";
// @ts-ignore
import session from 'express-session';
import TelegramBot from "node-telegram-bot-api";
import { MongoDBConnection } from '@/classes/databases/mongodb/MongoDBClass';
import { Encryption } from "@/classes/cryptography/EncryptionClass";
import { SessionService } from "@/classes/telegram/SessionService";
import { WorkerService } from "@/classes/telegram/WorkerService";
import { KeyboardService } from "@/classes/telegram/KeyboardService";
import { TelegramBotCommandHandlers } from "@/classes/telegram/TelegramBotCommandHandlers";
import { TradingProcessFlowHandlers } from "@/classes/telegram/TradingProcessFlowHandlers";
import { TelegramBotService } from "@/classes/telegram/TelegramBotService";
const { NODE_ENV, HOST, PORT, MONGODB_DATABASE_NAME, TELEGRAM_BOT_TOKEN } = env;

const serverUrl: string = `http://${HOST}:${PORT}`;

const util = require('util');

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

  // Initialize services

  const sessionService = new SessionService(db);

  const telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

  const workerService = new WorkerService(telegramBot);

  const keyboardService = new KeyboardService(telegramBot);

  const commandHandlers = new TelegramBotCommandHandlers(telegramBot, sessionService, keyboardService, workerService);

  const tradingProcessFlow = new TradingProcessFlowHandlers(telegramBot, sessionService, keyboardService, workerService);
  
  // Start the bot
  const bot = new TelegramBotService(telegramBot, sessionService, workerService, tradingProcessFlow, commandHandlers);
  
  const sessionMiddleware = sessionService.getSessionMiddleware();

  const sessionObject: any = session(sessionMiddleware);

  app.use(sessionObject);

  app.set("bot", bot);

  app.set("crypt", new Encryption());

  logger.info("Services ready...");

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
