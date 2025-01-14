import { ServerError } from "../fchat/ChatConnectionImpl";
import { errorNumberIsThrottle } from "../fchat/ServerErrorNumbers";
import { CancellationTokenSource } from "./CancellationTokenSource";
import { IDisposable } from "./Disposable";
import { PromiseSource } from "./PromiseSource";

export class SendQueue implements IDisposable {
    constructor() {
        this._cts = new CancellationTokenSource();
    }

    readonly _cts: CancellationTokenSource;
    readonly _taskQueue: (SendQueueTask & WithPromiseSource)[] = [];

    private _disposed: boolean = false;
    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            this._cts.cancel();
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }

    executeAsync(task: SendQueueTask): Promise<void> {
        if (this._cts.isCancellationRequested) {
            throw new Error("SendQueue disposed");
        }

        var pcs = new PromiseSource<void>();

        this._taskQueue.push({
            ...task,
            promiseSource: pcs,
            retriesDone: 0
        });

        if (this._taskQueue.length == 1) {
            this._processTaskQueue();
        }

        return pcs.promise;
    }

    private _cancelAllTasks() {
        const err = new Error("SendQueue disposed");
        while (this._taskQueue.length > 0) {
            const processingTask = this._taskQueue[0];
            (async function() {
                try { await processingTask.onFailTerminalAsync(err); }
                catch { }
                processingTask.promiseSource.reject(err);
            })();
            this._taskQueue.shift();
        }
    }

    private async _processTaskQueue(): Promise<void> {
        while (this._taskQueue.length > 0) {
            if (this._cts.isCancellationRequested) {
                this._cancelAllTasks();
                return;
            }

            const processingTask = this._taskQueue[0];
            let attemptError: any = null;
            try {
                await processingTask.onAttemptAsync();
            }
            catch (err) {
                attemptError = err;
            }

            if (attemptError != null) {
                let isTerminalError = false;
                if (processingTask.retriesDone >= processingTask.maxRetries) {
                    isTerminalError = true;
                }
                else if (!(attemptError instanceof ServerError) || (!errorNumberIsThrottle(attemptError.errorNumber))) {
                    isTerminalError = true;
                }

                if (!isTerminalError) {
                    try { await processingTask.onFailBeforeRetryAsync(attemptError); }
                    catch { }
                    processingTask.retriesDone += 1;
                }
                else {
                    try { await processingTask.onFailTerminalAsync(attemptError); }
                    catch { }
                    this._taskQueue.shift();
                    processingTask.promiseSource.reject(attemptError);
                }
            }
            else {
                try { await processingTask.onSuccessAsync(); }
                catch { }
                this._taskQueue.shift();
                processingTask.promiseSource.resolve();
            }
        }
    }
}

interface WithPromiseSource {
    promiseSource: PromiseSource<void>;
    retriesDone: number;
}

export interface SendQueueTask {
    onAttemptAsync: () => Promise<void>;

    onSuccessAsync: () => Promise<void>;

    onFailBeforeRetryAsync: (err: any) => Promise<void>;

    onFailTerminalAsync: (err: any) => Promise<void>;

    get maxRetries(): number;
}