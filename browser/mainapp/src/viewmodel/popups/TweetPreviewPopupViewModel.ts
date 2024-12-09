import { CancellationToken, CancellationTokenSource } from "../../util/CancellationTokenSource";
import { EventListenerUtil } from "../../util/EventListenerUtil";
import { OperationCancelledError, PromiseSource } from "../../util/PromiseSource";
import { TaskUtils } from "../../util/TaskUtils";
import { AppViewModel } from "../AppViewModel";
import { PopupViewModel } from "./PopupViewModel";

let nextPopupId = 1;

export class TweetPreviewPopupViewModel extends PopupViewModel {
    constructor(parent: AppViewModel) {
        super(parent);
    }

    private _tweetId: (string | null) = null;
    private _prevTweetIdCTS: (CancellationTokenSource | null) = null;

    get tweetId() { return this._tweetId; }
    set tweetId(value) {
        if (value != this._tweetId) {
            if (this._prevTweetIdCTS) {
                this._prevTweetIdCTS.cancel();
                this._prevTweetIdCTS = null;
            }

            this._tweetId = value;

            if (value) {
                this._prevTweetIdCTS = new CancellationTokenSource();
                const x = this.loadAndShow(value, this._prevTweetIdCTS.token);
            }
        }
    }

    private _element: HTMLIFrameElement | null = null;
    get element() { return this._element; }
    set element(value) {
        if (value != this._element) {
            if (this._element) {
                this._element.remove();
            }

            this._element = value;
        }
    }

    private async loadAndShow(tweetId: string, cancellationToken: CancellationToken) {
        try {
            await this.loadEmbedAsync(tweetId, nextPopupId++, cancellationToken);
            if (this.tweetId == tweetId && !cancellationToken.isCancellationRequested) {
                this.appViewModel.popups.push(this);
            }
        }
        catch (e) {
            if (!(e instanceof OperationCancelledError)) { 
                throw e;
            }
        }
    }

    private async loadEmbedAsync(tweetId: string, popupId: number, cancellationToken: CancellationToken): Promise<EmbedSize> {
        const ps = new PromiseSource<EmbedSize>();
        let completed = false;

        const elIFrame = document.createElement("iframe");
        elIFrame.setAttribute("frameBorder", "0");
        elIFrame.inert = true;
        elIFrame.style.pointerEvents = "none";
        elIFrame.style.zIndex = "9999999999";
        elIFrame.style.position = "absolute";
        elIFrame.style.top = "0px";
        elIFrame.style.left = "0px";
        elIFrame.style.width = "90vw";
        elIFrame.style.height = "100px";
        elIFrame.style.transform = "translateX(-110%) translateY(-110%)";
        
        const cleanupIFrame = () => {
            elIFrame.src = "";
            elIFrame.remove();
            if (this.element == elIFrame) {
                this.element = null;
            }
        };
        const cleanupEvents = () => {
            ctReg?.dispose();
            messageListener?.dispose();
        };

        const ctReg = cancellationToken.register(() => {
            if (!completed) {
                completed = true;
                ps.trySetCancelled(cancellationToken);
                cleanupIFrame();
            }
        });

        const messageListener = EventListenerUtil.addDisposableEventListener(window, "message", async (ev: MessageEvent) => {
            if (!completed) {
                if (ev.data?.kind == "tweet-embed-loaded" && ev.data.id == tweetId && ev.data.popupId == popupId) {
                    completed = true;
                    cleanupEvents();

                    let scale = 1;
                    if ((ev.data.width * scale) > window.innerWidth * 0.8) {
                        scale = (window.innerWidth * 0.8) / (ev.data.width);
                    }
                    if ((ev.data.height * scale) > window.innerHeight * 0.8) {
                        scale = Math.min(scale, (window.innerHeight * 0.8) / (ev.data.height));
                    }
                    
                    const effWidth = ev.data.width * scale;
                    const effHeight = ev.data.height * scale;

                    elIFrame.style.width = `${effWidth}px`;
                    elIFrame.style.height = `${effHeight}px`;
                    if (elIFrame.contentWindow) {
                        console.log("sending set-scale to popup", scale);
                        elIFrame.contentWindow?.postMessage({ kind: "set-scale", scale: scale }, "*");
                        await TaskUtils.delay(0, CancellationToken.NONE);
                    }
                    else {
                        console.warn("can't set-scale popup, no contentWindow");
                    }
                    this.element = elIFrame;
                    ps.resolve({
                        width: effWidth,
                        height: effHeight
                    });
                }
                else if (ev.data?.kind == "tweet-embed-failed" && ev.data.id == tweetId && ev.data.popupId == popupId) {
                    completed = true;
                    cleanupEvents();
                    cleanupIFrame();
                    ps.reject("embed failed");
                }
            }
        });

        if (!completed) {
            elIFrame.src = `tweet-popup.html?id=${encodeURIComponent(tweetId)}&popupId=${popupId}`;
            document.body.appendChild(elIFrame);
        }

        return ps.promise;
    }

    override dismissed(): void {
        super.dismissed();
        this.element = null;
    }
}

interface EmbedSize {
    width: number;
    height: number;
}