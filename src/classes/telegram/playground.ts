/* global use, db */
// MongoDB Playground
// To disable this template go to Settings | MongoDB | Use Default Template For Playground.
// Make sure you are connected to enable completions and to be able to run a playground.
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.
// The result of the last command run in a playground is shown on the results panel.
// By default the first 20 documents will be returned with a cursor.
// Use 'console.log()' to print to the debug output.
// For more documentation on playgrounds please refer to
// https://www.mongodb.com/docs/mongodb-vscode/playgrounds/

// Select the database to use.
use("ndutax_db");

// Insert a few documents into the sales collection.
db.getCollection("sv_sessions").insertOne({
  "_id": "27affcab-7d08-43d6-8584-375108c9610e",
  "maxAge": 1743693388095,
  "cookie": {
    "secure": false,
    "httpOnly": true,
    "sameSite": "strict",
    "originalMaxAge": 1743693388095,
    "maxAge": 1743693388095,
    "expires": 1743693388095,
    "path": "/",
    "domain": null,
    "priority": null,
    "partitioned": null
  },
  "session": {
    "sessionID": "27affcab-7d08-43d6-8584-375108c9610e",
    "chatId": 7542095001,
    "bot": {
      "chatId": 7542095001,
      "step": "login_account",
      "timestamp": 1743088592013,
      "accounts": {
        "telegram": {
          "id": 7542095001,
          "is_bot": false,
          "first_name": "CodeWriter",
          "username": "the_code_writer",
          "language_code": "en"
        },
        "deriv": {}
      }
    }
  },
  "createdAt": {
    "$date": "2025-03-27T15:16:32.014Z"
  },
  "updatedAt": {
    "$date": "2025-03-27T15:16:32.014Z"
  },
  "isActive": true
});
