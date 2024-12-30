import { CancellationToken } from "./CancellationTokenSource";
import { IDisposable } from "./Disposable";
import { PromiseSource } from "./PromiseSource";

export class TaskUtils {
    static async waitForCancel(cancellationToken: CancellationToken): Promise<void> {
        const ps = new PromiseSource<void>();
        using creg = cancellationToken.register(() => {
            ps.trySetCancelled(cancellationToken);
        });
        await ps.promise;
    }

    static delay(ms: number, cancellationToken?: CancellationToken) {
        if (ms == -1) { 
            return TaskUtils.waitForCancel(cancellationToken ?? CancellationToken.NONE); 
        }

        const ps = new PromiseSource<void>();
        let resolved = false;

        if (cancellationToken?.isCancellationRequested) {
            ps.reject("cancelled");
            return ps.promise;
        }

        let timeoutHandle: number;
        if (ms > 0) {
            timeoutHandle = window.setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    ps.tryResolve();
                }
            }, ms);
        }
        else {
            timeoutHandle = window.requestIdleCallback(() => {
                if (!resolved) {
                    resolved = true;
                    ps.tryResolve();
                }
            });
        }

        const cancelReg: (IDisposable | null) = (cancellationToken != null && cancellationToken != CancellationToken.NONE) 
            ? cancellationToken.register(() => {
                if (!resolved) {
                    resolved = true;
                    if (ms > 0) {
                        window.clearTimeout(timeoutHandle);
                    }
                    else {
                        window.cancelIdleCallback(timeoutHandle);
                    }
                    ps.trySetCancelled(cancellationToken);
                }
            }) : null;

        ps.promise.then(
            () => { cancelReg?.dispose(); },
            () => { cancelReg?.dispose(); });
        
        return ps.promise;
    }
}