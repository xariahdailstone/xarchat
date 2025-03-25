import { SnapshottableMap } from "./collections/SnapshottableMap";

let useCompat: boolean;
try {
    const c = new CSSStyleSheet();
    useCompat = false;
}
catch { 
    useCompat = true;
}

export interface SharedStyleSheet {
    replaceSync(text: string): void;
}

class NativeCSSStyleSheet implements SharedStyleSheet {
    constructor() {
        this._css = new CSSStyleSheet();
    }

    private readonly _css: CSSStyleSheet;

    replaceSync(text: string): void {
        this._css.replaceSync(text);
    }

    get sheet(): CSSStyleSheet { return this._css; }
}

class CompatCSSStyleSheet implements SharedStyleSheet {
    constructor() {
        this._fr = new FinalizationRegistry<number>(hv => {
            this._styleElements.delete(hv);
        });
    }

    private readonly _fr: FinalizationRegistry<number>;

    private _text: string = "";
    private _nextId: number = 0;
    private _styleElements: SnapshottableMap<number, WeakRef<HTMLStyleElement>> = new SnapshottableMap();

    replaceSync(text: string): void {
        this._text = text;
        //this.logger.logDebug("compatcssstylesheet change text", text);

        this._styleElements.forEachValueSnapshotted(x => {
            var xd = x.deref();
            if (xd) {
                while (xd.firstChild) {
                    xd.firstChild.remove();
                }
                //xd.setAttribute("data-value", this._text);
                xd.appendChild(document.createTextNode(this._text));
            }
        });
    }

    getStylesheetElement(): HTMLStyleElement {
        const myId = this._nextId++;

        const el = document.createElement("style");
        el.setAttribute("type", "text/css");
        //el.setAttribute("data-value", this._text);
        el.appendChild(document.createTextNode(this._text));
        this._styleElements.set(myId, new WeakRef(el));
        this._fr.register(el, myId);

        return el;
    }
}

export function setStylesheetAdoption(target: DocumentOrShadowRoot, sheets: SharedStyleSheet[]) {
    if (!useCompat) {
        target.adoptedStyleSheets = sheets.map(s => (s as NativeCSSStyleSheet).sheet);
    }
    else {
        if (target instanceof ShadowRoot) {
            const frag = new DocumentFragment();
            for (let x of sheets) {
                frag.appendChild((x as CompatCSSStyleSheet).getStylesheetElement());
            }
            target.insertBefore(frag, target.firstChild);
        }
        else if (target instanceof Document) {
            for (let x of sheets) {
                target.head.appendChild((x as CompatCSSStyleSheet).getStylesheetElement());
            }
        }
    }
}

export function createStylesheet(): SharedStyleSheet {
    if (!useCompat) {
        return new NativeCSSStyleSheet();
    }
    else {
        return new CompatCSSStyleSheet();
    }
}
