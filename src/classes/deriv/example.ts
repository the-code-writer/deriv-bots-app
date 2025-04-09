const DerivAutoTradingBotClass = require("./DerivAutoTradingBotClass.ts");

import { pino } from "pino";

import { env } from "@/common/utils/envConfig";

import { DerivAPIService } from "./DerivTrader";

const { parentPort } = require("node:worker_threads");

const logger = pino({ name: "DerivTradingBot" });

const sessionDocument:any = {
  "sessionID": "7cded92d-d42a-400b-a40c-c3ca60bafcf3",
  "chatId": 7542095001,
  "maxAge": 1744756376993,
  "cookie": {
    "secure": false,
    "httpOnly": true,
    "sameSite": "strict",
    "maxAge": 1744756376993,
    "expires": {
      "$date": "2025-04-15T22:32:56.993Z"
    },
    "path": "/",
    "domain": "nduta.x",
    "priority": "high",
    "partitioned": null
  },
  "session": {
    "sessionID": "7cded92d-d42a-400b-a40c-c3ca60bafcf3",
    "chatId": 7542095001,
    "bot": {
      "chatId": 7542095001,
      "timestamp": {
        "$date": "2025-04-08T23:07:35.993Z"
      },
      "tradingOptions": {
        "step": "TRADE_CONFIRMATION",
        "accountType": "VRTC1605087 ( USD )",
        "tradingType": "Derivatives 📊",
        "market": "Volatility 50(1s) 📈",
        "purchaseType": "Rise ⬆️",
        "stake": 15,
        "takeProfit": 15,
        "stopLoss": 10,
        "tradeDuration": "45min ⏱️",
        "updateFrequency": "35min ⏱️",
        "contractDurationUnits": "Hours ⏱️",
        "contractDurationValue": "18hrs ⏱️",
        "tradingMode": "📈 Manual Trading"
      },
      "accounts": {
        "telegram": {
          "id": 7542095001,
          "is_bot": false,
          "first_name": "CodeWriter",
          "username": "the_code_writer",
          "language_code": "en"
        },
        "deriv": {
          "accountList": {
            "1": {
              "acct": "CR518993",
              "token": "a1-rYXhGcfx5ABjchoJoCRumDrkx66XT",
              "cur": "USD"
            },
            "2": {
              "acct": "CR2029443",
              "token": "a1-GFnPO0vy5aAVY7bMQDESKJyJad9Pj",
              "cur": "USDC"
            },
            "3": {
              "acct": "CR528370",
              "token": "a1-FR6RPEfVrmBbXAum1eVJ2MFjlRBAB",
              "cur": "BTC"
            },
            "4": {
              "acct": "CR528372",
              "token": "a1-sMFsJZGoEwpfwTZJj2wVaUnYemr3s",
              "cur": "LTC"
            },
            "5": {
              "acct": "CR8424472",
              "token": "a1-84nvdVO6FnUPnOQhnmuHQAArCqM8e",
              "cur": "eUSDT"
            },
            "6": {
              "acct": "CR982988",
              "token": "a1-Zm4OHCpfP76ANMfdvrKc36YZ7oS7n",
              "cur": "ETH"
            },
            "7": {
              "acct": "VRTC1605087",
              "token": "a1-bG5N9SNLVf9ZqxfrEIWBuhECdmanK",
              "cur": "USD"
            }
          },
          "accountDetails": {}
        }
      }
    },
    "encid": "U2FsdGVkX1+RqkE4yrrfL4A9+RBWsGYRtGi2h/NirMA=",
    "encua": "d353580b8520434d40457e72148ca459",
    "encuaData": {
      "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      "browser": {
        "name": "Chrome",
        "version": "134.0.0.0",
        "major": "134",
        "type": null
      },
      "cpu": {
        "architecture": "amd64"
      },
      "device": {
        "type": null,
        "model": null,
        "vendor": null
      },
      "engine": {
        "name": "Blink",
        "version": "134.0.0.0"
      },
      "os": {
        "name": "Windows",
        "version": "10"
      }
    }
  },
  "createdAt": {
    "$date": "2025-04-08T23:07:35.993Z"
  },
  "updatedAt": {
    "$date": "2025-04-08T23:14:27.798Z"
  },
  "isActive": true
};

/*

    tradingOptions: {
      step: 'TRADE_CONFIRMATION',
      accountType: 'VRTC1605087 ( USD )',
      tradingType: 'Derivatives ≡ƒôè',
      market: 'Volatility 50(1s) ≡ƒôê',
      purchaseType: 'Rise Γ¼å∩╕Å',
      stake: 15,
      takeProfit: 15,
      stopLoss: 10,
      tradeDuration: '45min ΓÅ▒∩╕Å',
      updateFrequency: '35min ΓÅ▒∩╕Å',
      contractDurationUnits: 'Hours ΓÅ▒∩╕Å',
      contractDurationValue: '18hrs ΓÅ▒∩╕Å',
      tradingMode: '≡ƒôê Manual Trading'
    },

*/


const derivInstance = new DerivAutoTradingBotClass();

const accountToken = "a1-28VUaap8ZFN3G4lMgf5P3S3IPtUQl";

derivInstance.connect(() => {

    derivInstance.setAccount((userAccount: any) => {

        console.log("LOGIN_DERIV_ACCOUNT_READY", userAccount);

        tradeData();

    }, accountToken);

}, accountToken);

function tradeData() {
    
    derivInstance.startTrading(sessionDocument.session.bot.tradingOptions);

}
