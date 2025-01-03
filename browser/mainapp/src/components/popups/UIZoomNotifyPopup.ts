import { HTMLUtils } from "../../util/HTMLUtils";
import { UIZoomNotifyPopupViewModel } from "../../viewmodel/popups/UIZoomNotifyPopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { PopupBase, popupViewFor } from "./PopupFrame";

@componentArea("popups")
@componentElement("x-uizoomnotifypopup")
@popupViewFor(UIZoomNotifyPopupViewModel)
export class UIZoomNotifyPopup extends PopupBase<UIZoomNotifyPopupViewModel> {
    constructor() {
        super();

        this.watchExpr(vm => vm.message, msg => {
            msg = msg ?? "";

            this.elMain.innerText = msg;
        });
    }
}