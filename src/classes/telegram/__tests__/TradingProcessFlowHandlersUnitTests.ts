import { TradingProcessFlowHandlers } from '@/classes/telegram/TradingProcessFlowHandlers';
import { SessionService } from '@/classes/telegram/SessionService';
import { WorkerService } from '@/classes/telegram/WorkerService';
import { KeyboardService } from '@/classes/telegram/KeyboardService';

describe('TradingProcessFlowHandlers', () => {
    let tradingProcessFlow: TradingProcessFlowHandlers;
    let mockSessionService: jest.Mocked<SessionService>;
    let mockWorkerService: jest.Mocked<WorkerService>;
    let mockKeyboardService: jest.Mocked<KeyboardService>;
    let mockTelegramBot: any;

    beforeEach(() => {
        mockSessionService = {
            updateSession: jest.fn(),
        } as any;
        mockWorkerService = {
            postMessageToDerivWorker: jest.fn(),
        } as any;
        mockKeyboardService = {
            showAccountTypeKeyboard: jest.fn(),
            showTradingTypeKeyboard: jest.fn(),
        } as any;
        mockTelegramBot = {
            sendMessage: jest.fn(),
        };

        tradingProcessFlow = new TradingProcessFlowHandlers(
            mockTelegramBot,
            mockSessionService,
            mockKeyboardService,
            mockWorkerService
        );
    });

    describe('handleLoginAccount', () => {
        it('should update the session and show the account type keyboard', () => {
            const chatId = 12345;
            const text = 'test_account';
            const session: any = { chatId, step: 'login_account' };

            tradingProcessFlow.handleLoginAccount(chatId, text, session);

            expect(mockSessionService.updateSession).toHaveBeenCalledWith(chatId, {
                chatId,
                step: 'select_account_type',
                loginAccount: text,
            });
            expect(mockKeyboardService.showAccountTypeKeyboard).toHaveBeenCalledWith(chatId, text);
        });
    });
});