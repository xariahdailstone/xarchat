import { asDisposable, IDisposable } from "../../util/Disposable";
import { EventListenerUtil } from "../../util/EventListenerUtil";
import { HTMLUtils } from "../../util/HTMLUtils";
import { ColorRGBSelectPopupViewModel } from "../../viewmodel/popups/ColorRGBSelectPopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { ContextPopupBase } from "./ContextPopupBase";
import { popupViewFor } from "./PopupFrame";

@componentArea("popups")
@componentElement("x-colorrgbselectpopup")
@popupViewFor(ColorRGBSelectPopupViewModel)
export class ColorRGBSelectPopup extends ContextPopupBase<ColorRGBSelectPopupViewModel> {
    constructor() {
        super();

        const BAR_HEIGHT = 360;
        const DOT_SIZE = 7;

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="huesatbox" id="elHueSatBox">
                <div class="white-gradient"></div>
                <div class="black-gradient"></div>
                <div id="elDot" class="selection-dot"></div>
            </div>
            <div class="huebar" id="elHueBarBox">
                <img id="elBarImage" class="huebar-image" src="assets/ui/huebar.svg" />
                <div id="elBar" class="selection-bar"></div>
            </div>
            <div class="bottombar">
                <div id="elSwatch" class="bottombar-swatch"></div>
                <div id="elHexCodeLabel" class="bottombar-text-label">Color Code:</div>
                <input id="elHexCode" type="text" class="theme-textbox bottombar-text" maxlength="7"></input>
            </div>
        `);

        this.clickable = true;

        const elHueSatBox = this.$("elHueSatBox") as HTMLDivElement;
        const elDot =  this.$("elDot") as HTMLDivElement;
        const elHueBarBox = this.$("elHueBarBox") as HTMLDivElement;
        const elBarImage = this.$("elBarImage") as HTMLImageElement;
        const elBar =  this.$("elBar") as HTMLDivElement;
        const elSwatch = this.$("elSwatch") as HTMLDivElement;
        const elHexCode = this.$("elHexCode") as HTMLInputElement;

        this.whenConnectedWithViewModel(vm => {
            const disposables: IDisposable[] = [];

            const elBarImageHeight = 360;
            const elHueSatBoxWidth = 360;
            const elHueSatBoxHeight = 360;

            let zeroAtTop = true;

            let assignedHue = vm.hue;
            let assignedSaturation = vm.saturation;
            let assignedBrightness = vm.brightness;

            let setViaHueDrag = false;
            let setViaHSBDrag = false;
            let setViaHexCode = false;

            elBar.style.top = "0px";

            disposables.push(this.watchExpr(vm => [vm.hue, vm.white, vm.black], hwb => {
                if (!hwb) return;

                if (setViaHexCode) {
                    assignedHue = vm.hue;
                    assignedBrightness = vm.brightness;
                    assignedSaturation = vm.saturation;
                }
                
                //if (hue >= 0) { hue = 360; }
                if (!setViaHueDrag && !setViaHSBDrag) {
                    if (zeroAtTop && assignedHue == 0) {
                        elBar.style.top = "0px";
                    }
                    else {
                        elBar.style.top = `${(elBarImageHeight - (elBarImageHeight * (assignedHue / 360))) - 1}px`;
                    }

                    elDot.style.left = `${((elHueSatBoxWidth * (assignedSaturation))) - (DOT_SIZE / 2)}px`;
                    elDot.style.top = `${elHueSatBoxHeight - (elHueSatBoxHeight * (assignedBrightness)) - (DOT_SIZE / 2)}px`;
                }

                elSwatch.style.backgroundColor = `rgb(${vm.red}, ${vm.green}, ${vm.blue})`;
                elHueSatBox.style.backgroundColor = `hsl(${assignedHue}, 100%, 50%)`;

                if (!setViaHexCode) {
                    const assignStr = vm.rgbString.substring(1);
                    if (elHexCode.value.toLowerCase() != assignStr.toLowerCase() &&
                        elHexCode.value.toLowerCase() != "#" + assignStr.toLowerCase()) {
                        elHexCode.value = assignStr;
                    }
                }
            }));

            const textBoxChange = (ev: Event) => {
                const tbvalue = elHexCode.value;
                if (tbvalue.match(/^\#?[0-9A-Fa-f]{6}$/)) {
                    setViaHexCode = true;
                    setViaHSBDrag = false;
                    setViaHueDrag = false;
                    vm.rgbString = tbvalue;
                }
            };
            disposables.push(EventListenerUtil.addDisposableEventListener(elHexCode, "input", textBoxChange));
            disposables.push(EventListenerUtil.addDisposableEventListener(elHexCode, "change", textBoxChange));

            let hueDragging = false;
            const calcPointerHue = (ev: PointerEvent) => {
                let pxDown = ev.clientY - (elHueBarBox.clientTop + elHueBarBox.getClientRects()[0].top);
                pxDown = Math.min(elHueBarBox.clientHeight, Math.max(0, pxDown));
                const pctUp = (elHueBarBox.clientHeight - pxDown) / elHueBarBox.clientHeight;

                setViaHueDrag = true;
                setViaHSBDrag = false;
                setViaHexCode = false;
                elBar.style.top = `${pxDown - 1}px`;

                const assignHue = Math.min(360, Math.max(0, Math.round(pctUp * 360)));
                zeroAtTop = assignHue == 0 ? false : true;
                assignedHue = assignHue;
                vm.setHSB(assignHue, assignedSaturation, assignedBrightness);
            };
            disposables.push(EventListenerUtil.addDisposableEventListener(elHueBarBox, "pointerdown", (ev: PointerEvent) => {
                elHueBarBox.setPointerCapture(ev.pointerId);
                calcPointerHue(ev);
                hueDragging = true;
            }));
            disposables.push(EventListenerUtil.addDisposableEventListener(elHueBarBox, "pointerup", (ev: PointerEvent) => {
                elHueBarBox.releasePointerCapture(ev.pointerId);
                hueDragging = false;
            }));
            disposables.push(EventListenerUtil.addDisposableEventListener(elHueBarBox, "pointermove", (ev: PointerEvent) => {
                if (hueDragging) {
                    calcPointerHue(ev);
                }
            }));

            let wbDragging = false;
            const calcPointerWb = (ev: PointerEvent) => {
                let pxDown = ev.clientY - (elHueSatBox.clientTop + elHueSatBox.getClientRects()[0].top);
                let pxRight = ev.clientX - (elHueSatBox.clientLeft + elHueSatBox.getClientRects()[0].left);

                pxDown = Math.min(elHueSatBox.clientHeight, Math.max(0, pxDown));
                pxRight = Math.min(elHueSatBox.clientWidth, Math.max(0, pxRight));

                const pctLeft = (elHueSatBox.clientWidth - pxRight) / elHueSatBox.clientWidth;
                const pctDown = pxDown / elHueSatBox.clientHeight;

                setViaHSBDrag = true;
                setViaHexCode = false;
                setViaHueDrag = false;
                elDot.style.left = `${pxRight - (DOT_SIZE / 2)}px`;
                elDot.style.top = `${pxDown - (DOT_SIZE / 2)}px`;

                assignedBrightness = 1 - pctDown;
                assignedSaturation = 1 - pctLeft;
                vm.setHSB(assignedHue, 1 - pctLeft, 1 - pctDown);
            };
            disposables.push(EventListenerUtil.addDisposableEventListener(elHueSatBox, "pointerdown", (ev: PointerEvent) => {
                elHueSatBox.setPointerCapture(ev.pointerId);
                wbDragging = true;
                calcPointerWb(ev);
            }));
            disposables.push(EventListenerUtil.addDisposableEventListener(elHueSatBox, "pointerup", (ev: PointerEvent) => {
                elHueSatBox.releasePointerCapture(ev.pointerId);
                wbDragging = false;
            }));
            disposables.push(EventListenerUtil.addDisposableEventListener(elHueSatBox, "pointermove", (ev: PointerEvent) => {
                if (wbDragging) {
                    calcPointerWb(ev);
                }
            }));

            return asDisposable(...disposables);
        });
        

        elHueSatBox.addEventListener("click", (ev: MouseEvent) => {
        });
        elHueBarBox.addEventListener("click", (ev: MouseEvent) => {
        });
    }
}