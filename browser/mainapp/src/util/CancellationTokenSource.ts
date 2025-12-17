import { CallbackSet } from "./CallbackSet";
import { SnapshottableSet } from "./collections/SnapshottableSet";
import { EmptyDisposable, IDisposable, asDisposable } from "./Disposable";
import { OperationCancelledError } from "./PromiseSource";
import { Scheduler } from "./Scheduler";

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

    private readonly _registeredHandlers2: CallbackSet<CancellationEventHandler> = new CallbackSet("CancellationTokenImpl");

    register(callback: CancellationEventHandler): (IDisposable & Disposable) {
        if (this.isCancellationRequested) {
            try { callback(); }
            catch { }
        }

        return this._registeredHandlers2.add(callback);
    }

    cancel() {
        if (!this.isCancellationRequested) {
            this.isCancellationRequested = true;
            this._abortController.abort();
            this._registeredHandlers2.invoke();
        }
    }
}

export class CancellationTokenSource implements IDisposable {
    static readonly DefaultToken: CancellationToken = new NoneCancellationTokenImpl();

    static createLinkedSource(...cancellationTokens: CancellationToken[]): CancellationTokenSource {
        const result = new CancellationTokenSource();

        const resultReg = result.token.register(() => {
            unlinkRegistrations();
        });

        let registrations: IDisposable[] = [];

        const unlinkRegistrations = () => {
            for (let xreg of registrations) {
                xreg.dispose();
            }
            registrations = [];
            resultReg.dispose();
        };
        const linkedTokenCancelled = () => {
            unlinkRegistrations();
            result.cancel();
        };

        result._onDisposeFunc = () => { unlinkRegistrations(); };

        for (let ltoken of cancellationTokens) {
            if (result.isCancellationRequested) { break; }

            registrations.push(ltoken.register(linkedTokenCancelled));
        }

        return result;
    }

    constructor() {
    }

    private _onDisposeFunc: ((() => void) | null) = null;

    private _disposed: boolean = false;
    private _cancelAfterHandler: IDisposable | null = null;

    get isCancellationRequested(): boolean { return this._token.isCancellationRequested; }

    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            if (this._cancelAfterHandler) {
                this._cancelAfterHandler.dispose();
                this._cancelAfterHandler = null;
            }
            if (this._onDisposeFunc) {
                this._onDisposeFunc();
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
                this._cancelAfterHandler.dispose();
                this._cancelAfterHandler = null;
            }
            this._cancelAfterHandler = Scheduler.scheduleNamedCallback("CancellationTokenSource.cancelAfter", ms, 
                () => { this.cancel(); });
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