import { CancellationToken } from "./CancellationTokenSource";

export class PromiseSource<T> {
    static resolvedPromise<T>(value: T): Promise<T> {
        const ps = new PromiseSource<T>();
        ps.resolve(value);
        return ps.promise;
    }

    constructor() {
        let fresolve: (value: T) => void;
        let freject: (reason?: any) => void;
        this.promise = new Promise<T>((resolve, reject) => {
            fresolve = resolve;
            freject = reject;
        });
        this._resolve = fresolve!;
        this._reject = freject!;
    }

    readonly promise: Promise<T>;

    private _complete: boolean = false;
    private readonly _resolve: (value: T) => void;
    private readonly _reject: (reason?: any) => void;

    resolve(value: T) {
        this._complete = true;
        this._resolve(value);
    }

    reject(reason?: any) {
        this._complete = true;
        this._reject(reason);
    }

    setCancelled(cancellationToken?: CancellationToken) {
        this.reject(new OperationCancelledError(undefined, cancellationToken));
    }

    tryResolve(value: T): boolean {
        if (!this._complete) {
            this._complete = true;
            this._resolve(value);
            return true;
        }
        else {
            return false;
        }
    }

    tryReject(reason?: any) {
        if (!this._complete) {
            this._complete = true;
            this._reject(reason);
        }
    }

    trySetCancelled(cancellationToken?: CancellationToken) {
        this.tryReject(new OperationCancelledError(undefined, cancellationToken));
    }
}

export class OperationCancelledError extends Error {
    constructor(message?: string, cancellationToken?: CancellationToken) {
        super(message != null ? message : "Operation cancelled");
        this.cancellationToken = cancellationToken;
    }

    readonly cancellationToken?: CancellationToken;
}