import { HTMLUtils } from "../util/HTMLUtils";
import { URLUtils } from "../util/URLUtils";
import { componentElement } from "./ComponentBase";

class EIconSyncManager {
    add(ed: EIconDisplay, syncGroup: string) {
        this.remove(ed);
        // TODO:
    }

    remove(ed: EIconDisplay) {
        // TODO:
    }
}

const eIconSyncManager = new EIconSyncManager();

@componentElement("x-eicondisplay")
export class EIconDisplay extends HTMLElement {
    static get observedAttributes() { return [ 'eiconname', 'syncgroup' ] };

    constructor() {
        super();

        this._sroot = this.attachShadow({ mode: 'closed' });
        HTMLUtils.assignStaticHTMLFragment(this._sroot, `
            <link rel="stylesheet" type="text/css" href="styles/components/EIconDisplay.css" />
            <div id="elMain">
            </div>
        `);
        
    }

    private readonly _sroot: ShadowRoot;
    private get elMain() { return this._sroot.getElementById("elMain") as HTMLDivElement; }

    private attributeChangedCallback(name: string, oldValue?: string, newValue?: string) {
        if (name == "eiconname") {
            this.eiconName = newValue ?? null;
        }
        else if (name == "syncgroup") {
            this.syncGroup = newValue ?? null;
        }
    }

    private connectedCallback() {
        this.updateState();
    }

    private disconnectedCallback() {
        this.updateState();
    }

    get syncGroup() { return this.getAttribute("syncgroup") ?? null; }
    set syncGroup(value: string | null) {
        if (value !== this.syncGroup) {
            if (value) {
                this.setAttribute("syncgroup", value);
            }
            else {
                this.removeAttribute("syncgroup");
            }

            this.updateState();
        }
    }

    get eiconName() { return this.getAttribute("eiconname") ?? null; }
    set eiconName(value: string | null) { 
        if (value !== this.eiconName) {
            if (value) {
                this.setAttribute("eiconname", value);
            }
            else {
                this.removeAttribute("eiconname");
            }

            this.updateState();
        }
    }

    private _lastStateEIconName: string | null = null;
    private _lastStateIsConnected: boolean = false;
    private _lastStateSyncGroup: string | null = null;
    updateState() {
        const lastEIconName = this._lastStateEIconName;
        const lastIsConnected = this._lastStateIsConnected;
        const lastSyncGroup = this._lastStateSyncGroup;
        const isConnected = this.isConnected;
        const eiconName = this.eiconName;
        const syncGroup = isConnected ? this.syncGroup : null;

        this._lastStateEIconName = eiconName;
        this._lastStateIsConnected = isConnected;
        this._lastStateSyncGroup = syncGroup;

        let imgEl = this._sroot.getElementById("imgEl") as (HTMLImageElement | null);

        if (eiconName != lastEIconName) {
            if (eiconName) {
                if (!imgEl) {
                    imgEl = document.createElement("img");
                    this.elMain.appendChild(imgEl);
                }
                imgEl.src = URLUtils.getEIconUrl(eiconName, syncGroup);
            }
            else {
                if (imgEl) {
                    imgEl.remove();
                }
            }
        }

        if (syncGroup != lastSyncGroup) {
            if (syncGroup) {
                eIconSyncManager.add(this, syncGroup);
            }
            else {
                eIconSyncManager.remove(this);
            }
        }
    }
}