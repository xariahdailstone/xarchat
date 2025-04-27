import { asDisposable } from "../../util/Disposable";
import { EventListenerUtil } from "../../util/EventListenerUtil";
import { HTMLUtils } from "../../util/HTMLUtils";
import { StringUtils } from "../../util/StringUtils";
import { TooltipPopupViewModel } from "../../viewmodel/popups/TooltipPopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { ContextPopupBase, PositionTestFunc, Rect, Size } from "./ContextPopupBase";
import { popupViewFor } from "./PopupFrame";

const POSITION_BELOW_BOTRIGHT: PositionTestFunc = (viewportSize: Size, aroundRect: Rect, desiredSize: Size) => {
    const proposedTop = aroundRect.y + aroundRect.height;
    const proposedLeft = aroundRect.x + aroundRect.width;
    const proposedRight = Math.min(viewportSize.width, proposedLeft + desiredSize.width);
    const proposedBottom = Math.min(viewportSize.height, proposedTop + desiredSize.height);

    const result = {
        x: proposedLeft,
        y: proposedTop,
        width: proposedRight - proposedLeft,
        height: proposedBottom - proposedTop
    };
    return result;
};
const POSITION_BELOW_BOTLEFT: PositionTestFunc = (viewportSize: Size, aroundRect: Rect, desiredSize: Size) => {
    const proposedTop = aroundRect.y + aroundRect.height;
    const proposedRight = aroundRect.x;
    const proposedLeft = Math.max(0, proposedRight - desiredSize.width);
    const proposedBottom = Math.min(viewportSize.height, proposedTop + desiredSize.height);

    const result = {
        x: proposedLeft,
        y: proposedTop,
        width: proposedRight - proposedLeft,
        height: proposedBottom - proposedTop
    };
    return result;
};
const POSITION_ABOVE_TOPRIGHT: PositionTestFunc = (viewportSize: Size, aroundRect: Rect, desiredSize: Size) => {
    const proposedBottom = aroundRect.y;
    const proposedLeft = aroundRect.x + aroundRect.width;
    const proposedTop = Math.max(0, proposedBottom - desiredSize.height);
    const proposedRight = Math.min(viewportSize.width, proposedLeft + desiredSize.width);

    const result = {
        x: proposedLeft,
        y: proposedTop,
        width: proposedRight - proposedLeft,
        height: proposedBottom - proposedTop
    };
    return result;
};
const POSITION_ABOVE_TOPLEFT: PositionTestFunc = (viewportSize: Size, aroundRect: Rect, desiredSize: Size) => {
    const proposedBottom = aroundRect.y;
    const proposedRight = aroundRect.x;
    const proposedTop = Math.max(0, proposedBottom - desiredSize.height);
    const proposedLeft = Math.max(0, proposedRight - desiredSize.width);

    const result = {
        x: proposedLeft,
        y: proposedTop,
        width: proposedRight - proposedLeft,
        height: proposedBottom - proposedTop
    };
    return result;
};

@componentArea("popups")
@componentElement("x-tooltippopup")
@popupViewFor(TooltipPopupViewModel)
export class TooltipPopup extends ContextPopupBase<TooltipPopupViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div id="elTitle" class="tooltip-title"></div>
            <div id="elBody" class="tooltip-body"></div>
        `);
        const elTitle = this.$("elTitle") as HTMLDivElement;
        const elBody = this.$("elBody") as HTMLDivElement;

        this.watchExpr(vm => vm.title, v => {
            if (!StringUtils.isNullOrWhiteSpace(v))  {
                elTitle.innerText = v ?? "";
                elTitle.classList.remove("hidden");
            }
            else {
                elTitle.innerText = "";
                elTitle.classList.add("hidden");
            }
        });
        this.watchExpr(vm => vm.text, v => {
            elBody.innerText = (v != null) ? v : "";
        });
        this.whenConnectedWithViewModel(vm => {
            if (vm.flashDisplay) {
                this.elMain.classList.add("flash-display");
                this.elMain.addEventListener("animationend", (e) => {
                    vm.dismissed();
                });
            }
        });
    }

    private static POSITION_STRATEGIES = [
        POSITION_BELOW_BOTRIGHT,
        POSITION_BELOW_BOTLEFT,
        POSITION_ABOVE_TOPRIGHT,
        POSITION_ABOVE_TOPLEFT
    ]

    protected override getPositionStrategies() { return TooltipPopup.POSITION_STRATEGIES; }

    protected override getPoparoundRect(): { x: number; y: number; width: number; height: number; } {
        const viewportRect = this.getViewportRect();

        if (this.viewModel) {
            return { x: this.viewModel.mousePoint.x - viewportRect.x - 5, y: this.viewModel.mousePoint.y - viewportRect.y - 5, width: 15, height: 25 };
        }
        else {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
    }
}