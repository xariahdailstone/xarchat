import { asDisposable, IDisposable } from "../../util/Disposable";
import { HTMLUtils } from "../../util/HTMLUtils";
import { Scheduler } from "../../util/Scheduler";
import { ImagePreviewPopupViewModel } from "../../viewmodel/popups/ImagePreviewPopupViewModel";
import { TweetPreviewPopupViewModel } from "../../viewmodel/popups/TweetPreviewPopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { ContextPopupBase } from "./ContextPopupBase";
import { PopupBase, PopupFrame, popupViewFor } from "./PopupFrame";

@componentArea("popups")
@componentElement("x-tweetpreviewpopup")
@popupViewFor(TweetPreviewPopupViewModel)
export class TweetPreviewPopup extends PopupBase<TweetPreviewPopupViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div id="elPlaceholder"></div>
        `);
        const elPlaceholder = this.elMain.querySelector("#elPlaceholder") as HTMLDivElement;

        this.watchExpr(vm => vm.element, v => {
            if (v) {
                elPlaceholder!.style.width = v.style.width;
                elPlaceholder!.style.height = v.style.height;
            }
            else {
                elPlaceholder.style.width = "0px";
                elPlaceholder.style.height = "0px";
            }
        });

        this.whenConnected(() => {
            let rafHandle: IDisposable | null = null;

            const updateIFramePos = () => {
                rafHandle = Scheduler.scheduleNamedCallback("TweetPreviewPopup.updateIFramePos", ["nextframe", 250], updateIFramePos);

                const phRect = elPlaceholder.getClientRects().item(0);
                if (this.viewModel && this.viewModel.element) {
                    this.viewModel.element.style.transform = `translateX(${phRect?.left}px) translateY(${phRect?.top}px)`;
                }
            };

            rafHandle = Scheduler.scheduleNamedCallback("TweetPreviewPopup.updateIFramePos", ["frame", 250], updateIFramePos);

            return asDisposable(() => {
                if (rafHandle != null) {
                    rafHandle.dispose();
                    rafHandle = null;
                }
            })
        });
    }
}