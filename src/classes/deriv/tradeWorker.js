const DerivAutoTradingBotClass = require("./DerivAutoTradingBotClass.ts");

const { parentPort, workerData } = require("node:worker_threads");

const { action, meta } = workerData;

if (!action || !meta) {
  throw new Error("Invalid worker data");
}

const deriv = new DerivAutoTradingBotClass();

if (action === "INIT_TRADE") {
  
  if (!meta.session || !meta.session.market || !meta.session.stake) {
    throw new Error("Invalid session data");
  }

  deriv.startTrading(meta.session);

}

// Listen for messages from the main thread
parentPort.on("message", (message) => {
  console.log("NEW_WORKER_MESSAGE", [action, meta]);
  switch (message.action) {
    case "CONFIRM_TRADE": {
      deriv.startTrading(meta.session);
      break;
    }
    case "LOGGED_IN": {
      console.log("LOGGED_IN_IN_WORKER", meta);
      deriv.setAccount((userAccount) => {
        // send message with user data to TG for welcome before proceeding
        parentPort.postMessage({ type: "userAccount", data: userAccount });
      }, meta.data);
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
