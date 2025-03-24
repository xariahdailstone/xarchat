import { SnapshottableMap } from "./collections/SnapshottableMap";
import { SnapshottableSet } from "./collections/SnapshottableSet";
import { asDisposable, asNamedDisposable, IDisposable } from "./Disposable";
import { Logger, Logging } from "./Logger";

export class CallbackSet<T extends (...args: any) => any> {
    private _callbacksSet: SnapshottableMap<object, CallbackInfo<T>> = new SnapshottableMap();

    constructor(
        public readonly name: string,
        private readonly onCallbackRemoved?: () => void) {

        this._callbackName = `${name}-callback`;
        this._logger = Logging.createLogger(name);
    }

    public readonly _callbackName: string;
    private readonly _logger: Logger;

    get size() { return this._callbacksSet.size; }

    private fireOnCallbackRemoved() {
        if (this.onCallbackRemoved) {
            try { this.onCallbackRemoved(); }
            catch { }
        }
    }

    add(callback: T): IDisposable {
        const myKey = {};
        const cbi: CallbackInfo<T> = {
            key: myKey,
            callback: callback,
            errorCount: 0
        };
        this._callbacksSet.set(myKey, cbi);

        return asNamedDisposable(this._callbackName, () => {
            this._callbacksSet.delete(myKey);
            this.fireOnCallbackRemoved();
        });
    }

    delete(callback: T) {
        let anyRemoved = false;
        this._callbacksSet.forEachValueSnapshotted(cbi => {
            if (cbi.callback === callback) {
                this._callbacksSet.delete(cbi.key);
                anyRemoved = true;
            }
        });
        if (anyRemoved) {
            this.fireOnCallbackRemoved();
        }
    }

    clear() {
        let anyRemoved = false;
        if (this._callbacksSet.size > 0) {
            this._callbacksSet.clear();
            anyRemoved = true;
        }
        if (anyRemoved) {
            this.fireOnCallbackRemoved();
        }
    }

    invoke(...params: Parameters<T>) {
        let anyRemoved = false;
        this._callbacksSet.forEachValueSnapshotted(cbi => {
            try {
                cbi.callback(...params);
            }
            catch (e) {
                cbi.errorCount++;
                this._logger.logError("Callback threw unhandled exception", this.name, cbi.callback, cbi.errorCount, e);

                if (cbi.errorCount > 10) {
                    this._logger.logError("Unregistering repeatedly failing callback");
                    this._callbacksSet.delete(cbi.key);
                    anyRemoved = true;
                }
            }
        });
        if (anyRemoved) {
            this.fireOnCallbackRemoved();
        }
    }
}

export class NamedCallbackSet<TName, TCallback extends (...args: any) => any> {
    private _callbacksSet: SnapshottableMap<TName, CallbackSet<TCallback>> = new SnapshottableMap();

    constructor(public readonly name: string) {
        this._callbackName = `${name}-callback`;
        this._logger = Logging.createLogger(name);
    }

    private readonly _callbackName: string;
    private readonly _logger: Logger;

    add(name: TName, callback: TCallback): IDisposable {
        let nmap = this._callbacksSet.get(name);
        if (!nmap) {
            nmap = new CallbackSet(`${this.name}-${name}`, () => {
                if (nmap!.size == 0) {
                    this._callbacksSet.delete(name);
                }
            });
            this._callbacksSet.set(name, nmap);
        }
        const innerRes = nmap.add(callback);

        return asNamedDisposable(nmap._callbackName, () => {
            innerRes.dispose();
        });
    }

    delete(name: TName, callback: TCallback) {
        const nmap = this._callbacksSet.get(name);
        if (nmap) {
            nmap.delete(callback);
        }
    }

    invoke(name: TName, ...params: Parameters<TCallback>) {
        const nmap = this._callbacksSet.get(name);
        if (nmap) {
            nmap.invoke(...params);
        }
    }
}

interface CallbackInfo<T extends (...args: any) => any> {
    readonly key: object;
    readonly callback: T;
    errorCount: number;
}

const x = new CallbackSet<(a: string, b: string) => void>("test");
