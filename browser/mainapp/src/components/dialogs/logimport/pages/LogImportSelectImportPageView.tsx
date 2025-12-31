import { VNode } from "../../../../snabbdom/index";
import { IDisposable } from "../../../../util/Disposable";
import { VNodeUtils } from "../../../../util/VNodeUtils";
import { LogImportSelectImportPageViewModel } from "../../../../viewmodel/dialogs/logimport/LogImportSelectImportPageViewModel";
import { componentArea, ComponentBase, componentElement } from "../../../ComponentBase";
import { RenderArguments, RenderArgumentsWithViewModel, RenderingComponentBase } from "../../../RenderingComponentBase";
import { logImportPageFor, LogImportPageView } from "./LogImportPageView";

@componentElement("x-logimport-selectimport")
@componentArea("logimport/pages")
@logImportPageFor(LogImportSelectImportPageViewModel)
export class LogImportSelectImportPageView extends LogImportPageView<LogImportSelectImportPageViewModel> {
    constructor() {
        super();
    }

    render(args: RenderArgumentsWithViewModel<LogImportSelectImportPageViewModel>): VNode {
        return VNodeUtils.createEmptyFragment();
    }
}