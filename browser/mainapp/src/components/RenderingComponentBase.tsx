import { ComponentBase, componentElement } from "./ComponentBase.js";
import { Fragment, init, jsx, VNode, styleModule, toVNode, propsModule, eventListenersModule } from "../snabbdom/index.js";
import { DependencySet, Observable, isObservable } from "../util/Observable.js";
import { ObservableBase } from "../util/ObservableBase.js";
import { ConvertibleToDisposable, DisposableOwnerField, IDisposable, asDisposable } from "../util/Disposable.js";
import { CharacterName } from "../shared/CharacterName.js";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel.js";
import { CharacterSet, CharacterStatus } from "../shared/CharacterSet.js";
import { OnlineStatus } from "../shared/OnlineStatus.js";
import { TypingStatus } from "../shared/TypingStatus.js";
import { rawAttributesModule } from "../util/snabbdom/rawAttributes.js";
import { classListNewModule } from "../util/snabbdom/classList-new.js";
import { idModule } from "../util/snabbdom/id.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { valueSyncModule } from "../util/snabbdom/valueSyncHook.js";
import { Scheduler } from "../util/Scheduler.js";

export interface RenderArguments {
    addDisposable(disp: ConvertibleToDisposable): void;
}

export interface MakeRenderingComponentOptions {
    render: (renderArgs: RenderArguments) => (VNode | [VNode, IDisposable]);
    afterRender?: () => (void | IDisposable | IDisposable[] | Iterable<IDisposable>);
}
export interface RenderingComponentFunctions {
    readonly refreshDOM: () => void;
    readonly stateHasChanged: () => void;
}
export function makeRenderingComponent<TViewModel>(
    component: ComponentBase<TViewModel>,
    options: MakeRenderingComponentOptions): RenderingComponentFunctions {

    const logger = component.logger;

    const patch = init([classListNewModule, propsModule, rawAttributesModule, styleModule, eventListenersModule, valueSyncModule /* , idModule */], undefined, {
        experimental: {
            fragments: true
        }
    });
    HTMLUtils.assignStaticHTMLFragment(component.elMain, "<span id='elPlaceholder'></span>");
    const initVNode = <div></div>;
    let currentVNode = patch(component.$("elPlaceholder")!, initVNode);

    let refreshing: number = 0;
    let refreshDisposable: IDisposable | null = null;
    let statehasChangedRegistration: IDisposable | null = null;

    let currentDependencies = new DisposableOwnerField();
    
    let isConnected = component.elMain.isConnected;

    const stateHasChanged = (obs?: any, propName?: string) => {
        if (statehasChangedRegistration == null) {
            statehasChangedRegistration = Scheduler.scheduleNamedCallback("makeRenderingComponent.stateHasChanged", ["frame", "idle", 250], () => {
                statehasChangedRegistration = null;
                refreshDOM();
            });
        }
    };
    let curDepSet: DependencySet | null = null;
    const refreshDOM = () => {
        if (statehasChangedRegistration != null) {
            statehasChangedRegistration.dispose();
            statehasChangedRegistration = null;
        }
        if (!isConnected) { return; }

        currentDependencies.value = null;
        const myDepSet = Observable.createDependencySet();
        curDepSet = myDepSet;
        myDepSet.addChangeListener((obs, propName) => { 
            //this.logger.logDebug("RenderingComponentBase myDepSet.addChangeListener", component.constructor.name, obs, propName);
            if (curDepSet == myDepSet) { 
                logger.logDebug("RenderingComponentBase myDepSet.addChangeListener match", component.constructor.name, obs, propName);
                stateHasChanged(obs, propName); 
            } 
            else {
                logger.logDebug("RenderingComponentBase myDepSet.addChangeListener mismatch", component.constructor.name, obs, propName);
            }
        });
        currentDependencies.value = myDepSet;

        refreshing++;

        if (refreshDisposable != null) {
            refreshDisposable.dispose();
            refreshDisposable = null;
        }

        const rmDisposable = Observable.addReadMonitor((vm, propName, propValue) => {
            if (/*component.isConnected && */ isObservable(vm)) {
                // if (vm instanceof ActiveLoginViewModel && propName == "pmConvosCollapsed") {
                //     debugger;
                // }
                myDepSet.maybeAddDependency(vm, propName);
            }
        });
        try {
            logger.logDebug("render() start");
            const renderStart = performance.now();

            let renderResult: (VNode | [VNode, IDisposable]);
            const rdisposables: ConvertibleToDisposable[] = [];
            try {
                renderResult = options.render({
                    addDisposable(disp: ConvertibleToDisposable) {
                        rdisposables.push(disp);
                    }
                });
                const renderEnd = performance.now();
                logger.logDebug(`render() complete, took ${renderEnd - renderStart}ms, ${myDepSet.count} deps`)
            }
            catch (e) {
                const renderEnd = performance.now();
                logger.logError(`render() failed, took ${renderEnd - renderStart}ms, ${myDepSet.count} deps`, e);
                throw e;
            }
            let newVNode: VNode;
            if (renderResult instanceof Array) {
                newVNode = renderResult[0];
                refreshDisposable = asDisposable(renderResult[1], ...rdisposables);
            }
            else {
                newVNode = renderResult;
                refreshDisposable = asDisposable(...rdisposables);
            }
            currentVNode = patch(currentVNode, newVNode);
            
            const afterRenderResult = options.afterRender ? options.afterRender() : null;
            if (afterRenderResult) {
                if (typeof (afterRenderResult as any)[Symbol.iterator] == "function") {
                    const d = asDisposable(...afterRenderResult as Iterable<IDisposable>);
                    refreshDisposable = asDisposable(refreshDisposable, d);
                }
                else if (afterRenderResult instanceof Array) {
                    refreshDisposable = asDisposable(refreshDisposable, ...afterRenderResult)
                }
                else {
                    refreshDisposable = asDisposable(refreshDisposable, afterRenderResult as IDisposable)
                }
            }
        }
        catch (e) {
            logger.logError("rendering component failure", e);
        }
        finally
        {
            rmDisposable.dispose();
            refreshing--;
        }
        logger.logDebug("refresh dependency count", component.constructor.name, myDepSet.count, myDepSet.skippedDuplicateCount);
    };

    component.addEventListener("viewmodelchange", () => {
        stateHasChanged();
    });
    component.addEventListener("connected", () => {
        isConnected = true;
        //refreshDOM();
        stateHasChanged();
    });
    component.addEventListener("disconnected", () => {
        isConnected = false;
        currentDependencies.value = null;
        if (refreshDisposable != null) {
            refreshDisposable.dispose();
            refreshDisposable = null;
        }
        currentVNode = patch(currentVNode, <></>);
    });

    return {
        refreshDOM: refreshDOM,
        stateHasChanged: stateHasChanged
    }
}

export abstract class RenderingComponentBase<TViewModel> extends ComponentBase<TViewModel> {
    constructor() {
        super();
        this._rcFuncs = makeRenderingComponent(
            this, {
                render: (args) => this.render(args),
                afterRender: () => this.afterRender()
            });
    }

    private readonly _rcFuncs: RenderingComponentFunctions;

    protected abstract render(args: RenderArguments): (VNode | [VNode, IDisposable]);

    protected afterRender(): (void | IDisposable | IDisposable[] | Iterable<IDisposable>) { }

    refreshDOM() {
        this._rcFuncs.refreshDOM();
    }

    stateHasChanged() {
        this._rcFuncs.stateHasChanged();
    }

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
}

// export abstract class RenderingComponentBaseOld<TViewModel> extends ComponentBase<TViewModel> {
//     constructor() {
//         super();

//         this.patch = init([classListNewModule, propsModule, rawAttributesModule, styleModule, eventListenersModule, valueSyncModule /* , idModule */], undefined, {
//             experimental: {
//                 fragments: true
//             }
//         });
//         HTMLUtils.assignStaticHTMLFragment(this.elMain, "<span id='elPlaceholder'></span>");

//         const initVNode = <div></div>;
//         this._currentVNode = this.patch(this.$("elPlaceholder")!, initVNode);
//     }

//     private readonly patch: any;
//     private _currentVNode: VNode | Element;

//     override get viewModel(): (TViewModel | null) { return super.viewModel; }
//     override set viewModel(value: (TViewModel | null)) { super.viewModel = value; }

//     protected override viewModelChanged(): void {
//         this.stateHasChanged();
//     }

//     protected override connectedToDocument(): void {
//         this.refreshDOM();
//     }
//     protected override disconnectedFromDocument(): void {
//         this.cleanupDependencyListeners();
//         if (this._refreshDisposable != null) {
//             this._refreshDisposable.dispose();
//             this._refreshDisposable = null;
//         }
//     }

//     private _stateHasChangedRegistration: (number | null) = null;
//     stateHasChanged(): void {
//         if (this._stateHasChangedRegistration == null) {
//             this._stateHasChangedRegistration = window.requestAnimationFrame(() => {
//                 this._stateHasChangedRegistration = null;
//                 this.refreshDOM();
//             });
//         }
//     }

//     private _refreshing: number = 0;
//     private _refreshDisposable: IDisposable | null = null;

//     refreshDOM(): void {
//         if (this._stateHasChangedRegistration != null) {
//             window.cancelAnimationFrame(this._stateHasChangedRegistration);
//             this._stateHasChangedRegistration = null;
//         }

//         this.cleanupDependencyListeners();
//         const myDepSet = this._currentDependencies;

//         this._refreshing++;
//         const rmDisposable = Observable.addReadMonitor((vm, propName, propValue) => {
//             this.addDependencyListener(myDepSet, vm, propName);
//         });
//         try
//         {
//             if (this._refreshDisposable != null) {
//                 this._refreshDisposable.dispose();
//                 this._refreshDisposable = null;
//             }
//             const renderResult = this.render();
//             let newVNode: VNode;
//             if (renderResult instanceof Array) {
//                 newVNode = renderResult[0];
//                 this._refreshDisposable = renderResult[1];
//             }
//             else {
//                 newVNode = renderResult;
//                 this._refreshDisposable = null;
//             }
//             this._currentVNode = this.patch(this._currentVNode, newVNode);
            
//             const afterRenderResult = this.afterRender();
//             if (afterRenderResult) {
//                 if (typeof (afterRenderResult as any)[Symbol.iterator] == "function") {
//                     const d = asDisposable(...afterRenderResult as Iterable<IDisposable>);
//                     this._refreshDisposable = asDisposable(this._refreshDisposable, d);
//                 }
//                 else if (afterRenderResult instanceof Array) {
//                     this._refreshDisposable = asDisposable(this._refreshDisposable, ...afterRenderResult)
//                 }
//                 else {
//                     this._refreshDisposable = asDisposable(this._refreshDisposable, afterRenderResult as IDisposable)
//                 }
//             }
//         }
//         finally {
//             rmDisposable.dispose();
//             this._refreshing--;
//         }
//     }

//     protected afterRender(): (void | IDisposable | IDisposable[] | Iterable<IDisposable>) {
//     }

// //    private _dependencyListeners: Map<object, Map<string, Disposable>> = new Map();
//     private _currentDependencies: DependencySet = new DependencySet();

//     private addDependencyListener(depSet: DependencySet, vm: any, propertyName: string) {
//         if (this.isComponentConnected && isObservable(vm)) {
//             depSet.maybeAddDependency(vm, propertyName, () => {
//                 const newListener = (vm as Observable).addEventListener("propertychange", (e) => {
//                     if (e.propertyName == propertyName && depSet == this._currentDependencies) {
//                         this.stateHasChanged();
//                     }
//                 })
//                 return newListener;
//             });
//         }
//     }

//     private cleanupDependencyListeners() {
//         this._currentDependencies.dispose();
//         this._currentDependencies = new DependencySet();
//     }

//     private readonly P_CHARNAME = {};

//     protected getCharacterStatus(characterName: CharacterName | null | undefined): CharacterStatus {
//         let alvm: (ActiveLoginViewModel | null) = null;
//         let tvm = this.viewModel;

//         if (!characterName) {
//             return CharacterSet.emptyStatus(CharacterName.create(""));
//         }

//         while (tvm) {
//             if (tvm instanceof ActiveLoginViewModel) {
//                 alvm = tvm;
//                 break;
//             }
//             tvm = (tvm as any).parent;
//         }

//         if (alvm == null) {
//             return CharacterSet.emptyStatus(characterName);
//         }

//         return alvm.characterSet.getCharacterStatus(characterName);
//     }

//     abstract render(): (VNode | [VNode, IDisposable]);
// }

// class DependencySet implements IDisposable {
//     static createOver<T>(name: string, onExpire: () => any, func: () => T): { dependencySet: DependencySet, result: T | undefined, error: any | undefined } {
//         const depSet = new DependencySet(name, onExpire);
//         let result: T | undefined = undefined;
//         let error: any | undefined = undefined;
//         {
//             using readMonitor = Observable.addReadMonitor((observable: unknown, propertyName: string, gotValue: unknown) => {
//                 depSet.maybeAddDependency(observable, propertyName);
//             });
//             try {
//                 result = func();
//             }
//             catch (e) {
//                 result = undefined;
//                 error = e;
//             }
//         }
//         return { dependencySet: depSet, result: result, error: error };
//     }

//     constructor(
//         public readonly name: string,
//         onExpire: () => any) {

//         this._onExpire = onExpire;
//     }

//     private readonly _deps: Map<any, Map<string, IDisposable>> = new Map();
//     private _count: number = 0;
//     private _duplicatesDroppedCount: number = 0;

//     private _disposed: boolean = false;
//     dispose() {
//         if (!this._disposed) {
//             this._disposed = true;
//             for (let depsForVm of this._deps.values()) {
//                 for (let depForProp of depsForVm.values()) {
//                     depForProp.dispose();
//                 }
//             }
//         }
//     }

//     [Symbol.dispose]() { this.dispose(); }

//     get isDisposed() { return this._disposed; }

//     get count() { return this._count; }
//     get duplicatesDroppedCount() { return this._duplicatesDroppedCount; }

//     private readonly _onExpire: () => any;

//     maybeAddDependency(vm: any, propertyName: string) {
//         let depsForVm = this._deps.get(vm);
//         if (!depsForVm) {
//             depsForVm = new Map();
//             this._deps.set(vm, depsForVm);
//         }

//         let depForProp = depsForVm.get(propertyName);
//         if (!depForProp) {
//             const newListener = (vm as Observable).addEventListener("propertychange", (e) => {
//                 if (e.propertyName == propertyName) {
//                     this._onExpire();
//                 }
//             })

//             this._count++;
//             depsForVm.set(propertyName, newListener);
//         }
//         else {
//             this._duplicatesDroppedCount++;
//         }
//     }
// }

// interface Dependency {
//     target: any;
//     propertyName: string;
// }

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