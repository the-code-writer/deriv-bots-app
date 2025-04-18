const {DerivTradingBot} = require("../trader/deriv-trading-bot");

const { parentPort, workerData } = require("node:worker_threads");

const { action, chatId, text, session, data } = workerData;

if (!action) {
  throw new Error("Invalid worker data");
}

const botConfig = {
  tradingType: "Derivatives 📊",
  defaultMarket: "R_100",
  baseStake: 1,
  maxStake: 5,
  minStake: 0.35,
  maxRecoveryTrades: 5,
  takeProfit: 10,
  stopLoss: 5,
  contractDuration: 1,
  contractDurationUnit: "t",
};

const derivInstance = new DerivTradingBot(botConfig);

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
  ]);

  switch (message.action) {
    case "INIT_TRADE": {
      if (!meta.session || !meta.session.market || !meta.session.stake) {
        throw new Error("Invalid session data");
      }

      deriv.startTrading(meta.session);

      break;
    }
    case "CONFIRM_TRADE": {
      deriv.startTrading(meta.session);
      break;
    }
    case "CONFIRM_MANUAL_TRADE": {
      deriv.tradeAgain(meta.session);
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
