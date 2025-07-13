import { CancellationToken, CancellationTokenSource } from "./CancellationTokenSource";
import { OperationCancelledError, PromiseSource } from "./PromiseSource";
import { TaskUtils } from "./TaskUtils";

export class RateLimiter {
    constructor(
        private readonly maxTokens: number, 
        startingTokens: number,
        private readonly refreshAmount: number,
        private readonly refreshIntervalMs: number) {

        this.currentTokens = startingTokens;
        if (this.currentTokens < this.maxTokens) {
            this.startRefreshProcess();
        }
    }

    private currentTokens: number;

    private _waiters: WaitingEntry[] = [];

    private _refreshProcessRunning = false;
    private async startRefreshProcess(): Promise<void> {
        if (this._refreshProcessRunning) { return; }
        this._refreshProcessRunning = true;

        try {
            // Perform a pump immediately, then loop and dispatch until the bucket is full.
            while (true) {
                while (true) {
                    if (this._waiters.length > 0 && this._waiters[0].amountNeeded <= this.currentTokens) {
                        const w = this._waiters.shift()!;
                        if (w.promiseSource.tryResolve()) {
                            this.currentTokens -= w.amountNeeded;
                        }
                    }
                    else {
                        break;
                    }
                }

                await TaskUtils.delay(this.refreshIntervalMs, CancellationToken.NONE);
                this.currentTokens = Math.min(this.maxTokens, this.currentTokens + this.refreshAmount);

                if (this.currentTokens >= this.maxTokens) { break; }
            }
        }
        finally {
            this._refreshProcessRunning = false;
        }
    }

    async waitAsync(neededTokens: number, cancellationToken: CancellationToken): Promise<void> {
        if (cancellationToken.isCancellationRequested) { throw new OperationCancelledError("waitAsync cancelled", cancellationToken); }

        const we: WaitingEntry =  {
            amountNeeded: neededTokens,
            promiseSource: new PromiseSource<void>()
        };
        this._waiters.push(we);
        using cancelReg = cancellationToken.register(() => {
            if (we.promiseSource.trySetCancelled(cancellationToken)) {
                this._waiters = this._waiters.filter(e => e != we);
            }
        });

        this.startRefreshProcess();
        await we.promiseSource;
    }
}

interface WaitingEntry {
    amountNeeded: number;
    promiseSource: PromiseSource<void>;
}