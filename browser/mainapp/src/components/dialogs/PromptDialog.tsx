import { Fragment } from "../../snabbdom/index";
import { EventListenerUtil } from "../../util/EventListenerUtil";
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
            <div class="checkboxes" id="elCheckboxes"></div>
        `);

        const elMessage = this.$("elMessage") as HTMLDivElement;
        const elCheckboxes = this.$("elCheckboxes") as HTMLDivElement;

        this.watchExpr(vm => { return { message: vm.message, messageAsHtml: vm.messageAsHtml, checkboxes: vm.checkboxes }}, args => {
            if (args?.messageAsHtml ?? false) {
                elMessage.innerHTML = args?.message ?? "";
            }
            else {
                elMessage.innerText = args?.message ?? "";
            }

            if (args?.checkboxes && args.checkboxes.length > 0) {
                elCheckboxes.classList.add("shown");
                HTMLUtils.clearChildren(elCheckboxes);
                for (let checkboxInfo of args.checkboxes) {
                    const elCheckboxContainer = document.createElement("label");
                    elCheckboxContainer.classList.add("checkbox-container");

                    const elCheckbox = document.createElement("input");
                    elCheckbox.type = "checkbox";
                    elCheckbox.checked = checkboxInfo.checked;
                    elCheckbox.addEventListener("change", () => {
                        checkboxInfo.checked = elCheckbox.checked;
                    });
                    elCheckboxContainer.appendChild(elCheckbox);

                    const elLabelText = document.createElement("span");
                    elLabelText.classList.add("checkbox-label-text");
                    elLabelText.innerText = checkboxInfo.label;
                    elCheckboxContainer.appendChild(elLabelText);

                    elCheckboxes.appendChild(elCheckboxContainer);
                }
            }
            else {
                elCheckboxes.classList.remove("shown");
            }
        });
    }
}

