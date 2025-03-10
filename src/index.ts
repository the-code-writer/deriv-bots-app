import { env } from "@/common/utils/envConfig";
import { app, logger } from "@/server";
import TelegramNodeJSBot from "./classes/telegram/TelegramNodeJSBotClass";
import DerivAutoTradingBotClass from "./classes/deriv/DerivAutoTradingBot";

const server = app.listen(env.PORT, () => {
  const { NODE_ENV, HOST, PORT } = env;
  logger.info(`Server (${NODE_ENV}) running on port http://${HOST}:${PORT}`);

  //start the bot here

  const bot = new TelegramNodeJSBot();

  //const deriv = new DerivAutoTradingBotClass();

  //deriv.checkContract()

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
