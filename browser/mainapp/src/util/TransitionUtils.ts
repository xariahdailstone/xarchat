import { CancellationTokenSource } from "./CancellationTokenSource";
import { IDisposable, EmptyDisposable, asDisposable } from "./Disposable";
import { EventListenerUtil } from "./EventListenerUtil";
import { TaskUtils } from "./TaskUtils";

export class TransitionUtils {

    static onTransitionEndOrTimeout(el: HTMLElement, timeoutMs: number, callback: () => void): IDisposable {
        const cts = new CancellationTokenSource();

        let transitionHandler : IDisposable | null = null;

        let completed = false;
        const complete = () => {
            if (!completed) {
                completed = true;

                cts.cancel();
                transitionHandler?.dispose();
                try { callback(); }
                catch { }
            }
        };

        transitionHandler = EventListenerUtil.addDisposableEventListener(el, "transitionend", () => {
            complete();
        });

        ((async () => {
            try {
                await TaskUtils.delay(timeoutMs, cts.token);
                complete();
            }
            catch { }
        })()); 

        return asDisposable(() => complete());
    }
}