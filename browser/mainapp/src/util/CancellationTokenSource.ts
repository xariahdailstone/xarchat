import { SnapshottableSet } from "./collections/SnapshottableSet";
import { EmptyDisposable, IDisposable, asDisposable } from "./Disposable";
import { OperationCancelledError } from "./PromiseSource";

class NoneCancellationTokenImpl implements CancellationToken {
    constructor() {
        var acs = new AbortController();
        this.signal = acs.signal;
        this._emptyDisposable = EmptyDisposable;
    }

    private _emptyDisposable: (IDisposable & Disposable);

    get isCancellationRequested(): boolean {
        return false;
    }

    readonly signal: AbortSignal;

    register(callback: CancellationEventHandler): (IDisposable & Disposable) {
        return this._emptyDisposable;
    }

    throwIfCancellationRequested(): void {
    }
}

class CancellationTokenImpl implements CancellationToken {
    constructor() {
        this.signal = this._abortController.signal;
    }


    isCancellationRequested: boolean = false;

    throwIfCancellationRequested() {
        if (this.isCancellationRequested) {
            throw new OperationCancelledError("cancelled", this);
        }
    }

    private readonly _abortController: AbortController = new AbortController();
    readonly signal: AbortSignal;

    private readonly _registeredHandlers: SnapshottableSet<CancellationEventHandler> = new SnapshottableSet();
    register(callback: CancellationEventHandler): (IDisposable & Disposable) {
        if (this.isCancellationRequested) {
            try { callback(); }
            catch { }
        }

        this._registeredHandlers.add(callback);

        let disposed = false;
        return asDisposable(() => {
            if (!disposed) {
                this._registeredHandlers.delete(callback);
            }
        });
    }

    cancel() {
        if (!this.isCancellationRequested) {
            this.isCancellationRequested = true;
            this._abortController.abort();
            this._registeredHandlers.forEachValueSnapshotted(handler => {
                try { handler(); }
                catch { }
            });
        }
    }
}

export class CancellationTokenSource implements IDisposable {
    static readonly DefaultToken: CancellationToken = new NoneCancellationTokenImpl();

    constructor() {
    }

    private _disposed: boolean = false;
    private _cancelAfterHandler: number | null = null;

    get isCancellationRequested(): boolean { return this._token.isCancellationRequested; }

    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            if (this._cancelAfterHandler) {
                window.clearTimeout(this._cancelAfterHandler);
                this._cancelAfterHandler = null;
            }
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }

    cancel() {
        if (!this._disposed) {
            this._disposed = true;
            this._token.cancel();
        }
    }

    cancelAfter(ms: number) {
        if (!this._disposed) {
            if (this._cancelAfterHandler) {
                window.clearTimeout(this._cancelAfterHandler);
            }
            this._cancelAfterHandler = window.setTimeout(() => { this.cancel(); }, ms);
        }
    }

    private readonly _token: CancellationTokenImpl = new CancellationTokenImpl();
    get token(): CancellationToken { return this._token; }
}

(window as any)["__CancellationTokenSource"] = CancellationTokenSource;

export interface CancellationToken {
    get isCancellationRequested(): boolean;
    get signal(): AbortSignal;
    register(callback: CancellationEventHandler): (IDisposable & Disposable);
    throwIfCancellationRequested(): void;
}

export const CancellationToken = {
    get NONE() { return CancellationTokenSource.DefaultToken; }
};

(window as any)["__CancellationTokenNone"] = CancellationToken.NONE;

export type CancellationEventHandler = () => any;