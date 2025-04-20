import { jsx, Fragment, VNode } from "../../snabbdom/index";
import { EmptyDisposable, IDisposable } from "../../util/Disposable";
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
        strictWidth: true
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
            return [<></>, EmptyDisposable];
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
}