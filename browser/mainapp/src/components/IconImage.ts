import { CancellationToken } from "../util/CancellationTokenSource.js";
import { IDisposable } from "../util/Disposable.js";
import { EL } from "../util/EL.js";
import { HostInterop } from "../util/HostInterop.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { runInAnimationFrame } from "../util/RequestAnimationFrameHook.js";
import { createStylesheet, setStylesheetAdoption } from "../util/StyleSheetPolyfill.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";

const imageCache = new Map<string, WeakRef<CachedImageInfo>>();
const freg = new FinalizationRegistry<CachedImageInfoInner>((heldValue) => {
    imageCache.delete(heldValue.src);
    heldValue?.dispose();
});

class CachedImageInfoInner implements IDisposable {
    constructor(
        public readonly src: string
    ) {
    }

    private _url: (string | null) = null;

    dispose() {
        if (this._url) {
            URL.revokeObjectURL(this._url);
            this._url = null;
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    setBlobUrl(url: string) {
        this._url = url;
    }
}

class CachedImageInfo {
    static getOrCreate(src: string): CachedImageInfo {
        const existingObj = imageCache.get(src)?.deref();
        if (existingObj) {
            return existingObj;
        }
        else {
            const result = new CachedImageInfo(src);
            freg.register(result, result._innerInfo);
            imageCache.set(src, new WeakRef(result));
            return result;
        }
    }

    private constructor(src: string) {
        this._src = src;
        this._innerInfo = new CachedImageInfoInner(src);
        this._urlPromise = new Promise<string | HTMLImageElement>(async (resolve, reject) => {
            try {
                const result = await this.performLoad();
                resolve(result);
            }
            catch (e) {
                reject(e);
            }
        });
    }

    private readonly _src: string;
    private readonly _innerInfo: CachedImageInfoInner;
    
    private readonly _urlPromise;

    private async performLoad() : Promise<string | HTMLImageElement> {
        if (this._src.startsWith("https:")) {
            const p = new Promise<HTMLImageElement>((resolve, reject) => {
                const imgEl = document.createElement("img");
                imgEl.addEventListener("load", () => {
                    resolve(imgEl);
                });
                imgEl.addEventListener("error", () => {
                    reject("failed to load image");
                });
                imgEl.setAttribute("src", this._src);
            });
            const resultEl = await p;
            return resultEl;
        }
        else {
            if (this._src.endsWith(".svg")) {
                const p = HostInterop.getSvgDataAsync(this._src, CancellationToken.NONE);
                return p;
            }
            else {
                const resp = await fetch(this._src);
                if (this._src.endsWith(".svg")) {
                    const text = await resp.text();
                    return text;
                }
                else {
                    const blob = await resp.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    this._innerInfo.setBlobUrl(objectUrl);
                    return objectUrl;
                }
            }
        }
    }


    private _getTemplateAsync: Promise<HTMLTemplateElement> | null = null;

    private async getTemplateAsyncInner(): Promise<HTMLTemplateElement> {
        const d = await this._urlPromise; 
        const template = document.createElement("template");

        if (d instanceof HTMLImageElement) {
            template.content.appendChild(d);
        }
        else if (this._src.endsWith(".svg")) {
            template.innerHTML = d;
        }
        else {
            const el = document.createElement("img");
            el.setAttribute("src", d);
            template.content.appendChild(el);
        }

        return template;
    }

    async getTemplateAsync(): Promise<HTMLTemplateElement> { 
        if (!this._getTemplateAsync) {
            this._getTemplateAsync = this.getTemplateAsyncInner();
        }
        return this._getTemplateAsync;
    }
}

const iconImage2Stylesheet = createStylesheet();
iconImage2Stylesheet.replaceSync(`
:host {
    display: block;
    contain: paint;
    /*display: block;
    position: relative;
    overflow: hidden;*/
}
.lh-monitor-container { display: inline; position: absolute; opacity: 0; top: 0; left: 0; width: 1px; height: 1px; user-select: none; pointer-events: none; }
.lh-monitor { display: inline; position: absolute; opacity: 0; user-select: none; pointer-events: none; }
.main { display: contents; --fgcolor: currentColor; max-width: inherit; max-height: inherit; }
.main > * { 
    display: block; 
    max-width: var(--converted-max-width); 
    max-height: var(--converted-max-height); 
    width: inherit;
    height: inherit;
    fill: var(--fgcolor);
}
`);

@componentElement("x-iconimage")
export class IconImage extends HTMLElement {
    static get observedAttributes() { return [ "src" ]; }

    constructor() {
        super();
        this._sroot = this.attachShadow({ mode: 'closed' });
        HTMLUtils.assignStaticHTMLFragment(this._sroot,
            `<div class="lh-monitor-container"><div id="elLineHeightMonitor" class="lh-monitor">A</div></div><div id="elMain" class="main"></div>`);
        setStylesheetAdoption(this._sroot, [ iconImage2Stylesheet ]);
    }

    private readonly _sroot: ShadowRoot;
    private _ro: ResizeObserver | null = null;

    protected attributeChangedCallback(name: string, oldValue?: string | undefined, newValue?: string | undefined): void {
        if (name == "src") {
            this.src = newValue ? newValue : null;
        }
    }

    protected connectedCallback() {
        const elLineHeightMonitor = this._sroot.getElementById("elLineHeightMonitor") as HTMLDivElement;

        this._ro = new ResizeObserver(entries => {
            for (let entry of entries) {
                this.recalculateDimensions(entry.contentRect.height);
            }
        });
        this._ro.observe(elLineHeightMonitor);
        // window.requestAnimationFrame(() => {
        //     this.recalculateDimensions();
        // });
    }

    protected disconnectedCallback() {
        if (this._ro) {
            this._ro.disconnect();
            this._ro = null;
        }
    }

    private getCurrentLineHeight() {
        const elLineHeightMonitor = this._sroot.getElementById("elLineHeightMonitor") as HTMLDivElement;
        return elLineHeightMonitor.clientHeight;
    }

    private getLhUnits(str: string) {
        const re = new RegExp(/^([\d\.]+)lh$/, "i");
        const xr = re.exec(str);
        if (xr) {
            return +xr[1];
        }
        else {
            return null;
        }
    }

    private nullIf(value: string, ...nullIfValues: string[]) {
        for (let niv of nullIfValues) {
            if (value == niv) {
                return null;
            }
        }
        return value;
    }

    private recalculateDimensions(lineHeight: number) {
        const elLineHeightMonitor = this._sroot.getElementById("elLineHeightMonitor") as HTMLDivElement;
        const elMain = this._sroot.getElementById("elMain") as HTMLDivElement;

        //const lineHeight = this.getCurrentLineHeight();
        const cs = window.getComputedStyle(this);

        const strMaxWidth = 
            this.nullIf(cs.getPropertyValue("--iconimage-max-width"), "", "none")
            ?? this.nullIf(cs.maxWidth, "", "none")
            ?? cs.width;
        const strMaxHeight = 
            this.nullIf(cs.getPropertyValue("--iconimage-max-height"), "", "none")
            ?? this.nullIf(cs.maxHeight, "", "none")
            ?? cs.height;

        const maxWidthUnits = this.getLhUnits(strMaxWidth);
        const maxHeightUnits = this.getLhUnits(strMaxHeight);

        if (maxWidthUnits != null) {
            elMain.style.setProperty("--converted-max-width", (lineHeight * maxWidthUnits) + "px");
        }
        else {
            elMain.style.setProperty("--converted-max-width", strMaxWidth);
        }
        if (maxHeightUnits != null) {
            elMain.style.setProperty("--converted-max-height", (lineHeight * maxHeightUnits) + "px");
        }
        else {
            elMain.style.setProperty("--converted-max-height", strMaxHeight);
        }
    }

    private _src: (string | null) = null;
    get src() { return this._src; }
    set src(value) {
        if (value !== this._src) {
            this._src = value;
            this.reinitializeImage(value);
            if (value != null) {
                this.setAttribute("src", value);
            }
            else {
                this.removeAttribute("src");
            }
        }
    }

    private _currentInitializeCall: object = {};

    private async reinitializeImage(src: string | null) {
        const thisCallIdentity = {};
        this._currentInitializeCall = thisCallIdentity;

        const elMain = this._sroot.getElementById("elMain") as HTMLDivElement;

        while (elMain.lastChild) {
            elMain.lastChild.remove();
        }

        if (src) {
            const ii = CachedImageInfo.getOrCreate(src);
            const elTemplate = await ii.getTemplateAsync();
            if (this._currentInitializeCall !== thisCallIdentity) {
                return;
            } 

            const el = elTemplate.content.cloneNode(true) as HTMLElement;
            //el.classList.add("img");
            elMain.appendChild(el);
            (elMain.firstChild as any)["__x"] = ii;
        }
    }
}


export class IconImageLightweight implements IDisposable {
    constructor(
        private readonly containerElement: HTMLElement) {

        // this._intersectionObserver = new IntersectionObserver(entries => {
        //     for (let entry of entries) {
        //         if (entry.isIntersecting) {
        //             if (!this._isVisible) {
        //                 this._isVisible = true;
        //                 this.onSrcUpdated();
        //             }
        //         }
        //     }
        // });
        // this._intersectionObserver.observe(containerElement);
    }

    // private readonly _intersectionObserver: IntersectionObserver;
    private _disposed: boolean = false;

    private _isVisible: boolean = true;

    dispose() {
        this._disposed = true;
        this.src = null;
        // this._intersectionObserver.disconnect();
    }

    [Symbol.dispose]() { this.dispose(); }

    private _src: (string | null) = "";
    get src() { return this._src; }
    set src(value: string | null) {
        if (this._disposed) { value = null; }
        if (value !== this._src) {
            this._src = value;
            this.onSrcUpdated();
        }
    }

    private onSrcUpdated() {
        const src = this._isVisible ? this._src : null;

        HTMLUtils.clearChildren(this.containerElement);
        if (src != null) {
            const srcLower = src?.toLowerCase();
            if (src.endsWith(".png") || src.endsWith(".gif") || src.endsWith(".jpg") || src.endsWith(".jpeg")) {
                const imgEl = document.createElement("img");
                imgEl.src = src;
                imgEl.classList.add("iconimagelightweight-img");
                this.containerElement.append(imgEl);
            }
            else if (src.endsWith(".svg")) {
                const icoImgEl = document.createElement("x-iconimage") as IconImage;
                icoImgEl.classList.add("iconimagelightweight-iconimage");
                icoImgEl.src = src;
                this.containerElement.append(icoImgEl);
            }
        }
    }
}