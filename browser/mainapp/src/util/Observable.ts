import { h } from "../snabbdom/h.js";
import { SnapshottableSet } from "./collections/SnapshottableSet.js";
import { IDisposable, EmptyDisposable, asDisposable } from "./Disposable.js";
import { setupValueSubscription, ValueSubscriptionImpl } from "./ObservableBase.js";

export interface Observable {
    addEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): IDisposable;
    removeEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): void;
//    raisePropertyChangeEvent(propertyName: string): void;
    raisePropertyChangeEvent(propertyName: string, propValue: unknown): void;

    addValueSubscription(propertyPath: string, handler: (value: any) => any): ValueSubscription;
}

export function isObservable(obj: any) {
    if (obj == null) return false;
    return (typeof obj.addEventListener == "function" &&
        typeof obj.removeEventListener == "function" &&
        typeof obj.raisePropertyChangeEvent == "function" &&
        typeof obj.addValueSubscription == "function");
}

export class PropertyChangeEvent extends Event {
    constructor(public readonly propertyName: string, public readonly propertyValue: unknown) {
        super("propertychange");
    }
}

export type PropertyChangeEventListener = (event: PropertyChangeEvent) => any;

export interface ValueSubscription extends IDisposable {
    readonly value: any;
}

export class Observable {
    private static readonly _listeners: Set<ReadMonitorEventListener> = new Set();

    private static _currentFireStackDepth = 0;
    private static _currentFireStackCount = 0;
    private static _maxFireStackDepth = 0;
    private static readonly MAX_FIRE_STACK_DEPTH = 500;
    private static readonly MAX_FIRE_STACK_COUNT = 10000;
    static enterObservableFireStack(callback: () => any) {
        if (this._currentFireStackDepth == 0) {
            this._currentFireStackDepth = 1;
            this._currentFireStackCount = 1;
            this._maxFireStackDepth = 1;
        }
        else {
            this._currentFireStackDepth++;
            this._currentFireStackCount++;
        }
        try {
            this._maxFireStackDepth = Math.max(this._currentFireStackDepth, this._maxFireStackDepth);
            callback();
        }
        finally {
            this._currentFireStackDepth--;
            if (this._currentFireStackDepth == 0) {
                //this.logging.logDebug(`[ObservableFireStack] maxDepth=${this._maxFireStackDepth} count=${this._currentFireStackCount}`);
                this._currentFireStackCount = 0;
                this._currentFireStackDepth = 0;
                this._maxFireStackDepth = 0;
            }
        }
    }

    static addReadMonitor(listener: ReadMonitorEventListener): (IDisposable & Disposable) {

        this._listeners.add(listener);

        let disposed = false;
        return asDisposable(() => {
            if (!disposed) {
                this._listeners.delete(listener);
            }
        });
    }

    static publishRead(observable: unknown, propertyName: string, gotValue: unknown) {
        for (let listener of this._listeners) {
            try {
                listener(observable, propertyName, gotValue);
            }
            catch { }
        }
    }

    static publishNamedRead(name: string, gotValue: unknown) {
        const o = new DynamicNameObservable(name);
        Observable.publishRead(o, "value", gotValue);
    }

    static publishNamedUpdate(name: string, value: unknown) {
        const o = new DynamicNameObservable(name);
        o.raisePropertyChangeEvent("value", value);
    }
}

class DynamicNameObservable implements Observable {
    private static _listeners: Map<string, SnapshottableSet<PropertyChangeEventListener>> = new Map();

    constructor(
        private readonly name: string) {
    }

    addEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): IDisposable {
        if (eventName == "propertychange") {
            let lx = DynamicNameObservable._listeners.get(this.name);
            if (!lx) {
                lx = new SnapshottableSet();
                DynamicNameObservable._listeners.set(this.name, lx);
            }

            lx.add(handler);
            return asDisposable(() => {
                this.removeEventListener("propertychange", handler);
            });
        }
        else {
            return asDisposable();
        }
    }

    removeEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): void {
        if (eventName == "propertychange") {
            let lx = DynamicNameObservable._listeners.get(this.name);
            if (lx) {
                lx.delete(handler);
                if (lx.size == 0) {
                    DynamicNameObservable._listeners.delete(this.name);
                }
            }
        }
    }

    raisePropertyChangeEvent(propertyName: string, propValue: unknown): void {
        const lx = DynamicNameObservable._listeners.get(this.name);
        if (lx) {
            Observable.enterObservableFireStack(() => {
                const args = new PropertyChangeEvent(propertyName, propValue);
                lx.forEachValueSnapshotted(h => {
                    try { h(args); }
                    catch { }
                });
            });
        }
    }

    addValueSubscription(propertyPath: string, handler: (value: any) => any): ValueSubscription {
        if (propertyPath == "." || propertyPath == "value") {
            let disposed = false;
            let lastValue: any = null;
            
            const h = this.addEventListener("propertychange", (args) => {
                lastValue = args.propertyValue;
                try { handler(lastValue); }
                catch { }
            });

            const result = new ValueSubscriptionImpl(() => lastValue, () => h.dispose());
            return result;
        }
        else {
            const result = new ValueSubscriptionImpl(() => null);
            return result;
        }
    }
}

export type ReadMonitorEventListener = (observable: unknown, propertyName: string, gotValue: unknown) => void;

export class ObservableValue<T> implements Observable {
    constructor(initialValue: T, debug?: boolean) {
        this._value = initialValue;
        this.debug = debug ?? false;
    }

    debug: boolean = false;

    private _propertyChangeListeners: SnapshottableSet<PropertyChangeEventListener> | null = null;

    addEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): IDisposable {
        if (this.debug) { let x = 1; }
        if (eventName == "propertychange") {
            if (!this._propertyChangeListeners) {
                this._propertyChangeListeners = new SnapshottableSet();
            }

            this._propertyChangeListeners.add(handler);

            return asDisposable(() => {
                this.removeEventListener(eventName, handler);
            });
        }
        else {
            return EmptyDisposable;
        }
    }

    removeEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): void {
        if (this.debug) { let x = 1; }
        if (this._propertyChangeListeners) {
            this._propertyChangeListeners.delete(handler);
            if (this._propertyChangeListeners.size == 0) {
                this._propertyChangeListeners = null;
            }
        }
    }

    raisePropertyChangeEvent(propertyName: string, propValue: unknown): void {
        if (this.debug) { let x = 1; }
        if (this._propertyChangeListeners) {
            Observable.enterObservableFireStack(() => {
                const pce = new PropertyChangeEvent(propertyName, propValue);
                this._propertyChangeListeners!.forEachValueSnapshotted(l => {
                    try { l(pce); }
                    catch { }
                });
            });
        }
    }

    addValueSubscription(propertyPath: string, handler: (value: any) => any): ValueSubscription {
        if (this.debug) { let x = 1; }
        return setupValueSubscription(this, propertyPath, handler);
    }

    private _value: T;

    get value(): T { 
        if (this.debug) { let x = 1; }
        const result = this._value;
        Observable.publishRead(this, "value", result);
        return result;
    }

    set value(value: T) {
        if (this.debug) { let x = 1; }
        if (value !== this._value) {
            this._value = value;
            this.raisePropertyChangeEvent("value", value);
        }
    }
}