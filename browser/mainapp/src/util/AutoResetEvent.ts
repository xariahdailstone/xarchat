import { CancellationToken } from "./CancellationTokenSource";
import { PromiseSource } from "./PromiseSource";

export class AutoResetEvent {
    constructor() {
    }

    _isSet: boolean = false;
    _waiters: PromiseSource<void>[] = [];

    set() {
        if (!this._isSet) {
            while (this._waiters.length > 0) {
                const nw = this._waiters.shift()!;
                if (nw.tryResolve()) {
                    return;
                }
            }
        }
        this._isSet = true;
    }
    
    async waitAsync(cancellationToken: CancellationToken): Promise<void> {
        if (this._isSet && this._waiters.length == 0) {
            this._isSet = false;
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
        this._isSet = false;
    }
}

