import { CallbackSet } from './CallbackSet';
import { KeyValuePair } from './collections/KeyValuePair';
import { SnapshottableMap } from './collections/SnapshottableMap';
import { IDisposable } from './Disposable';
import { HostInterop } from './HostInterop';
import { Logger, Logging } from './Logger';
import { Observable } from './Observable';
import { ObservableExpression } from './ObservableExpression';

export interface ConfigBlock {
    get(key: string): (unknown | null);
    getWithDefault(key: string, defaultValue: any): (unknown | null);
    set(key: string, value: (unknown | null)): void;

    getFirst(keys: string[]): (unknown | null);
    getFirstWithDefault(keys: string[], defaultValue: any): (unknown | null);

    observe(key: string, onValueUpdated: (value: (unknown | null)) => void): IDisposable;
    observeAll(onValueUpdated: (key: string, value: (unknown | null)) => void): IDisposable;

    forEach(callback: (kvp: KeyValuePair<string, unknown | null>) => void): void;
}

export class HostInteropConfigBlock implements ConfigBlock {

    static async createAsync(): Promise<HostInteropConfigBlock> {
        var pairs = await HostInterop.getConfigValuesAsync();
        const result = new HostInteropConfigBlock(pairs);
        HostInterop.registerConfigChangeCallback(kvp => {
            result.hostAssign(kvp.key, kvp.value);
        });
        return result;
    }

    private constructor(pairs: { key: string, value: (unknown | null)}[]) {
        this._logger = Logging.createLogger("HostInteropConfigBlock");
        for (let pair of pairs) {
            if (pair.value != null) {
                this._values.set(pair.key, pair.value);
            }
        }
    }

    private readonly _logger: Logger;
    private _values: SnapshottableMap<string, unknown | null> = new SnapshottableMap();

    get(key: string): unknown | null {
        let v = this._values.get(key) ?? null;
        if (v instanceof Array) {
            v = [ ...v ];
        }
        Observable.publishNamedRead(`hicb:${key}`, v);
        return v;
    }

    getWithDefault(key: string, defaultValue: any): (unknown | null) {
        return this.get(key) ?? defaultValue;
    }

    getFirst(keys: string[]): (unknown | null) {
        for (let tkey of keys) {
            const v = this.get(tkey);
            if (v != null) {
                return v;
            }
        }
        return null;
    }

    getFirstWithDefault(keys: string[], defaultValue: any): (unknown | null) {
        return this.getFirst(keys) ?? defaultValue;
    }

    set(key: string, value: string | null): void {
        const v = this._values.get(key) ?? null;
        if (value != v) {
            if (value != null) {
                this._values.set(key, value);
            }
            else {
                this._values.delete(key);
            }
            HostInterop.setConfigValue(key, value);
            Observable.publishNamedUpdate(`hicb:${key}`, value);
            this._allObservers.invoke(key, value);
            this.logDebugChange(key, value);
        }
    }

    observe(key: string, onValueUpdated: (value: unknown | null) => void): IDisposable {
        const expr = new ObservableExpression(() => this.get(key),
            (v) => { onValueUpdated(v ?? null); },
            (err) => { onValueUpdated(null); });

        return expr;
    }

    private _allObservers: CallbackSet<(key: string, value: (unknown | null)) => void> = new CallbackSet("ConfigBlockAllObservers");
    observeAll(onValueUpdated: (key: string, value: (unknown | null)) => void): IDisposable {
        return this._allObservers.add(onValueUpdated);
    }

    hostAssignSet(pairs: { key: string, value: (unknown | null) }[]): void {
        for (let pair of pairs) {
            this.hostAssign(pair.key, pair.value);
        }
    }

    hostAssign(key: string, value: (unknown | null)): void {
        const v = this._values.get(key) ?? null;
        if (value != v) {
            if (value != null) {
                this._values.set(key, value);
            }
            else {
                this._values.delete(key);
            }
            Observable.publishNamedUpdate(`hicb:${key}`, value);
            this._allObservers.invoke(key, value);
            this.logDebugChange(key, value);
        }
    }

    forEach(callback: (kvp: KeyValuePair<string, unknown | null>) => void) {
        this._values.forEachEntrySnapshotted(kvp => {
            callback(new KeyValuePair(kvp[0], kvp[1]));
        });
    }

    private logDebugChange(key: string, value: (unknown | null)) {
        this._logger.logDebug("configchange", key, value);
    }
}