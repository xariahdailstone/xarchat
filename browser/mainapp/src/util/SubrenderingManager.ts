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

export interface ISubrenderingManager extends IDisposable {
    mark(): void;
    sweep(): void;
    getOrCreate<TAdditionalData>(key: string, additionalData: TAdditionalData, createFunc: (rargs: SubrenderArguments<TAdditionalData>) => VNode): VNode;
}

export class NullSubrenderingManager implements ISubrenderingManager {
    private _isDisposed: boolean = false;
    get isDisposed() { return this._isDisposed; }
    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            if (this._currentRenderDisposables.length > 0) {
                const disps = this._currentRenderDisposables;
                this._currentRenderDisposables = [];
                asDisposable(...disps).dispose();
            }
        }
    }
    [Symbol.dispose](): void { this.dispose(); }

    private _currentRenderDisposables: ConvertibleToDisposable[] = [];

    mark(): void {
        if (this._currentRenderDisposables.length > 0) {
            const disps = this._currentRenderDisposables;
            this._currentRenderDisposables = [];
            asDisposable(...disps).dispose();
        }
    }
    sweep(): void {
    }

    getOrCreate<TAdditionalData>(key: string, additionalData: TAdditionalData, createFunc: (rargs: SubrenderArguments<TAdditionalData>) => VNode): VNode {
        const result = createFunc({
            additionalData: additionalData,
            addDisposable: (disp: ConvertibleToDisposable) => {
                this._currentRenderDisposables.push(disp);
            }
        });
        return result;
    }
}

export interface SubrenderArguments<TAdditionalData> extends RenderArguments {
    additionalData: TAdditionalData;
}