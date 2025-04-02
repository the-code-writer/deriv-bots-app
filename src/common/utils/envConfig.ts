import dotenv from "dotenv";
import { cleanEnv, num, str, url, testOnly } from "envalid";

dotenv.config();

export const env = cleanEnv(process.env, {
  // String variables
  APP_DOMAIN: str({ devDefault: testOnly("nduta.x") }),
  APP_CRYPTOGRAPHIC_KEY: str({ devDefault: testOnly("@p4$$w07D!") }),
  DEVICE_AGENT: str({ devDefault: testOnly("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36") }),
  CORS_ORIGIN: str({ devDefault: testOnly("http://localhost:*") }),
  HOST: str({ devDefault: testOnly("localhost") }),
  IMAGE_BANNER: url({ devDefault: testOnly("https://cdn.prod.website-files.com/66585fe0e1dc7e70cc75d440/66a3154b6213d328633433d5_Deriv%20Bot.webp") }),
  NODE_ENV: str({ devDefault: testOnly("development") }),
  DERIV_APP_TOKEN: str({ devDefault: testOnly("2EhRyJ3xvy1FFj0") }),
  DERIV_APP_OAUTH_CHANNEL: str({ devDefault: testOnly("telegram-bot-oauth") }),
  DERIV_APP_LOGIN_URL: url({ devDefault: testOnly("http://localhost:8080/deriv-oauth") }),
  DERIV_APP_OAUTH_URL: url({ devDefault: testOnly("https://oauth.deriv.com/oauth2/authorize?app_id=68182") }),
  DERIV_APP_ENDPOINT: str({ devDefault: testOnly("wss://ws.derivws.com/websockets/v3?app_id=") }),
  DERIV_APP_ENDPOINT_DOMAIN: str({ devDefault: testOnly("ws.derivws.com") }),
  DERIV_APP_ENDPOINT_APP_ID: str({ devDefault: testOnly("68182") }),
  DERIV_APP_ENDPOINT_LANG: str({ devDefault: testOnly("EN") }),
  TELEGRAM_BOT_TOKEN: str({ devDefault: testOnly("7325482342:AAGfExzAOb5V66N4aCjiycL9-IULfUGVUG8") }),
  PUSHER_TOKEN: str({ devDefault: testOnly("d7c8541eaeb8ad290bb1") }),
  PUSHER_CLUSTER: str({ devDefault: testOnly("ap2") }),
  PUSHER_APP_ID: str({ devDefault: testOnly("1953773") }),
  PUSHER_APP_SECRET: str({ devDefault: testOnly("aea9a2d72a60d56aaa79") }),
  MONGODB_CONNECTION_STRING: str({ devDefault: testOnly("mongodb+srv://chloefxd20607:1f4Brdsn6WCt4m9j@cluster0.rhuko.mongodb.net/") }),
  MONGODB_BACKUP_PATH: str({ devDefault: testOnly("./files/databases/mongodb/backups/") }),
  MONGODB_DATABASE_NAME: str({ devDefault: testOnly("ndutax_db") }),
  DB_SERVER_SESSIONS_DATABASE_COLLECTION: str({ devDefault: testOnly("sv_sessions") }),
  DB_USER_ACCOUNT_DATABASE_COLLECTION: str({ devDefault: testOnly("user_accounts") }),
  DB_DERIV_TRADE_RESULT_DATABASE_COLLECTION: str({ devDefault: testOnly("dv_trade_results") }),
  DB_DERIV_ACCOUNT: str({ devDefault: testOnly("https://www.example.com?acct1=CR518993&token1=a1-DCWzEgC2K7TPhXXy2VAzBDrmRxU1i&cur1=USD&acct2=CR2029443&token2=a1-h4kkMc3Ydx18PhBDX1L883fw2xCDg&cur2=USDC&acct3=CR528370&token3=a1-1jfNoSeHNWsX8LmyBY3h13WAq6YaF&cur3=BTC&acct4=CR528372&token4=a1-qNASuJGJh7GCnkkEMjcJR36saoB3x&cur4=LTC&acct5=CR8424472&token5=a1-MgWeNe41ZmlR6f5yZ0aQGVvfBEGoI&cur5=eUSDT&acct6=CR982988&token6=a1-g0R8JGLJ3DSTvVEz7GXAnDUofsoIB&cur6=ETH&acct7=VRTC1605087&token7=a1-azGoefPe917EDjGonVzsn0HiM3MzF&cur7=USD") }),

  // Number variables
  COMMON_RATE_LIMIT_MAX_REQUESTS: num({ devDefault: testOnly(1000) }),
  COMMON_RATE_LIMIT_WINDOW_MS: num({ devDefault: testOnly(3600) }),
  PORT: num({ devDefault: testOnly(8080) }),
  CONNECTION_MAXIMUM_ATTEMPTS: num({ devDefault: testOnly(5) }),
  CONNECTION_ATTEMPTS_TIMEOUT: num({ devDefault: testOnly(3000) }),
  CONNECTION_ATTEMPTS_TIMEOUT_INCREMENT: num({ devDefault: testOnly(3) }),
  CONNECTION_PING_TIMEOUT: num({ devDefault: testOnly(30000) }),
  CONNECTION_CONTRACT_CREATION_TIMEOUT: num({ devDefault: testOnly(5000) }),
  CONNECTION_RETRY_DELAY: num({ devDefault: testOnly(3000) }),
  DERIV_APP_ID: num({ devDefault: testOnly(1089) }),
  MAX_STAKE: num({ devDefault: testOnly(1000) }),
  MIN_STAKE: num({ devDefault: testOnly(0.35) }),
  MAX_RECOVERY_TRADES_X2: num({ devDefault: testOnly(4) }),
  MAX_RECOVERY_TRADES_X10: num({ devDefault: testOnly(2) }),
  MONGODB_MAX_RETRIES: num({ devDefault: testOnly(5) }),
  MONGODB_RETRY_DELAY: num({ devDefault: testOnly(3000) }),
  DB_SERVER_SESSIONS_DATABASE_TTL: str({ devDefault: testOnly("1 week") }),
});