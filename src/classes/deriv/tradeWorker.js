const { parentPort, workerData } = require("worker_threads");
const axios = require("axios");

const { session } = workerData;

if (!session || !session.market || !session.stake) {
  throw new Error("Invalid session data");
}

const params = {
  proposal: 1,
  amount: session.stake,
  basis: "stake",
  contract_type: session.purchaseType,
  currency: "USD",
  duration: session.tradeDuration,
  duration_unit: "m",
  symbol: session.market,
};

console.log("TRADING", params);

// Simulate API call (replace with actual Deriv API integration)
axios
  .post("https://api.deriv.com/place_trade", params)
  .then((response) => {
    const tradeId = response.data.trade_id;
    parentPort.postMessage(`Trade placed successfully! Trade ID: ${tradeId}`);
  })
  .catch((error) => {
    parentPort.postMessage(`Failed to place trade: ${error.message}`);
  });
