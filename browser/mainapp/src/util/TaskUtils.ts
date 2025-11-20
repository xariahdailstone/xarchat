import { CancellationToken } from "./CancellationTokenSource";
import { asDisposable, IDisposable } from "./Disposable";
import { PromiseSource } from "./PromiseSource";
import { Scheduler } from "./Scheduler";

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

        let timeoutHandle: IDisposable;
        if (ms > 0) {
            const thNum = Scheduler.scheduleNamedCallback("TaskUtils.delay", ms, () => {
                if (!resolved) {
                    resolved = true;
                    ps.tryResolve();
                }
            });
            timeoutHandle = asDisposable(() => thNum.dispose());
        }
        else {
            timeoutHandle = Scheduler.scheduleNamedCallback("TaskUtils.delay", ["idle", 250], () => {
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
                    timeoutHandle.dispose();
                    ps.trySetCancelled(cancellationToken);
                }
            }) : null;

        ps.promise.then(
            () => { cancelReg?.dispose(); },
            () => { cancelReg?.dispose(); });
        
        return ps.promise;
    }
}