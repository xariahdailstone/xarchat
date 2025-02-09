import { AppViewModel } from "../../viewmodel/AppViewModel";
import { IFramePopupViewModel } from "../../viewmodel/popups/IFramePopupViewModel";
import { ImagePreviewPopupViewModel } from "../../viewmodel/popups/ImagePreviewPopupViewModel";
import { CancellationToken } from "../CancellationTokenSource";
import { IDisposable } from "../Disposable";
import { EventListenerUtil } from "../EventListenerUtil";

class CheckData {
    constructor(
        public readonly url: string,
        public readonly cancellationToken: CancellationToken,
        relatedChecks?: Map<string, CheckData>) {

        this._relatedChecks = relatedChecks ?? new Map();
    }

    private _relatedChecks: Map<string, CheckData> = new Map();

    getRelatedCheck(url: string) {
        let r = this._relatedChecks.get(url);
        if (!r) {
            r = new CheckData(url, this.cancellationToken, this._relatedChecks);
            this._relatedChecks.set(url, r);
        }
        return r;
    }

    private _headData: Promise<Response | null> | null = null;
    private _htmlBodyData: Promise<Document | null> | null = null;

    get headData(): Promise<Response | null> {
        if (!this._headData) {
            this._headData = this.populateHeadData();
        }
        return this._headData;
    }

    get htmlBodyData(): Promise<Document | null> {
        if (!this._htmlBodyData) {
            this._htmlBodyData = this.populateHtmlBodyData();
        }
        return this._htmlBodyData;
    }

    private async populateHeadData(): Promise<Response | null> {
        const resp = await fetch(this.url, {
            method: "HEAD",
            signal: this.cancellationToken.signal,
            credentials: 'same-origin',
            headers: {
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-User": "?1",
            }
        });
        if (resp.status != 200) {
            return null;
        }
        return resp;
    }

    private async populateHtmlBodyData(): Promise<Document | null> {
        const resp = await fetch(this.url, {
            method: "GET",
            signal: this.cancellationToken.signal,
            credentials: 'same-origin',
            headers: {
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin",
                "Sec-Fetch-User": "?1",
            }
        });
        if (resp.status != 200) {
            return null;
        }

        const contentTypeHeader = resp.headers.get("content-type");
        if (!contentTypeHeader || !contentTypeHeader.startsWith("text/html")) {
            return null;
        }

        const bodyHtml = await resp.text();

        const tmpl = new DOMParser();
        const rdoc = tmpl.parseFromString(bodyHtml, "text/html");
        return rdoc;
    }
}

export class LinkPreviewProvider {
    static addMouseOverPreview(appViewModel: AppViewModel, url: string, el: HTMLElement) {
        const u = new URL(url);
        let popupViewModel: (ImagePreviewPopupViewModel | IFramePopupViewModel | null) = null;
        let linkPreviewData: (LinkPreviewData | null | undefined) = undefined;
        let mouseStillOver: boolean = false;
        let mouseOutDispose: IDisposable | null = null;

        el.addEventListener("mouseover", async () => {
            console.log("link mouseover");
            mouseStillOver = true;
            if (linkPreviewData === undefined) {
                linkPreviewData = await LinkPreviewProvider.getLinkPreviewDataAsync(url, CancellationToken.NONE);
            }
            if (mouseStillOver) {
                if (linkPreviewData instanceof LinkPreviewImageData) {
                    const previewUrl = linkPreviewData.url;
                    const myPopupViewModel = new ImagePreviewPopupViewModel(appViewModel, el);
                    popupViewModel = myPopupViewModel;
                    if (previewUrl && popupViewModel == myPopupViewModel) {
                        myPopupViewModel.imageUrl = previewUrl;
                    }
                }
                else if (linkPreviewData instanceof LinkPreviewVideoData) {
                    const previewUrl = linkPreviewData.url;
                    const myPopupViewModel = new ImagePreviewPopupViewModel(appViewModel, el);
                    popupViewModel = myPopupViewModel;
                    if (previewUrl && popupViewModel == myPopupViewModel) {
                        myPopupViewModel.videoUrl = previewUrl;
                    }
                }
                else if (linkPreviewData instanceof LinkPreviewRichEmbedData) {
                    const richEmbedData = linkPreviewData;
                    const myPopupViewModel = new IFramePopupViewModel(appViewModel, el);
                    const ifr = document.createElement("iframe");

                    mouseOutDispose = EventListenerUtil.addDisposableEventListener(window, "message", (evt: MessageEvent) => {
                        try {
                            const data = evt.data
                            console.log("embed message", data);
                            if (data.cmd == "embed-loaded" && data.embedId == richEmbedData.embedId) {
                                myPopupViewModel.iframeSize = [ data.width, data.height ];
                                window.requestAnimationFrame(() => {
                                    myPopupViewModel.visible = true;
                                });
                            }
                        }
                        catch { }
                    });

                    appViewModel.popups.push(myPopupViewModel);
                    popupViewModel = myPopupViewModel;
                    
                    ifr.src = linkPreviewData.url;
                    ifr.allow = "";
                    myPopupViewModel.iframeElement = ifr;
                }
            }
        });
        el.addEventListener("mouseout", () => {
            console.log("link mouseout");
            mouseStillOver = false;
            if (mouseOutDispose) {
                mouseOutDispose.dispose();
                mouseOutDispose = null;
            }
            if (popupViewModel) {
                popupViewModel.dismissed();
                popupViewModel = null;
            }
        });
    }

    static async getLinkPreviewDataAsync(url: string, cancellationToken: CancellationToken): Promise<LinkPreviewData | null> {
        const checkData = new CheckData(url, cancellationToken);
        return (await this.checkForRichEmbedAsync(checkData, cancellationToken)) ??
            (await this.checkForVideoAsync(checkData, true, cancellationToken)) ??
            (await this.checkForImageAsync(checkData, true, cancellationToken)) ??
            (await this.checkForOpenGraphVideoAsync(checkData, cancellationToken)) ??
            (await this.checkForOpenGraphImageAsync(checkData, cancellationToken)) ??
            null;
    }

    private static _nextEmbedIdNum: number = 1;

    private static async checkForRichEmbedAsync(
        checkData: CheckData,
        cancellationToken: CancellationToken): Promise<LinkPreviewRichEmbedData | null> {

        const u = new URL(checkData.url);
        if (u.hostname == "bsky.app" && u.pathname.indexOf("/post/") != -1) {
            const myEmbedId = this._nextEmbedIdNum++;
            return new LinkPreviewRichEmbedData(`embeds/bluesky.html?url=${encodeURIComponent(checkData.url)}&eid=${myEmbedId}`, myEmbedId.toString());
        }
        else if ((u.hostname == "youtube.com" || u.hostname == "www.youtube.com") && u.pathname == "/watch") {
            const myEmbedId = this._nextEmbedIdNum++;
            return new LinkPreviewRichEmbedData(`embeds/youtube.html?vid=${u.searchParams.get("v")}&eid=${myEmbedId}`, myEmbedId.toString());
        }
        else if (u.hostname == "youtu.be") {
            const myEmbedId = this._nextEmbedIdNum++;
            return new LinkPreviewRichEmbedData(`embeds/youtube.html?vid=${u.pathname.substring(1)}&eid=${myEmbedId}`, myEmbedId.toString());
        }
        else {
            return null;
        }
    }

    private static async checkForVideoAsync(
        checkData: CheckData,
        allowOpenGraphGet: boolean,
        cancellationToken: CancellationToken): Promise<LinkPreviewVideoData | null> {
        try {
            const headData = await checkData.headData;
            if (!headData) {
                return null;
            }

            const contentTypeHeader = headData.headers.get("content-type");
            if (contentTypeHeader && contentTypeHeader.startsWith("video/")) {
                return new LinkPreviewVideoData(headData.url);
            }
            else if (allowOpenGraphGet && contentTypeHeader && contentTypeHeader.startsWith("text/html")) {
                return await this.checkForOpenGraphVideoAsync(checkData, cancellationToken);
            }
        }
        catch { }

        return null;
    }

    private static async checkForImageAsync(
        checkData: CheckData,
        allowOpenGraphGet: boolean,
        cancellationToken: CancellationToken): Promise<LinkPreviewImageData | null> {
        try {
            const headData = await checkData.headData;
            if (!headData) {
                return null;
            }

            const contentTypeHeader = headData.headers.get("content-type");
            if (contentTypeHeader && contentTypeHeader.startsWith("image/")) {
                return new LinkPreviewImageData(headData.url);
            }
            else if (allowOpenGraphGet && contentTypeHeader && contentTypeHeader.startsWith("text/html")) {
                return await this.checkForOpenGraphImageAsync(checkData, cancellationToken);
            }
        }
        catch { }

        return null;
    }

    private static async checkForOpenGraphVideoAsync(checkData: CheckData, cancellationToken: CancellationToken): Promise<LinkPreviewImageData | null> {
        try {
            const rdoc = await checkData.htmlBodyData;
            if (!rdoc) {
                return null;
            }

            const elMetaImage = rdoc.querySelector("meta[property='og:video']") as (HTMLMetaElement | null);
            if (!elMetaImage) { console.log("no og:video meta found"); return null; }
            console.log("og:video meta", elMetaImage.content);

            const metaImageUrl = elMetaImage.content;
            const innerCheckData = checkData.getRelatedCheck(metaImageUrl);
            const innerResult = (metaImageUrl != checkData.url) ? await this.checkForVideoAsync(innerCheckData, false, cancellationToken) : null;
            return innerResult;
        }
        catch (e) { console.error("checkForOpenGraphVideoAsync error", e); }

        return null;
    }

    private static async checkForOpenGraphImageAsync(checkData: CheckData, cancellationToken: CancellationToken): Promise<LinkPreviewImageData | null> {
        try {
            const rdoc = await checkData.htmlBodyData;
            if (!rdoc) {
                return null;
            }

            const elMetaImage = rdoc.querySelector("meta[property='og:image']") as (HTMLMetaElement | null);
            if (!elMetaImage) { console.log("no og:image meta found"); return null; }
            console.log("og:image meta", elMetaImage.content);

            const metaImageUrl = elMetaImage.content;
            const innerCheckData = checkData.getRelatedCheck(metaImageUrl);
            const innerResult = (metaImageUrl != checkData.url) ? await this.checkForImageAsync(innerCheckData, false, cancellationToken) : null;
            return innerResult;
        }
        catch (e) { console.error("checkForOpenGraphImageAsync error", e); }

        return null;
    }
}

export abstract class LinkPreviewData {
}

export class LinkPreviewVideoData extends LinkPreviewData {
    constructor(public readonly url: string) {
        super();
    }
}

export class LinkPreviewImageData extends LinkPreviewData {
    constructor(public readonly url: string) {
        super();
    }
}

export class LinkPreviewRichEmbedData extends LinkPreviewData {
    constructor(public readonly url: string, public readonly embedId: string) {
        super();
    }
}