import { HTMLUtils } from "../../util/HTMLUtils";
import { ImagePreviewPopupViewModel } from "../../viewmodel/popups/ImagePreviewPopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { ContextPopupBase } from "./ContextPopupBase";
import { PopupBase, PopupFrame, popupViewFor } from "./PopupFrame";

@componentArea("popups")
@componentElement("x-imagepreviewpopup")
@popupViewFor(ImagePreviewPopupViewModel)
export class ImagePreviewPopup extends PopupBase<ImagePreviewPopupViewModel> {
    constructor() {
        super();

        this.watchExpr(vm => vm.imageElement, v => {
            if (v) {
                this.elMain.appendChild(v);
            }
            else {
                HTMLUtils.clearChildren(this.elMain);
            }
        });
        this.watchExpr(vm => vm.videoElement, v => {
            if (v) {
                this.elMain.appendChild(v);
            }
            else {
                HTMLUtils.clearChildren(this.elMain);
            }
        });
    }
}