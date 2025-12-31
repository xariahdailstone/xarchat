import { jsx, Fragment, VNode } from "../../../snabbdom/index";
import { IDisposable } from "../../../util/Disposable";
import { VNodeUtils } from "../../../util/VNodeUtils";
import { LogImportViewModel } from "../../../viewmodel/dialogs/logimport/LogImportViewModel";
import { componentArea, componentElement } from "../../ComponentBase";
import { makeRenderingComponent, RenderArguments, RenderingComponentBase } from "../../RenderingComponentBase";
import { DialogComponentBase, dialogViewFor } from "../DialogFrame";

@componentElement("x-logimportview")
@componentArea("logimport")
@dialogViewFor(LogImportViewModel)
export class LogImportView extends DialogComponentBase<LogImportViewModel> {
    constructor() {
        super();

        makeRenderingComponent(this, {
            render: (args) => this.render(args)
        });
    }

    protected render(args: RenderArguments): VNode {
        const vm = this.viewModel;
        if (!vm) { return VNodeUtils.createEmptyFragment(); }

        throw new Error("Method not implemented.");
    }
}