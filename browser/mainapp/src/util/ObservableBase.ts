import { SnapshottableSet } from "./collections/SnapshottableSet.js";
import { asDisposable, EmptyDisposable, IDisposable, isDisposable } from "./Disposable.js";
import { Logger, Logging } from "./Logger.js";
import { ObjectUniqueId } from "./ObjectUniqueId.js";
import { Observable, PropertyChangeEvent, PropertyChangeEventListener, ValueSubscription } from "./Observable.js";
import { Collection } from "./ObservableCollection.js";

const DEBUG_PROP: string | null = null; // "scrolledTo";

const NullDisposable: IDisposable = EmptyDisposable;

type ObservableReader = [string, (instance: any) => any];

const obsPropsMetadata: Map<Function, ObservableReader[]> = new Map();

export abstract class ObservableBase implements Observable {
    constructor() {
        this.logger = Logging.createLogger(`${this.constructor.name}#${ObjectUniqueId.get(this)}`);
    }

    private readonly _disposeSentinel: object | null = null;

    private readonly _lastSeenProps: Map<string, any> = new Map();
    private readonly _propertyListeners: Map<string, SnapshottableSet<PropertyChangeEventListener>> = new Map();

    protected logger: Logger;

    addPropertyListener(propertyName: string, onChangeCallback: PropertyChangeEventListener): IDisposable {
        let lset = this._propertyListeners.get(propertyName);
        if (!lset) {
            lset = new SnapshottableSet<PropertyChangeEventListener>();
            this._propertyListeners.set(propertyName, lset);
        }
        lset.add(onChangeCallback);

        return asDisposable(() => {
            this.removePropertyListener(propertyName, onChangeCallback);
        });
    }

    removePropertyListener(propertyName: string, onChangeCallback: PropertyChangeEventListener) {
        let lset = this._propertyListeners.get(propertyName);
        if (lset) {
            lset.delete(onChangeCallback);
            if (lset.size == 0) {
                this._propertyListeners.delete(propertyName);
            }
        }
    }

    addEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): IDisposable {
        if (eventName == "propertychange") {
            return this.addPropertyListener("*", handler);
        }
        else {
            return NullDisposable;
        }
    }

    removeEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): void {
        if (eventName == "propertychange") {
            this.removePropertyListener("*", handler);
        }
    }

    raisePropertyChangeEvent(propertyName: string, propValue: unknown): void {
        const lset = this._propertyListeners.get(propertyName);
        if (lset) {
            Observable.enterObservableFireStack(() => {
                const evt = new PropertyChangeEvent(propertyName, propValue);
                lset.forEachValueSnapshotted(x => {
                    try { x(evt); }
                    catch { }
                });
            });
        }

        const lset2 = this._propertyListeners.get("*");
        if (lset2) {
            Observable.enterObservableFireStack(() => {
                const evt = new PropertyChangeEvent(propertyName, propValue);
                lset2.forEachValueSnapshotted(x => {
                    try { x(evt); }
                    catch { }
                });
            });
        }
    }

    addValueSubscription(propertyPath: string, handler: (value: any) => any): ValueSubscription {
        return setupValueSubscription(this, propertyPath, handler);
    }

    scanForChanges(debug?: boolean) {
        if (debug) {
            this.logger.logDebug("scanForChanges", this);
        }
        let xx = this; //Object.getPrototypeOf(this);
        while (xx != null) {
            const dx = obsPropsMetadata.get(xx.constructor);
            
            if (dx) {
                for (let r of dx) {
                    const key = r[0];
                    const reader = r[1];
                    try {
                        const value = reader(this);
                        const prevValue = this._lastSeenProps?.get(key);
                        if (this._lastSeenProps && prevValue !== value) {
                            this._lastSeenProps.set(key, value);
                            if (debug) {
                                this.logger.logDebug("raising prop change", this, key);
                            }
                            this.raisePropertyChangeEvent(key, value);
                        }
                        else {
                            //this.logger.logDebug("prop unchanged", key);
                        }
                    }
                    catch { }
                }
            }

            xx = Object.getPrototypeOf(xx);
        }
    }
}

export class ValueSubscriptionImpl implements ValueSubscription {
    constructor(
        private readonly valueFunc: () => any,
        private readonly onDispose?: (() => any) | undefined) {
    }

    get value() { return this.valueFunc(); }

    _disposed = false;

    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            if (this.onDispose) {
                this.onDispose();
            }
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }
}

export function setupValueSubscription(observable: Observable, propertyPath: string, handler: (value: any) => any): ValueSubscription {
    const ppDotIdx = propertyPath.indexOf('.');
    const thisProp = (ppDotIdx == -1) ? propertyPath : propertyPath.split('.')[0];
    
    let curValue: any = null;
    let myEventListener: (IDisposable | null) = null;
    let mySubSubscription: (ValueSubscription | null) = null;

    const result = new ValueSubscriptionImpl(
        () => curValue, 
        () => {
            teardownChain();
            curValue = null;
        }
    );

    const setCurValue = (newValue: any) => {
        if (newValue !== curValue) {
            curValue = newValue;
            handler(newValue);
        }
    };

    function canAddValueSubscription(obj: any) {
        return obj != null && typeof obj.addValueSubscription == "function";
    }

    const setupChain = () => {
        teardownChain();
        myEventListener = observable.addEventListener("propertychange", e => {
            if (e.propertyName == thisProp) {
                setupChain();
            }
        });

        const curThisValue = (observable as any)[thisProp];
        if (ppDotIdx == -1) {
            setCurValue(curThisValue);
        }
        else {
            if (canAddValueSubscription(curThisValue)) {
                const subPropertyPath = propertyPath.split('.');
                subPropertyPath.shift();
                mySubSubscription = (curThisValue as Observable).addValueSubscription(subPropertyPath.join('.'), (v) => {
                    setCurValue(v);
                });
                setCurValue(mySubSubscription.value);
            }
            else if (curThisValue instanceof Collection) {
                setCurValue(null);
            }
            else {
                setCurValue(null);
            }
        }
    };
    const teardownChain = () => {
        if (mySubSubscription) {
            mySubSubscription.dispose();
        }
        if (myEventListener) {
            myEventListener.dispose();
        }
    };
    
    setupChain();

    return result;
}

const PROP_SYM = Symbol("allprops");
function enumAllProperties2<T>(obj: T): Iterable<Extract<keyof T, string>> {
    if (obj == null) {
        return [];
    }
    if ((obj as any)[PROP_SYM]) {
        return (obj as any)[PROP_SYM] as any;
    }

    let ret: Set<Extract<keyof T, string>> = new Set();
    for (let x of enumAllProperties2(Object.getPrototypeOf(obj))) {
        ret.add(x as any);
    }
    for (let x of Object.getOwnPropertyNames(obj)) {
        ret.add(x as any);
    }

    (obj as any)[PROP_SYM] = ret;
    return ret;
}

function *enumAllProperties<T>(obj: T): IterableIterator<Extract<keyof T, string>> {
    let returned: Set<string> = new Set();
    while (obj != null) {
        for (let x of Object.getOwnPropertyNames(obj)) {
            if (!returned.has(x)) {
                returned.add(x);
                yield x as any;
            }
        }
        obj = Object.getPrototypeOf(obj);
    }
}

const wrapModelLogger: Logger = Logging.createLogger("wrapModel");
export function wrapModel<T extends object>(rawModel: T): (T & Observable) {

    const previousPropertyValues = new Map<Extract<keyof T, string>, any>();

    const scanForChanges = () => {
        //const changedProps: string[] = [];
        const toFire: (() => void)[] = [];

        //for (let propName in rawModel) {
        //for (let propName of enumAllProperties(rawModel)) {
        for (let propName of enumAllProperties2(rawModel)) {
            let ovalue: any;
            try {
                ovalue = rawModel[propName];
            }
            catch { 
                continue;
            }
            if (propName == DEBUG_PROP) {
                wrapModelLogger.logDebug(`${propName} from ${previousPropertyValues.get(propName)} to ${ovalue}`);
            }
            if (previousPropertyValues.get(propName) !== ovalue) {
                //changedProps.push(propName);
                const tPropName = propName;
                toFire.push(() => {
                    try { raisePropertyChangeEvent(tPropName, ovalue); } catch { }
                });
            }

            previousPropertyValues.set(propName, ovalue);
        }

        if (toFire.length > 0) {
            Observable.enterObservableFireStack(() => {
                for (let fire of toFire) {
                    fire();
                }
            });
        }
    };

    let propertyChangedListeners = new SnapshottableSet<PropertyChangeEventListener>();

    const addEventListener = (eventName: string, handler: PropertyChangeEventListener): IDisposable => {
        if (eventName == "propertychange") {
            propertyChangedListeners.add(handler);
        }
        return asDisposable(() => {
            propertyChangedListeners.delete(handler);
        });
    };
    const removeEventListener = (eventName: string, handler: PropertyChangeEventListener) => {
        if (eventName == "propertychange") {
            propertyChangedListeners.delete(handler);
        }
    };
    const raisePropertyChangeEvent = (propertyName: string, propValue: unknown) => {
        Observable.enterObservableFireStack(() => {
            propertyChangedListeners.forEachValueSnapshotted(v => {
                try {
                    v(new PropertyChangeEvent(propertyName, propValue));
                }
                catch {
                }
            });
        });
        //Observable.publishRead(result, propertyName, (rawModel as any)[propertyName]);
    };

    const handler = {
        get(target: T, prop: PropertyKey, receiver: unknown) {
            if (prop === "addEventListener") {
                return addEventListener;
            }
            else if (prop == "removeEventListener") {
                return removeEventListener;
            }
            else if (prop == "raisePropertyChangeEvent") {
                return raisePropertyChangeEvent;
            }
            else {
                const gotValue = Reflect.get(target, prop, receiver);
                if (typeof prop == "string") {
                    try { Observable.publishRead(result, prop, gotValue); } catch { }
                }
                if (prop == DEBUG_PROP) {
                    wrapModelLogger.logDebug(`get ${prop} = ${gotValue}`);
                }
                return gotValue;
            }
        },
        set(target: T, prop: PropertyKey, value: unknown) {
            if (prop == DEBUG_PROP) {
                wrapModelLogger.logDebug(`set ${prop} = ${value}`);
            }
            const result = Reflect.set(target, prop, value);
            scanForChanges();
            return result;
        }
    };

    const result = new Proxy(rawModel, handler) as (T & Observable);
    return result;
}

export function observablePropertyExt(options: { debug: boolean }) {
    return function (target: any, propertyKey: string, descriptor?: PropertyDescriptor) {
        return observablePropertyInternal({ ...options, target, propertyKey, descriptor });    
    }
}

export function observableProperty(target: any, propertyKey: string, descriptor?: PropertyDescriptor) {
    return observablePropertyInternal({target, propertyKey, descriptor});
}

const observablePropertyInternalLogger: Logger = Logging.createLogger("observablePropertyInternal");
function observablePropertyInternal(options: { target: any, propertyKey: string, descriptor?: PropertyDescriptor, debug?: boolean }) {
    const target = options.target;
    const propertyKey = options.propertyKey;
    const descriptor = options.descriptor;
    const debug = options.debug ?? false;

    const taa = (target.constructor as any);
    if (!obsPropsMetadata.has(taa)) {
        obsPropsMetadata.set(taa, []);
    }
    const mdArray = obsPropsMetadata.get(taa)!;

    //observablePropertyInternalLogger.logDebug(`defining get/set for ${descriptor ? 'property' : 'field'} ${propertyKey} on ${taa.name}`);

    if (descriptor) {
        const origGet = descriptor.get;
        const origSet = descriptor.set;
    
        descriptor.get = function() {
            const result = origGet?.call(this);
            if (debug) observablePropertyInternalLogger.logDebug("reading prop", propertyKey, result);
            Observable.publishRead(this, propertyKey, result);
            return result;
        };
        descriptor.set = function(value: any) {
            if (debug) observablePropertyInternalLogger.logDebug("writing prop", propertyKey, value);
            origSet?.call(this, value);
            if (this && typeof((this as any).scanForChanges) == "function") {
                (this as any).scanForChanges(debug);
            }
        };

        mdArray.push([ propertyKey, (instance: any) => { return origGet?.call(instance); }]);
    }
    else {
        const SYM_PROP_FIELD = Symbol(`${propertyKey} backing field`);
        (target as any)[SYM_PROP_FIELD] = (target as any)[propertyKey];
        
        delete (target as any)[propertyKey];

        Object.defineProperty(target, propertyKey, {
            get: function() {
                if (debug) observablePropertyInternalLogger.logDebug("reading fld", propertyKey);
                const result = (this as any)[SYM_PROP_FIELD];
                Observable.publishRead(this, propertyKey, result);
                return result;
            },
            set: function(value: any) {
                if (debug) observablePropertyInternalLogger.logDebug("writing fld", propertyKey, value);
                (this as any)[SYM_PROP_FIELD] = value;
                if (this && typeof((this as any).scanForChanges) == "function") {
                    (this as any).scanForChanges(debug);
                }
            },
            configurable: true,
            enumerable: true
        });

        mdArray.push([ propertyKey, (instance: any) => { return instance[SYM_PROP_FIELD] } ]);
    }
}