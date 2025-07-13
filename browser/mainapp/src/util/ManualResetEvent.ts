import { CancellationToken } from "./CancellationTokenSource";
import { PromiseSource } from "./PromiseSource";


export class ManualResetEvent {
    constructor() {
    }

    private _isSet: boolean = false;
    private _waiters: PromiseSource<void>[] = [];

    set() {
        if (!this._isSet) {
            this._isSet = true;
            const signalWaiters = [...this._waiters];
            this._waiters = [];
            for (let w of signalWaiters) {
                w.tryResolve();
            }
        }
    }

    reset() {
        this._isSet = false;
    }

    async waitAsync(cancellationToken: CancellationToken): Promise<void> {
        if (this._isSet) {
            return;
        }

        const ps = new PromiseSource<void>();
        this._waiters.push(ps);
        using cancelReg = cancellationToken.register(() => {
            if (ps.trySetCancelled()) {
                this._waiters = this._waiters.filter(w => w != ps);
            }
        });
        await ps.promise;
    }
}
