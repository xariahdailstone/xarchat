import { jsx } from "../../../../snabbdom/jsx";
import { VNode } from "../../../../snabbdom/vnode";
import { componentElement, componentArea } from "../../../ComponentBase";
import { RenderArgumentsWithViewModel } from "../../../RenderingComponentBase";
import { LogImportPageView } from "./LogImportPageView";


@componentElement("x-logimport-unknownpage")
@componentArea("logimport/pages")
export class LogImportUnknownPageView extends LogImportPageView<any> {
    protected render(args: RenderArgumentsWithViewModel<any>): VNode {
        return <div>Unknown page view model type: {args.viewModel.constructor.name}</div>;
    }
}
