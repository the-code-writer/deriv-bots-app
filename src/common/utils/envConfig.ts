import dotenv from "dotenv";
import { cleanEnv, num, str, url, bool, testOnly } from "envalid";

dotenv.config();

export const env = cleanEnv(process.env, {
  // ========================
  // Application Core
  // ========================
  APP_DOMAIN: str({ devDefault: testOnly("nduta.x") }),
  NODE_ENV: str({ devDefault: testOnly("development") }),
  HOST: str({ devDefault: testOnly("localhost") }),
  PORT: num({ devDefault: testOnly(8080) }),
  CORS_ORIGIN: str({ devDefault: testOnly("http://localhost:*") }),
  IMAGE_BANNER: url({ devDefault: testOnly("https://cdn.prod.website-files.com/66585fe0e1dc7e70cc75d440/66a3154b6213d328633433d5_Deriv%20Bot.webp") }),
  SPACE_CHARACTER: str({ devDefault: testOnly("‎") }),

  // ========================
  // Connection & Network
  // ========================
  CONNECTION_MAXIMUM_ATTEMPTS: num({ devDefault: testOnly(5) }),
  CONNECTION_ATTEMPTS_TIMEOUT: num({ devDefault: testOnly(3000) }),
  CONNECTION_ATTEMPTS_TIMEOUT_INCREMENT: num({ devDefault: testOnly(3) }),
  CONNECTION_PING_TIMEOUT: num({ devDefault: testOnly(30000) }),
  CONNECTION_CONTRACT_CREATION_TIMEOUT: num({ devDefault: testOnly(60000) }),
  CONNECTION_RETRY_DELAY: num({ devDefault: testOnly(3000) }),

  // ========================
  // Security & Cryptography
  // ========================
  APP_CRYPTOGRAPHIC_KEY: str({ devDefault: testOnly("") }),
  SESSION_SECRET: str({ devDefault: testOnly("pass123") }),
  SESSION_NAME: str({ devDefault: testOnly("nduta.sid") }),
  SESSION_COOKIE_DOMAIN: str({ devDefault: testOnly("nduta.x") }),
  SESSION_COOKIE_SECURE: bool({ devDefault: testOnly(false) }),
  SESSION_COOKIE_HTTPONLY: bool({ devDefault: testOnly(true) }),
  SESSION_COOKIE_SAMESITE: str({ devDefault: testOnly("Lax") }),
  SESSION_COOKIE_MAX_AGE: num({ devDefault: testOnly(86400000) }),
  SESSION_RESAVE: bool({ devDefault: testOnly(false) }),
  SESSION_SAVE_UNINITIALIZED: bool({ devDefault: testOnly(false) }),

  // ========================
  // Database (MongoDB)
  // ========================
  MONGODB_CONNECTION_STRING: str({ devDefault: testOnly("mongodb://localhost:27017") }),
  MONGODB_CONNECTION_STRINGX: str({ devDefault: testOnly("") }),
  MONGODB_DATABASE_NAME: str({ devDefault: testOnly("ndutax_db") }),
  MONGODB_BACKUP_PATH: str({ devDefault: testOnly("./files/databases/mongodb/backups/") }),
  MONGODB_MAX_RETRIES: num({ devDefault: testOnly(5) }),
  MONGODB_RETRY_DELAY: num({ devDefault: testOnly(3000) }),
  DB_SERVER_SESSIONS_DATABASE_COLLECTION: str({ devDefault: testOnly("ndtx_sessions") }),
  DB_USER_ACCOUNT_DATABASE_COLLECTION: str({ devDefault: testOnly("ndtx_users") }),
  DB_DERIV_TRADE_RESULT_DATABASE_COLLECTION: str({ devDefault: testOnly("dv_trade_results") }),
  DB_SERVER_SESSIONS_DATABASE_TTL: str({ devDefault: testOnly("1 week") }),

  // ========================
  // Deriv API & Trading
  // ========================
  DERIV_APP_ID: num({ devDefault: testOnly(1089) }),
  DERIV_APP_TOKEN: str({ devDefault: testOnly("") }),
  DERIV_APP_URL: url({ devDefault: testOnly("http://localhost:8080/") }),
  DERIV_APP_TG_URL: url({ devDefault: testOnly("https://t.me/ndutax_bot") }),
  DERIV_APP_LOGIN_URL: url({ devDefault: testOnly("https://inboxgroup.ai/test/scripts/oauth.html") }),
  DERIV_APP_OAUTH_URL: str({ devDefault: testOnly("https://oauth.deriv.com/oauth2/authorize?app_id=68182") }),
  DERIV_APP_OAUTH_CHANNEL: str({ devDefault: testOnly("telegram-bot-oauth") }),
  DERIV_APP_OAUTH_LOGIN_URL: str({ devDefault: testOnly("/oauth/login") }),
  DERIV_APP_OAUTH_CALLBACK_INIT_URL: str({ devDefault: testOnly("/oauth/callback-init") }),
  DERIV_APP_OAUTH_CALLBACK_URL: str({ devDefault: testOnly("/oauth/callback") }),
  DERIV_APP_ENDPOINT: str({ devDefault: testOnly("wss://ws.derivws.com/websockets/v3?app_id=") }),
  DERIV_APP_ENDPOINT_DOMAIN: str({ devDefault: testOnly("ws.derivws.com") }),
  DERIV_APP_ENDPOINT_APP_ID: str({ devDefault: testOnly("68182") }),
  DERIV_APP_ENDPOINT_LANG: str({ devDefault: testOnly("EN") }),
  MAX_STAKE: num({ devDefault: testOnly(5000) }),
  MIN_STAKE: num({ devDefault: testOnly(0.35) }),
  MAX_RECOVERY_TRADES: num({ devDefault: testOnly(4) }),

  // ========================
  // Circuit Breaker (Risk Management)
  // ========================
  // Loss Limits
  MAX_ABSOLUTE_LOSS: num({ devDefault: testOnly(1000) }),
  MAX_DAILY_LOSS: num({ devDefault: testOnly(500) }),
  MAX_CONSECUTIVE_LOSSES: num({ devDefault: testOnly(5) }),
  MAX_BALANCE_PERCENTAGE_LOSS: num({ devDefault: testOnly(0.5) }),

  // Rapid Loss Protection
  RAPID_LOSS_TIME_WINDOW_MS: num({ devDefault: testOnly(30000) }),
  RAPID_LOSS_THRESHOLD: num({ devDefault: testOnly(2) }),
  RAPID_LOSS_INITIAL_COOLDOWN_MS: num({ devDefault: testOnly(30000) }),
  RAPID_LOSS_MAX_COOLDOWN_MS: num({ devDefault: testOnly(300000) }),
  RAPID_LOSS_COOLDOWN_MULTIPLIER: num({ devDefault: testOnly(2) }),

  // General Cooldown
  COOLDOWN_PERIOD_MS: num({ devDefault: testOnly(60000) }),

  // ========================
  // Third-Party Integrations
  // ========================
  TELEGRAM_BOT_TOKEN: str({ devDefault: testOnly("") }),
  PUSHER_TOKEN: str({ devDefault: testOnly("") }),
  PUSHER_CLUSTER: str({ devDefault: testOnly("ap2") }),
  PUSHER_APP_ID: str({ devDefault: testOnly("") }),
  PUSHER_APP_SECRET: str({ devDefault: testOnly("") }),
});