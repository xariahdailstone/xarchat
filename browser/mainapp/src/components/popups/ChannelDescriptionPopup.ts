import { ChatBBCodeParser } from "../../util/bbcode/BBCode";
import { IDisposable, EmptyDisposable, asDisposable } from "../../util/Disposable";
import { ResizeObserverNice } from "../../util/ResizeObserverNice";
import { WhenChangeManager } from "../../util/WhenChange";
import { AppViewModel } from "../../viewmodel/AppViewModel";
import { ChannelDescriptionPopupViewModel } from "../../viewmodel/popups/ChannelDescriptionPopupViewModel";
import { ComponentBase, componentArea, componentElement } from "../ComponentBase";
import { PopupBase, PopupFrame, popupViewFor } from "./PopupFrame";

@componentArea("popups")
@componentElement("x-descriptionpopup")
@popupViewFor(ChannelDescriptionPopupViewModel)
export class ChannelDescriptionPopup extends PopupBase<ChannelDescriptionPopupViewModel> {
    constructor(public readonly parent: AppViewModel) {
        super();

        let ro = new ResizeObserverNice(() => {
            positionPopup();
        });
        let roReset: IDisposable = EmptyDisposable;
        const getPopupFrameOfs = () => {
            roReset.dispose();

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
                            ro.observe(el);
                            ro.observe(this);
                            roReset = asDisposable(() => {
                                ro.unobserve(el as HTMLElement);
                                ro.unobserve(this);
                            });
                            return ofsRects.item(0);
                        }
                    }
                    el = el.parentNode;
                }
            }
            return null;
        };

        const frameSize = 6;
        const computedStyle = window.getComputedStyle(this);
        const positionPopup = () => {
            try {
                const popFromElement = this.viewModel?.popFromElement as (HTMLElement | null);
                const isConnected = this.isComponentConnected;

                if (popFromElement instanceof HTMLElement && isConnected) {
                    const elRect = popFromElement.getClientRects().item(0)!;
                    const ofsRect = getPopupFrameOfs();
                    if (ofsRect == null) { return; }

                    const x = elRect.x - ofsRect.x - frameSize;
                    const y = elRect.y - ofsRect.y - frameSize;
                    const maxHeight = ofsRect.height - y - frameSize - 10;
                    const w = elRect.width + (frameSize * 2);

                    this.style.top = `${y}px`;
                    this.style.left = `${x}px`;
                    this.style.width = `${w}px`;
                    this.style.maxHeight = `${maxHeight}px`;
                }
            }
            catch (e) { }
        }

        this.watch("popFromElement", (v) => {
            positionPopup();
        });

        const parsedBBCodeWCM = new WhenChangeManager();
        this.watch("description", (v) => {
            v = v ?? "";
            parsedBBCodeWCM.assign({ v }, () => {
                const sp = ChatBBCodeParser.parse(v, {
                });
                this.elMain.appendChild(sp.element);
                return asDisposable(() => {
                    this.elMain.removeChild(sp.element);
                    sp.dispose();
                });
            });
        });

        this.whenConnected(() => {
            positionPopup();
        });
    }

    get appViewModel() { return this.parent; }
}