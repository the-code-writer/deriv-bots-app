import { Message } from 'node-telegram-bot-api';
import { TelegramBotCommandHandlers } from '@/classes/telegram/TelegramBotCommandHandlers';
import { SessionService } from '@/classes/telegram/SessionService';
import { WorkerService } from '@/classes/telegram/WorkerService';
import { KeyboardService } from '@/classes/telegram/KeyboardService';
import { CONSTANTS } from '@/common/utils/constants';

describe('TelegramBotCommandHandlers', () => {
    let commandHandlers: TelegramBotCommandHandlers;
    let mockSessionService: jest.Mocked<SessionService>;
    let mockWorkerService: jest.Mocked<WorkerService>;
    let mockKeyboardService: jest.Mocked<KeyboardService>;
    let mockTelegramBot: any;

    beforeEach(() => {
        mockSessionService = {
            getSession: jest.fn(),
            updateSession: jest.fn(),
            initializeSession: jest.fn(),
            cleanupInactiveSessions: jest.fn(),
        } as any;
        mockWorkerService = {
            postMessageToDerivWorker: jest.fn(),
            handleWorkerMessage: jest.fn(),
        } as any;
        mockKeyboardService = {
            getLoginKeyboard: jest.fn(),
            showAccountTypeKeyboard: jest.fn(),
        } as any;
        mockTelegramBot = {
            sendMessage: jest.fn(),
            sendPhoto: jest.fn(),
        };

        commandHandlers = new TelegramBotCommandHandlers(
            mockTelegramBot,
            mockSessionService,
            mockKeyboardService,
            mockWorkerService
        );
    });

    describe('handleStartCommand', () => {
        it('should initialize a session and send a welcome message', async () => {
            const msg: Message = {
                chat: { id: 12345, first_name: 'John' },
            } as any;

            await commandHandlers.handleStartCommand(msg);

            expect(mockSessionService.updateSession).toHaveBeenCalledWith(
                12345,
                expect.objectContaining({
                    chatId: 12345,
                    step: 'login_account',
                    accounts: { telegram: msg.from, deriv: {} },
                })
            );
            expect(mockTelegramBot.sendPhoto).toHaveBeenCalled();
            expect(mockTelegramBot.sendMessage).toHaveBeenCalled();
        });
    });

    describe('handleConfirmCommand', () => {
        it('should confirm a trade if a session exists', async () => {
            const msg: Message = { chat: { id: 12345 } } as any;
            const session = { chatId: 12345, step: 'confirm_trade' };

            mockSessionService.getSession.mockResolvedValue(session);

            await commandHandlers.handleConfirmCommand(msg);

            expect(mockWorkerService.postMessageToDerivWorker).toHaveBeenCalledWith(
                CONSTANTS.COMMANDS.CONFIRM,
                12345,
                "",
                session
            );
        });

        it('should not confirm a trade if no session exists', async () => {
            const msg: Message = { chat: { id: 12345 } } as any;

            mockSessionService.getSession.mockResolvedValue(null);

            await commandHandlers.handleConfirmCommand(msg);

            expect(mockWorkerService.postMessageToDerivWorker).not.toHaveBeenCalled();
        });
    });
});