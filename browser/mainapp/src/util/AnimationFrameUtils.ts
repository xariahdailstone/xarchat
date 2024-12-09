import { IDisposable, asDisposable } from "./Disposable";

export class AnimationFrameUtils {
    static createPerFrame(callback: () => void): IDisposable {
        let disposed = false;
        let handle: (number | null) = null;

        const onFrame = () => {
            if (!disposed) {
                handle = window.requestAnimationFrame(onFrame);
            }
            else {
                handle = null;
            }
            
            try {
                callback();
            }
            catch { }
        };
        handle = window.requestAnimationFrame(onFrame);

        return asDisposable(() => {
            disposed = true;
            if (handle) {
                window.cancelAnimationFrame(handle);
                handle = null;
            }
        });
    }

    static createWithIntervals(intervalMs: number, callback: () => void): IDisposable {
        let disposed = false;
        let rafHandle: (number | null) = null;
        let intervalHandle: (number | null) = window.setInterval(() => {
            if (rafHandle == null) {
                rafHandle = window.requestAnimationFrame(() => {
                    rafHandle = null;
                    try { callback(); }
                    catch { }
                });
            }
        }, intervalMs);

        return asDisposable(() => {
            disposed = true;
            if (rafHandle != null) {
                window.cancelAnimationFrame(rafHandle);
                rafHandle = null;
            }
            window.clearInterval(intervalHandle!);
            intervalHandle = null;
        })
    }
}