import { HTMLUtils } from "../../util/HTMLUtils";
import { EditMemoViewModel } from "../../viewmodel/dialogs/EditMemoViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { DialogComponentBase, dialogViewFor } from "./DialogFrame";

@componentArea("dialogs")
@componentElement("x-editmemodialog")
@dialogViewFor(EditMemoViewModel)
export class EditMemoDialog extends DialogComponentBase<EditMemoViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <textarea id="elTextarea" class="memo-text-area"></textarea>
        `);

        const elTextarea = this.$("elTextarea") as HTMLTextAreaElement;

        this.watchExpr(vm => vm.memoText, txt => {
            elTextarea.value = txt ?? "";
        });
        this.watchExpr(vm => vm.saving, saving => {
            this.elMain.inert = saving ?? false;
            this.elMain.classList.toggle("saving", saving ?? false);
        });

        const textAreaChanged = () => {
            const v = elTextarea.value;
            if (this.viewModel) {
                this.viewModel.memoText = v;
            }
        };
        elTextarea.addEventListener("change", textAreaChanged);
        elTextarea.addEventListener("input", textAreaChanged);
    }

}