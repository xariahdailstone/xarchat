import { jsx, Fragment, VNode } from "../../snabbdom/index";
import { StringUtils } from "../../util/StringUtils";
import { VNodeUtils } from "../../util/VNodeUtils";
import { AppInitializeViewModel } from "../../viewmodel/dialogs/AppInitializeViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { makeRenderingComponent, RenderArguments } from "../RenderingComponentBase";
import { DialogBorderType, DialogComponentBase, DialogFrame, dialogViewFor } from "./DialogFrame";

@componentArea("dialogs")
@componentElement("x-appinitializedialog")
@dialogViewFor(AppInitializeViewModel)
export class AppInitializeDialog extends DialogComponentBase<AppInitializeViewModel> {
    constructor() {
        super();

        makeRenderingComponent(this, {
            render: (e) => this.render(e)
        })
    }

    override get dialogBorderType(): DialogBorderType { 
        return this.viewModel && this.viewModel.parent.isInStartup ? DialogBorderType.FULLPAGENOENTRYANIM : DialogBorderType.FULLPAGE; 
    }

    render(args: RenderArguments): VNode {
        const vm = this.viewModel;
        if (!vm) { return VNodeUtils.createEmptyFragment(); }

        const isCancelVisible = vm.cancelButtonText != null;

        const otherDialogShowing = vm.otherDialogShowing;
        if (otherDialogShowing) { return VNodeUtils.createEmptyFragment(); }

        return <>
            <x-loadingicon id="elLoadingIcon"></x-loadingicon>
            <div id="elAction">{ !StringUtils.isNullOrWhiteSpace(vm.action) ? vm.action : "Please wait..." }</div>

            <button id="elCancel" class={{ "theme-button": true, "invisible": !isCancelVisible }} on={{
                "click": () => vm.cancel()
            }}>{ vm.cancelButtonText ?? "" }</button>        
        </>;
    }
}
