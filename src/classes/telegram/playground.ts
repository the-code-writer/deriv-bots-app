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
use('ndutax_db');

// Insert a few documents into the sales collection.
db.getCollection('sv_sessions').insertOne({
  "_id": "0279ea84-808a-4236-a627-294ab590ea4b",
  "maxAge": 1743102892621,
  "cookie": {
    "secure": false,
    "httpOnly": true,
    "sameSite": "strict",
    "originalMaxAge": 1743102892621,
    "maxAge": 1743102892621,
    "expires": 1743102892621,
    "path": "/",
    "domain": null,
    "priority": null,
    "partitioned": null
  },
  "session": {
    "sessionID": "0279ea84-808a-4236-a627-294ab590ea4b",
    "chatId": 7000005000,
    "bot": {
      "chatId": 7000005000,
      "step": "login_account",
      "timestamp": 1742498109400,
      "accounts": {
        "telegram": {
          "id": 7000005000,
          "is_bot": false,
          "first_name": "CodeWriter",
          "username": "the_code_writer",
          "language_code": "en"
        },
        "deriv": {}
      }
    },
    "encid": "U2FsdGVkX19dFoh0JJdM53FYUrtxg4L+xrLLCIKeVAY="
  },
  "createdAt": "2025-03-20T19:15:09.401Z",
  "updatedAt": "2025-03-20T19:15:09.401Z",
  "isActive": true
});
