import { HTMLUtils } from "../../util/HTMLUtils";
import { MessagePreviewPopupViewModel } from "../../viewmodel/popups/MessagePreviewPopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { ContextPopupBase, PositionTestFunc, Rect, Size } from "./ContextPopupBase";
import { PopupBase, popupViewFor } from "./PopupFrame";

const POSITION_STRATEGY: PositionTestFunc[] = [
    (viewportSize: Size, aroundRect: Rect, desiredSize: Size) => {
        const proposedBottom = aroundRect.y;
        const proposedLeft = aroundRect.x;
        const proposedRight = Math.min(viewportSize.width, proposedLeft + desiredSize.width);
        const proposedTop = Math.max(0, proposedBottom - desiredSize.height);

        const result = {
            x: proposedLeft - 5,
            y: proposedTop - 5,
            width: Math.min(aroundRect.width, desiredSize.width) + 10,
            height: proposedBottom - 10,
            enforceSize: true
        };
        return result;
    }
]

@componentArea("popups")
@componentElement("x-messagepreviewpopup")
@popupViewFor(MessagePreviewPopupViewModel)
export class MessagePreviewPopup extends ContextPopupBase<MessagePreviewPopupViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="previewtitle">Preview:</div>
            <div class="previewdata" id="elPreviewData"></div>
        `);

        const elPreviewData = this.$("elPreviewData") as HTMLDivElement;

        this.watchExpr(vm => vm.parseResult, pr => {
            HTMLUtils.clearChildren(elPreviewData);
            if (pr) {
                elPreviewData.appendChild(pr.element);
            }
        });
    }

    protected override getPositionStrategies() { return POSITION_STRATEGY; }
}