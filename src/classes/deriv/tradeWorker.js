const DerivAutoTradingBotClass = require("./DerivAutoTradingBotClass.ts");

const { parentPort, workerData } = require("node:worker_threads");

const { action, chatId, text, session, data } = workerData;

if (!action) {
  throw new Error("Invalid worker data");
}

const derivInstance = new DerivAutoTradingBotClass();



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
      
      console.log("LOGIN_DERIV_ACCOUNT_READY", userAccount);

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
