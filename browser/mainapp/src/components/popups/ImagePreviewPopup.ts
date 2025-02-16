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

        this.watchExpr(vm => [vm.imageElement, vm.videoElement], vels => {
            HTMLUtils.clearChildren(this.elMain);
            if (vels) {
                if (vels[0]) {
                    this.elMain.appendChild(vels[0]);
                }
                else if (vels[1]) {
                    this.elMain.appendChild(vels[1]);
                }
                else {
                    HTMLUtils.clearChildren(this.elMain);    
                }
            }
        });
    }
}