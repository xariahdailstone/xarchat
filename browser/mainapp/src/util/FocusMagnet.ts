import { Logger, Logging } from "./Logger";
import { ObjectUniqueId } from "./ObjectUniqueId";

export class FocusMagnet {

    private static _instance: FocusMagnet | null = null;
    static get instance() {
        if (this._instance == null) {
            this._instance = new FocusMagnet();
        }
        return this._instance;
    }

    constructor() {
        this.logger = Logging.createLogger(`FocusMagnet#${ObjectUniqueId.get(this)}`);

        document.addEventListener("focus", (e) => { 
            //this.logger.logDebug("focusmanager document.focus", e.target);
            this.ultimateFocus = this.drillDown(e.target as Element);
        }, { capture: true });
        document.addEventListener("blur", (e) => {
            //this.logger.logDebug("focusmanager document.blur", e.target);
            this.ultimateFocus = null;
        }, { capture: true });

        // document.addEventListener("selectionchange", (e) => {
        //     this.logger.logDebug("focusmanager document.selectionchange", e.target);
        // }, { capture: true });
    }

    readonly logger: Logger;

    private _scopeElement: HTMLElement | null = null;

    private _ultimateFocus: Element | null = null;
    get ultimateFocus() { return this._ultimateFocus; }
    set ultimateFocus(value: Element | null) {
        if (value != this._ultimateFocus) {
            this._ultimateFocus = value;
            this.logger.logDebug("focusmanager ultimate element", value);
        }
    }

    setScope(scopeElement: HTMLElement | null) {
        if (scopeElement != this._scopeElement) {
            this._scopeElement = scopeElement;
            // this.logger.logDebug(`focusmanager scope set`, scopeElement);
        }
    }

    drillDown(topElement: Element | null | undefined): Element | null {
        if (!topElement) {
            return null;
        }
        if (topElement.shadowRoot || (topElement as any)["_sroot"]) {
            const shadowRoot = (topElement.shadowRoot || (topElement as any)["_sroot"]) as ShadowRoot;
            if (!(shadowRoot as any)["__fmattached"]) {
                (shadowRoot as any)["__fmattached"] = true;
                shadowRoot.addEventListener("focus", (e) => {
                    //this.logger.logDebug("focusmanager shadowroot.focus", topElement, e.target);
                    this.ultimateFocus = this.drillDown(e.target as Element);
                }, { capture: true });
                shadowRoot.addEventListener("blur", (e) => {
                    //this.logger.logDebug("focusmanager shadowroot.blur", topElement, e.target);
                    //this.ultimateFocus = this.drillDown(e.target as Element);
                }, { capture: true });
            }
            return this.drillDown(shadowRoot.activeElement);
        }
        else {
            return topElement;
        }
    }

}