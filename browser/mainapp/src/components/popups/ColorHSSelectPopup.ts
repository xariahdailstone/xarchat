import { HTMLUtils } from "../../util/HTMLUtils";
import { ColorHSSelectPopupViewModel } from "../../viewmodel/popups/ColorHSSelectPopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { ContextPopupBase } from "./ContextPopupBase";
import { PopupBase, popupViewFor } from "./PopupFrame";

@componentArea("popups")
@componentElement("x-colorhsselectpopup")
@popupViewFor(ColorHSSelectPopupViewModel)
export class ColorHSSelectPopup extends ContextPopupBase<ColorHSSelectPopupViewModel> {
    constructor() {
        super();

        const CIRCLE_SIZE = 200;
        const DOT_SIZE = 5;

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="imgcontainer">
                <img src="assets/ui/hslcircle.svg" id="elCircle" class="circle-img" style="width: ${CIRCLE_SIZE}px; height: ${CIRCLE_SIZE}px;" draggable="false" />
                <div id="elDot" class="selection-dot" style="width: ${DOT_SIZE}px; height: ${DOT_SIZE}px;"></div>
            </div>
        `);
        this.clickable = true;

        const elCircle = this.$("elCircle") as HTMLImageElement;
        const elDot =  this.$("elDot") as HTMLDivElement;

        this.watchExpr(() => [this.viewModel?.hue, this.viewModel?.saturation], v => {
            const hue = v ? v[0]! : 0;
            const sat = (v ? v[1]! : 0) / 100;
            const xy = this.hueSatCoordToXYCoord(hue, sat, (CIRCLE_SIZE / 2), (CIRCLE_SIZE / 2), (CIRCLE_SIZE / 2));
            elDot.style.left = `${xy.x - (DOT_SIZE / 2)}px`;
            elDot.style.top = `${xy.y - (DOT_SIZE / 2)}px`;
        });

        const handleMouseEvent = (e: MouseEvent) => {
            if (this.viewModel) {
                const el = e.target as HTMLImageElement;
                const elRect = el.getClientRects()[0];
                const x = e.clientX - elRect.x;
                const y = e.clientY - elRect.y;
                const hs = this.xyCoordToHueSatCoord(x, y, (CIRCLE_SIZE / 2), (CIRCLE_SIZE / 2), (CIRCLE_SIZE / 2));
                hs.sat = Math.min(1, hs.sat);
                this.viewModel.setHueSaturation(hs.hue, Math.round(hs.sat * 100));
            }
        };

        let dragging = false;
        elCircle.addEventListener("pointerdown", (e) => {
            dragging = true;
            elCircle.setPointerCapture(e.pointerId);
            return false;
        });
        elCircle.addEventListener("pointerup", (e) => {
            dragging = false;
            elCircle.releasePointerCapture(e.pointerId);
            return false;
        });
        elCircle.addEventListener("pointermove", (e) => {
            if (dragging) {
                handleMouseEvent(e);
            }
        });

        elCircle.addEventListener("click", (e) => {
            handleMouseEvent(e);
        });
    }

    // hue = 0-255
    // sat = 0-1
    private hueSatCoordToXYCoord(hue: number, sat: number, centerX: number, centerY: number, radius: number) {
        const adjhue = ((360 - hue) + 270) % 360
        const theta = ((adjhue / 360) * (Math.PI * 2)) - Math.PI;
        const rho = sat * radius;
        return { x: centerX + (rho * Math.cos(theta)), y: centerY - (rho * Math.sin(theta)) };
    }

    private xyCoordToHueSatCoord(x: number, y: number, centerX: number, centerY: number, radius: number) {
        const nx = x - centerX;
        const ny = 0 - (y - centerY);
        const rho = Math.sqrt(Math.pow(nx, 2) + Math.pow(ny, 2))
        const thetarad = Math.atan2(ny, nx) - (Math.PI / 2);

        const thetapct = ((thetarad + (Math.PI * 2)) % (Math.PI * 2)) / (Math.PI * 2);

        const hue = 360 - Math.floor(thetapct * 360);
        const sat = rho / radius;
        this.logger.logDebug(`thetarad = ${thetarad}, thetapct = ${thetapct}, hue = ${hue}, rho = ${rho}`);
        return { hue: hue, sat: sat };
    }
}