import { jsx, Fragment, VNode } from "../../snabbdom/index";
import { EmptyDisposable, IDisposable } from "../../util/Disposable";
import { VNodeUtils } from "../../util/VNodeUtils";
import { AboutViewModel } from "../../viewmodel/dialogs/AboutViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { makeRenderingComponent } from "../RenderingComponentBase";
import { DialogComponentBase, dialogViewFor } from "./DialogFrame";

@componentArea("dialogs")
@componentElement("x-aboutdialog")
@dialogViewFor(AboutViewModel)
export class AboutDialog extends DialogComponentBase<AboutViewModel> {
    constructor() {
        super();

        makeRenderingComponent(this, {
            render: () => this.render()
        });
    }

    render(): [VNode, IDisposable] {
        const vm = this.viewModel;
        if (!vm) { return [VNodeUtils.createEmptyFragment(), EmptyDisposable] }

        const acknowledgements = vm.acknowledgements;
        
        this.logger.logInfo("rendering about dialog");
        const vnode = <div classList={[ "about-container" ]}>
            <div classList={[ "about-title" ]}>{vm.productName}</div>
            <div classList={[ "about-version" ]}>{vm.fullClientVersion}</div>
            <div classList={[ "about-acknowledgements" ]}>{acknowledgements?.asVNode()}</div>
        </div>

        return [vnode, EmptyDisposable];
    }
}