import { Logging } from "./Logger";

const logger = Logging.createLogger("requestAnimationFrameHook");

let isHooked = false;
export function hookRequestAnimationFrame() {
    if (isHooked) { return; }

    isHooked = true;

    let _nextHandleNumber: number = 1;
    let _waitingCallbacks: Map<number, FrameRequestCallback> = new Map();

    let _currentRAFHandle: number | null = null;
    let _currentTimeoutHandle: number | null = null;

    const originalRAF: (callback: FrameRequestCallback) => number = (window as any).requestAnimationFrame;
    const originalCAF: (handle: number) => any = (window as any).cancelAnimationFrame;

    const stopRegistrations = () => {
        if (_currentRAFHandle != null) {
            originalCAF(_currentRAFHandle);
            _currentRAFHandle = null;
        }
        if (_currentTimeoutHandle != null) {
            window.clearTimeout(_currentTimeoutHandle);
            _currentTimeoutHandle = null;
        }
    }

    const processRAFEvents = (timestamp: DOMHighResTimeStamp) => {
        stopRegistrations();

        const myCallbacks = _waitingCallbacks.keys().toArray();
        logger.logDebug("triggering requestAnimationFrame", myCallbacks.length);
        for (let tkey of myCallbacks) {
            const tcallback = _waitingCallbacks.get(tkey);
            if (tcallback) {
                _waitingCallbacks.delete(tkey);
                try { tcallback(timestamp); }
                catch { }
            }
        }
    };

    (window as any).requestAnimationFrame = function (callback: FrameRequestCallback) {
        const myNumber = _nextHandleNumber++;
        _waitingCallbacks.set(myNumber, callback);

        if (_currentRAFHandle == null) {
            _currentRAFHandle = originalRAF((timestamp) => {
                _currentRAFHandle = null;
                processRAFEvents(timestamp);
            });
        }
        if (_currentTimeoutHandle == null) {
            _currentTimeoutHandle = window.setTimeout(() => {
                _currentTimeoutHandle = null;
                processRAFEvents(window.performance.now());
            }, 1000);
        }
        return myNumber;
    };
    (window as any).cancelAnimationFrame = function(handle: number) {
        _waitingCallbacks.delete(handle);
        if (_waitingCallbacks.size == 0) {
            stopRegistrations();
        }
    }
}
