import { asDisposable } from "../util/Disposable.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { ActiveLoginViewModel, SelectableTab, SelectedChannel } from "../viewmodel/ActiveLoginViewModel.js";
import { AddChannelsViewModel } from "../viewmodel/AddChannelsViewModel.js";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { RenderingComponentBase } from "./RenderingComponentBase.js";

@componentElement("x-stage")
export class Stage extends ComponentBase<ActiveLoginViewModel> {
    constructor() {
        super();

        HTMLUtils.clearChildren(this.elMain);

        this.watchExpr(vm => vm.selectedTab, st => {
            let createdEl: (ComponentBase<any> | null) = null;
            this.logDebug("Stage viewModel change", st);

            if (st) {
                createdEl = StageViews.getComponentFor(st);
            }
    
            // if (v instanceof ChannelViewModel) {
            //     createdEl = document.createElement("x-channelview");
            // }
            // else if (v instanceof AddChannelsViewModel) {
            //     createdEl = document.createElement("x-addchannelsview");
            // }

            if (createdEl) {
                createdEl.classList.add("actor");
                createdEl.viewModel = st;
                this.elMain.appendChild(createdEl);
                if (typeof (createdEl as any).viewActivated == "function") {
                    (createdEl as any).viewActivated();
                }
                return asDisposable(() => {
                    createdEl!.remove();
                });
            }
        });
    }
}

class StageViews {
    private static _registeredStageViewTypes: Map<ConstructorOf<any>, ConstructorOf<ComponentBase<any>>> = new Map();

    static registerStageComponentType<TAbstractViewModel, TViewModel extends TAbstractViewModel>(
        viewModelType: ConstructorOf<TViewModel>, elementClass: ConstructorOf<ComponentBase<TAbstractViewModel>>) {

        this._registeredStageViewTypes.set(viewModelType, elementClass);
    }

    static getComponentFor(vm: object): (ComponentBase<any> | null) {
        for (let k of this._registeredStageViewTypes.keys()) {
            if (vm instanceof k) {
                const viewEl = new (this._registeredStageViewTypes.get(k)!)();
                //viewEl.viewModel = vm;
                return viewEl;
            }
        }
        return null;
    }
}

interface ConstructorOf<T> {
    new (...params: any[]): T;
}

export function stageViewFor<TAbstractViewModel, TViewModel extends TAbstractViewModel>(vm: ConstructorOf<TViewModel>) {
    return function(target: ConstructorOf<ComponentBase<TAbstractViewModel>>) {
        StageViews.registerStageComponentType(vm, target);
    }
}

interface IStageViewComponent {
    viewActivated(): void;
}

export class StageViewComponent<T> extends ComponentBase<T> implements IStageViewComponent {
    viewActivated(): void {
    }
}

export abstract class RenderingStageViewComponent<T> extends RenderingComponentBase<T> implements IStageViewComponent {
    viewActivated(): void {
    }
}