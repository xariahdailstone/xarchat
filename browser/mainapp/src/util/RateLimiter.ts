import { CancellationToken } from "./CancellationTokenSource";
import { PromiseSource } from "./PromiseSource";
import { TaskUtils } from "./TaskUtils";

export class RateLimiter {
    constructor(
        public readonly maxTokens: number, 
        startingTokens: number,
        public readonly rechargeRatePerSec: number) {

        this._curTokens = startingTokens;
    }

    private _curTokens: number;

    private _inWaitMode: boolean = false;
    private _waiters: { neededTokens: number, pcs: PromiseSource<void> }[] = [];
    private _rechargingTokens: boolean = false;

    async acquireAsync(consumeTokens: number, cancellationToken: CancellationToken): Promise<void> {
        if (!this._inWaitMode) {
            if (this._curTokens == this.maxTokens || this._curTokens >= consumeTokens) {
                this._curTokens -= consumeTokens;
                this.maybeStartRechargeLoop();
                return;
            }
        }

        this._inWaitMode = true;
        const ps = new PromiseSource<void>();
        const w = { neededTokens: consumeTokens, pcs: ps };
        this._waiters.push(w);
        using ctRes = cancellationToken.register(() => { 
            this._waiters = this._waiters.filter(x => x !== w);
            ps.trySetCancelled(cancellationToken);
        });
        this.maybeStartRechargeLoop();
        await ps.promise;
        return;
    }

    private async maybeStartRechargeLoop() {
        if (!this._rechargingTokens) {
            this._rechargingTokens = true;
            let lastRechargeAt = performance.now();
            while (true) {
                await TaskUtils.delay(10);
                let thisTick = performance.now();
                let msElapsed = thisTick - lastRechargeAt;
                const amountToRecharge = (this.rechargeRatePerSec / 1000) * msElapsed;
                this._curTokens = Math.min(this.maxTokens, this._curTokens + amountToRecharge);

                while (this._waiters.length > 0) {
                    const peek = this._waiters[0];
                    if (this._curTokens == this.maxTokens || this._curTokens >= peek.neededTokens) {
                        this._curTokens -= peek.neededTokens;
                        if (!peek.pcs.tryResolve()) {
                            this._curTokens += peek.neededTokens;
                        }
                        this._waiters.shift();
                    }
                    else {
                        break;
                    }
                }
                if (this._waiters.length == 0) {
                    this._inWaitMode = false;
                }

                if (this._curTokens >= this.maxTokens) {
                    this._rechargingTokens = false;
                    return;
                }
                lastRechargeAt = thisTick;
            }
        }
    }
}