import { RenderArguments } from "../components/RenderingComponentBase";
import { VNode } from "../snabbdom/index";
import { CallbackSet } from "./CallbackSet";
import { asDisposable, ConvertibleToDisposable, IDisposable, ObjectDisposedError } from "./Disposable";
import { testEquivalent } from "./Equality";
import { Logger, Logging } from "./Logger";
import { CreateDependencySetOverResult, Observable, PropertyChangeEvent, PropertyChangeEventListener, ValueSubscription } from "./Observable";
import { setupValueSubscription } from "./ObservableBase";

interface RenderResult {
    additionalData: any;
    disposableSet: IDisposable;
    vnode: VNode | null;
    error: any | null;
}

export interface SubrenderArguments<TAdditionalData> extends RenderArguments {
    additionalData: TAdditionalData;
}

export class SubrenderingManager implements IDisposable, Observable {
    constructor(
        private readonly name: string) {

        const xname = `SubrenderingManager:${name}`;
        this._callbackSet = new CallbackSet(xname);
        this._logger = Logging.createLogger(xname);
    }

    private _isDisposed = false;
    get isDisposed() { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            const ur = this._unusedRenders.values();
            this._unusedRenders.clear();
            ur.forEach(v => {
                v.disposableSet.dispose();
            });
            const ur2 = this._usedRenders.values();
            this._usedRenders.clear();
            ur2.forEach(v => {
                v.disposableSet.dispose();
            });
        }
    }
    [Symbol.dispose](): void {
        this.dispose();
    }

    private _nextUpdValue: number = 0;

    private readonly _logger: Logger;
    private _unusedRenders: Map<string, RenderResult> = new Map();
    private _usedRenders: Map<string, RenderResult> = new Map();

    // Marks all current subrenders as unused
    mark() {
        this._usedRenders.forEach((value, key) => {
            this._unusedRenders.set(key, value);
        });
        this._usedRenders.clear();
    }

    // Disposes subrenders that are still marked unused
    sweep() {
        const ur = [...this._unusedRenders.values()];
        this._unusedRenders.clear();
        this._logger.logDebug(`sweeping ${ur.length} renders`);
        ur.forEach(rr => {
            rr.disposableSet?.dispose();
        });
        this._logger.logDebug(`swept ${ur.length} renders`);
    }

    private tryGetExisting<TAdditionalData>(key: string, additionalData: TAdditionalData): VNode | null {
        if (this._unusedRenders.has(key)) {
            const rrRes = this._unusedRenders.get(key)!;
            if (testEquivalent(rrRes.additionalData, additionalData)) {
                this._unusedRenders.delete(key);
                this._usedRenders.set(key, rrRes);
                Observable.publishRead(this, key, rrRes.vnode);
                if (rrRes.error) {
                    throw rrRes.error;
                }
                return rrRes.vnode!;
            }
            else {
                this._unusedRenders.delete(key);
                rrRes.disposableSet.dispose();
            }
        }
        if (this._usedRenders.has(key)) {
            const rrRes = this._usedRenders.get(key)!;
            if (testEquivalent(rrRes.additionalData, additionalData)) {
                Observable.publishRead(this, key, rrRes.vnode);
                if (rrRes.error) {
                    throw rrRes.error;
                }
                return rrRes.vnode!;
            }
            else {
                this._usedRenders.delete(key);
                rrRes.disposableSet.dispose();
            }
        }
        return null;
    }
    private setValue(key: string, rr: RenderResult) {
        if (this._unusedRenders.has(key)) {
            const rrRes = this._unusedRenders.get(key);
            this._unusedRenders.delete(key);
            rrRes?.disposableSet.dispose();
        }
        if (this._usedRenders.has(key)) {
            const rrRes = this._usedRenders.get(key);
            if (rrRes == rr) return;
            this._usedRenders.delete(key);
            rrRes?.disposableSet.dispose();
        }
        this._usedRenders.set(key, rr);
    }

    private _nextRenderId: number = 1;
    getOrCreate<TAdditionalData>(key: string, additionalData: TAdditionalData, createFunc: (rargs: SubrenderArguments<TAdditionalData>) => VNode): VNode {
        if (this._isDisposed) { throw new ObjectDisposedError(this); }

        {
            const existing = this.tryGetExisting(key, additionalData);
            if (existing) {
                return existing;
            }
        }

        const myRenderId = this._nextRenderId++;
        this._logger.logDebug(`performing fresh render (${myRenderId}) for ${key}`);
        const disposables: ConvertibleToDisposable[] = [];

        const sdepsetres = Observable.inReadSubScope(() => 
            Observable.createDependencySetOver(
                () => {},
                () => {
                    const rargs: SubrenderArguments<TAdditionalData> = {
                        addDisposable(disp: ConvertibleToDisposable) {
                            disposables.push(disp);
                        },
                        additionalData: additionalData
                    };
                    const vnode = createFunc(rargs);
                    return vnode;
                }
            )
        );
        const combinedDisposable = asDisposable(
            ...disposables,
            sdepsetres.dependencySet,
            () => {
                this._logger.logDebug(`dropped existing render (${myRenderId}) for ${key}`);
            });

        sdepsetres!.dependencySet.addChangeListener(() => {
            let gotrrRes: RenderResult | null = null;
            if (this._usedRenders.has(key)) {
                const rrRes = this._usedRenders.get(key);
                if (rrRes?.disposableSet == combinedDisposable) {
                    this._usedRenders.delete(key);
                    gotrrRes = rrRes;
                }
            }
            if (this._unusedRenders.has(key)) {
                const rrRes = this._unusedRenders.get(key);
                if (rrRes?.disposableSet == combinedDisposable) {
                    this._unusedRenders.delete(key);
                    gotrrRes = rrRes;
                }
            }

            if (gotrrRes) {
                this._logger.logDebug(`subrender item updated for ${key} by (${myRenderId})`);
                gotrrRes.disposableSet.dispose();
                this.raisePropertyChangeEvent(key, this._nextUpdValue++);    
            }
            else {
                this._logger.logWarn(`subrender item updated for ${key} by (${myRenderId}) - BUT NO MATCH`);
            }
        });

        this.setValue(key, { additionalData: additionalData, disposableSet: combinedDisposable, vnode: sdepsetres.result ?? null, error: sdepsetres.error ?? null });
        if (sdepsetres.error) {
            Observable.publishRead(this, key, sdepsetres.error);
            throw sdepsetres.error;
        }
        else {
            Observable.publishRead(this, key, sdepsetres.result);
            return sdepsetres.result!;
        }
    }

    private readonly _callbackSet: CallbackSet<PropertyChangeEventListener>;
    addEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): IDisposable {
        return this._callbackSet.add(handler);
    }
    removeEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): void {
        this._callbackSet.delete(handler);
    }
    raisePropertyChangeEvent(propertyName: string, propValue: unknown): void {
        this._callbackSet.invoke(new PropertyChangeEvent(propertyName, propValue));
    }
    addValueSubscription(propertyPath: string, handler: (value: any) => any): ValueSubscription {
        return setupValueSubscription(this, propertyPath, handler);
    }

}