import { AlertViewModel } from "../../viewmodel/dialogs/AlertViewModel";
import { AppInitializeViewModel } from "../../viewmodel/dialogs/AppInitializeViewModel";
import { ComponentBase, componentArea, componentElement } from "../ComponentBase";
import { DialogComponentBase, DialogFrame, dialogViewFor } from "./DialogFrame";

@componentArea("dialogs")
@componentElement("x-alertdialog")
@dialogViewFor(AlertViewModel)
export class AlertDialog extends DialogComponentBase<AlertViewModel> {
    constructor() {
        super();

        const updateMessageText = () => {
            if (this.viewModel) {
                const message = this.viewModel.message ?? "";
                if (this.viewModel.options.messageAsHtml) {
                    this.elMain.innerHTML = message;
                }
                else {
                    this.elMain.innerText = message;
                }
            }
            else {
                this.elMain.innerText = "";
            }
        };

        this.watchExpr(vm => vm.message, v => {
            updateMessageText();
        });
    }
}
