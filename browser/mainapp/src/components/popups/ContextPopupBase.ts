import { AnimationFrameUtils } from "../../util/AnimationFrameUtils";
import { asDisposable } from "../../util/Disposable";
import { WhenChangeManager } from "../../util/WhenChange";
import { ContextPopupViewModel } from "../../viewmodel/popups/PopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { PopupBase } from "./PopupFrame";

export type Size = { width: number; height: number; };
export type Rect = { x: number; y: number; width: number; height: number; };
export type PositionTestFunc = (viewportSize: Size, aroundRect: Rect, desiredSize: Size) => Rect & { enforceSize?: boolean };
function getRectOverlap(a: Rect, b: Rect): Rect {
    const top = Math.max(a.y, b.y);
    const left = Math.max(a.x, b.x);
    const right = Math.max(left, Math.min(a.x + a.width, b.x + b.width));
    const bottom = Math.max(top, Math.min(a.y + a.height + b.y + b.height));
    return { x: left, y: top, width: right - left, height: bottom - top };
}
const POSITION_BELOW_TORIGHT: PositionTestFunc = (viewportSize: Size, aroundRect: Rect, desiredSize: Size) => {
    const proposedTop = aroundRect.y + aroundRect.height;
    const proposedLeft = aroundRect.x;
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
const POSITION_BELOW_TOLEFT: PositionTestFunc = (viewportSize: Size, aroundRect: Rect, desiredSize: Size) => {
    const proposedTop = aroundRect.y + aroundRect.height;
    const proposedRight = aroundRect.x + aroundRect.width;
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
const POSITION_ABOVE_TORIGHT: PositionTestFunc = (viewportSize: Size, aroundRect: Rect, desiredSize: Size) => {
    const proposedBottom = aroundRect.y;
    const proposedLeft = aroundRect.x;
    const proposedRight = Math.min(viewportSize.width, proposedLeft + desiredSize.width);
    const proposedTop = Math.max(0, proposedBottom - desiredSize.height);

    const result = {
        x: proposedLeft,
        y: proposedTop,
        width: proposedRight - proposedLeft,
        height: proposedBottom - proposedTop
    };
    return result;
};
const POSITION_ABOVE_TOLEFT: PositionTestFunc = (viewportSize: Size, aroundRect: Rect, desiredSize: Size) => {
    const proposedBottom = aroundRect.y;
    const proposedRight = aroundRect.x + aroundRect.width;
    const proposedLeft = Math.max(0, proposedRight - desiredSize.width);
    const proposedTop = Math.max(0, proposedBottom - desiredSize.height);

    const result = {
        x: proposedLeft,
        y: proposedTop,
        width: proposedRight - proposedLeft,
        height: proposedBottom - proposedTop
    };
    return result;
};
const POSITION_STRATEGIES = [
    POSITION_BELOW_TORIGHT,
    POSITION_BELOW_TOLEFT,
    POSITION_ABOVE_TORIGHT,
    POSITION_ABOVE_TOLEFT
];


@componentArea("popups")
export abstract class ContextPopupBase<TViewModel extends ContextPopupViewModel> extends PopupBase<TViewModel> {
    constructor() {
        super();

        this.whenConnected(() => {
            this._cachedViewportElement = null;
            const pf = AnimationFrameUtils.createPerFrame(() => this.positionPopup());
            return asDisposable(
                pf, 
                () => this._cachedViewportElement = null);
        });
    }

    override get requiredStylesheets() {
        return [
            ...super.requiredStylesheets,
            "styles/components/popups/ContextPopupBase.css"
        ];
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

    private getMyDesiredSize(): Size {
        //this.style.maxHeight = "none";
        //this.style.maxWidth = "none";
        return { width: this.offsetWidth, height: this.offsetHeight };
    }

    protected getPoparoundRect(): Rect {
        const popFromElement = this.viewModel?.contextElement;
        const isConnected = this.isComponentConnected;
        const viewportRect = this.getViewportRect();

        let elRect: Rect;
        if (popFromElement && isConnected) {
            elRect = popFromElement.getClientRects().item(0)!;
            elRect = { x: elRect.x - viewportRect.x, y: elRect.y - viewportRect.y, width: elRect.width, height: elRect.height };
        }
        else {
            elRect = { x: 0, y: 0, width: 0, height: 0 };
        }

        return elRect;
    }

    protected getPositionStrategies() { return POSITION_STRATEGIES; }
    protected freezePosition: boolean = false;
    private positionFrozen: boolean = false;

    private _positionWCM = new WhenChangeManager();
    private positionPopup() {
        if (this.positionFrozen) { return; }
        
        const popFromElement = this.viewModel?.contextElement;
        const isConnected = this.isComponentConnected;

        const viewportRect = this.getViewportRect();
        const myWidth = this.offsetWidth;
        const myHeight = this.offsetHeight;
        const windowWidth = viewportRect.width
        const windowHeight = viewportRect.height;

        let elRect: Rect = this.getPoparoundRect();

        this._positionWCM.assign({ 
            offsetWidth: myWidth, offsetHeight: myHeight, 
            erx: elRect.x, ery: elRect.y, elw: elRect.width, elh: elRect.height,
            ww: windowWidth, wh: windowHeight }, () => {

            try {
                if (popFromElement && isConnected) {
                    //const elRect = popFromElement.getClientRects().item(0)!;
                    const desiredSize = this.getMyDesiredSize();
                    const vpSize = viewportRect;
                    let displayRect: ((Rect & { enforceSize?: boolean }) | null) = null;
                    let bestSizeSoFar: number = 0;

                    for (let strat of this.getPositionStrategies()) {
                        const tresultRect = strat(vpSize, elRect, desiredSize);
                        if (tresultRect.width == desiredSize.width && tresultRect.height == desiredSize.height) {
                            displayRect = tresultRect;
                            break;
                        }
                        if (tresultRect.width * tresultRect.height > bestSizeSoFar) {
                            bestSizeSoFar = tresultRect.width * tresultRect.height;
                            displayRect = tresultRect;
                        }
                    }

                    this.style.top = `${displayRect?.y ?? 0}px`;
                    this.style.left = `${displayRect?.x ?? 0}px`;
                    if (this.freezePosition) {
                        this.positionFrozen = true;
                    }
                    if (displayRect?.enforceSize) {
                        this.style.maxWidth = `${displayRect?.width ?? vpSize.width}px`;
                        this.style.maxHeight = `${displayRect?.height ?? vpSize.height}px`;
                    }
                }
            }
            finally {
            }
        });
    }
}
