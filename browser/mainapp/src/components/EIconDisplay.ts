import { CharacterName } from "../shared/CharacterName";
import { BBCodeParser } from "../util/bbcode/BBCode";
import { CancellationTokenSource } from "../util/CancellationTokenSource";
import { asDisposable, IDisposable } from "../util/Disposable";
import { EIconLoadManager } from "../util/EIconLoadManager";
import { EventListenerUtil } from "../util/EventListenerUtil";
import { HTMLUtils } from "../util/HTMLUtils";
import { Logging } from "../util/Logger";
import { ObjectUniqueId } from "../util/ObjectUniqueId";
import { ObservableExpression } from "../util/ObservableExpression";
import { Scheduler } from "../util/Scheduler";
import { setStylesheetAdoption } from "../util/StyleSheetPolyfill";
import { URLUtils } from "../util/URLUtils";
import { WhenChangeManager } from "../util/WhenChange";
import { AppViewModel } from "../viewmodel/AppViewModel";
import { componentElement, StyleLoader } from "./ComponentBase";

const emptyImageUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const io = new IntersectionObserver((entries) => {
    for (let entry of entries) {
        const ed = (entry.target as EIconDisplay);
        ed.set_isIntersecting(entry.isIntersecting);
    }
});

const elForceVisStyle = document.createElement("style");
elForceVisStyle.appendChild(document.createTextNode(`
    .eicon-visibility-container {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        user-select: none;
        z-index: 9999;
        opacity: 0.01;
        line-height: 1px;

        img {
            width: 1px;
            height: 1px;

            &.hidden {
                display: none;
            }
        }
    }    
`));
document.head.appendChild(elForceVisStyle);
const elForceVisibilityContainer = document.createElement("div");
elForceVisibilityContainer.classList.add("eicon-visibility-container");
document.body.appendChild(elForceVisibilityContainer);

class EIconSyncManager {
    private readonly _logger = Logging.createLogger(`EIconSyncManager#${ObjectUniqueId.get(this)}`);

    private _syncGroups: Map<string, Set<EIconDisplay>> = new Map();
    private _eiconsToSyncGroup: Map<EIconDisplay, string> = new Map();

    add(ed: EIconDisplay, syncGroup: string) {
        let sg = this._syncGroups.get(syncGroup);
        if (!sg) {
            sg = new Set();
            this._syncGroups.set(syncGroup, sg);
        }
        sg.add(ed);
        this._eiconsToSyncGroup.set(ed, syncGroup);
    }

    remove(ed: EIconDisplay, syncGroup: string) {
        const sg = this._syncGroups.get(syncGroup);
        if (sg) {
            sg.delete(ed);
            if (sg.size == 0) {
                this._syncGroups.delete(syncGroup);
            }
        }
        this._eiconsToSyncGroup.delete(ed);
    }

    indicateLoad(ed: EIconDisplay) {
        const syncGroup = this._eiconsToSyncGroup.get(ed);
        if (syncGroup) {
            const sg = this._syncGroups.get(syncGroup);
            if (sg) {
                let allLoaded = true;
                for (let xed of sg.values()) {
                    allLoaded = allLoaded && xed.isImageLoaded && xed.isIntersecting;
                }
                if (allLoaded) {
                    this._logger.logDebug("syncing eicon sync group", syncGroup);
                    for (let xed of sg.values()) {
                        xed.restartAnimation();
                    }
                }
            }
        }
    }
}

const eIconSyncManager = new EIconSyncManager();

@componentElement("x-eicondisplay")
export class EIconDisplay extends HTMLElement {
    static get observedAttributes() { return [ 'eiconname', 'syncgroup', 'charname', 'loading' ] };

    constructor() {
        super();

        // this._sroot = ShadowRootsManager.elementAttachShadow(this, { mode: 'closed' });
        // HTMLUtils.assignStaticHTMLFragment(this._sroot, `
        //     <div id="elMain">
        //     </div>
        // `);
    
        // this._styleLoader = new StyleLoader(ss => {
        //     //setStylesheetAdoption(this._sroot, ss);
        //     //(this._sroot as any).adoptedStyleSheets = [...ss];
        // });  
        // this._styleLoader.addLoad("styles/components/EIconDisplay.css");

        // this._sroot.addEventListener("copy", (e: ClipboardEvent) => {
        //     BBCodeParser.performCopy(e);
        // });

        //this._logger.logInfo("Created EIconDisplay");
    }

    private readonly _logger = Logging.createLogger(`EIconDisplay#${ObjectUniqueId.get(this)}`);

    //private readonly _styleLoader: StyleLoader;

    //private readonly _sroot: ShadowRoot;
    //private get elMain() { return this._sroot.getElementById("elMain") as HTMLDivElement; }
    private get elMain() { return this; }

    private get imgEl() {
        if (this.childElementCount == 0) { return null; }
        return this.firstElementChild as HTMLImageElement;
    }

    private attributeChangedCallback(name: string, oldValue?: string, newValue?: string) {
        if (name == "eiconname") {
            this.eiconName = newValue ?? null;
        }
        else if (name == "syncgroup") {
            this.syncGroup = newValue ?? null;
        }
        else if (name == "charname") {
            this.charName = newValue ?? null;
        }
        else if (name == "loading") {
            this.lazyLoad = (newValue == "lazy");
        }
    }

    private connectedCallback() {
        //this._logger.logInfo("connected to DOM");
        this.updateState();
        if (this._forceVisImgEl && !this._forceVisImgEl.parentElement) {
            elForceVisibilityContainer.appendChild(this._forceVisImgEl);
        }
    }

    private disconnectedCallback() {
        //this._logger.logInfo("disconnected from DOM");
        this.updateState();
        if (this._forceVisImgEl && this._forceVisImgEl.parentElement) {
            this._forceVisImgEl.remove();
        }
    }

    private _isIntersecting: boolean = false;
    get isIntersecting() { return this._isIntersecting; }
    set_isIntersecting(value: boolean) {
        if (value !== this._isIntersecting) {
            this._isIntersecting = value;
            this._logger.logDebug("eicon intersecting", this.eiconName, value);
            this.updateState();
        }
    }

    private _isImageLoaded: boolean = false;
    get isImageLoaded() { return this._isImageLoaded; }
    private set_isImageLoaded(value: boolean) {
        if (value !== this._isImageLoaded) {
            this._isImageLoaded = value;
            this.updateState();
        }
    }

    get lazyLoad() { return this.getAttribute("loading") == "lazy"; }
    set lazyLoad(value: boolean) {
        if (value != this.lazyLoad) {
            if (value) {
                this.setAttribute("loading", "lazy");
            }
            else {
                this.removeAttribute("loading");
            }
            this.updateState();
        }
    }

    get charName() { return this.getAttribute("charname") ?? null; }
    set charName(value: string | null) {
        if (value !== this.charName) {
            if (value) {
                this.setAttribute("charname", value);
            }
            else {
                this.removeAttribute("charname");
            }
            this.updateState();
        }
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

    private _restartingAnimation = false;
    restartAnimation() {
        if (!this._restartingAnimation) {
            this._restartingAnimation = true;
            Scheduler.scheduleCallback("nextframe", () => {
                this._restartingAnimation = false;
                const imgEl = this.imgEl;
                if (imgEl && this._forceVisImgEl) {
                    const src = imgEl.src;
                    imgEl.src = "";
                    this._forceVisImgEl.src = "";

                    imgEl.src = src;
                    this._forceVisImgEl.src = src;
                }
            });
        }
    }

    private _appViewModelHookup: IDisposable | null = null;

    private _stopPreviousEIconLoad: (() => void) = () => {};

    private _lastStateEIconName: string | null = null;
    private _lastStateIsConnected: boolean = false;
    private _lastStateIsIntersecting: boolean = false;
    private _lastStateSyncGroup: string | null = null;
    private _lastIsCompletedLoaded = false;
    private _isInIntersectObserver = false;

    private _eiconBlockWCM: WhenChangeManager = new WhenChangeManager();

    private _updateStateScheduledEvent: (IDisposable | null) = null;

    updateState() {
        if (this._updateStateScheduledEvent) { return; }

        this._updateStateScheduledEvent = Scheduler.scheduleCallback("frame", () => {
            this._updateStateScheduledEvent = null;
            this.updateStateInternal();
        });
    }

    private _forceVisImgEl: HTMLImageElement | null = null;

    private createImageEl(eiconName: string) {
        let imgEl = this.imgEl;
        if (!imgEl) {
            imgEl = document.createElement("img");
            imgEl.id = "imgEl";
            imgEl.src = emptyImageUrl;
            imgEl.setAttribute("data-copycontent", `[eicon]${eiconName}[/eicon]`);
            this.elMain.appendChild(imgEl);
        }
        if (!this._forceVisImgEl) {
            this._forceVisImgEl = document.createElement("img");
            this._forceVisImgEl.src = imgEl.src;
            elForceVisibilityContainer.appendChild(this._forceVisImgEl);
        }
        return imgEl;
    }
    private setImageElSrc(src: string) {
        this.createImageEl(src).src = src;
        this._forceVisImgEl!.src = src;
    }

    private updateStateInternal() {
        const lastEIconName = this._lastStateEIconName;
        const lastIsConnected = this._lastStateIsConnected;
        const lastIsIntersecting = this._lastStateIsIntersecting;
        const lastSyncGroup = this._lastStateSyncGroup;

        const isConnected = this.isConnected;
        const isIntersecting = this._isIntersecting;
        const isLazyLoad = this.lazyLoad;
        const eiconName = (!isLazyLoad || isIntersecting) ? this.eiconName : "";
        const syncGroup = isConnected ? this.syncGroup : null;
        const charName = this.charName ? CharacterName.create(this.charName) : null;

        if (lastEIconName == eiconName && lastIsConnected == isConnected && lastSyncGroup == syncGroup && lastIsIntersecting == isIntersecting) { return; }
        //this._logger.logInfo(`updateState lastEIconName=${lastEIconName}, lastIsConnected=${lastIsConnected}, lastSyncGroup=${lastSyncGroup}, eiconName=${eiconName}, isConnected=${isConnected}, syncGroup=${syncGroup}`);

        this._lastStateEIconName = eiconName;
        this._lastStateIsConnected = isConnected;
        this._lastStateSyncGroup = syncGroup;
        this._lastStateIsIntersecting = isIntersecting;

        let imgEl = this.imgEl;

        if (syncGroup != lastSyncGroup) {
            if (syncGroup) {
                eIconSyncManager.add(this, syncGroup);
            }
            else {
                if (lastSyncGroup) {
                    eIconSyncManager.remove(this, lastSyncGroup);
                }
            }
        }

        this._eiconBlockWCM.assign<[CharacterName | null, string | null]>((isConnected && charName && eiconName) ? [charName, eiconName] : [null, null],
            v => {
                const charName = v[0];
                const eiconName = v[1];
                if (charName && eiconName) {
                    const isBlockedObs = new ObservableExpression(
                        () => {
                            for (let login of ((window as any)["__vm"] as AppViewModel).logins) {
                                if (login.characterName == charName) {
                                    return login.eIconFavoriteBlockViewModel.isBlocked(eiconName);
                                }
                            }
                            return false;
                        },
                        (isBlocked) => { imgEl?.classList.toggle("blocked", isBlocked); },
                        () => { imgEl?.classList.toggle("blocked", false); }
                    );
                    return asDisposable(isBlockedObs);
                }
            });

        if (isConnected) {
            if (!this._isInIntersectObserver) {
                this._isInIntersectObserver = true;
                io.observe(this);
            }

            if (eiconName != lastEIconName || syncGroup != lastSyncGroup) {
                this._stopPreviousEIconLoad();

                if (eiconName) {
                    imgEl = this.createImageEl(eiconName);

                    const cts = new CancellationTokenSource();
                    this._stopPreviousEIconLoad = () => cts.cancel();
                    (async () => {
                        try {
                            const loadedEicon = EIconLoadManager.getEIcon(eiconName);
                            const blobUrl = await loadedEicon.getBlobUrlAsync(syncGroup ?? "", cts.token);
                            this._stopPreviousEIconLoad = () => {
                                blobUrl.dispose();
                                this.setImageElSrc(emptyImageUrl);
                            };
                            const loadHandler = EventListenerUtil.addDisposableEventListener(imgEl, "load", () => {
                                loadHandler.dispose();
                                this._logger.logDebug("eicon load", eiconName);
                                this.set_isImageLoaded(true);
                            });
                            this.setImageElSrc(blobUrl.url);
                        }
                        catch { }
                    })();
                }
            }

            if (this.isImageLoaded && this.isIntersecting && !this._lastIsCompletedLoaded) {
                this._lastIsCompletedLoaded = true;
                this._logger.logDebug("indicating eicon load sync", eiconName);
                eIconSyncManager.indicateLoad(this);
            }
            else {
                this._lastIsCompletedLoaded = false;
            }

            if (isIntersecting && isIntersecting != lastIsIntersecting) {
                eIconSyncManager.indicateLoad(this);
            }

            if (this._forceVisImgEl) {
                this._forceVisImgEl.classList.toggle("hidden", !isIntersecting);
            }
        }
        else {
            this._stopPreviousEIconLoad();

            this._lastIsCompletedLoaded = false;
            if (this._appViewModelHookup) {
                this._appViewModelHookup.dispose();
                this._appViewModelHookup = null;
            }
            
            if (this._isInIntersectObserver) {
                this._isInIntersectObserver = false;
                io.unobserve(this);
            }
        }
    }
}