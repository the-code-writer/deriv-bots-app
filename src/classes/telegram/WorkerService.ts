import { Worker } from "node:worker_threads";
import { pino } from "pino";
import { env } from "@/common/utils/envConfig";
import { Session } from "@/classes/telegram/SessionService";

// Logger
const logger = pino({ name: "WorkerService" });

// Environment variables
const { APP_CRYPTOGRAPHIC_KEY } = env;

/**
 * Interface for worker service
 */
export interface IWorkerService {
    postMessageToDerivWorker(action: string, chatId: number, text: string, session: Session, data?: any): void;
    handleWorkerMessage(chatId: number, message: any): void;
}


/**
 * Worker service
 */
export class WorkerService implements IWorkerService {

    private workers: { [key: string]: Worker } = {};

    private telegramBot: any;

    constructor(telegramBot: any) {
        this.telegramBot = telegramBot;
        logger.info("Worker Service started!");
    }

    postMessageToDerivWorker(action: string, chatId: number, text: string, session: Session, data?: any): void {
        const workerID = `WKR_${chatId}`;

        if (this.workers[workerID]) {
            this.workers[workerID].postMessage({ action, text, meta: { chatId, text, session, data } });
        } else {
            this.workers[workerID] = new Worker("./src/classes/deriv/tradeWorker.js", {
                workerData: { action, text, meta: { chatId, text, session } },
            });

            this.workers[workerID].on("message", (message) => this.handleWorkerMessage(chatId, message));
            this.workers[workerID].on("error", (error) => this.handleWorkerError(chatId, error));
            this.workers[workerID].on("exit", (code) => this.handleWorkerExit(chatId, code));
        }
    }

    handleWorkerMessage(chatId: number, message: any): void {
        // Handle worker messages
    }

    private handleWorkerError(chatId: number, error: Error): void {
        logger.error(`Worker error: ${error.message}`);
        delete this.workers[`WKR_${chatId}`];
    }

    private handleWorkerExit(chatId: number, code: number): void {
        if (code !== 0) {
            logger.error(`Worker stopped with exit code ${code}`);
            delete this.workers[`WKR_${chatId}`];
        }
    }
}

