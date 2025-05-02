import { Worker } from "node:worker_threads";
import { pino } from "pino";
import { v4 as uuidv4 } from 'uuid';
import { env } from "@/common/utils/envConfig";
import { IKeyboardService } from "./KeyboardService";
import { IUserRepository, IUser } from "../user/UserInterfaces";
import { UserService } from "../user/UserService";

// Logger
const logger = pino({ name: "WorkerService" });

// Environment variables
const { APP_CRYPTOGRAPHIC_KEY } = env;

/**
 * Interface for worker service
 */
export interface IWorkerService {
    postMessageToDerivWorker(action: string, chatId: number, text: string, session: any, data?: any): void;
    handleWorkerMessage(chatId: number, message: any): void;
}


/**
 * Worker service
 */
export class WorkerService implements IWorkerService {

    private workers: { [key: string]: Worker } = {};

    private telegramBot: any;
    private keyboardService: IKeyboardService;
    private userService: UserService;

    constructor(telegramBot: any, keyboardService: IKeyboardService, userService: UserService) {
        this.telegramBot = telegramBot;
        this.keyboardService = keyboardService;
        this.userService = userService;
        logger.info("Worker Service started!");
    }

    postMessageToDerivWorker(action: string, chatId: number, text: string, session: any, data?: any): void {

        const workerID = `WKR_${chatId}`;

        if (this.workers[workerID]) {
            this.workers[workerID].postMessage({ action, chatId, text, session, data });
        } else {
            this.workers[workerID] = new Worker("./src/classes/deriv/tradeWorker.js", {
                workerData: { action, chatId, text, session, data },
            });
            this.workers[workerID].on("message", (message) => this.handleWorkerMessage(chatId, message));
            this.workers[workerID].on("error", (error) => this.handleWorkerError(chatId, error));
            this.workers[workerID].on("exit", (code) => this.handleWorkerExit(chatId, code));
        }
    }


    async handleWorkerMessage(chatId: number, message: any): Promise<void> {

        console.log("MESSAGE_FROM_WORKER", chatId, message);

        switch (message.action) {

            case "LOGIN_DERIV_ACCOUNT_READY": {

                const { sessionDocument, userAccount } = message.data;

                console.log("AGNESSSS", chatId, sessionDocument, userAccount.account)

                this.userService.createUserWithCallback(chatId, sessionDocument, userAccount.account,  async (createdUser: IUser) => {

                    const welcomeUser: string = await this.userService.createUserWelcomeMessage(createdUser);

                    this.telegramBot.sendMessage(chatId, welcomeUser);

                    setTimeout(() => {

                        this.keyboardService.showTradingTypeKeyboard(chatId, sessionDocument);

                    }, 1000)

                });

                break;
            }

            case "sendTelegramMessage": {

                this.keyboardService.sendMessage(chatId, message.text);

                break;
            }

            case "lastTradeSummary": {

                this.keyboardService.sendMessage(chatId, message.text);

                break;
            }

            case "generateTradingSummary": {

                this.keyboardService.sendMessage(chatId, message.text);

                break;
            }

            case "revertStepShowAccountTypeKeyboard": {

                this.keyboardService.sendMessage(chatId, message.text);

                setTimeout(() => {
                    this.keyboardService.showAccountTypeKeyboard(chatId);
                }, 500);

                break;
            }

            default: {

                console.log("UNKNOWN_MESSAGE_FROM_WORKER", message);

                break;

            }
        }

    }

    private handleWorkerError(chatId: number, error: Error): void {
        logger.error(`Worker error: ${error.message}`);
        console.log(error);
        delete this.workers[`WKR_${chatId}`];
    }

    private handleWorkerExit(chatId: number, code: number): void {
        if (code !== 0) {
            logger.error(`Worker stopped with exit code ${code}`);
            delete this.workers[`WKR_${chatId}`];
        }
    }
}

