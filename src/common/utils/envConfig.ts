import dotenv from "dotenv";
import { cleanEnv, host, num, port, str, testOnly } from "envalid";

dotenv.config();

export const env = cleanEnv(process.env, {
  
  APP_CRYPTOGRAPHIC_KEY: str({ devDefault: testOnly("") }),
  COMMON_RATE_LIMIT_MAX_REQUESTS: num({ devDefault: testOnly(20) }),
  COMMON_RATE_LIMIT_WINDOW_MS: num({ devDefault: testOnly(1000) }),
  CORS_ORIGIN: str({ devDefault: testOnly("") }),
  HOST: str({ devDefault: testOnly("") }),
  IMAGE_BANNER: str({ devDefault: testOnly("") }),
  NODE_ENV: str({
    devDefault: testOnly("test"),
    choices: ["development", "production", "test"],
  }),
  PORT: num({ devDefault: testOnly(8080) }),
  CONNECTION_MAXIMUM_ATTEMPTS: num({ devDefault: testOnly(5) }),
  CONNECTION_PING_TIMEOUT: num({ devDefault: testOnly(30000) }),
  CONNECTION_CONTRACT_CREATION_TIMEOUT: num({ devDefault: testOnly(5000) }),
  CONNECTION_RETRY_DELAY: num({ devDefault: testOnly(2000) }),
  DERIV_APP_TOKEN: str({ devDefault: testOnly("") }),
  DERIV_APP_ID: num({ devDefault: testOnly(1089) }),
  DERIV_APP_ENDPOINT: str({ devDefault: testOnly("") }),
  TELEGRAM_BOT_TOKEN: str({ devDefault: testOnly("") }),
  TELEGRAM_SESSION_DB: str({ devDefault: testOnly("") }),
  MAX_STAKE: num({ devDefault: testOnly(1000) }),
  MIN_STAKE: num({ devDefault: testOnly(0.35) }),
  MAX_RECOVERY_TRADES_X2: num({ devDefault: testOnly(4) }),
  MAX_RECOVERY_TRADES_X10: num({ devDefault: testOnly(2) }),
});


