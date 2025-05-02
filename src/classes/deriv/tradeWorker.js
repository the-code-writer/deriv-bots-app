const { DerivTradingBot } = require("../trader/deriv-trading-bot");

const { parentPort, workerData } = require("node:worker_threads");

const { action, chatId, text, session, data } = workerData;

if (!action) {
  throw new Error("Invalid worker data");
}

const botConfig = {};

const derivInstance = new DerivTradingBot(botConfig);

let accountToken = "";

const handleLoggedIn = (
  userAction,
  userChatId,
  textString,
  sessionDocument,
  metaData
) => {
  console.log("LOGIN_DERIV_ACCOUNT", {
    userAction,
    userChatId,
    textString,
    sessionDocument,
    metaData,
  });

  const accounts = metaData.accountList;

  const accountNumber = metaData.accountNumber;

  const account = derivInstance.getAccountToken(
    accounts,
    "acct",
    accountNumber
  );

  console.log("ACCOUNT_TOKEN", account);

  accountToken = 'a1-28VUaap8ZFN3G4lMgf5P3S3IPtUQl';  //account.token;

  try {
    derivInstance.setAccount((userAccount) => {
      console.log("###############LOGIN_DERIV_ACCOUNT_READY", userAccount);

      parentPort.postMessage({
        action: "LOGIN_DERIV_ACCOUNT_READY",
        data: { userAccount, sessionDocument, chatId: userChatId },
      });
    }, account.token);
  } catch (error) {
    console.log("LOGIN_DERIV_ACCOUNT_ERROR", error);

    parentPort.postMessage({
      action: "LOGIN_DERIV_ACCOUNT_ERROR",
      data: { error, sessionDocument, chatId: userChatId },
    });
  }
};

if (action === "LOGIN_DERIV_ACCOUNT") {
  if (!chatId || !data) {
    throw new Error("Invalid session data");
  }

  handleLoggedIn(action, chatId, text, session, data);
}

// Listen for messages from the main thread
parentPort.on("message", (message) => {
  console.log("MESSAGE_FROM_PARENT", message, [
    message.action,
    message.session,
    message.session.bot.tradingOptions,
  ]);

  switch (message.action) {
    case "INIT_TRADE": {
      if (!meta.session || !meta.session.market || !meta.session.stake) {
        throw new Error("Invalid session data");
      }
      console.error(message.session.bot.tradingOptions, false, accountToken);
      derivInstance.startTrading(
        message.session.bot.tradingOptions,
        false,
        accountToken
      );

      break;
    }
    case "TRADE_CONFIRMATION": {
      console.error(message.session.bot.tradingOptions, false, accountToken);
      derivInstance.startTrading(
        message.session.bot.tradingOptions,
        false,
        accountToken
      );
      break;
    }
    case "CONFIRM_MANUAL_TRADE": {
      console.error(message.session.bot.tradingOptions, false, accountToken);
      derivInstance.startTrading(
        message.session.bot.tradingOptions,
        false,
        accountToken
      );
      break;
    }
    case "LOGIN_DERIV_ACCOUNT": {
      const { action, chatId, text, session, data } = message;
      handleLoggedIn(action, chatId, text, session, data);
      break;
    }
    case "LOGGED_IN": {
      handleLoggedIn(message.chatId, message.data);
      break;
    }
    default: {
      console.log("UNHANDLED_MESSAGE_FROM_PARENT", message);
      // Send a response back to the main thread
      parentPort.postMessage({
        type: "UNHANDLED_MESSAGE_FROM_PARENT",
        data: message,
      });
      break;
    }
  }
});
