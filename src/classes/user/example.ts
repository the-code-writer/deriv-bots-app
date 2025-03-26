import { MongoDBConnection } from "../databases/mongodb/MongoDBClass";
import { UserServiceFactory } from './UserServiceFactory';

(async () => {
    
    // Example of how to use the refactored module
    const db = new MongoDBConnection(/* config */);

    await db.connect();

    const userService = UserServiceFactory.createUserService(db);

    // Create a new user
    const newUser = await userService.create({
        userId: '123',
        chatId: '456',
        sessionId: '',
        accountId: '',
        name: 'John Doe',
        username: '',
        email: 'john@example.com',
        derivAccount: {
            email: "",
            country: "",
            currency: "USD",
            loginid: "",
            user_id: 0,
            fullname: "",
            amount: {
                _data: {
                    value: 0,
                    currency: "",
                    lang: ""
                }
            }
        },
        telegramAccount: {
            id: 1186,
            first_name: "JOHNX"
        }
    });

    console.log("USER", newUser);

    // Update user details
    const updatedUser = await userService.updateUserDetails('123', {
        sessionId: 'SESSION_ID_001',
        accountId: 'ACCOUNT_ID_001',
        name: 'Johnathan Doe',
        username: 'johnathan.doe',
        email: 'johnathan@example.com',
        derivAccount: {
            email: "johnathan@example.com",
            country: "zw",
            currency: "USD",
            loginid: "705559",
            user_id: 158450,
            fullname: "Johnathan Doe",
            amount: {
                _data: {
                    value: 0.86,
                    currency: "USD",
                    lang: "EN"
                }
            }
        },
        telegramAccount: {
            id: 741151,
            first_name: "Jony Ive",
            username: "jonyIve"
        }
    });

    console.log("NEW USER", updatedUser);

    // Get active users
    const activeUsers = await userService.getActiveUsers();

    console.log("ACTIVE USERS", activeUsers);

})();
