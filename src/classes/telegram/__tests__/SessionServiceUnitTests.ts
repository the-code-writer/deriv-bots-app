import { Session, SessionService } from '@/classes/telegram/SessionService';
import { MongoDBConnection } from '@/classes/databases/mongodb/MongoDBClass';

describe('SessionService', () => {
    
    let sessionService: SessionService;
    let mockDb: jest.Mocked<MongoDBConnection>;

    beforeEach(() => {
        mockDb = {
            updateItems: jest.fn(),
            getAllItems: jest.fn(),
            deleteItem: jest.fn(),
            getItem: jest.fn(),
        } as any;
        sessionService = new SessionService(mockDb);
    });

    describe('initializeSession', () => {
        it('should initialize a session for a chat ID', async () => {
            const chatId = 12345;
            await sessionService.initializeSession(chatId);

            expect(mockDb.updateItems).toHaveBeenCalledWith(
                'tg_sessions',
                [{ field: 'chatId', operator: 'eq', value: chatId }],
                { $set: { chatId, step: 'login_account', timestamp: expect.any(Number) } }
            );
        });
    });

    describe('updateSession', () => {
        it('should update a session in the database', async () => {
            const chatId = 12345;
            const session: Session = { chatId, step: 'select_account_type', timestamp: Date.now() };

            await sessionService.updateSession(chatId, session);

            expect(mockDb.updateItems).toHaveBeenCalledWith(
                'tg_sessions',
                [{ field: 'chatId', operator: 'eq', value: chatId }],
                { $set: session }
            );
        });
    });

    describe('cleanupInactiveSessions', () => {
        it('should delete inactive sessions', async () => {
            const now = Date.now();
            const inactiveSession = { chatId: 12345, timestamp: now - 31 * 60 * 1000 }; // 31 minutes old
            const activeSession = { chatId: 67890, timestamp: now - 29 * 60 * 1000 }; // 29 minutes old

            mockDb.getAllItems.mockResolvedValue([inactiveSession, activeSession]);

            await sessionService.cleanupInactiveSessions();

            expect(mockDb.deleteItem).toHaveBeenCalledWith(
                'tg_sessions',
                [{ field: 'chatId', operator: 'eq', value: inactiveSession.chatId }]
            );
            expect(mockDb.deleteItem).not.toHaveBeenCalledWith(
                'tg_sessions',
                [{ field: 'chatId', operator: 'eq', value: activeSession.chatId }]
            );
        });
    });

    describe('getSession', () => {
        it('should return a session for a chat ID', async () => {
            const chatId = 12345;
            const session: Session = { chatId, step: 'login_account', timestamp: Date.now() };

            mockDb.getItem.mockResolvedValue(session);

            const result = await sessionService.getSession(chatId);

            expect(result).toEqual(session);
            expect(mockDb.getItem).toHaveBeenCalledWith(
                'tg_sessions',
                [{ field: 'chatId', operator: 'eq', value: chatId }]
            );
        });

        it('should return null if no session is found', async () => {
            const chatId = 12345;

            mockDb.getItem.mockResolvedValue(null);

            const result = await sessionService.getSession(chatId);

            expect(result).toBeNull();
        });
    });
});