import { IDisposable } from "./Disposable";
import { Logging } from "./Logger";
import { Scheduler } from "./Scheduler";

const logger = Logging.createLogger("requestAnimationFrameHook");

let isHooked = false;
export function hookRequestAnimationFrame() {
    if (isHooked) { return; }

    isHooked = true;

    let _nextHandleNumber: number = 1;
    let _waitingCallbacks: Map<number, FrameRequestCallback> = new Map();

    let _currentRAFHandle: number | null = null;
    let _currentTimeoutHandle: IDisposable | null = null;

    const originalRAF: (callback: FrameRequestCallback) => number = (window as any).requestAnimationFrame;
    const originalCAF: (handle: number) => any = (window as any).cancelAnimationFrame;

    const stopRegistrations = () => {
        if (_currentRAFHandle != null) {
            originalCAF(_currentRAFHandle);
            _currentRAFHandle = null;
        }
        if (_currentTimeoutHandle != null) {
            _currentTimeoutHandle.dispose();
            _currentTimeoutHandle = null;
        }
    }

    const processRAFEvents = (timestamp: DOMHighResTimeStamp) => {
        stopRegistrations();

        const myCallbacks = [..._waitingCallbacks.keys()];
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

    const wany = window as any;

    wany.requestAnimationFrame = function (callback: FrameRequestCallback) {
        const myNumber = _nextHandleNumber++;
        _waitingCallbacks.set(myNumber, callback);

        if (_currentRAFHandle == null) {
            _currentRAFHandle = originalRAF((timestamp) => {
                _currentRAFHandle = null;
                processRAFEvents(timestamp);
            });
        }
        if (_currentTimeoutHandle == null) {
            _currentTimeoutHandle = Scheduler.scheduleNamedCallback("requestAnimationFrame fallback", 250, () => {
                _currentTimeoutHandle = null;
                processRAFEvents(window.performance.now());
            });
        }
        return myNumber;
    };
    wany.cancelAnimationFrame = function(handle: number) {
        _waitingCallbacks.delete(handle);
        if (_waitingCallbacks.size == 0) {
            stopRegistrations();
        }
    }

    wany.requestActualAnimationFrame = function (callback: FrameRequestCallback) {
        return originalRAF(callback);
    };
    wany.cancelActualAnimationFrame = function (handle: number) {
        originalCAF(handle);
    };
}

export interface HasActualRAF {
    requestActualAnimationFrame(callback: FrameRequestCallback): number;
    cancelActualAnimationFrame(handle: number): void;
}

abstract class AnimationFrameManagerBase implements IDisposable {
    constructor() {
    }

    private _isDisposed: boolean = false;
    get isDisposed(): boolean { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            this.cancelAnimationFrame();
        }
    }
    
    [Symbol.dispose](): void { this.dispose(); }

    private _rafHandle: number | null = null;
    private _currentCallback: FrameRequestCallback | null = null;
    private _isExecuting: boolean = false;

    requestAnimationFrame(callback: FrameRequestCallback): void {
        if (this._isDisposed) {
            throw new Error("FirstInAnimationFrameManager is disposed");
        }
        this.requestAnimationFrameInner((n) => {
            this._isExecuting = true;
            try {
                callback(n);
            }
            finally {
                this._isExecuting = false;
            }
        });
    }

    protected windowRequestAnimationFrame(callback: FrameRequestCallback): number {
        const res = (window as unknown as HasActualRAF).requestActualAnimationFrame((n) => {
            this._rafHandle = null;
            callback(n);
        });
        this._rafHandle = res;
        this._currentCallback = callback;
        return res;
    }
    protected windowCancelAnimationFrame(): void {
        if (this._rafHandle != null) {
            (window as unknown as HasActualRAF).cancelActualAnimationFrame(this._rafHandle);
            this._rafHandle = null;
            this._currentCallback = null;
        }
    }

    protected abstract requestAnimationFrameInner(callback: FrameRequestCallback): void

    cancelAnimationFrame() {
        this.windowCancelAnimationFrame();
    }

    executeImmediately() {
        if (this._currentCallback != null) {
            const cc = this._currentCallback;
            this.cancelAnimationFrame();

            cc(window.performance.now());
        }
    }

    get hasPendingAnimationFrame() { return this._rafHandle != null; }
    get hasExecutingAnimationFrame() { return this._isExecuting; }
    get hasPendingOrExecutingAnimationFrame() { return this._rafHandle != null || this._isExecuting; }
}

export class FirstInAnimationFrameManager extends AnimationFrameManagerBase {
    protected override requestAnimationFrameInner(callback: FrameRequestCallback) {
        if (!this.hasPendingAnimationFrame) {
            this.windowRequestAnimationFrame(n => {
                callback(n);
            });
        }
    }
}

export class LatestOnlyAnimationFrameManager extends AnimationFrameManagerBase {
    protected override requestAnimationFrameInner(callback: FrameRequestCallback) {
        this.cancelAnimationFrame();
        this.windowRequestAnimationFrame(n => {
            callback(n);
        });
    }
}