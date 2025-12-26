import { jsx, Fragment, VNode } from "../../snabbdom/index";
import { AnimationFrameUtils } from "../../util/AnimationFrameUtils";
import { EmptyDisposable, IDisposable } from "../../util/Disposable";
import { VNodeUtils } from "../../util/VNodeUtils";
import { SuggestTextBoxPopupViewModel } from "../../viewmodel/popups/SuggestTextBoxPopupViewModel";
import { SuggestionHeader, SuggestionSeparator } from "../../viewmodel/SuggestTextBoxViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { makeRenderingComponent } from "../RenderingComponentBase";
import { ContextPopupBase, PositionTestFunc, Rect, Size } from "./ContextPopupBase";
import { popupViewFor } from "./PopupFrame";

const POSITION_BELOW: PositionTestFunc = (viewportSize: Size, aroundRect: Rect, desiredSize: Size) => {
    const proposedTop = aroundRect.y + aroundRect.height;
    const proposedLeft = aroundRect.x; 
    const proposedWidth = Math.max(aroundRect.width, aroundRect.x - desiredSize.width);
    const proposedBottom = Math.min(viewportSize.height, proposedTop + desiredSize.height);

    const result = {
        x: proposedLeft,
        y: proposedTop,
        width: proposedWidth,
        height: proposedBottom - proposedTop,
        enforceSize: true,
        strictWidth: true,
        allowExpansion: true
    };
    return result;
};

@componentArea("popups")
@componentElement("x-suggesttextboxpopup")
@popupViewFor(SuggestTextBoxPopupViewModel)
export class SuggestTextBoxPopup extends ContextPopupBase<SuggestTextBoxPopupViewModel> {
    constructor() {
        super();

        makeRenderingComponent(this, {
            render: () => this.render(),
            afterRender: () => this.afterRender()
        });
    }

    protected override get myRequiredStylesheets(): string[] {
        return [...super.myRequiredStylesheets, 'styles/components/popups/ContextMenuPopup.css']
    }
    
    protected override getPositionStrategies(): PositionTestFunc[] {
        return [ POSITION_BELOW ];
    }

    afterRender() {
        const selItem = this.elMain.querySelector(".menu-item-selected");
        if (selItem) {
            this.logger.logInfo("scrollIntoView", selItem);
            selItem.scrollIntoView({ block: "nearest" });
        }
        else {
            this.logger.logInfo("no scrollIntoView");
        }
    }

    render(): [VNode, IDisposable] {
        const vm = this.viewModel;
        if (!vm) {
            return [VNodeUtils.createEmptyFragment(), EmptyDisposable];
        }

        const itemNodes: VNode[] = [];
        for (let i = 0; i < vm.items.length; i++) {
            const item = vm.items[i];
            if (typeof item == "string") {
                itemNodes.push(<div class={{ "menu-item": true, "menu-item-selected": vm.selectedIndex == i }} on={{ 
                    "mousedown": (e: MouseEvent) => { e.preventDefault(); },
                    "mouseup": (e: MouseEvent) => { e.preventDefault(); vm.selectItem(item); } 
                }}>{item}</div>);
            }
            else if (item instanceof SuggestionHeader) {
                itemNodes.push(<div class={{ "menu-header": true }}>{item.title}</div>);
            }
            else if (item instanceof SuggestionSeparator) {
                itemNodes.push(<div class={{ "menu-separator": true }}></div>);
            }
            else {
                this.logger.logError("unknown suggestion item", item);
            }
        }

        const vnode = <div id="elContent" classList={["items"]}>
            {itemNodes}
        </div>;

        return [vnode, EmptyDisposable];
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