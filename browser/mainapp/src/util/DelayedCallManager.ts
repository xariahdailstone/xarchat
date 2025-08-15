

export class DelayedCallManager {
    constructor(
        private readonly callStyle: DelayedCallStyle, 
        private readonly scheduler: DelayedCallScheduler) {

    }

    private _currentlyScheduledCall: (() => void) | null = null;
    private _isScheduled = false;
    private _unscheduleFunc: (() => void) | null = null;

    scheduleDelayedCall(func: () => void) {
        if (this._currentlyScheduledCall) {
            this._currentlyScheduledCall = func;
        }
        else {
            switch (this.callStyle) {
                case DelayedCallStyle.RUN_FIRST:
                    break;
                default:
                case DelayedCallStyle.RUN_LAST:
                    this._currentlyScheduledCall = func;
                    break;
            }
        }
        if (!this._isScheduled) {
            this.schedule();
        }
    }

    cancelDelayedCall() {
        if (this._unscheduleFunc) {
            this._unscheduleFunc();

            this._currentlyScheduledCall = null;
            this._isScheduled = false;
            this._unscheduleFunc = null;
        }
    }

    private schedule() {
        switch (this.scheduler) {
            default:
            case DelayedCallScheduler.REQUEST_ANIMATION_FRAME:
                {
                    const n = window.requestAnimationFrame(() => this.runDelayedCall());
                    this._unscheduleFunc = () => window.cancelAnimationFrame(n);
                    this._isScheduled = true;
                }
                break;
            case DelayedCallScheduler.SET_TIMEOUT_1MS:
                {
                    const n = window.setTimeout(() => this.runDelayedCall(), 1);
                    this._unscheduleFunc = () => window.clearTimeout(n);
                    this._isScheduled = true;
                }
                break;
        }
    }

    private runDelayedCall() {
        const csc = this._currentlyScheduledCall;

        this._currentlyScheduledCall = null;
        this._isScheduled = false;
        this._unscheduleFunc = null;

        if (csc) {
            try {
                csc();
            }
            catch (e) { 
                // TODO: log failure                
            }
        }
    }
}

export enum DelayedCallStyle {
    RUN_FIRST,
    RUN_LAST
}

export enum DelayedCallScheduler {
    REQUEST_ANIMATION_FRAME,
    SET_TIMEOUT_1MS
}