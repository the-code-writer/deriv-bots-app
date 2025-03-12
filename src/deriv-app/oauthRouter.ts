import express, { Request, Response, Router } from 'express';
import { env } from '@/common/utils/envConfig';
import MongoStore from 'connect-mongo';
import session from 'express-session';
import { MongoDBConnection } from '@/classes/databases/mongodb/MongoDBClass';
const { DERIV_APP_OAUTH_URL, APP_CRYPTOGRAPHIC_KEY, DB_SERVER_SESSIONS_DATABASE, DB_SERVER_SESSIONS_DATABASE_COLLECTION, DB_SERVER_SESSIONS_DATABASE_TTL } = env;
export const oauthRouter: Router = express.Router();

// Get the database instance from the app
oauthRouter.use((req, res, next) => {

  const db = req.app.get("db") as InstanceType<typeof MongoDBConnection>;

  // Configure and apply the session middleware
  const sessionMiddleware:any = session({
    store: MongoStore.create({
      client: db.getClient(), // Use the MongoDB client
      dbName: DB_SERVER_SESSIONS_DATABASE,
      collectionName: DB_SERVER_SESSIONS_DATABASE_COLLECTION,
      ttl: DB_SERVER_SESSIONS_DATABASE_TTL || 60 * 60 * 24, // 1 day
      autoRemove: "native", // Automatically remove expired sessions
    }),
    secret: APP_CRYPTOGRAPHIC_KEY,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "strict",
      maxAge: (1000 * DB_SERVER_SESSIONS_DATABASE_TTL) || 86400000, // 1 day
    },
  });

  // Invoke the session middleware
  sessionMiddleware(req, res, next);

});

oauthRouter.get("/", async (req: Request, res: Response) => {

  const data = {
    title: "Deriv Trading Bot",
    nonce: res.locals.nonce,
    derivLoginURL: DERIV_APP_OAUTH_URL
  };

  res.render("index", { data })

});

oauthRouter.get("/deriv-oauth", async (req: Request, res: Response) => {

  const { telegram_id, telegram_username } = req.query;

  // @ts-ignore
  req.session.chatId = telegram_id;
  // @ts-ignore
  req.session.username = telegram_username;

  const data = {
    title: "Deriv Login",
    nonce: res.locals.nonce,
    derivLoginURL: DERIV_APP_OAUTH_URL
  };

  res.render("deriv-oauth-template", { data })

});

oauthRouter.get("/deriv-callback", async (req: Request, res: Response) => {

  // Extract all query parameters
  const queryParams = req.query;

  // Extract all cookies
  // @ts-ignore
  const session: any = req.session;

  // Initialize an empty object to store the organized data
  const organizedData: any = {};

  // Iterate over the query parameters
  for (const key in queryParams) {

    // Check if the key starts with 'acct', 'token', or 'cur'
    if (key.startsWith("acct") || key.startsWith("token") || key.startsWith("cur")) {
      // Extract the index from the key (e.g., 'acct1' -> '1')
      // @ts-ignore:
      const index = key.match(/\d+/)[0];

      // Initialize the object for this index if it doesn't exist
      if (!organizedData[index]) {
        organizedData[index] = {};
      }

      // Add the value to the corresponding property
      if (key.startsWith("acct")) {
        organizedData[index].acct = queryParams[key];
      } else if (key.startsWith("token")) {
        organizedData[index].token = queryParams[key];
      } else if (key.startsWith("cur")) {
        organizedData[index].cur = queryParams[key];
      }

    }

  }

  // Access the bot instance from _req.app
  const bot = req.app.get("bot");

  if (!bot) {
    return res.status(500).send("<h2>Telegram bot is not initialized</h2>");
  }

  // Call the bot's userLoggedIn function
  bot.loggedIn({
    nonce: res.locals.nonce,
    accounts: organizedData,
    chatId: session.chatId,
    username: session.username,
  });

  // Send a response
  res.status(200).send("<h2>User logged in successfully</h2>");

});

