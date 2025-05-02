import { MongoDBConnection } from "../databases/mongodb/MongoDBClass";
import TelegramBot from 'node-telegram-bot-api';
import { SessionManagerStorageClass } from '@/classes/sessions/SessionManagerStorageClass';
import { SessionService, ISessionService } from '@/classes/sessions/SessionService';
import { WorkerService } from '@/classes/telegram/WorkerService';
import { IKeyboardService, KeyboardService } from '@/classes/telegram/KeyboardService';
import { TelegramBotCommandHandlers } from '@/classes/telegram/TelegramBotCommandHandlers';
import { TradingProcessFlowHandlers } from '@/classes/telegram/TradingProcessFlowHandlers';
import { TelegramBotService } from '@/classes/telegram/TelegramBotService';
import { getDerivAccountFromURLParams, getQueryParamsFromURL } from '../../common/utils/snippets';

import { env } from "@/common/utils/envConfig";
import { pino } from 'pino';
import { Encryption } from "../cryptography/EncryptionClass";
import { UserServiceFactory } from '../user/UserServiceFactory';
import { CONSTANTS } from '@/common/utils/constants';
import { KeyboardButton } from 'node-telegram-bot-api';

// Logger
const logger = pino({ name: "TelegramServiceExample" });

// Environment variables
const { APP_CRYPTOGRAPHIC_KEY, MONGODB_DATABASE_NAME, DB_SERVER_SESSIONS_DATABASE_COLLECTION, DB_SERVER_SESSIONS_DATABASE_TTL, TELEGRAM_BOT_TOKEN, DB_DERIV_ACCOUNT } = env;

// Initialize services required for the application
const initializeServices = async (telegramBot: TelegramBot): Promise<any> => {

  const db = new MongoDBConnection();
  await db.connect();
  await db.createDatabase(MONGODB_DATABASE_NAME);

  const sessionStore = new SessionManagerStorageClass(db, DB_SERVER_SESSIONS_DATABASE_COLLECTION);
  const sessionService: ISessionService = new SessionService(sessionStore, DB_SERVER_SESSIONS_DATABASE_COLLECTION, DB_SERVER_SESSIONS_DATABASE_TTL);

  const userService = UserServiceFactory.createUserService(db);

  const keyboardService = new KeyboardService(telegramBot);
  const workerService = new WorkerService(telegramBot, keyboardService, userService, sessionService);
  const commandHandlers = new TelegramBotCommandHandlers(telegramBot, sessionService, keyboardService, workerService, userService);
  const tradingProcessFlow = new TradingProcessFlowHandlers(telegramBot, sessionService, keyboardService, workerService);
  return { sessionService, workerService, keyboardService, commandHandlers, tradingProcessFlow };

};

// Start the Telegram bot service
const startTelegramBotService = (
  telegramBot: TelegramBot,
  sessionService: ISessionService,
  workerService: WorkerService,
  tradingProcessFlow: TradingProcessFlowHandlers,
  commandHandlers: TelegramBotCommandHandlers,
  keyboardService: IKeyboardService
) => {

  return new TelegramBotService(telegramBot, sessionService, workerService, tradingProcessFlow, commandHandlers, keyboardService);

};

(async () => {

  //console.log(">>>>>>", Encryption.decryptAES("U2FsdGVkX19yk3ykUOVvdXbwwAW8hoSd4Rrlo6VK2Iw=", APP_CRYPTOGRAPHIC_KEY)); 

  const chatId: number = 7542095001;

  const telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

  const { sessionService, workerService, commandHandlers, tradingProcessFlow, keyboardService } = await initializeServices(telegramBot);

  const bot = startTelegramBotService(telegramBot, sessionService, workerService, tradingProcessFlow, commandHandlers, keyboardService);

  await commandHandlers.handleStartCommand({
    chat: {
      id: chatId
    },
    from: {
      first_name: "Douglas",
      id: chatId,
      last_name: "Maposa",
      username: "drmposa",
      language_code: "en",
      is_bot: false
    }
  })

  const queryString: string = DB_DERIV_ACCOUNT;

  const queryParams: any = getQueryParamsFromURL(queryString);

  const organizedData: any = getDerivAccountFromURLParams(queryParams);

  let sessionDocument: any = await sessionService.getUserSessionByChatId(chatId);

  console.log("*** SESSION - 001 ***", chatId, sessionDocument);

  sessionDocument.session.bot.accounts.deriv.accountList = organizedData;

  await bot.authorizeOauthData(sessionDocument);

  sessionDocument = await sessionService.getUserSessionByChatId(chatId);

  console.log("*** SESSION - 002 ***", chatId, sessionDocument);

  let text: string | KeyboardButton = "CR8424472 ( eUSDT )";

  await tradingProcessFlow.handleAccountTypeSelection(chatId, text, sessionDocument.session)

  sessionDocument = await sessionService.getUserSessionByChatId(chatId);

  console.log("*** SESSION - 003 ***", chatId, sessionDocument);

  text = CONSTANTS.TRADING_TYPES.DERIVATIVES;

  console.log("CONSTANTS.TRADING_TYPES.DERIVATIVES", [CONSTANTS.TRADING_TYPES.DERIVATIVES, text])

  await tradingProcessFlow.handleTradingTypeSelection(chatId, text, sessionDocument.session)

  sessionDocument = await sessionService.getUserSessionByChatId(chatId);

  console.log("*** SESSION - 004 ***", chatId, sessionDocument);

  text = CONSTANTS.CONTRACT_TYPES.DERIVATIVES[4][1];

  await tradingProcessFlow.handleMarketSelection(chatId, text, sessionDocument.session)

})();
