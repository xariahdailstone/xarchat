import { enterDelayingBlock } from "./DelayCodeUtils";
import { IDisposable, asDisposable } from "./Disposable";
import { Scheduler } from "./Scheduler";

export class AnimationFrameUtils {
    static createPerFrame(callback: () => void): IDisposable {
        let disposed = false;
        let handle: (IDisposable | null) = null;

        const onFrame = () => {
            if (!disposed) {
                handle = Scheduler.scheduleNamedCallback("AnimationFrameUtils.createPerFrame", ["nextframe", 250], onFrame);
            }
            else {
                handle = null;
            }
            
            try {
                enterDelayingBlock(() => {
                    callback();
                });
            }
            catch { }
        };
        handle = Scheduler.scheduleNamedCallback("AnimationFrameUtils.createPerFrame", ["nextframe", 250], onFrame);

        return asDisposable(() => {
            disposed = true;
            if (handle) {
                handle.dispose();
                handle = null;
            }
        });
    }

    static createWithIntervals(intervalMs: number, callback: () => void): IDisposable {
        let disposed = false;
        let rafHandle: (IDisposable | null) = null;
        let intervalHandle: (number | null) = window.setInterval(() => {
            if (rafHandle == null) {
                rafHandle = Scheduler.scheduleNamedCallback("AnimationFrameUtils.createWithIntervals", ["frame", 250], () => {
                    rafHandle = null;
                    try { callback(); }
                    catch { }
                });
            }
        }, intervalMs);

        return asDisposable(() => {
            disposed = true;
            if (rafHandle != null) {
                rafHandle.dispose();
                rafHandle = null;
            }
            window.clearInterval(intervalHandle!);
            intervalHandle = null;
        })
    }
}