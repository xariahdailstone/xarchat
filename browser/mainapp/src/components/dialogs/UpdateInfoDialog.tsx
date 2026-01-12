import { jsx, Fragment, VNode } from "../../snabbdom/index";
import { SystemMessageBBCodeParser } from "../../util/bbcode/BBCode";
import { VNodeUtils } from "../../util/VNodeUtils";
import { UpdateInfoDialogViewModel } from "../../viewmodel/dialogs/UpdateInfoDialogViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { makeRenderingComponent, RenderArguments } from "../RenderingComponentBase";
import { DialogComponentBase, dialogViewFor } from "./DialogFrame";

@componentElement("x-updateinfodialog")
@componentArea("dialogs")
@dialogViewFor(UpdateInfoDialogViewModel)
export class UpdateInfoDialog extends DialogComponentBase<UpdateInfoDialogViewModel> {
    constructor() {
        super();

        makeRenderingComponent(this, {
            render: (args) => this.render(args)
        })
    }

    render(args: RenderArguments): VNode {
        const vm = this.viewModel;
        if (!vm) { return VNodeUtils.createEmptyFragment(); }

        const descNode = vm.mustUpdate ?
            <p classList={[ "description" ]}>
                A new <b><u>required update</u></b> to XarChat is available for download.  New
                and updated features are listed below:
            </p> :
            <p classList={["description"]}>
                A new version of XarChat is available for download.  New
                and updated features are listed below:
            </p>;

        const bbc = SystemMessageBBCodeParser.parse(vm.changelogBBCode);
        args.addDisposable(bbc);

        return <>
            <h1 classList={[ "title" ]}>XarChat Update Available</h1>
            {descNode}
            <div classList={[ "changelog" ]}>{ bbc.asVNode() }</div>
        </>;
    }
}