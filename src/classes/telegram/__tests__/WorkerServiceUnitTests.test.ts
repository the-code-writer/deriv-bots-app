
import { Worker } from 'node:worker_threads';
import { WorkerService } from '@/classes/telegram/WorkerService';

describe('WorkerService', () => {
    let workerService: WorkerService;
    let mockTelegramBot: any;

    beforeEach(() => {
        mockTelegramBot = {
            sendMessage: jest.fn(),
        };
        workerService = new WorkerService(mockTelegramBot);
    });

    describe('postMessageToDerivWorker', () => {
        it('should create a new worker and post a message', () => {
            const chatId = 12345;
            const action = 'CONFIRM_TRADE';
            const text = '';
            const session: any = { chatId };

            workerService.postMessageToDerivWorker(action, chatId, text, session);

            expect(Worker).toHaveBeenCalled();
            
        });
    });
});