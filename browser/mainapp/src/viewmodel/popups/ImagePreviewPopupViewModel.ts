import { CancellationTokenSource } from "../../util/CancellationTokenSource";
import { HTMLUtils } from "../../util/HTMLUtils";
import { observableProperty } from "../../util/ObservableBase";
import { PromiseSource } from "../../util/PromiseSource";
import { ContextPopupViewModel, PopupViewModel } from "./PopupViewModel";


export class ImagePreviewPopupViewModel extends ContextPopupViewModel {

    private _loadCTS: CancellationTokenSource | null = null;

    private _imageUrl: string | null = null;
    @observableProperty
    get imageUrl(): string | null { return this._imageUrl; }
    set imageUrl(value: (string | null)) {
        if (value != this._imageUrl) {
            if (this._loadCTS) {
                this._loadCTS.cancel();
                this._loadCTS = null;
            }

            this._imageUrl = value;
            const myLoadCTS = new CancellationTokenSource();
            this._loadCTS = myLoadCTS;

            if (value) {
                (async () => {
                    const imgEl = document.createElement("img");

                    const loadedPS = new PromiseSource<void>();
                    using r = myLoadCTS.token.register(() => {
                        imgEl.src = "";
                        loadedPS.tryResolve();
                    });

                    imgEl.addEventListener("load", () => {
                        loadedPS.tryResolve();
                    });
                    imgEl.src = value;

                    await loadedPS.promise;

                    if (!myLoadCTS.isCancellationRequested) {
                        this.imageElement = imgEl;
                    }
            })();
            }
            else {
                this.imageElement = null;
            }
        }
    }

    private _imageElement: HTMLImageElement | null = null;
    @observableProperty
    get imageElement(): HTMLImageElement | null { return this._imageElement; }
    set imageElement(value) {
        if (value != this._imageElement) {
            if (this._imageElement) {
                this.breakImageElement(this._imageElement);
            }
            this._imageElement = value;
            if (value) {
                this.parent.popups.push(this);
            }
            else {
                this.parent.popups.remove(this);
            }
        }
    }

    private breakImageElement(el: HTMLImageElement) {
        el.src = "";
    }

    private breakVideoElement(el: HTMLVideoElement) {
        el.src = "";
        HTMLUtils.clearChildren(el);
    }

    private _videoUrl: string | null = null;
    @observableProperty
    get videoUrl(): string | null { return this._videoUrl; }
    set videoUrl(value: (string | null)) {
        if (value != this._videoUrl) {
            if (this._loadCTS) {
                this._loadCTS.cancel();
                this._loadCTS = null;
            }

            this._videoUrl = value;
            const myLoadCTS = new CancellationTokenSource();
            this._loadCTS = myLoadCTS;
            
            if (value) {
                (async () => {
                    const vidEl = document.createElement("video");
                    const srcEl = document.createElement("source");
                    let wasCancelled = false;

                    const canPlayPS = new PromiseSource<void>();
                    using r = myLoadCTS.token.register(() => {
                        console.log("cancelling video load", value);
                        vidEl.src = "";
                        srcEl.src = "";
                        HTMLUtils.clearChildren(vidEl);
                        wasCancelled = true;
                        canPlayPS.tryResolve();
                    });

                    vidEl.addEventListener("canplay", () => {
                        canPlayPS.resolve();
                    });
                    vidEl.autoplay = true;
                    vidEl.muted = true;
                    vidEl.loop = true;
                    
                    console.log("starting video load", value);
                    srcEl.src = value;
                    vidEl.appendChild(srcEl);

                    await canPlayPS.promise;

                    if (!myLoadCTS.isCancellationRequested) {
                        console.log("completed video load", value);
                        this.videoElement = vidEl;
                    }
                    else {
                        if (!wasCancelled) {
                            console.log("ABANDONED video load", value);
                        }
                    }
                })();
                
            }
            else {
                this.videoElement = null;
            }
        }
    }

    private _videoElement: HTMLVideoElement | null = null;
    @observableProperty
    get videoElement(): HTMLVideoElement | null { return this._videoElement; }
    set videoElement(value) {
        if (value != this._videoElement) {
            if (this._videoElement) {
                this.breakVideoElement(this._videoElement);
            }
            this._videoElement = value;
            if (value) {
                this.parent.popups.push(this);
            }
            else {
                this.parent.popups.remove(this);
            }
        }
    }

    dismissed(): void {
        this.imageUrl = null;
        this.videoUrl = null;

        if (this._loadCTS) {
            this._loadCTS.cancel();
            this._loadCTS = null;
        }

        super.dismissed();
    }
}
