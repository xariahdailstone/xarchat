import { ComponentBase, componentElement } from "./ComponentBase.js";
import { Fragment, init, jsx, VNode, styleModule, toVNode, propsModule, eventListenersModule } from "../snabbdom/index.js";
import { Observable, isObservable } from "../util/Observable.js";
import { ObservableBase } from "../util/ObservableBase.js";
import { IDisposable, asDisposable } from "../util/Disposable.js";
import { CharacterName } from "../shared/CharacterName.js";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel.js";
import { CharacterSet, CharacterStatus } from "../shared/CharacterSet.js";
import { OnlineStatus } from "../shared/OnlineStatus.js";
import { TypingStatus } from "../shared/TypingStatus.js";
import { rawAttributesModule } from "../util/snabbdom/rawAttributes.js";
import { classListNewModule } from "../util/snabbdom/classList-new.js";
import { idModule } from "../util/snabbdom/id.js";
import { CharacterGender } from "../shared/CharacterGender.js";
import { HTMLUtils } from "../util/HTMLUtils.js";

export abstract class RenderingComponentBase<TViewModel> extends ComponentBase<TViewModel> {
    constructor() {
        super();

        this.patch = init([classListNewModule, propsModule, rawAttributesModule, styleModule, eventListenersModule /* , idModule */], undefined, {
            experimental: {
                fragments: true
            }
        });
        HTMLUtils.assignStaticHTMLFragment(this.elMain, "<span id='elPlaceholder'></span>");

        const initVNode = <div></div>;
        this._currentVNode = this.patch(this.$("elPlaceholder")!, initVNode);
    }

    private readonly patch: any;
    private _currentVNode: VNode | Element;

    override get viewModel(): (TViewModel | null) { return super.viewModel; }
    override set viewModel(value: (TViewModel | null)) { super.viewModel = value; }

    protected override viewModelChanged(): void {
        this.stateHasChanged();
    }

    protected override connectedToDocument(): void {
        this.refreshDOM();
    }
    protected override disconnectedFromDocument(): void {
        this.cleanupDependencyListeners();
        if (this._refreshDisposable != null) {
            this._refreshDisposable.dispose();
            this._refreshDisposable = null;
        }
    }

    private _stateHasChangedRegistration: (number | null) = null;
    stateHasChanged(): void {
        if (this._stateHasChangedRegistration == null) {
            this._stateHasChangedRegistration = window.requestAnimationFrame(() => {
                this._stateHasChangedRegistration = null;
                this.refreshDOM();
            });
        }
    }

    private _refreshing: number = 0;
    private _refreshDisposable: IDisposable | null = null;

    refreshDOM(): void {
        if (this._stateHasChangedRegistration != null) {
            window.cancelAnimationFrame(this._stateHasChangedRegistration);
            this._stateHasChangedRegistration = null;
        }

        this.cleanupDependencyListeners();
        const myDepSet = this._currentDependencies;

        this._refreshing++;
        const rmDisposable = Observable.addReadMonitor((vm, propName, propValue) => {
            this.addDependencyListener(myDepSet, vm, propName);
        });
        try
        {
            if (this._refreshDisposable != null) {
                this._refreshDisposable.dispose();
                this._refreshDisposable = null;
            }
            const renderResult = this.render();
            let newVNode: VNode;
            if (renderResult instanceof Array) {
                newVNode = renderResult[0];
                this._refreshDisposable = renderResult[1];
            }
            else {
                newVNode = renderResult;
                this._refreshDisposable = null;
            }
            this._currentVNode = this.patch(this._currentVNode, newVNode);
            
            const afterRenderResult = this.afterRender();
            if (afterRenderResult) {
                if (typeof (afterRenderResult as any)[Symbol.iterator] == "function") {
                    const d = asDisposable(...afterRenderResult as Iterable<IDisposable>);
                    this._refreshDisposable = asDisposable(this._refreshDisposable, d);
                }
                else if (afterRenderResult instanceof Array) {
                    this._refreshDisposable = asDisposable(this._refreshDisposable, ...afterRenderResult)
                }
                else {
                    this._refreshDisposable = asDisposable(this._refreshDisposable, afterRenderResult as IDisposable)
                }
            }
        }
        finally {
            rmDisposable.dispose();
            this._refreshing--;
        }
    }

    protected afterRender(): (void | IDisposable | IDisposable[] | Iterable<IDisposable>) {
    }

//    private _dependencyListeners: Map<object, Map<string, Disposable>> = new Map();
    private _currentDependencies: DependencySet = new DependencySet();

    private addDependencyListener(depSet: DependencySet, vm: any, propertyName: string) {
        if (this.isComponentConnected && isObservable(vm)) {
            depSet.maybeAddDependency(vm, propertyName, () => {
                const newListener = (vm as Observable).addEventListener("propertychange", (e) => {
                    if (e.propertyName == propertyName && depSet == this._currentDependencies) {
                        this.stateHasChanged();
                    }
                })
                return newListener;
            });
        }
    }

    private cleanupDependencyListeners() {
        this._currentDependencies.dispose();
        this._currentDependencies = new DependencySet();
    }

    private readonly P_CHARNAME = {};

    protected getCharacterStatus(characterName: CharacterName | null | undefined): CharacterStatus {
        let alvm: (ActiveLoginViewModel | null) = null;
        let tvm = this.viewModel;

        if (!characterName) {
            return CharacterSet.emptyStatus(CharacterName.create(""));
        }

        while (tvm) {
            if (tvm instanceof ActiveLoginViewModel) {
                alvm = tvm;
                break;
            }
            tvm = (tvm as any).parent;
        }

        if (alvm == null) {
            return CharacterSet.emptyStatus(characterName);
        }

        return alvm.characterSet.getCharacterStatus(characterName);
    }

    abstract render(): (VNode | [VNode, IDisposable]);
}

class DependencySet implements IDisposable {
    constructor() {
    }

    private readonly _deps: Map<any, Map<string, IDisposable>> = new Map();

    dispose() {
        for (let depsForVm of this._deps.values()) {
            for (let depForProp of depsForVm.values()) {
                depForProp.dispose();
            }
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    maybeAddDependency(vm: any, propertyName: string, setupFunc: () => IDisposable) {
        let depsForVm = this._deps.get(vm);
        if (!depsForVm) {
            depsForVm = new Map();
            this._deps.set(vm, depsForVm);
        }

        let depForProp = depsForVm.get(propertyName);
        if (!depForProp) {
            depForProp = setupFunc();
            depsForVm.set(propertyName, depForProp);
        }
    }
}

interface Dependency {
    target: any;
    propertyName: string;
}

export class TestRenderViewModel extends ObservableBase {
    characterName: string | null = null;
}

@componentElement("x-testrendered")
export class TestRenderedComponent extends RenderingComponentBase<TestRenderViewModel> {

    constructor() {
        super();
        this.viewModel = new TestRenderViewModel();
    }

    override render() {
        return <>
            <div class={{ mytestclass: this.viewModel?.characterName == "foo" }}>
                {this.viewModel?.characterName ?? ""}
            </div>
        </>;
    }
}