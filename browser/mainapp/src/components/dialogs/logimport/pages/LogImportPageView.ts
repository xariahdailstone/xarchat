import { VNode, VNodeData, jsx } from "../../../../snabbdom/index";
import { IDisposable } from "../../../../util/Disposable";
import { VNodeUtils } from "../../../../util/VNodeUtils";
import { ComponentBase } from "../../../ComponentBase";
import { makeRenderingComponent, RenderArguments, RenderArgumentsWithViewModel, RenderingComponentBase } from "../../../RenderingComponentBase";

export interface ConstructorOf<T> {
    new (...params: any[]): T;
}

const pageViews: { viewModelType: ConstructorOf<any>, getElementNameFunc: () => string }[] = [];

export abstract class LogImportPageView<T> extends ComponentBase<T> {
    static getVNodeForPage(vm: any, data?: VNodeData): VNode {
        const myData = { ...data };
        if (!myData.props) { myData.props = {}; }
        myData.props["viewModel"] = vm;

        const vmctor = vm.constructor;
        for (let tpair of pageViews) {
            if (vmctor == tpair.viewModelType) {
                const elName = tpair.getElementNameFunc();
                return jsx(elName, myData);
            }
        }

        return jsx("x-logimport-unknownpage", myData);
    }

    constructor() {
        super();

        makeRenderingComponent(this, {
            render: (args) => {
                const viewModel = this.viewModel;
                if (!viewModel) { return VNodeUtils.createEmptyFragment(); }
                return this.render({ ...args, viewModel: viewModel });
            }
        });
    }

    protected abstract render(args: RenderArgumentsWithViewModel<T>): VNode;
}

export function logImportPageFor<T>(viewModelType: ConstructorOf<T>) {
    return (target: ConstructorOf<LogImportPageView<any>>) => {
        const getElementNameFunc = () => window.customElements.getName(target)!;
        pageViews.push({ viewModelType, getElementNameFunc });
    };
}