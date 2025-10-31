import { CancellationToken, CancellationTokenSource } from "./CancellationTokenSource";
import { asDisposable, IDisposable } from "./Disposable";
import { EventListenerUtil } from "./EventListenerUtil";
import { PromiseSource } from "./PromiseSource";

export class Mutex {
    constructor() {
    }

    private _held: boolean = false;
    private _waiters: (PromiseSource<void>)[] = [];

    async acquireAsync(cancellationToken?: CancellationToken): Promise<IDisposable & Disposable> {
        if (this._held) {
            const ps = new PromiseSource<void>();
            if (cancellationToken) {
                using _ = cancellationToken.register(() => {
                    this._waiters = this._waiters.filter(x => x !== ps);
                    ps.tryReject("cancelled");
                });

                await ps.promise;
            }
            else {
                this._waiters.push(ps);
                await ps.promise;
            }
        }
        else {
            this._held = true;
        }

        let disposed = false;
        return asDisposable(() => {
            if (!disposed) {
                disposed = true;
                this.release();
            }
        });
    }

    release() {
        if (this._waiters.length > 0) {
            const giveTo = this._waiters.shift();
            giveTo?.resolve();
        }
        else {
            this._held = false;
        }
    }

    async executeWhileHeldAsync<T>(func: () => Promise<T>, cancellationToken: CancellationToken): Promise<T> {
        await this.acquireAsync(cancellationToken);
        try {
            const result = await func();
            return result;
        }
        finally {
            this.release();
        }
    }

    private _latestExecutor: object | null = null;
    private _currentLatestWaiters: Set<PromiseSource<void>> | null = null;
    async executeLatestWhileHeldAsync(func: () => Promise<void>): Promise<void> {
        const ps = new PromiseSource<void>();

        const myKey = {};
        this._latestExecutor = myKey;
        this._currentLatestWaiters = this._currentLatestWaiters ?? new Set();
        this._currentLatestWaiters.add(ps);

        await this.executeWhileHeldAsync(async () => {
            if (this._latestExecutor == myKey) {
                const waiters = this._currentLatestWaiters;
                this._currentLatestWaiters = null;
                try {
                    await func();
                }
                finally {
                    if (waiters) {
                        for (let w of waiters.values()) {
                            w.tryResolve();
                        }
                    }
                }
            }
        }, CancellationToken.NONE);

        await ps.promise;
    }
}