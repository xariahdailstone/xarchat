import { CallbackSet } from "../util/CallbackSet.js";
import { CancellationToken } from "../util/CancellationTokenSource.js";
import { IDisposable } from "../util/Disposable.js";
import { EL } from "../util/EL.js";
import { HostInterop } from "../util/hostinterop/HostInterop.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { ShadowRootsManager } from "../util/ShadowRootsManager.js";
import { createStylesheet, setStylesheetAdoption } from "../util/StyleSheetPolyfill.js";
import { ComponentBase, componentElement, StyleLoader } from "./ComponentBase.js";

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

    private _disposed: boolean = false;
    dispose() {
        if (this._url) {
            URL.revokeObjectURL(this._url);
            this._url = null;
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }

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

// const iconImage2Stylesheet = createStylesheet();
// iconImage2Stylesheet.replaceSync(`
// :host {
//     display: block;
//     contain: paint;
//     /*display: block;
//     position: relative;
//     overflow: hidden;*/
// }
// .main { display: contents; --fgcolor: currentColor; max-width: inherit; max-height: inherit; }
// .main > * { 
//     display: block; 
//     max-width: var(--iconimage-max-width); 
//     max-height: var(--iconimage-max-height); 
//     width: inherit;
//     height: inherit;
//     fill: var(--fgcolor);
// }
// `);

@componentElement("x-iconimage")
export class IconImage extends HTMLElement {
    static get observedAttributes() { return [ "src" ]; }

    constructor() {
        super();
        this._sroot = ShadowRootsManager.elementAttachShadow(this, { mode: 'closed' });
        HTMLUtils.assignStaticHTMLFragment(this._sroot,
            `<div id="elMain" class="main"></div>`);

        const _styleLoader = new StyleLoader(ss => {
            setStylesheetAdoption(this._sroot, ss);
            //(this._sroot as any).adoptedStyleSheets = [...ss];
        });
        _styleLoader.addLoad("styles/components/IconImage.css");

        //setStylesheetAdoption(this._sroot, [ iconImage2Stylesheet ]);
    }

    private readonly _sroot: ShadowRoot;

    protected attributeChangedCallback(name: string, oldValue?: string | undefined, newValue?: string | undefined): void {
        if (name == "src") {
            this.src = newValue ? newValue : null;
        }
    }

    private _connectDisconnectCallbackSet: CallbackSet<() => void> = new CallbackSet(this.constructor.name);
    addConnectDisconnectHandler(callback: () => void): IDisposable {
        return this._connectDisconnectCallbackSet.add(callback);
    }
    removeConnectDisconnectHandler(callback: () => void): void {
        this._connectDisconnectCallbackSet.delete(callback);
    }    

    protected connectedCallback() {
        this._connectDisconnectCallbackSet.invoke();
    }

    protected disconnectedCallback() {
        this._connectDisconnectCallbackSet.invoke();
    }

    private nullIf(value: string, ...nullIfValues: string[]) {
        for (let niv of nullIfValues) {
            if (value == niv) {
                return null;
            }
        }
        return value;
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

    get isDisposed() { return this._disposed; }

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