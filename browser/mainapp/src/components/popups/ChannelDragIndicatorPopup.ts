import { HTMLUtils } from "../../util/HTMLUtils";
import { ChannelDragIndicatorPopupViewModel } from "../../viewmodel/popups/ChannelDragIndicatorPopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { Rect } from "./ContextPopupBase";
import { PopupBase, popupViewFor } from "./PopupFrame";

@componentArea("popups")
@componentElement("x-channeldragindicatorpopup")
@popupViewFor(ChannelDragIndicatorPopupViewModel)
export class ChannelDragIndicatorPopup extends PopupBase<ChannelDragIndicatorPopupViewModel> {
    constructor() {
        super();

        this.watchExpr(vm => [vm.position, vm.targetElement], d => {
            if (!d) { return; }

            const position = d[0] as ("before" | "after");
            const targetElement = d[1] as (HTMLElement | null);

            if (!targetElement) { return; }

            const MYHEIGHT = 3;
            const targetElementRect = targetElement.getClientRects().item(0)!;

            const viewportRect = this.getViewportRect();

            let top: number;
            let left: number = targetElementRect.left - viewportRect.x;
            let width: number = targetElementRect.width;
            switch (position) {
                default:
                case "before":
                    top = targetElementRect.top - (MYHEIGHT / 2);
                    break;
                case "after":
                    top = (targetElementRect.top + targetElementRect.height) - (MYHEIGHT / 2);
                    break;
            }
            top = top - viewportRect.y;

            this.style.top = `${top}px`;
            this.style.left = `${left}px`;
            this.style.width = `${width}px`;
            this.style.height = `${MYHEIGHT}px`;
            this.logger.logDebug("dragindicator relocate", top, left, width, MYHEIGHT);
        });
    }

    private _cachedViewportElement: (HTMLElement | null) = null;
    protected getViewportRect(): Rect {
        if (!this._cachedViewportElement) {
            this.findViewportElement();
        }

        if (this._cachedViewportElement) {
            const rects = this._cachedViewportElement.getClientRects();
            return rects[0];
        }
        else {
            return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
        }
    }
        
    private findViewportElement() {
        let el: (Node | null) = this.parentNode;
        while (el) {
            if (el instanceof ShadowRoot) {
                el = el.host;
            }
            else if (el instanceof HTMLElement) {
                const computedStyle = window.getComputedStyle(el);
                if (computedStyle.display != "contents") {
                    const ofsRects = el.getClientRects();
                    if (ofsRects && ofsRects.length > 0) {
                        this._cachedViewportElement = el;
                        return;
                    }
                }
                el = el.parentNode;
            }
        }
    }
}