import { asDisposable, IDisposable } from './Disposable';
import { HostInterop } from './HostInterop';
import { Logger, Logging } from './Logger';
import { Observable } from './Observable';
import { CalculatedObservable } from './ObservableExpression';

export interface ConfigBlock {
    get(key: string): (unknown | null);
    getWithDefault(key: string, defaultValue: any): (unknown | null);
    set(key: string, value: (unknown | null)): void;

    getFirst(keys: string[]): (unknown | null);
    getFirstWithDefault(keys: string[], defaultValue: any): (unknown | null);

    observe(key: string, onValueUpdated: (value: (unknown | null)) => void): IDisposable;
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
    private _values: Map<string, unknown | null> = new Map();

    get(key: string): unknown | null {
        const v = this._values.get(key) ?? null;
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
            this.logDebugChange(key, value);
        }
    }

    observe(key: string, onValueUpdated: (value: unknown | null) => void): IDisposable {
        const cexpr = new CalculatedObservable("HostInteropConfigBlock.observe", () => this.get(key));
        const vsub = cexpr.addValueChangeListener(v => {
            onValueUpdated(v ?? null);
        });
        return asDisposable(cexpr, vsub);
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
            this.logDebugChange(key, value);
        }
    }

    private logDebugChange(key: string, value: (unknown | null)) {
        this._logger.logDebug("configchange", key, value);
    }
}