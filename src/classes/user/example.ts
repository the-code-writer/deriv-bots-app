// Example of how to use the refactored module
const db = new DatabaseConnection(/* config */);
const userService = UserServiceFactory.createUserService(db);

// Create a new user
const newUser = await userService.create({
    userId: '123',
    chatId: '456',
    name: 'John Doe',
    email: 'john@example.com',
    derivAccount: { /* deriv account data */ },
    telegramAccount: { /* telegram account data */ }
});

// Update user details
const updatedUser = await userService.updateUserDetails('123', {
    name: 'Johnathan Doe',
    email: 'johnathan@example.com'
});

// Get active users
const activeUsers = await userService.getActiveUsers();