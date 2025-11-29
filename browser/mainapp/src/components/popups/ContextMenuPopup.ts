import { AnimationFrameUtils } from "../../util/AnimationFrameUtils";
import { IDisposable, EmptyDisposable, ConvertibleToDisposable, asDisposable } from "../../util/Disposable";
import { HTMLUtils } from "../../util/HTMLUtils";
import { ObservableExpression } from "../../util/ObservableExpression";
import { WhenChangeManager } from "../../util/WhenChange";
import { ContextMenuPopupItemViewModel, ContextMenuPopupViewModel } from "../../viewmodel/popups/ContextMenuPopupViewModel";
import { CollectionViewUltraLightweight } from "../CollectionViewUltraLightweight";
import { componentArea, componentElement } from "../ComponentBase";
import { ContextPopupBase, PositionTestFunc, PositionTestFuncResult, Rect, Size } from "./ContextPopupBase";
import { popupViewFor } from "./PopupFrame";

const POSITION_BELOW_TORIGHT_CLIPTOVP: PositionTestFunc = (viewportSize: Size, aroundRect: Rect, desiredSize: Size) => {
    const proposedTop = aroundRect.y + aroundRect.height;
    const proposedLeft = aroundRect.x;
    const proposedRight = Math.min(viewportSize.width, proposedLeft + desiredSize.width);
    const proposedBottom = Math.min(viewportSize.height, proposedTop + desiredSize.height);

    const result: PositionTestFuncResult = {
        x: proposedLeft,
        y: proposedTop,
        width: proposedRight - proposedLeft,
        height: proposedBottom - proposedTop,
        enforceSize: true,
        allowExpansion: true
    };
    return result;
};
const POSITION_BELOW_TOLEFT_CLIPTOVP: PositionTestFunc = (viewportSize: Size, aroundRect: Rect, desiredSize: Size) => {
    const proposedTop = aroundRect.y + aroundRect.height;
    const proposedRight = aroundRect.x + aroundRect.width;
    const proposedLeft = Math.max(0, proposedRight - desiredSize.width);
    const proposedBottom = Math.min(viewportSize.height, proposedTop + desiredSize.height);

    const result: PositionTestFuncResult = {
        x: proposedLeft,
        y: proposedTop,
        width: proposedRight - proposedLeft,
        height: proposedBottom - proposedTop,
        enforceSize: true,
        allowExpansion: true
    };
    return result;
};
const POSITION_ABOVE_TORIGHT_CLIPTOVP: PositionTestFunc = (viewportSize: Size, aroundRect: Rect, desiredSize: Size) => {
    const proposedBottom = aroundRect.y;
    const proposedLeft = aroundRect.x;
    const proposedRight = Math.min(viewportSize.width, proposedLeft + desiredSize.width);
    const proposedTop = Math.max(0, proposedBottom - desiredSize.height);

    const result: PositionTestFuncResult = {
        x: proposedLeft,
        y: proposedTop,
        width: proposedRight - proposedLeft,
        height: proposedBottom - proposedTop,
        enforceSize: true,
        allowExpansion: true
    };
    return result;
};
const POSITION_ABOVE_TOLEFT_CLIPTOVP: PositionTestFunc = (viewportSize: Size, aroundRect: Rect, desiredSize: Size) => {
    const proposedBottom = aroundRect.y;
    const proposedRight = aroundRect.x + aroundRect.width;
    const proposedLeft = Math.max(0, proposedRight - desiredSize.width);
    const proposedTop = Math.max(0, proposedBottom - desiredSize.height);

    const result: PositionTestFuncResult = {
        x: proposedLeft,
        y: proposedTop,
        width: proposedRight - proposedLeft,
        height: proposedBottom - proposedTop,
        enforceSize: true,
        allowExpansion: true
    };
    return result;
};
const POSITION_STRATEGIES = [
    POSITION_BELOW_TORIGHT_CLIPTOVP,
    POSITION_BELOW_TOLEFT_CLIPTOVP,
    POSITION_ABOVE_TORIGHT_CLIPTOVP,
    POSITION_ABOVE_TOLEFT_CLIPTOVP
];


@componentArea("popups")
@componentElement("x-contextmenupopup")
@popupViewFor(ContextMenuPopupViewModel<any>)
export class ContextMenuPopup extends ContextPopupBase<ContextMenuPopupViewModel<any>> {

    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div id="elContent" class="content">
            </div>
        `);
        this.clickable = true;

        const elContent = this.$("elContent") as HTMLDivElement;
        const collView = new ContextMenuPopupItemView(elContent, this);

        this.watchExpr(vm => vm.items, items => { collView.viewModel = items ?? null; });

        this.freezePosition = true;
    }

    selectValue(value: any) {
        if (this.viewModel && this.viewModel.onValueSelected) {
            this.viewModel.onValueSelected(value);
        }
    }

    protected override initializePositioningLogic(): void {
        this.whenConnected(() => {
            const r = AnimationFrameUtils.createPerFrame(() => {
                this.updatePositioning(r);
            });
            return r;
        });
    }

    private updatePositioning(tickDisposable: IDisposable) {
        tickDisposable.dispose();

        const vpRect = this.getViewportRect();
        const elRect = this.getPoparoundRect();
        const menuHeight = this.scrollHeight;
        const menuWidth = this.scrollWidth;

        const heightBelow = vpRect.height - (elRect.y + elRect.height);
        const heightAbove = elRect.y;
        const widthRight = vpRect.width - elRect.x;
        const widthLeft = elRect.x + elRect.width;

        let positionAbove: boolean;
        let positionLeft: boolean;

        if (menuHeight <= heightBelow) {
            positionAbove = false;
        }
        else {
            positionAbove = (heightAbove > heightBelow);
        }
        if (menuWidth <= widthRight)
        {
            positionLeft = false;
        }
        else {
            positionLeft = (widthLeft > widthRight);
        }

        if (positionAbove) {
            this.style.bottom = `${vpRect.height - elRect.y}px`;
            this.style.maxHeight = `${elRect.y}px`;
            //this.style.height = `${elRect.y}px`;
        }
        else {
            this.style.top = `${elRect.y + elRect.height}px`;
            this.style.maxHeight = `${vpRect.height - (elRect.y + elRect.height)}px`;
            //this.style.height = `${vpRect.height - (elRect.y + elRect.height)}px`;
        }
        if (positionLeft) {
            this.style.right = `${vpRect.width - (elRect.x + elRect.width)}px`;
            this.style.maxWidth = `${elRect.x + elRect.width}px`;
            //this.style.width = `${elRect.x + elRect.width}px`;
        }
        else {
            this.style.left = `${elRect.x}px`;
            this.style.maxWidth = `${vpRect.width - elRect.x}px`;
            //this.style.width = `${vpRect.width - elRect.x}px`;
        }
    }
}

export class ContextMenuPopupItemView extends CollectionViewUltraLightweight<ContextMenuPopupItemViewModel<any>> {

    constructor(
        containerElement: HTMLElement,
        private readonly parent: ContextMenuPopup) {

        super(containerElement);
    }

    createItemElement(viewModel: ContextMenuPopupItemViewModel<any>): [HTMLElement, IDisposable] {
        const disposables: ConvertibleToDisposable[] = [];
        const addDisposable = (d: ConvertibleToDisposable) => disposables.push(d);

        let el: HTMLDivElement;
        if (viewModel.title == "-" && !viewModel.enabled) {
            el = document.createElement("div");
            el.classList.add("menu-separator");
        }
        else {
            el = document.createElement("div");
            el.classList.add("menu-item");
            
            const elText = document.createElement("div");
            elText.classList.add("menu-item-text");
            elText.innerText = viewModel.title;
            el.appendChild(elText);

            addDisposable(new ObservableExpression(
                () => viewModel.isHighlightedItem,
                (isHighlightedItem) => { 
                    const wasHighlighted = el.classList.contains("highlighted");
                    el.classList.toggle("highlighted", isHighlightedItem); 
                    if (isHighlightedItem && !wasHighlighted) {
                        el.scrollIntoView({ block: "nearest" });
                    }
                },
                () => {}
            ));

            el.addEventListener("mousedown", (e) => {
                e.preventDefault();
            }, true);
            el.addEventListener("mouseover", (e) => {
                console.log("menu item mouseover", viewModel);
                if (viewModel.owner) {
                    viewModel.owner.highlightedItem = viewModel;
                }
                e.preventDefault();
            }, true);
            el.addEventListener("mouseup", (e) => {
                e.preventDefault();
                this.parent.selectValue(viewModel.value);
            }, true);

            // el.addEventListener("click", () => {
            //     this.parent.selectValue(viewModel.value);
            // }, true);
        }

        if (!viewModel.enabled) {
            el.classList.add("disabled");
        }

        return [el, asDisposable(...disposables)];
    }

}