import { VNode, jsx, Fragment } from "../snabbdom/index";
import { ArrayUtils } from "./ArrayUtils";
import { CallbackSet } from "./CallbackSet";
import { asDisposable, ConvertibleToDisposable, IDisposable } from "./Disposable";
import { Logger, Logging } from "./Logger";
import { DependencySet, IObservable, Observable, PropertyChangeEvent, PropertyChangeEventListener, ValueSubscription } from "./Observable";
import { setupValueSubscription } from "./ObservableBase";
import { ISubrenderingManager, SubrenderArguments } from "./SubrenderingManager";

export class SubrenderingManager2 implements ISubrenderingManager {
    constructor(private readonly name: string) {
        this.logger = Logging.createLogger(`SubrenderingManager2#${name}`);
    }

    private readonly logger: Logger;

    private _isDisposed: boolean = false;
    get isDisposed() { return this._isDisposed; }
    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            for (let v of this._currentSubrenders.values()) {
                v.dispose();
            }
            this._currentSubrenders.clear();
        }
    }
    [Symbol.dispose](): void { this.dispose(); }

    private _currentSubrenders: Map<string, SubrenderData<any>> = new Map();

    mark(): void {
        if (this._isDisposed) { return; }
        for (let v of this._currentSubrenders.values()) {
            v.isActive = false;
        }
        this.logger.logDebug("marked cached items", this._currentSubrenders.size);
    }
    sweep(): void {
        if (this._isDisposed) { return; }
        const keysToRemove: string[] = [];
        for (let kvp of this._currentSubrenders) {
            const key = kvp[0];
            const value = kvp[1];
            if (!value.isActive) {
                value.dispose();
                keysToRemove.push(key);
            }
        }
        for (let key of keysToRemove) {
            this.logger.logDebug("swept stale subitem", key);
            this._currentSubrenders.delete(key);
        }
        this.logger.logDebug("active items cached", this._currentSubrenders.size);
    }

    private areArgumentsEquivalent(a: any, b: any): boolean {
        if (a == null && b == null) { return true; }
        if (a == null || b == null) { return false; }

        const aType = typeof a;
        const bType = typeof b;
        if (aType != bType) { return false; }

        if (aType == "object") {
            if (Array.isArray(aType) && Array.isArray(bType)) {
                return ArrayUtils.areEquivalent(a, b);
            }
            else if (Array.isArray(aType) || Array.isArray(bType)) {
                return false;
            }

            if (a !== b) {
                const aPropNames = Object.getOwnPropertyNames(a);
                const bPropNames = Object.getOwnPropertyNames(b);
                if (aPropNames.length != bPropNames.length) { return false; }
                for (let propName of aPropNames) {
                    const bPropIdx = bPropNames.indexOf(propName);
                    if (bPropIdx == -1) { return false; }
                    bPropNames.splice(bPropIdx, 1);

                    const aValue = a[propName];
                    const bValue = b[propName];
                    if (!this.areArgumentsEquivalent(aValue, bValue)) { return false; }
                }
                if (bPropNames.length != 0) { return false; }
            }
            return true;
        }
        else {
            return (a == b);
        }
    }

    getOrCreate<TAdditionalData>(key: string, additionalData: TAdditionalData, createFunc: (rargs: SubrenderArguments<TAdditionalData>) => VNode): VNode {
        if (this._isDisposed) { return <></>; }
        const cachedValue = this._currentSubrenders.get(key);
        if (cachedValue) {
            if (cachedValue.isExpired) {
                this.logger.logDebug("item stale due to depset", key);
                cachedValue.dispose();
            }
            else if (this.areArgumentsEquivalent(cachedValue.additionalData, additionalData)) {
                return cachedValue.cloneResult();
            }
            else {
                this.logger.logDebug("item stale due to additionalData", key);
                cachedValue.dispose();
            }
        }
        else {
            this.logger.logDebug("rendering new subitem", key);
        }

        const src = new SubrenderData(additionalData, createFunc);
        this._currentSubrenders.set(key, src);
        return src.cloneResult();
    }

}

class SubrenderData<TAdditionalData> implements IDisposable, IObservable<any> {
    constructor(
        public readonly additionalData: TAdditionalData, 
        createFunc: (rargs: SubrenderArguments<TAdditionalData>) => VNode) {

        const depset = Observable.inReadSubScope(() => {
            return Observable.createDependencySetOver(
                () => { },
                () => {
                    return createFunc({
                        additionalData: additionalData,
                        addDisposable: (d: ConvertibleToDisposable) => {
                            this._disposables.push(d);
                        }
                    });
                }
            )
        });
        this._origResult = depset.result!;
        this._depSet = depset.dependencySet;
        let expiredNum = 0;
        this._depSet.addChangeListener(() => {
            this.isExpired = true;
            this.raisePropertyChangeEvent(SubrenderData.PROPNAME_EXPIRED, ++expiredNum);
        });
    }

    private readonly _cbSet: CallbackSet<PropertyChangeEventListener> = new CallbackSet("SubrenderingManager2");
    addEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): IDisposable {
        return this._cbSet.add(handler);
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

    private readonly _origResult: VNode;
    private readonly _depSet: DependencySet;
    private readonly _disposables: ConvertibleToDisposable[] = [];

    private _isDisposed: boolean = false;
    get isDisposed() { return this._isDisposed; }
    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            this._depSet.dispose();
            asDisposable(...this._disposables).dispose();
        }
    }
    [Symbol.dispose](): void { this.dispose(); }

    isActive: boolean = true;

    isExpired: boolean = false;

    private static readonly PROPNAME_EXPIRED = "expired";

    cloneResult(): VNode {
        Observable.publishRead(this, SubrenderData.PROPNAME_EXPIRED, 0);
        this.isActive = true;
        return this.cloneVNode(this._origResult);
    }

    private cloneVNode(origNode: VNode): VNode {
        const result = {...origNode};
        if (result.children) {
            for (let i = 0; i < result.children?.length; i++) {
                const titem = result.children[i];
                if (typeof titem != "string") {
                    result.children[i] = this.cloneVNode(titem);
                }
            }
        }
        return result;
    }
}