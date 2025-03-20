import { env } from "@/common/utils/envConfig";
import { app, logger } from "@/server";
import TelegramBot from "node-telegram-bot-api";
import { WorkerService } from "@/classes/telegram/WorkerService";
import { KeyboardService } from "@/classes/telegram/KeyboardService";
import { TelegramBotCommandHandlers } from "@/classes/telegram/TelegramBotCommandHandlers";
import { TradingProcessFlowHandlers } from "@/classes/telegram/TradingProcessFlowHandlers";
import { TelegramBotService } from "@/classes/telegram/TelegramBotService";
import { ISessionService, SessionService } from '@/classes/sessions/SessionService';
import { MongoDBConnection } from '@/classes/databases/mongodb/MongoDBClass';
import { SessionManagerStorageClass } from '@/classes/sessions/SessionManagerStorageClass';

const { NODE_ENV, HOST, PORT, MONGODB_DATABASE_NAME, DB_SERVER_SESSIONS_DATABASE_COLLECTION, DB_SERVER_SESSIONS_DATABASE_TTL, TELEGRAM_BOT_TOKEN } = env;

const serverUrl: string = `http://${HOST}:${PORT}`;

// Utility function to override util methods
const overrideUtilMethods = () => {

  const util = require('util');
  util.isArray = Array.isArray;
  util.isDate = (obj: any) => Object.prototype.toString.call(obj) === '[object Date]';
  util.isRegExp = (obj: any) => Object.prototype.toString.call(obj) === '[object RegExp]';

};

// Initialize services required for the application
const initializeServices = async (telegramBot: TelegramBot) : Promise<any>=> {

  const db = new MongoDBConnection();
  await db.connect();
  await db.createDatabase(MONGODB_DATABASE_NAME);

  const sessionStore = new SessionManagerStorageClass(db, DB_SERVER_SESSIONS_DATABASE_COLLECTION);
  const sessionService = new SessionService(sessionStore, DB_SERVER_SESSIONS_DATABASE_COLLECTION, DB_SERVER_SESSIONS_DATABASE_TTL);

  const workerService = new WorkerService(telegramBot);
  const keyboardService = new KeyboardService(telegramBot);
  const commandHandlers = new TelegramBotCommandHandlers(telegramBot, sessionService, keyboardService, workerService);
  const tradingProcessFlow = new TradingProcessFlowHandlers(telegramBot, sessionService, keyboardService, workerService);
  return { sessionService, workerService, keyboardService, commandHandlers, tradingProcessFlow };

};

// Start the Telegram bot service
const startTelegramBotService = (
  telegramBot: TelegramBot,
  sessionService: ISessionService,
  workerService: WorkerService,
  tradingProcessFlow: TradingProcessFlowHandlers,
  commandHandlers: TelegramBotCommandHandlers
) => {

  return new TelegramBotService(telegramBot, sessionService, workerService, tradingProcessFlow, commandHandlers);

};

// Start the server
const startServer = () => {

  const server = app.listen(PORT, () => {

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

};

// Main function to bootstrap the application
const bootstrap = async () => {

  overrideUtilMethods();

  const telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

  const { sessionService, workerService, commandHandlers, tradingProcessFlow } = await initializeServices(telegramBot);

  const bot = startTelegramBotService(telegramBot, sessionService, workerService, tradingProcessFlow, commandHandlers);

  app.set("bot", bot);

  startServer();

};

// Start the application
bootstrap().catch((error) => {

  logger.error("Failed to start the application:", error);

  process.exit(1);

});