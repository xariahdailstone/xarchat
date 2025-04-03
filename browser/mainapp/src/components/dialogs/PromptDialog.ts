import { asDisposable, IDisposable } from "../../util/Disposable";
import { EventListenerUtil } from "../../util/EventListenerUtil";
import { HTMLUtils } from "../../util/HTMLUtils";
import { PromptForStringViewModel, PromptViewModel } from "../../viewmodel/dialogs/PromptViewModel";
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

@componentArea("dialogs")
@componentElement("x-promptforstringdialog")
@dialogViewFor(PromptForStringViewModel)
export class PromptForStringDialog extends DialogComponentBase<PromptForStringViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="message" id="elMessage"></div>
            <input type="text" class="textbox theme-textbox" id="txtValue" data-initial-focus="true" />
        `);

        const elMessage = this.$("elMessage") as HTMLDivElement;
        const txtValue= this.$("txtValue") as HTMLInputElement;

        this.whenConnectedWithViewModel(vm => {
            const disposables: IDisposable[] = [];

            const txtValueChanged = () => {
                vm.value = txtValue.value;
            };
            disposables.push(EventListenerUtil.addDisposableEventListener(txtValue, "input", txtValueChanged));
            disposables.push(EventListenerUtil.addDisposableEventListener(txtValue, "change", txtValueChanged));

            return asDisposable(...disposables);
        });

        this.watchExpr(vm => vm.value, value => {
            value ??= "";
            if (value != txtValue.value) {
                txtValue.value = value;
            }
        });

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