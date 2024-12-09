import { CancellationToken } from "./CancellationTokenSource";
import { IDisposable } from "./Disposable";
import { PromiseSource } from "./PromiseSource";

export class TaskUtils {
    static delay(ms: number, cancellationToken?: CancellationToken) {
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