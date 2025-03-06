const DerivAutoTradingBot = require("./DerivAutoTradingBot.ts");

const { parentPort, workerData } = require("node:worker_threads");

const { action, meta } = workerData;

if (!action || !meta) {
  throw new Error("Invalid worker data");
}

if (action === "INIT_TRADE") {

  if (!meta.session || !meta.session.market || !meta.session.stake) {
    throw new Error("Invalid session data");
  }

  const deriv = new DerivAutoTradingBot();

  deriv.startTrading(meta.session);

  // Listen for messages from the main thread
  parentPort.on("message", (message) => {
    if (message.action === "CONFIRM_TRADE") {
      deriv.startTrading(meta.session);
    } else {
      console.log("Worker received second message:", message);
      // Send a response back to the main thread
      parentPort.postMessage({ type: "response", data: message });
    }
  });

}
