import { HTMLUtils } from "../../util/HTMLUtils";
import { AppInitializeViewModel } from "../../viewmodel/dialogs/AppInitializeViewModel";
import { ComponentBase, componentArea, componentElement } from "../ComponentBase";
import { DialogBorderType, DialogComponentBase, DialogFrame, dialogViewFor } from "./DialogFrame";

@componentArea("dialogs")
@componentElement("x-appinitializedialog")
@dialogViewFor(AppInitializeViewModel)
export class AppInitializeDialog extends DialogComponentBase<AppInitializeViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <x-loadingicon id="elLoadingIcon"></x-loadingicon>
            <div id="elAction">Please wait...</div>

            <button id="elCancel" class="theme-button">X</button>
        `);

        const elAction = this.$("elAction") as HTMLDivElement;
        const elCancel = this.$("elCancel") as HTMLButtonElement;

        this.$("elCancel")?.addEventListener("click", () => {
            this.viewModel!.cancel();
        });

        this.watchExpr(vm => vm.action, (v: (string | null)) => {
            elAction.innerText = (v != null) ? v : "Please wait...";
        });
        this.watchExpr(vm => vm.cancelButtonText, cbt => {
            if (cbt) {
                elCancel.innerText = cbt;
                elCancel.classList.remove("invisible");
            }
            else {
                elCancel.classList.add("invisible");
            }
        });
    }

    override get dialogBorderType(): DialogBorderType { 
        return this.viewModel && this.viewModel.parent.isInStartup ? DialogBorderType.FULLPAGENOENTRYANIM : DialogBorderType.FULLPAGE; 
    }
}