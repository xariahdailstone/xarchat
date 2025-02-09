import { EventListenerUtil } from "../../util/EventListenerUtil";
import { HTMLUtils } from "../../util/HTMLUtils";
import { IFramePopupViewModel } from "../../viewmodel/popups/IFramePopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { ContextPopupBase } from "./ContextPopupBase";
import { popupViewFor } from "./PopupFrame";

@componentArea("popups")
@componentElement("x-iframepopup")
@popupViewFor(IFramePopupViewModel)
export class IFramePopup extends ContextPopupBase<IFramePopupViewModel> {
    constructor() {
        super();

        const recalcScale = () => {
            const vh = window.innerHeight * 0.9;
            const vw = window.innerWidth * 0.9;
            const ifrw = this.viewModel!.iframeSize[0];
            const ifrh = this.viewModel!.iframeSize[1];

            const scaleY = Math.min(1, vh / ifrh);
            const scaleX = Math.min(1, vw / ifrw);
            const scale = Math.min(scaleY, scaleX);
            this.elMain.style.setProperty("--iframe-scale", scale.toString());
        };

        this.whenConnected(() => {
            return EventListenerUtil.addDisposableEventListener(window, "resize", () => {
                recalcScale();
            });
        })
        this.watchExpr(vm => vm.iframeElement, ifr => {
            if (!ifr) {
                HTMLUtils.clearChildren(this.elMain);
            }
            else {
                this.elMain.appendChild(ifr);
            }
        });
        this.watchExpr(vm => vm.visible, visible => {
            this.style.opacity = !!visible ? "1" : "0";
        });
        this.watchExpr(vm => vm.iframeSize, ifrSize => {
            if (ifrSize) {
                this.elMain.style.setProperty("--iframe-width", `${ifrSize[0]}px`);
                this.elMain.style.setProperty("--iframe-height", `${ifrSize[1]}px`);
                recalcScale();
            }
        });
    }
}