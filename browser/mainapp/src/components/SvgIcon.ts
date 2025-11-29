import { CallbackSet } from "../util/CallbackSet";
import { SnapshottableSet } from "../util/collections/SnapshottableSet";
import { DelayedCallManager, DelayedCallScheduler, DelayedCallStyle } from "../util/DelayedCallManager";
import { IDisposable } from "../util/Disposable";
import { HTMLUtils } from "../util/HTMLUtils";
import { Logger, Logging } from "../util/Logger";
import { ObjectUniqueId } from "../util/ObjectUniqueId";
import { ShadowRootsManager } from "../util/ShadowRootsManager";

export class SvgIcon extends HTMLElement {

    static get observedAttributes() { return [ 'src' ] };

    constructor() {
        super();

        this.logger = Logging.createLogger(`SvgIcon#${ObjectUniqueId.get(this)}`);

        this._sroot = ShadowRootsManager.elementAttachShadow(this, { mode: 'closed' });
        HTMLUtils.assignStaticHTMLFragment(this._sroot, `
            <link rel="stylesheet" type="text/css" href="styles/components/SvgIcon.css" />
            <div id="elMain">
            </div>
        `);

        // this.elIcon.addEventListener("load", () => {
        //     this.elMain.classList.add("loaded");
        //     this.logger.logDebug("svgicon loaded", this.src);
        //     this.recheckStyle();
        // });

        this.recheckStyle();
    }

    readonly logger: Logger;

    private readonly _sroot: ShadowRoot;

    private get elMain(): HTMLDivElement { return this._sroot.getElementById("elMain") as HTMLDivElement; }
    private get elIcon(): HTMLObjectElement | undefined { return this._sroot.getElementById("elIcon") as HTMLObjectElement | undefined; }

    get src(): string { return this.getAttribute("src") ?? ""; }
    set src(value: string) {
        if (value != null) {
            this.setAttribute("src", value);
        }
        else {
            this.removeAttribute("src");
        }
    }

    private attributeChangedCallback(name: string, oldValue?: string, newValue?: string) {
        if (name == "src") {
            this.attrSrcChanged(oldValue, newValue);
        }
    }

    private _mutationObservers: SnapshottableSet<MutationObserver> = new SnapshottableSet();

    private setupMutationObservers() {
        this.teardownMutationObservers();

        this._mutationObservers.clear();
        const obsv = new MutationObserver(() => { this.recheckStyle(); });
        this._mutationObservers.add(obsv);

        let checkElement = this.parentElement as (Node | null);
        while (checkElement) {
            if (checkElement instanceof ShadowRoot) {
                obsv.observe(checkElement, { subtree: true, attributes: true, childList: true  });
                checkElement = checkElement.host;
            }
            else if (checkElement instanceof HTMLBodyElement) {
                obsv.observe(checkElement, { subtree: true, attributes: true, childList: true  });
                checkElement = null;
            }
            else {
                checkElement = checkElement.parentNode;
            }
        }
    }

    private teardownMutationObservers() {
        this._mutationObservers.forEachValueSnapshotted(obsv => {
            obsv.disconnect();
        });
        this._mutationObservers.clear();
    }

    private _connectDisconnectCallbackSet: CallbackSet<() => void> = new CallbackSet(this.constructor.name);
    addConnectDisconnectHandler(callback: () => void): IDisposable {
        return this._connectDisconnectCallbackSet.add(callback);
    }
    removeConnectDisconnectHandler(callback: () => void): void {
        this._connectDisconnectCallbackSet.delete(callback);
    }   

    private connectedCallback() {
        this.setupMutationObservers();
        this.recheckStyle();
        this._connectDisconnectCallbackSet.invoke();
    }

    private disconnectedCallback() {
        this.teardownMutationObservers();
        this._connectDisconnectCallbackSet.invoke();
    }

    private attrSrcChanged(oldValue?: string, newValue?: string) {
        this.recheckStyle();
        if (newValue != null) {
            this.logger.logDebug("svgicon attrSrcChanged", this.src);
            this.elMain.classList.remove("loaded");
            this.elMain.classList.remove("styled");

            const newEl = document.createElement("object");
            newEl.setAttribute("id", "elIcon");
            if (newValue.endsWith(".svg")) {
                newEl.setAttribute("type", "image/svg+xml");
            }
            else if (newValue.endsWith(".jpg") || newValue.endsWith(".jpeg")) {
                newEl.setAttribute("type", "image/jpeg");
            }
            else if (newValue.endsWith(".gif")) {
                newEl.setAttribute("type", "image/gif");
            }
            else if (newValue.endsWith(".png")) {
                newEl.setAttribute("type", "image/png");
            }
            newEl.style.visibility = "hidden";
            newEl.addEventListener("load", () => {
                this.recheckStyle();
                newEl.style.visibility = "visible";
            });
            newEl.setAttribute("data", newValue);
            this.elMain.firstElementChild?.remove();
            this.elMain.appendChild(newEl);
            this.recheckStyle();
        }
        else {
            this.logger.logDebug("svgicon attrSrcCleared", this.src);
            this.elMain.classList.remove("loaded");
            this.elMain.classList.remove("styled");
            this.elMain.firstElementChild?.remove();
        }
    }

    private _fgColor: string | null = null;
    private _bgColor: string | null = null;

    private _recheckStyleDCM = new DelayedCallManager(
        DelayedCallStyle.RUN_LAST, DelayedCallScheduler.REQUEST_ANIMATION_FRAME);

    private recheckStyle() {
        this._recheckStyleDCM.scheduleDelayedCall(() => {
            const computedStyle = window.getComputedStyle(this);

            let svgDoc: HTMLElement | null;
            try {
                svgDoc = this.elIcon?.getSVGDocument()?.documentElement ?? null;
            }
            catch (e) {
                svgDoc = null;
            }

            if (svgDoc) {
                const computedFgColor = computedStyle.color;
                const computedBgColor = computedStyle.backgroundColor;

                if (computedFgColor != this._fgColor) {
                    this._fgColor = computedFgColor;
                    svgDoc.style.setProperty("--fgcolor", computedFgColor);
                }
                if (computedBgColor != this._bgColor) {
                    this._bgColor = computedBgColor;
                    svgDoc.style.setProperty("--bgcolor", computedBgColor);
                }
            }

            const elIcon = this.elIcon;
            if (elIcon) {
                if (computedStyle.maxWidth == "" || computedStyle.maxWidth == "none") {
                    elIcon.style.maxWidth = "var(--svgicon-max-width)";
                    elIcon.style.maxHeight = "var(--svgicon-max-height)";
                }
                else {
                    elIcon.style.maxWidth = computedStyle.maxWidth;
                    elIcon.style.maxHeight = computedStyle.maxHeight;
                }
            }
            
            if (svgDoc) {
                this.logger.logDebug("svgicon styled", this.src);
                this.elMain.classList.add("styled");
            }
        });
    }
}

window.customElements.define("x-svgicon", SvgIcon);