import { h } from "../snabbdom/h.js";
import { CallbackSet, NamedCallbackSet } from "./CallbackSet.js";
import { SnapshottableMap } from "./collections/SnapshottableMap.js";
import { SnapshottableSet } from "./collections/SnapshottableSet.js";
import { IDisposable, EmptyDisposable, asDisposable } from "./Disposable.js";
import { testEquality } from "./Equality.js";
import { setupValueSubscription, ValueSubscriptionImpl } from "./ObservableBase.js";
import { ObservableExpression } from "./ObservableExpression.js";

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
    private static _listeners: Set<ReadMonitorEventListener> = new Set();

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

    static getDependenciesMonitor(func: () => any): DependencySet {
        const ds = new DependencySetImpl();
        let returned = false;
        try {
            const rm = Observable.addReadMonitor((observable, propertyName) => {
                ds.maybeAddDependency(observable, propertyName);
            });
            try {
                func();
            }
            finally {
                rm.dispose();
            }

            returned = true;
            return ds;
        }
        finally {
            if (!returned) {
                ds.dispose();
            }
        }
    }

    static calculate<T>(name: string, func: () => T): T {
        const oe = new CalculatedObservable(name, func);
        return oe.value;
    }

    static inReadSubScope<T>(func: () => T): T {
        const origListeners = this._listeners;
        this._listeners = new Set();
        try {
            return func();
        }
        finally {
            this._listeners = origListeners;
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

    static publishNamedRead(name: NamedObservableName, gotValue: unknown) {
        const o = new DynamicNameObservable(name);
        Observable.publishRead(o, "value", gotValue);
    }

    static publishNamedUpdate(name: NamedObservableName, value: unknown) {
        const o = new DynamicNameObservable(name);
        o.raisePropertyChangeEvent("value", value);
    }

    static createDependencySet(): DependencySet {
        const result = new DependencySetImpl();
        return result;
    }

    static createDependencySetOver<T>(
        onExpire: () => any,
        func: () => T): { dependencySet: DependencySet, result: T | undefined, error: any | undefined } {

        const depSet = new DependencySetImpl();
        depSet.addChangeListener(onExpire);
        let result: T | undefined = undefined;
        let error: any | undefined = undefined;
        try {
            using rm = Observable.addReadMonitor((observable, propertyName) => {
                depSet.maybeAddDependency(observable, propertyName);
            });
            result = func();
        }
        catch (e) {
            error = e;
        }
        return { dependencySet: depSet, result: result, error: error };
    }
}

export type NamedObservableName = string; // | CompoundObservableName;

export class CompoundObservableName {
    constructor(private readonly parts: any[]) {
    }

    equals(other: CompoundObservableName): boolean {
        if (other.parts.length != this.parts.length) { return false; }
        for (let i = 0; i < this.parts.length; i++) {
            const a = this.parts[i];
            const b = other.parts[i];
            if (!testEquality(a, b)) { return false; }
        }
        return true;
    }
}

class DynamicNameObservable implements Observable {
    private static _listeners2: NamedCallbackSet<string, PropertyChangeEventListener> = new NamedCallbackSet("DynamicNameObservable");

    constructor(
        private readonly name: NamedObservableName) {
    }

    addEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): IDisposable {
        if (eventName == "propertychange") {
            return DynamicNameObservable._listeners2.add(this.name, handler);
        }
        else {
            return EmptyDisposable;
        }
    }

    removeEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): void {
        if (eventName == "propertychange") {
            DynamicNameObservable._listeners2.delete(this.name, handler);
        }
    }

    raisePropertyChangeEvent(propertyName: string, propValue: unknown): void {
        const args = new PropertyChangeEvent(propertyName, propValue);
        Observable.enterObservableFireStack(() => {
            DynamicNameObservable._listeners2.invoke(this.name, args);
        });
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

    name: string | null = null;
    debug: boolean = false;

    withName(name: string): ObservableValue<T> {
        this.name = name;
        return this;
    }

    private _propertyChangeListeners2: CallbackSet<PropertyChangeEventListener> | null = null;

    addEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): IDisposable {
        if (this.debug) { let x = 1; }
        if (eventName == "propertychange") {
            if (!this._propertyChangeListeners2) {
                this._propertyChangeListeners2 = new CallbackSet("ObservableValue", () => {
                    if (this._propertyChangeListeners2?.size == 0) {
                        this._propertyChangeListeners2 = null;
                    }
                });
            }

            return this._propertyChangeListeners2.add(handler);
        }
        else {
            return EmptyDisposable;
        }
    }

    removeEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): void {
        if (this.debug) { let x = 1; }
        if (this._propertyChangeListeners2) {
            this._propertyChangeListeners2.delete(handler);
        }
    }

    raisePropertyChangeEvent(propertyName: string, propValue: unknown): void {
        if (this.debug) { let x = 1; }
        if (this._propertyChangeListeners2) {
            Observable.enterObservableFireStack(() => {
                const pce = new PropertyChangeEvent(propertyName, propValue);
                this._propertyChangeListeners2?.invoke(pce);
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

export interface DependencySet extends IDisposable {
    debug: boolean;
    readonly count: number;
    readonly skippedDuplicateCount: number;
    addChangeListener(callback: (observable?: any, propertyName?: string) => any): IDisposable;
    maybeAddDependency(vm: any, propertyName: string): void;
}

class DependencySetImpl implements DependencySet {
    constructor() {
    }

    private readonly _deps: Map<any, Map<string, IDisposable>> = new Map();

    private _count: number = 0;
    private _skippedDuplicateCount: number = 0;

    private _disposed: boolean = false;
    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            for (let depsForVm of this._deps.values()) {
                for (let depForProp of depsForVm.values()) {
                    depForProp.dispose();
                }
            }
            this._deps.clear();
            this._changeListeners.clear();
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }

    debug: boolean = false;

    get count() { return this._count; }
    get skippedDuplicateCount() { return this._skippedDuplicateCount; }

    maybeAddDependency(vm: any, propertyName: string) {
        let depsForVm = this._deps.get(vm);
        if (!depsForVm) {
            depsForVm = new Map();
            this._deps.set(vm, depsForVm);
        }

        let depForProp = depsForVm.get(propertyName);
        if (!depForProp) {
            depForProp = this.attachToObservable(vm, propertyName);
            depsForVm.set(propertyName, depForProp);
            this._count++;
        }
        else {
            this._skippedDuplicateCount++;
        }
    }

    private attachToObservable(observable: any, propertyName: string): IDisposable {
        const newListener = (observable as Observable).addEventListener("propertychange", (e) => {
            if (e.propertyName == propertyName) {
                this.stateHasChanged(observable, propertyName);
            }
        })
        return newListener;
    }

    private stateHasChanged(observable: any, propertyName: string) {
        const cl = this._changeListeners;
        cl.forEachValueSnapshotted(v => {
            try { v(observable, propertyName); }
            catch { }
        });
        this.dispose();
    }

    private readonly _changeListeners: SnapshottableMap<object, (observable?: any, propertyName?: string) => any> = new SnapshottableMap();
    addChangeListener(callback: () => any): IDisposable {
        if (!this._disposed) {
            const myKey = {};
            this._changeListeners.set(myKey, callback);
            return asDisposable(() => {
                this._changeListeners.delete(myKey);
            });
        }
        else {
            return EmptyDisposable;
        }
    }
}

interface Dependency {
    target: any;
    propertyName: string;
}

export class CalculatedObservable<T> implements Observable, IDisposable {
    constructor(
        public readonly name: string,
        private readonly expression: () => T) {

        this._cbSet = new CallbackSet<PropertyChangeEventListener>("CalculatedObservable", () => this.maybeStopObserving());

        Observable.inReadSubScope(() => {
            this.updateValue();
        });
    }

    private _cachedValueIsError = false;
    private _cachedValue: T | undefined = undefined;
    private _cachedError: any = undefined;

    private _isDisposed = false;
    private _observing = false;
    private readonly _cbSet: CallbackSet<PropertyChangeEventListener>;
    private _depSet: DependencySet | null = null;

    get isDisposed(): boolean { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            this.refreshDepSet();
        }
    }

    [Symbol.dispose](): void { this.dispose(); }

    private updateValue() {
        const prevEffValue = this._cachedValueIsError ? this._cachedError : this._cachedValue;

        try {
            const res = this.expression();
            this._cachedValueIsError = false;
            this._cachedValue = res;
            this._cachedError = undefined;
        }
        catch (e) {
            this._cachedValueIsError = true;
            this._cachedValue = undefined;
            this._cachedError = e;
        }

        const newEffValue = this._cachedValueIsError ? this._cachedError : this._cachedValue;

        if (prevEffValue !== newEffValue) {
            this.raisePropertyChangeEvent("value", newEffValue);
        }

        return newEffValue;
    }

    private startObserving() {
        if (!this._observing && !this._isDisposed) {
            this._observing = true;
            this.refreshDepSet();
        }
    }

    private maybeStopObserving() { 
        if (this._observing) {
            this._observing = false;
            this.refreshDepSet();
        }
    }

    private refreshDepSet() {
        if (this._depSet != null) {
            this._depSet.dispose();
            this._depSet = null;
        }
        if (this._isDisposed || !this._observing) { return; }

        Observable.inReadSubScope(() => {
            const cdsResult = Observable.createDependencySetOver(
                () => this.refreshDepSet(),
                () => this.updateValue()
            );
            this._depSet = cdsResult.dependencySet;
        });
    }

    get value(): T {
        if (this._cachedValueIsError) {
            Observable.publishRead(this, "value", this._cachedError);
            throw this._cachedError;
        }
        else {
            Observable.publishRead(this, "value", this._cachedValue);
            return this._cachedValue!;
        }
    }

    addEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): IDisposable {
        const res = this._cbSet.add(handler);
        this.startObserving();
        return res;
    }

    removeEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): void {
        this._cbSet.delete(handler);
    }

    raisePropertyChangeEvent(propertyName: string, propValue: unknown): void {
        this._cbSet.invoke(new PropertyChangeEvent(propertyName, propValue));
    }

    addValueSubscription(propertyPath: string, handler: (value: any) => any): ValueSubscription {
        return setupValueSubscription(this, propertyPath, handler);
    }
   
}