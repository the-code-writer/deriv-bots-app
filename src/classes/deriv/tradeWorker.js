const DerivAutoTradingBotClass = require("./DerivAutoTradingBotClass.ts");

const { parentPort, workerData } = require("node:worker_threads");

const {action, chatId, data} = workerData;

if (!action) {
  throw new Error("Invalid worker data");
}

const derivInstance = new DerivAutoTradingBotClass();

const handleLoggedIn = (id, metadata) =>  {
  
  const account = derivInstance.getAccountToken(metadata, "cur", "USD");

  console.log("ACCOUNT_TOKEN", account.token, account);

  derivInstance.setAccount((userAccount) => {
    
  console.log("LOGGED_IN_ACCOUNT", userAccount);

    // send message with user data to TG for welcome before proceeding
    parentPort.postMessage({ type: "userAccount", data: userAccount });
    
  }, account.token);
}

if (action === "LOGGED_IN") {

  if (!chatId || !data) {
    throw new Error("Invalid session data");
  }

  handleLoggedIn(chatId, data);

}

// Listen for messages from the main thread
parentPort.on("message", (message) => {

  console.log("NEW_WORKER_MESSAGE", message, [
    message.action,
    message.meta.data,
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
    case "LOGGED_IN": {
      handleLoggedIn(message.chatId, message.data);
      break;
    }
    default: {
      console.log("Worker received second message:", message);
      // Send a response back to the main thread
      parentPort.postMessage({ type: "response", data: message });
      break;
    }
  }
});
