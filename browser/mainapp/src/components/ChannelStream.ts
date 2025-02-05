import { CharacterGenderConvert } from "../shared/CharacterGender.js";
import { CharacterName } from "../shared/CharacterName.js";
import { OnlineStatusConvert } from "../shared/OnlineStatus.js";
import { BBCodeParser, ChatBBCodeParser } from "../util/bbcode/BBCode.js";
import { CharacterLinkUtils } from "../util/CharacterLinkUtils.js";
import { getEffectiveCharacterName, getEffectiveCharacterNameDocFragment } from "../util/CharacterNameIcons.js";
import { KeyValuePair } from "../util/collections/KeyValuePair.js";
import { NumberComparer } from "../util/Comparer.js";
import { asDisposable, IDisposable, EmptyDisposable } from "../util/Disposable.js";
import { EventListenerUtil } from "../util/EventListenerUtil.js";
import { getRoot } from "../util/GetRoot.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { IterableUtils } from "../util/IterableUtils.js";
import { ObservableValue } from "../util/Observable.js";
import { ResizeObserverNice } from "../util/ResizeObserverNice.js";
import { ScrollAnchorTo } from "../util/ScrollAnchorTo.js";
import { URLUtils } from "../util/URLUtils.js";
import { ChannelMessageDisplayStyle, ChannelMessageType, ChannelMessageViewModel, ChannelViewModel, ChannelViewScrollPositionModel } from "../viewmodel/ChannelViewModel.js";
import { ChannelStreamMessageViewRenderer } from "./ChannelStreamMessageViewRenderer.js";
import { ChannelView } from "./ChannelView.js";
import { CollectionView2 } from "./CollectionView2.js";
import { CollectionViewLightweight } from "./CollectionViewLightweight.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { StatusDotLightweight } from "./StatusDot.js";

const DEBUG_SCROLLING = false;
const NEW_SCROLLING = false;

enum ScrollSuppressionReason {
    NotConnectedToDocument = "NotConnectedToDocument",
    CMCVNotReady = "CMCVNotReady",
    CMCVUpdatingElements = "CMCVUpdatingElements",
    ResettingScroll = "ResettingScroll",
    ScrollingStreamTo = "ScrollingStreamTo",
    ScrollingStreamToSmooth = "ScrollingStreamToSmooth",
}

@componentElement("x-channelstream")
export class ChannelStream extends ComponentBase<ChannelViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <x-channelfiltersbar class="filtersbar"></x-channelfiltersbar>
            <div class="messagecontainerouter">
                <div class="messagecontainer" id="elMessageContainer">
                </div>
                <div id="elBottomNotifications">
                    <div id="elSending">Sending...</div>
                    <button id="elScrolledUp">
                        Currently scrolled to view older messages.  Click here to scroll to the newest messages.
                    </button>
                    <button id="elNewMessagesBelow">
                        \u26A0\uFE0F New messages received below.  Click here to scroll to the newest messages.
                    </button>
                </div>
            </div>
        `);

        const elMessageContainer = this.$("elMessageContainer") as HTMLDivElement;
        const elScrolledUp = this.$("elScrolledUp") as HTMLButtonElement;
        const elNewMessagesBelow = this.$("elNewMessagesBelow") as HTMLButtonElement;
        const elSending = this.$("elSending") as HTMLDivElement;

        const iterateElements = function* (): Iterable<AnchorElementInfo> {
            for (let i = 0; i < elMessageContainer.children.length; i++) {
                const el = elMessageContainer.children.item(i) as HTMLElement;
                const messageId = el.getAttribute("data-messageid")!;
                yield {
                    element: el,
                    elementIdentity: messageId
                } as AnchorElementInfo;
            }
        };
        const getElementByIdentity = (identity: any) => {
            const result = elMessageContainer.querySelector(`[data-messageid='${identity}']`) as (HTMLElement | null)
            return result;
        };
        this._scrollManager = new DefaultStreamScrollManager(elMessageContainer, iterateElements, getElementByIdentity, (v) => {
            console.log("setting scrolledTo", v, this.viewModel?.collectiveName);
            if (this.viewModel) {
                if (v) {
                    this.viewModel.scrolledTo = v;
                }
                else {
                    this.viewModel.scrolledTo = null;
                }
            }
        });
        //this._scrollManager = new NullStreamScrollManager();

        // this one managed by connected/disconnected
        this.suppressScrollRecording(ScrollSuppressionReason.NotConnectedToDocument);

        // this one managed by ChannelStreamMessageViewRenderer
        this.suppressScrollRecording(ScrollSuppressionReason.CMCVNotReady);

        this.whenConnectedWithViewModel(() => {
            const vm = this.viewModel!;
            let firstRenderComplete = false;
            const cmcv = new ChannelStreamMessageViewRenderer();
            cmcv.updatingElements = () => {
                if (this.viewModel === vm) {
                    console.log("cmcv updatingelements", this.viewModel?.messages?.length ?? "null", elMessageContainer.childElementCount);
                    this.suppressScrollRecording(ScrollSuppressionReason.CMCVUpdatingElements);
                }
            };
            cmcv.updatedElements = () => {
                if (this.viewModel === vm) {
                    console.log("cmcv updatedelements", this.viewModel?.messages?.length ?? "null", elMessageContainer.childElementCount);
                    this.resumeScrollRecording(ScrollSuppressionReason.CMCVUpdatingElements);
                    if (!firstRenderComplete) {
                        firstRenderComplete = true;
                        this.resumeScrollRecording(ScrollSuppressionReason.CMCVNotReady);
                    }

                    this.updateCollapseHostMonitoring();
                }
            };
            HTMLUtils.clearChildren(elMessageContainer);
            const tn = document.createElement("div");
            elMessageContainer.appendChild(tn);
            cmcv.element = tn;
            const mwatch = this.watchExpr(vm => vm.messages, m => {
                cmcv.collection = m ?? null;
            });

            return asDisposable(cmcv, mwatch, () => {
                if (firstRenderComplete) {
                    this.suppressScrollRecording(ScrollSuppressionReason.CMCVNotReady);
                }
                firstRenderComplete = false;
                this.updateCollapseHostMonitoring();
            });
        });

        elMessageContainer.addEventListener("copy", (e: ClipboardEvent) => {
            BBCodeParser.performCopy(e);
        });
        elScrolledUp.addEventListener("click", (e) => {
            if (this.viewModel) {
                this._scrollManager.setNextUpdateIsSmooth();
                this.viewModel.scrolledTo = null;
            }
        });
        elNewMessagesBelow.addEventListener("click", (e) => {
            if (this.viewModel) {
                this._scrollManager.setNextUpdateIsSmooth();
                this.viewModel.scrolledTo = null;
            }
        });

        const updateAlerts = () => {
            const newMsgs = this.viewModel?.newMessagesBelowNotify ?? false;
            const scrolledUp = (this.viewModel?.scrolledTo ?? null) != null;
            elNewMessagesBelow.classList.toggle("shown", newMsgs);
            elScrolledUp.classList.toggle("shown", scrolledUp && !newMsgs);
        };

        this.watch("newMessagesBelowNotify", v => {
            updateAlerts();
        });
        this.watch("scrolledTo", (v) => {
            //this.log("scrolledTo change, resetscroll");
            this._scrollManager.scrolledTo = v;
            updateAlerts();
        });
        this.watch("pendingSendsCount", len => {
            len = len ?? 0;
            elSending.classList.toggle("shown", (len > 0));
        });

        this.watchExpr(vm => vm.getConfigSettingById("highlightMyMessages"), hmm => {
            elMessageContainer.classList.toggle("highlight-from-me", !!hmm);
        });
    }

    private _previousCollapseHostRO: ResizeObserver | null = null;
    updateCollapseHostMonitoring() {
        const vm = this.viewModel;
        const elMessageContainer = this.$("elMessageContainer") as HTMLDivElement;

        if (this._previousCollapseHostRO) {
            this._previousCollapseHostRO.disconnect();
            this._previousCollapseHostRO = null;
        }
        if (!vm) { return; }

        const ro = new ResizeObserver(entries => {
            for (let entry of entries) {
                const target = entry.target;
                if (target.classList.contains("messageitem")) {
                    const mheight = entry.contentRect.height;
                    const mvm = (target as any)["__vm"] as ChannelMessageViewModel;
                    const overflowHeight = +(window.getComputedStyle(target).getPropertyValue("--ad-collapse-max-height-numeric") ?? "40");
                    mvm.isOversized = (mheight > overflowHeight);
                }
            }
        });
        this._previousCollapseHostRO = ro;
        elMessageContainer.querySelectorAll(".collapse-host.collapsible .messageitem").forEach(el => { ro.observe(el); });
    }

    protected get myRequiredStylesheets() {
        return [ 
            ...super.myRequiredStylesheets,
            `styles/components/ChannelMessageCollectionView-import.css`
        ];
    }

    get viewModel(): (ChannelViewModel | null) { return super.viewModel; }

    private _scrollManager: StreamScrollManager;

    get hasTextSelection(): boolean {
        const elMessageContainer = this.$("elMessageContainer") as HTMLDivElement;

        const root = getRoot(elMessageContainer as Node);
        if (!root) return false;
        
        const sel = (root as Document).getSelection();
        if (sel?.type != "Range") return false;

        return true;
    }

    private _resizeObserver: ResizeObserver | null = null;
    private _knownSize: { width: number, cheight: number, sheight: number } = { width: 0, cheight: 0, sheight: 0 };

    protected override connectedToDocument(): void {
        this._resizeObserver = new ResizeObserverNice((entries) => {
            this._scrollManager.resetScroll();
        });
        this._resizeObserver.observe(this.$("elMessageContainer") as HTMLDivElement);

        this.resumeScrollRecording(ScrollSuppressionReason.NotConnectedToDocument);
    }

    protected override disconnectedFromDocument(): void {
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;

        this.suppressScrollRecording(ScrollSuppressionReason.NotConnectedToDocument);
    }

    private _suppressScrollRecording: number = 0;

    private suppressScrollRecording(reason: ScrollSuppressionReason) {
        this._scrollManager.suppressScrollRecording(reason);
    }
    private resumeScrollRecording(reason: ScrollSuppressionReason, dontResetOnZero?: boolean) {
        this._scrollManager.resumeScrollRecording(reason, dontResetOnZero);
    }


    private _pendingResetScroll: number | null = null;

    private static SCROLL_TO_END = 9999999;
    private scrollStreamTo(top: number): boolean {
        const elMessageContainer = this.$("elMessageContainer") as HTMLDivElement;

        if (top == ChannelStream.SCROLL_TO_END) {
            elMessageContainer.scroll({ top: top, left: 0, behavior: "instant" });
            return true;    
        }

        const SLACK = 10;
        const scrollHeight = elMessageContainer.scrollHeight;
        const clientHeight = elMessageContainer.clientHeight;

        let isScrolledToBottom = false;
        if (top >= scrollHeight - clientHeight - SLACK) {
            top = scrollHeight - clientHeight;
            isScrolledToBottom = true;
        }

        elMessageContainer.scroll({ top: top, left: 0, behavior: "instant" });
        return isScrolledToBottom;
    }
}

class AdCollapseManagerEntry {
    constructor(
        public readonly outer: HTMLDivElement,
        public readonly inner: HTMLDivElement,
        public readonly collapseBtn: HTMLButtonElement,
        public readonly collapseBtnContainer: HTMLDivElement,
        public readonly vm: ChannelMessageViewModel,
        collapseHeight: number) {

        this._collapseHeight = collapseHeight;
        this.updateStyling();
    }

    private _collapseHeight: number;
    private _isHighEnough: boolean = false;
    private _isCollapsed: boolean = true;

    get collapseHeight() { return this._collapseHeight; }
    set collapseHeight(value: number) {
        if (value !== this._collapseHeight) {
            this._collapseHeight = value;
            this.updateStyling();
        }
    }

    get isHighEnough() { return this._isHighEnough; }
    set isHighEnough(value: boolean) {
        if (value !== this._isHighEnough) {
            this._isHighEnough = value;
            this.updateStyling();
        }
    }

    get isCollapsed() { return this._isCollapsed; }
    set isCollapsed(value: boolean) {
        if (value !== this._isCollapsed) {
            this._isCollapsed = value;
            this.updateStyling();
        }
    }

    updateStyling() {
        if (!this._isHighEnough) {
            this.styleNotHighEnough();
        }
        else if (this._isCollapsed) {
            this.styleCollapsed();
        }
        else {
            this.styleExpanded();
        }
    }

    private styleNotHighEnough() {
        //this.outer.style.maxHeight = this._collapseHeight + "px";
        this.outer.classList.remove("collapsed");
        this.outer.classList.remove("expanded");
    }

    private styleCollapsed() {
        this.collapseBtn.innerText = "Expand";
        //this.outer.style.maxHeight = this._collapseHeight + "px";
        this.outer.classList.add("collapsed");
        this.outer.classList.remove("expanded");
    }

    private styleExpanded() {
        this.collapseBtn.innerText = "Collapse";
        //this.outer.style.maxHeight = "none";
        this.outer.classList.remove("collapsed");
        this.outer.classList.add("expanded");
    }

    cleanup: (IDisposable | null) = null;
}
// type AdCollapseManagerEntry = { 
//     outer: HTMLDivElement, 
//     inner: HTMLDivElement, 
//     collapseBtn: HTMLButtonElement,
//     isCollapsed: boolean,
//     vm: ChannelMessageViewModel, 
//     cleanup: (IDisposable | null) 
// };

class AdCollapseManagerImpl {
    constructor() {
        this._rm = new ResizeObserverNice((entries) => this.handleResize(entries));
    }

    private readonly _rm: ResizeObserver;
    private readonly _oiMap: Map<HTMLDivElement, AdCollapseManagerEntry> = new Map();

    private handleResize(entries: ResizeObserverEntry[]) {
        for (let entry of entries) {
            const v = this._oiMap.get(entry.target as HTMLDivElement);
            if (v) {
                if (v.inner == entry.target) {
                    this.handleInnerChange(v, entry.contentRect);
                }
            }
        }
    }

    private handleInnerChange(v: AdCollapseManagerEntry, innerSize: DOMRectReadOnly) {
        const collapseHeight = +(window.getComputedStyle(v.outer).getPropertyValue("--ad-collapse-max-height-numeric"));
        const isCollapsable = (innerSize.height > collapseHeight);
        if (isCollapsable) {
            v.isHighEnough = true;
        }
        else {
            v.isHighEnough = false;
        }
    }

    add(vm: ChannelMessageViewModel, outerEl: HTMLDivElement, innerEl: HTMLDivElement) {
        const collapseBtnContainer = document.createElement("div");
        collapseBtnContainer.classList.add("collapse-button-container");
        collapseBtnContainer.setAttribute("data-copycontent", "");

        const collapseBtn = document.createElement("button");
        collapseBtn.classList.add("collapse-button");
        collapseBtn.innerText = "Expand";
        collapseBtn.setAttribute("data-copycontent", "");
        collapseBtn.setAttribute("data-iscollapsebutton", "true");
        collapseBtnContainer.appendChild(collapseBtn);
        
        outerEl.insertBefore(collapseBtnContainer, innerEl);

        const v = new AdCollapseManagerEntry(outerEl, innerEl, collapseBtn, collapseBtnContainer, vm, vm.appViewModel.collapseHeight);

        this._oiMap.set(outerEl, v);
        
        this._oiMap.set(innerEl, v);

        collapseBtn.addEventListener("click", () => {
            v.isCollapsed = !v.isCollapsed;
        });

        this._rm.observe(outerEl);
        this._rm.observe(innerEl);
    }

    remove(el: HTMLDivElement) {
        const v = this._oiMap.get(el);
        if (v) {
            if (v.cleanup) {
                v.cleanup.dispose();
                v.cleanup = null;
            }
            v.collapseBtnContainer.remove();
            this._rm.unobserve(v.inner);
            this._rm.unobserve(v.outer);
            this._oiMap.delete(v.inner);
            this._oiMap.delete(v.outer);
        }
    }
}

const AdCollapseManager: AdCollapseManagerImpl = new AdCollapseManagerImpl();

const dtf = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const dtfDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'numeric', year: 'numeric' });
const dtfWithDate = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });

function areSameDate(a: Date, b: Date) {
    const aDate = a.getFullYear().toString() + '-' + a.getMonth().toString() + '-' + a.getDate().toString();
    const bDate = b.getFullYear().toString() + '-' + b.getMonth().toString() + '-' + b.getDate().toString();
    return (aDate == bDate);
}

@componentElement("x-channelmessagecollectionview")
export class ChannelMessageCollectionView extends CollectionViewLightweight<KeyValuePair<any, ChannelMessageViewModel>> {
    constructor() {
        super();

        this.watchExpr(vm => this.channelViewModel?.messageDisplayStyle, mds => {
            if (mds) {
                console.log("message display style change -->", mds);
                this.recreateElements();
                console.log("done with message display style change -->", mds);
            }
        });
    }

    private _channelViewModel: ObservableValue<(ChannelViewModel | null)> = new ObservableValue(null);
    get channelViewModel() { return this._channelViewModel.value; }
    set channelViewModel(value: (ChannelViewModel | null)) { this._channelViewModel.value = value; }

    createUserElement(kvm: KeyValuePair<any, ChannelMessageViewModel>): [HTMLElement, IDisposable] {
        const vm = kvm.value;
        switch (vm.type) {
            case ChannelMessageType.CHAT:
            case ChannelMessageType.AD:
            case ChannelMessageType.ROLL:
            case ChannelMessageType.SPIN:
            case ChannelMessageType.SYSTEM:
            case ChannelMessageType.SYSTEM_IMPORTANT:
                return this.createStandardUserElement(vm);
            case ChannelMessageType.LOG_NAV_PROMPT:
                return this.createLogNavUserElement(vm);
            case ChannelMessageType.TYPING_STATUS_INDICATOR:
                return this.createTypingStatusElement(vm);
        }
    }

    private createTypingStatusElement(vm: ChannelMessageViewModel): [HTMLElement, IDisposable] {
        const resultDisposables: IDisposable[] = [];

        let elMain = document.createElement("div");
        elMain.classList.add("messageitem");
        elMain.classList.add("typingstatusindicator");

        const elMessageText = document.createElement("span");
        elMessageText.classList.add("messagetext");

        let emptySpan: HTMLSpanElement | null = null;
        if (vm.text == "") {
            emptySpan = document.createElement("span");
            HTMLUtils.assignStaticHTMLFragment(emptySpan, "&nbsp;");
        }
        vm.incrementParsedTextUsage();
        resultDisposables.push(asDisposable(() => vm.decrementParsedTextUsage()));
        elMessageText.appendChild(vm.text != "" ? vm.parsedText : emptySpan!);
        elMain.appendChild(elMessageText);

        return [elMain, asDisposable(...resultDisposables)];
    }

    private createStandardUserElement(vm: ChannelMessageViewModel): [HTMLElement, IDisposable] {
        const resultDisposables: IDisposable[] = [];
        //let resultDisposable: IDisposable = EmptyDisposable;

        const displayStyle = vm.channelViewModel?.messageDisplayStyle ?? ChannelMessageDisplayStyle.FCHAT;

        let elMain = document.createElement("div");
        elMain.classList.add("messageitem");
        elMain.classList.add(`displaystyle-${displayStyle.toString().toLowerCase()}`);

        let isSystemMessage = vm.type == ChannelMessageType.SYSTEM || vm.type == ChannelMessageType.SYSTEM_IMPORTANT;

        let emoteStyle: ("none" | "normal" | "possessive") = "none";
        if (vm.type == ChannelMessageType.CHAT && vm.text.startsWith("/me ")) {
            emoteStyle = "normal";
        }
        else if (vm.type == ChannelMessageType.CHAT && vm.text.startsWith("/me's ")) {
            emoteStyle = "possessive";
        }

        let isImportant = vm.type == ChannelMessageType.SYSTEM_IMPORTANT;
        if (vm.type == ChannelMessageType.CHAT && vm.text.startsWith("/warn ")) {
            const isChanOp = this.channelViewModel?.isEffectiveOp(vm.characterStatus.characterName) ?? false;
            if (isChanOp) {
                isImportant = true;
            }
        }

        if (displayStyle == ChannelMessageDisplayStyle.DISCORD) {
            const elIcon = document.createElement("img");
            elIcon.classList.add("icon");
            elIcon.src = URLUtils.getAvatarImageUrl(vm.characterStatus.characterName);
            elMain.appendChild(elIcon);
        }

        const elTimestamp = document.createElement("span");
        elTimestamp.classList.add("timestamp");
        let tsText: string;
        let copyText: string = "[" + ( areSameDate(new Date(), vm.timestamp) ? dtf.format(vm.timestamp) : dtfWithDate.format(vm.timestamp) ) + "]";
        if (displayStyle == ChannelMessageDisplayStyle.DISCORD) {
            tsText = ( areSameDate(new Date(), vm.timestamp) ? ("Today at " + dtf.format(vm.timestamp)) : (dtfDate.format(vm.timestamp) + " at " + dtf.format(vm.timestamp)) )
        }
        else {
            tsText = copyText;
        }
        elTimestamp.innerText = tsText;
        elTimestamp.setAttribute("data-copycontent", `[sub]${copyText}[/sub]`);
        elMain.appendChild(elTimestamp);

        const elTsSpacer = document.createElement("span");
        elTsSpacer.classList.add("timestamp-spacer");
        elTsSpacer.innerText = " ";
        elMain.appendChild(elTsSpacer);

        if (vm.type == ChannelMessageType.ROLL) {
            const elDiceIcon = document.createElement("span");
            elDiceIcon.classList.add("dice-icon");
            elDiceIcon.innerText = "\u{1F3B2} ";
            elMain.appendChild(elDiceIcon);
        }
        else if (vm.type == ChannelMessageType.SPIN) {
            const elBottleIcon = document.createElement("span");
            elBottleIcon.classList.add("dice-icon");
            elBottleIcon.innerText = "\u{1F37E} ";
            elMain.appendChild(elBottleIcon);
        }
        else if (vm.type == ChannelMessageType.CHAT && isImportant) {
            const elWarningIcon = document.createElement("span");
            elWarningIcon.classList.add("dice-icon");
            elWarningIcon.innerText = "\u{1F6D1} ";
            elMain.appendChild(elWarningIcon);
        }
        else if (vm.type == ChannelMessageType.AD) {
            const elAdIcon = document.createElement("span");
            elAdIcon.classList.add("dice-icon");
            elAdIcon.innerText = "\u{1F4E2} ";
            elMain.appendChild(elAdIcon);
        }

        let targetContainer: HTMLElement = elMain;
        if (displayStyle == ChannelMessageDisplayStyle.DISCORD && emoteStyle != "none") {
            const messageContentEl = document.createElement("span");
            messageContentEl.classList.add("message-content");
            elMain.appendChild(messageContentEl);
            targetContainer = messageContentEl;
        }

        if (!isSystemMessage) {
            const sdLightweight = new StatusDotLightweight();
            sdLightweight.status = vm.characterStatus.status;
            sdLightweight.element.classList.add("character-status");
            sdLightweight.element.setAttribute("data-copycontent", "");
            targetContainer.appendChild(sdLightweight.element);
            resultDisposables.push(sdLightweight);

            // const elUsernameStatus = document.createElement("x-statusdot");
            // elUsernameStatus.classList.add("character-status");
            // elUsernameStatus.setAttribute("status", OnlineStatusConvert.toString(vm.characterStatus.status));
            // elUsernameStatus.setAttribute("statusmessage", vm.characterStatus.statusMessage);
            // elMain.appendChild(elUsernameStatus);

            const elCSSpacer = document.createElement("span");
            elCSSpacer.classList.add("character-status-spacer");
            elCSSpacer.setAttribute("data-copycontent", "");
            elCSSpacer.innerText = " ";
            targetContainer.appendChild(elCSSpacer);
        }

        const elUsername = document.createElement("span");
        elUsername.classList.add("character");
        if (!isSystemMessage) {
            elUsername.classList.add("gender-" + (CharacterGenderConvert.toString(vm.characterStatus.gender) ?? "none"));
            elUsername.setAttribute("data-copycontent", `[user]${vm.characterStatus.characterName.value}[/user]`);
            CharacterLinkUtils.setupCharacterLink(elUsername, vm.activeLoginViewModel, vm.characterStatus.characterName, this.channelViewModel);
        }
        const ecnFrag = getEffectiveCharacterNameDocFragment(vm.characterStatus.characterName, vm.parent ?? vm.activeLoginViewModel);
        elUsername.appendChild(ecnFrag);
        targetContainer.appendChild(elUsername);

        let spacerText = "";
        switch (vm.type) {
            case ChannelMessageType.ROLL:
                spacerText = " ";
                break;
            case ChannelMessageType.SPIN:
                spacerText = " ";
                break;
            case ChannelMessageType.CHAT:
                if (emoteStyle == "none") {
                    spacerText = ": "
                }
                else if (emoteStyle == "normal") {
                    spacerText = " ";
                }
                else if (emoteStyle == "possessive") {
                    spacerText = "'s ";
                }
                break;
            case ChannelMessageType.AD:
                spacerText = ": ";
                break;
            case ChannelMessageType.SYSTEM:
            case ChannelMessageType.SYSTEM_IMPORTANT:
                spacerText = ": ";
                break;
        }
        const elUsernameSpacer = document.createElement("span");
        elUsernameSpacer.classList.add("character-spacer");
        elUsernameSpacer.innerText = spacerText;
        targetContainer.appendChild(elUsernameSpacer); 

        const elMessageText = document.createElement("span");
        elMessageText.classList.add("messagetext");
        vm.incrementParsedTextUsage();
        resultDisposables.push(asDisposable(() => vm.decrementParsedTextUsage()));
        elMessageText.appendChild(vm.parsedText);
        targetContainer.appendChild(elMessageText);

        elMain.classList.toggle("emote", (emoteStyle != "none"));
        elMain.classList.toggle("ad", (vm.type == ChannelMessageType.AD));
        elMain.classList.toggle("roll", (vm.type == ChannelMessageType.ROLL));
        elMain.classList.toggle("spin", (vm.type == ChannelMessageType.SPIN));
        elMain.classList.toggle("chat", (vm.type == ChannelMessageType.CHAT));
        elMain.classList.toggle("system", isSystemMessage);
        elMain.classList.toggle("important", isImportant);
        elMain.classList.toggle("has-ping", vm.containsPing);
        elMain.classList.toggle("from-me", CharacterName.equals(vm.characterStatus.characterName, vm.activeLoginViewModel.characterName));

        const collapseAds = vm.type == ChannelMessageType.AD && vm.appViewModel.collapseAds;
        if (collapseAds) {
            let outerEl = document.createElement("div");
            outerEl.setAttribute("data-messageid", vm.uniqueMessageId.toString());
            outerEl.classList.add("collapse-host");
            outerEl.classList.add("collapsible");
            outerEl.setAttribute("data-copyinline", "true");
            outerEl.appendChild(elMain);
            AdCollapseManager.add(vm, outerEl, elMain);
            return [outerEl, asDisposable(...resultDisposables, () => {
                AdCollapseManager.remove(outerEl);
            })];
        }
        else {
            let outerEl = document.createElement("div");
            outerEl.setAttribute("data-messageid", vm.uniqueMessageId.toString());
            outerEl.classList.add("collapse-host");
            outerEl.setAttribute("data-copyinline", "true");
            outerEl.appendChild(elMain);
            return [outerEl, asDisposable(...resultDisposables)];
        }
    }

    private createLogNavUserElement(vm: ChannelMessageViewModel): [HTMLElement, IDisposable] {
        let resultDisposables: IDisposable[] = [];

        let elMain = document.createElement("div");
        elMain.classList.add("messageitem");
        elMain.classList.add("messageitem-lognav");

        const elMessageText = document.createElement("div");
        elMessageText.classList.add("lognavtext");
        vm.incrementParsedTextUsage();
        resultDisposables.push(asDisposable(() => vm.decrementParsedTextUsage()));
        elMessageText.appendChild(vm.parsedText);
        elMessageText.addEventListener("click", () => {
            if (vm.onClick) {
                vm.onClick();
            }
        });
        elMain.appendChild(elMessageText);

        let outerEl = document.createElement("div");
            outerEl.setAttribute("data-messageid", vm.uniqueMessageId.toString());
            outerEl.classList.add("collapse-host");
            outerEl.setAttribute("data-copyinline", "true");
            outerEl.appendChild(elMain);
        return [outerEl, asDisposable(...resultDisposables)];
    }

    destroyUserElement(kvm: KeyValuePair<any, ChannelMessageViewModel>, el: HTMLElement): void {
    }
}

interface AnchorElementInfo {
    elementIdentity: any;
    element: HTMLElement;
}
interface AnchorElementScrollTo {
    elementIdentity: object;
    scrollDepth: number;
}

interface StreamScrollManager extends IDisposable {
    setNextUpdateIsSmooth(): void;
    scrolledTo: any;
    resetScroll(): void;
    suppressScrollRecording(reason: ScrollSuppressionReason): void;
    resumeScrollRecording(reason: ScrollSuppressionReason, dontResetOnZero?: boolean): void;
}

export class NullStreamScrollManager implements StreamScrollManager {
    constructor() { }

    dispose(): void { }
    [Symbol.dispose](): void { }
    get isDisposed(): boolean { return true; }
    setNextUpdateIsSmooth(): void { }
    scrolledTo: any;
    resetScroll(): void { }
    suppressScrollRecording(reason: ScrollSuppressionReason): void { }
    resumeScrollRecording(reason: ScrollSuppressionReason, dontResetOnZero?: boolean): void { }
}

export class DefaultStreamScrollManager implements StreamScrollManager {
    constructor(
        private readonly containerElement: HTMLElement,
        private readonly getAnchorElementIterable: () => Iterable<AnchorElementInfo>,
        private readonly getElementByIdentity: (identity: any) => (HTMLElement | null),
        private readonly scrolledToChanged: (value: AnchorElementScrollTo | null) => void
    ) {

        this._disposables.push(EventListenerUtil.addDisposableEventListener(containerElement, "scroll", (e: Event) => this.containerScrolled()));
    }

    private _disposables: IDisposable[] = [];
    private _suppressionCount: number = 0;
    private _knownSize: { width: number, cheight: number, sheight: number } = { width: 0, cheight: 0, sheight: 0 };

    private _disposed: boolean = false;
    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            for (let d of this._disposables) {
                d.dispose();
            }
            this._disposables = [];
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }

    private _scrollAnchorTo: ScrollAnchorTo = ScrollAnchorTo.TOP;
    get scrollAnchorTo(): ScrollAnchorTo { return this._scrollAnchorTo; }
    set scrollAnchorTo(value: ScrollAnchorTo) {
        if (value != this._scrollAnchorTo) {
            this._scrollAnchorTo = value;
            this.recordScrollPosition();
        }
    }

    private readonly _suppressionReasons: Map<ScrollSuppressionReason, number> = new Map();

    private buildReasonsString() {
        const builder: string[] = [];
        for (let kvp of this._suppressionReasons) {
            builder.push(`${kvp[0]}=${kvp[1]}`);
        }
        return builder.join(", ");
    }

    suppressScrollRecording(reason: ScrollSuppressionReason) {
        this._suppressionCount++;
        
        const prevCount = this._suppressionReasons.get(reason) ?? 0;
        this._suppressionReasons.set(reason, prevCount + 1);
        if (reason == ScrollSuppressionReason.CMCVNotReady) {
            this.containerElement.style.visibility = "hidden";
        }
        
        console.log("^^^ _suppressionCount", this._suppressionCount, this.buildReasonsString());
    }

    resumeScrollRecording(reason: ScrollSuppressionReason, skipScrollReset?: boolean) {
        if (this._suppressionCount <= 1) {
            if (!skipScrollReset) {
                this.resetScroll();
            }
        }
        this._suppressionCount = Math.max(0, this._suppressionCount - 1);
        
        const prevCount = this._suppressionReasons.get(reason) ?? 0;
        if (prevCount == 1 || prevCount == 0) {
            this._suppressionReasons.delete(reason);
        }
        else {
            this._suppressionReasons.set(reason, prevCount - 1);
        }

        console.log("vvv _suppressionCount", this.buildReasonsString());
        if (this._suppressionCount == 0) {
            this.containerElement.style.visibility = "visible";
        }
    }

    private resumeScrollRecordingWhenTop(targetTop: number) {
        let msRemaining = 1000;
        let lastTimestamp = performance.now();

        const tick = (msElapsed: number) => {
            const curScrollTop = this.containerElement.scrollTop;
            msRemaining -= (msElapsed - lastTimestamp);
            lastTimestamp = msElapsed;

            if (this.containerElement.scrollTop != targetTop && msRemaining > 0) {
                window.requestAnimationFrame(tick);
            }
            else {
                this.resumeScrollRecording(ScrollSuppressionReason.ScrollingStreamToSmooth);
            }
        };
        window.requestAnimationFrame(tick);
    }

    get isRecordingSuppressed() { return this._suppressionCount > 0; }

    private containerScrolled() {
        if (!this.isRecordingSuppressed) {
            if (this.containerElement.clientWidth == this._knownSize.width &&
                this.containerElement.clientHeight == this._knownSize.cheight &&
                (this.containerElement.scrollHeight - this.containerElement.clientHeight) == this._knownSize.sheight) {
                    
                this.recordScrollPosition();
            }
            else {
                this.resetScroll();
            }
        }
    }

    private _pendingResetScroll: (number | null) = null;
    private _nextUpdateIsSmooth: boolean = false;
    private _pendingScrollSmooth: boolean = false;

    setNextUpdateIsSmooth() {
        this._nextUpdateIsSmooth = true;
        window.setTimeout(() => this._nextUpdateIsSmooth = false, 100);
    }

    resetScroll(smooth?: boolean) {
        this._pendingScrollSmooth = smooth ?? this._nextUpdateIsSmooth;
        if (this._pendingResetScroll !== null) {
            return;
        }

        this.suppressScrollRecording(ScrollSuppressionReason.ResettingScroll);
        this._pendingResetScroll = window.requestAnimationFrame(() => {
            let isSmoothScroll = this._pendingScrollSmooth;
            let isScrolledToMaximum: boolean;
            let scrollToY: number;
            console.log("resetting scroll", this.scrolledTo);
            if (this.scrolledTo) {
                scrollToY = 0;
                const scrollToEl = this.getElementByIdentity(this.scrolledTo.elementIdentity);
                if (scrollToEl) {
                    const pos = this.getElementPositioning(scrollToEl);
                    scrollToY = pos.top + this.scrolledTo.scrollDepth;
                    if (this.scrollAnchorTo == ScrollAnchorTo.BOTTOM) {
                        scrollToY = Math.max(0, scrollToY - this.containerElement.clientHeight);
                    }
                }
                // for (let el of this.enumerateAnchorElements) {
                //     if (el.elementIdentity == this.scrolledTo.elementIdentity) {
                //         const pos = this.getElementPositioning(el.element);
                //         scrollToY = pos.top + this.scrolledTo.scrollDepth;
                //         break;
                //     }
                // }
            }
            else {
                if (this.scrollAnchorTo == ScrollAnchorTo.TOP) {
                    scrollToY = DefaultStreamScrollManager.SCROLL_TO_END;
                }
                else {
                    scrollToY = 0;
                }
            }

            isScrolledToMaximum = this.scrollStreamTo(scrollToY, isSmoothScroll);
            console.log("resetting scroll ==> ", scrollToY, isScrolledToMaximum);
            if (isScrolledToMaximum && this._suppressionCount == 1) {
                this.scrolledTo = null;
            }

            this._knownSize.width = this.containerElement.clientWidth;
            this._knownSize.cheight = this.containerElement.clientHeight;
            this._knownSize.sheight = this.containerElement.scrollHeight - this.containerElement.clientHeight;

            this.resumeScrollRecording(ScrollSuppressionReason.ResettingScroll);
            this._pendingResetScroll = null;
        });
    }

    private static SCROLL_TO_END = 9999999;
    private scrollStreamTo(top: number, isSmoothScroll: boolean): boolean {
        if (top == DefaultStreamScrollManager.SCROLL_TO_END) {
            if (isSmoothScroll) {
                const targetTop = this.containerElement.scrollHeight - this.containerElement.clientHeight;
                this.suppressScrollRecording(ScrollSuppressionReason.ScrollingStreamToSmooth);
                this.containerElement.scroll({ top: targetTop, left: 0, behavior: "smooth" });
                this.resumeScrollRecordingWhenTop(targetTop);
            }
            else {
                this.containerElement.scroll({ top: top, left: 0, behavior: "instant" });
            }
            return true;
        }

        const SLACK = 10;
        const scrollHeight = this.containerElement.scrollHeight;
        const clientHeight = this.containerElement.clientHeight;

        let isScrolledToMaximum = false;
        if (this.scrollAnchorTo == ScrollAnchorTo.TOP && top >= scrollHeight - clientHeight - SLACK) {
            top = scrollHeight - clientHeight;
            isScrolledToMaximum = true;
        }
        else if (this.scrollAnchorTo == ScrollAnchorTo.BOTTOM && top <= SLACK) {
            top = 0;
            isScrolledToMaximum = true;
        }

        if (Math.abs(this.containerElement.scrollTop - top) > 2) {
            if (isSmoothScroll) {
                this.suppressScrollRecording(ScrollSuppressionReason.ScrollingStreamToSmooth);
                this.containerElement.scroll({ top: top, left: 0, behavior: "smooth" });
                this.resumeScrollRecordingWhenTop(top);
            }
            else {
                this.containerElement.scroll({ top: top, left: 0, behavior: "instant" });
            }
        }
        else {
        }
        return isScrolledToMaximum;
    }

    private _scrolledTo: AnchorElementScrollTo | null = null;
    get scrolledTo() { return this._scrolledTo; }
    set scrolledTo(value) { 
        if (value == null && this._scrolledTo == null) return;
        if (value?.elementIdentity == this._scrolledTo?.elementIdentity && value?.scrollDepth == this._scrolledTo?.scrollDepth) return;

        this._scrolledTo = value; 
        if (this.scrolledToChanged) {
            this.scrolledToChanged(value);
        }
        this.resetScroll();
    }

    private recordScrollPosition() {
        const rawScrollAnchorPos = this.scrollAnchorTo == ScrollAnchorTo.TOP 
            ? this.containerElement.scrollTop 
            : this.containerElement.scrollTop + this._knownSize.cheight;

        if (this.scrollAnchorTo == ScrollAnchorTo.TOP && Math.abs(rawScrollAnchorPos - (this._knownSize.sheight)) < 10) {
            this.scrolledTo = null;
        }
        else if (this.scrollAnchorTo == ScrollAnchorTo.BOTTOM && Math.abs(rawScrollAnchorPos - this._knownSize.cheight) < 10) {
            this.scrolledTo = null;
        }
        else {
            const q = IterableUtils.asQueryable(this.getAnchorElementIterable()).
                select(aei => { return { elementIdentity: aei.elementIdentity, element: aei.element, position: this.getElementPositioning(aei.element) }; }).
                orderBy(x => x.position.top, new NumberComparer()).
                toArray();

            let lastEl: (AnchorElementInfo | null) = (q.length > 0) ? q[0] : null;
            let lastOffsetTop: number = (q.length > 0) ? q[0].position.top : 0;

            for (let ai of q) {
                if (ai.position.top > rawScrollAnchorPos) {
                    break;
                }
                else {
                    lastEl = ai;
                    lastOffsetTop = ai.position.top;
                }
            }
            if (lastEl) {
                const depth = rawScrollAnchorPos - lastOffsetTop;
                this.scrolledTo = { elementIdentity: lastEl.elementIdentity, scrollDepth: depth };
            }
            else {
                this.scrolledTo = null;
            }
        }
    }

    private getElementPositioning(el: HTMLElement): { top: number, height: number } {
        // TODO: need to make this smarter?
        return { top: el.offsetTop, height: el.offsetHeight };
    }
}