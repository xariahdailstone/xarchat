import { HTMLUtils } from "../../util/HTMLUtils";
import { PromptViewModel } from "../../viewmodel/dialogs/PromptViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { DialogComponentBase, dialogViewFor } from "./DialogFrame";

@componentArea("dialogs")
@componentElement("x-promptdialog")
@dialogViewFor(PromptViewModel<any>)
export class PromptDialog extends DialogComponentBase<PromptViewModel<any>> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="message" id="elMessage"></div>
        `);

        const elMessage = this.$("elMessage") as HTMLDivElement;

        this.watchExpr(vm => { return { message: vm.message, messageAsHtml: vm.messageAsHtml }}, args => {
            if (args?.messageAsHtml ?? false) {
                elMessage.innerHTML = args?.message ?? "";
            }
            else {
                elMessage.innerText = args?.message ?? "";
            }
        });
    }
}