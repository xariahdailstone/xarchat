import { HTMLUtils } from "../../util/HTMLUtils";
import { LinkHintPopupViewModel } from "../../viewmodel/popups/LinkHintPopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { PopupBase, popupViewFor } from "./PopupFrame";

@componentArea("popups")
@componentElement("x-linkhintpopup")
@popupViewFor(LinkHintPopupViewModel)
export class LinkHintPopup extends PopupBase<LinkHintPopupViewModel> {

    constructor() {
        super();
        this.clickable = false;

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="hinttext" id="elHintText"></div>
        `);

        const elHintText = this.$("elHintText") as HTMLDivElement;
        this.watchExpr(vm => vm.hintText, hintText => {
            elHintText.innerText = hintText ?? "";
        });
    }


}