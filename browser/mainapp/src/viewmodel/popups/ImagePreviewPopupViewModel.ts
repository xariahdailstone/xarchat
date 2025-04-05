import { CancellationToken, CancellationTokenSource } from "../../util/CancellationTokenSource";
import { HTMLUtils } from "../../util/HTMLUtils";
import { ObservableValue } from "../../util/Observable";
import { observableProperty } from "../../util/ObservableBase";
import { PromiseSource } from "../../util/PromiseSource";
import { ContextPopupViewModel, PopupViewModel } from "./PopupViewModel";

export class ImagePreviewPopupViewModel extends ContextPopupViewModel {

    private readonly _imageUrl: ObservableValue<string | null> = new ObservableValue(null).withName("ImagePreviewPopupViewModel._imageUrl");
    private readonly _videoUrl: ObservableValue<string | null> = new ObservableValue(null).withName("ImagePreviewPopupViewModel._videoUrl");

    private readonly _imageElement: ObservableValue<HTMLImageElement | null> = new ObservableValue(null).withName("ImagePreviewPopupViewModel._imageElement");
    private readonly _videoElement: ObservableValue<HTMLVideoElement | null> = new ObservableValue(null).withName("ImagePreviewPopupViewModel._videoElement");

    get imageUrl(): string | null { return this._imageUrl.value; }
    set imageUrl(value: (string | null)) {
        if (value !== this._imageUrl.value) {
            this._imageUrl.value = value;
            this.startLoad();
        }
    }

    get videoUrl(): string | null { return this._videoUrl.value; }
    set videoUrl(value: (string | null)) {
        if (value !== this._videoUrl.value) {
            this._videoUrl.value = value;
            this.startLoad();
        }
    }

    get imageElement(): HTMLImageElement | null { return this._imageElement.value; }
    set imageElement(value: (HTMLImageElement | null)) { 
        if (value !== this._imageElement.value) {
            this._imageElement.value = value;
            this.updateVisibility();
        }
    }

    get videoElement(): HTMLVideoElement | null { return this._videoElement.value; }
    set videoElement(value: (HTMLVideoElement | null)) { 
        if (value !== this._videoElement.value) {
            this._videoElement.value = value;
            this.updateVisibility();
        }
    }


    private _currentLoadCTS: CancellationTokenSource = new CancellationTokenSource();

    private startLoad() {
        this._currentLoadCTS.cancel();
        
        const myCTS = new CancellationTokenSource();
        this._currentLoadCTS = myCTS;

        this._imageElement.value = null;
        this._videoElement.value = null;

        if (this._imageUrl.value) {
            this.logger.logDebug("image preview load start");
            this.loadImageAsync(this._imageUrl.value, myCTS.token);
        }
        else if (this._videoUrl.value) {
            this.logger.logDebug("video preview load start");
            this.loadVideoAsync(this._videoUrl.value, myCTS.token);
        }
    }

    private async loadImageAsync(url: string, cancellationToken: CancellationToken) {
        try {
            const imgEl = document.createElement("img");

            const loadedPS = new PromiseSource<void>();
            using r = cancellationToken.register(() => {
                if (loadedPS.tryReject("cancelled")) {
                    this.logger.logDebug("image preview load cancelled");
                    imgEl.src = "";
                }
                else {
                    this.logger.logDebug("image preview load could not cancel");
                }
            });
            imgEl.addEventListener("load", () => {
                loadedPS.tryResolve();
            });

            imgEl.src = this.getImageProxyUrl(url);
            await loadedPS.promise;

            if (!cancellationToken.isCancellationRequested) {
                this.logger.logDebug("completed image load");
                this.imageElement = imgEl;
            }
        }
        catch {
            if (!cancellationToken.isCancellationRequested) {
                this.imageElement = null;
            }
        }
    }

    private async loadVideoAsync(url: string, cancellationToken: CancellationToken) {
        const vidEl = document.createElement("video");
        const srcEl = document.createElement("source");
        let wasCancelled = false;

        try {
            const canPlayPS = new PromiseSource<void>();
            using r = cancellationToken.register(() => {
                if (canPlayPS.tryReject("cancelled")) {
                    this.logger.logDebug("cancelling video load", url);
                    vidEl.src = "";
                    srcEl.src = "";
                    HTMLUtils.clearChildren(vidEl);
                    wasCancelled = true;
                }
                else {
                    this.logger.logDebug("could not cancel video load", url);
                }
            });

            vidEl.addEventListener("canplay", () => {
                canPlayPS.resolve();
            });
            vidEl.autoplay = true;
            vidEl.muted = true;
            vidEl.loop = true;
            
            this.logger.logDebug("starting video load", url);
            srcEl.src = url;
            vidEl.appendChild(srcEl);

            await canPlayPS.promise;

            if (!cancellationToken.isCancellationRequested) {
                this.logger.logDebug("completed video load", url);
                this.videoElement = vidEl;
            }
        }
        catch {
            if (!cancellationToken.isCancellationRequested) {
                this.videoElement = null;
            }
        }
    }

    private getImageProxyUrl(url: string): string {
        const u = new URL(url);
        if (u.hostname == "i.4cdn.org") {
            const fnParts = u.pathname.split('/');
            const fn = fnParts[fnParts.length - 1];
            url = `/api/proxyImageUrl/${fn}?url=${encodeURIComponent(url)}&loadAs=ssimage`;
        }
        return url;
    }

    private updateVisibility() {
        if (this.videoElement || this.imageElement) {
            this.appViewModel.popups.push(this);
        }
        else {
            this.appViewModel.popups.remove(this);
        }
    }

    dismissed(): void {
        this.logger.logDebug("imagepreviewpopup dismissed");
        this.imageUrl = null;
        this.videoUrl = null;

        super.dismissed();
    }
}

