import { CharacterGenderConvert } from "../shared/CharacterGender.js";
import { CharacterName } from "../shared/CharacterName.js";
import { OnlineStatusConvert } from "../shared/OnlineStatus.js";
import { AutohideElementsManager } from "../util/AutohideElementsManager.js";
import { BBCodeParser, ChatBBCodeParser } from "../util/bbcode/BBCode.js";
import { CharacterLinkUtils } from "../util/CharacterLinkUtils.js";
import { getEffectiveCharacterName, getEffectiveCharacterNameDocFragment } from "../util/CharacterNameIcons.js";
import { ChatMessageUtils } from "../util/ChatMessageUtils.js";
import { KeyValuePair } from "../util/collections/KeyValuePair.js";
import { ReadOnlyStdObservableCollection } from "../util/collections/ReadOnlyStdObservableCollection.js";
import { NumberComparer } from "../util/Comparer.js";
import { asDisposable, IDisposable, EmptyDisposable } from "../util/Disposable.js";
import { EventListenerUtil } from "../util/EventListenerUtil.js";
import { getRoot } from "../util/GetRoot.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { IterableUtils } from "../util/IterableUtils.js";
import { ObservableValue } from "../util/Observable.js";
import { FirstInAnimationFrameManager } from "../util/RequestAnimationFrameHook.js";
import { ResizeObserverNice } from "../util/ResizeObserverNice.js";
import { Scheduler } from "../util/Scheduler.js";
import { ScrollAnchorTo } from "../util/ScrollAnchorTo.js";
import { URLUtils } from "../util/URLUtils.js";
import { ChannelMessageDisplayStyle, ChannelMessageType, ChannelMessageViewModel, ChannelViewModel, ChannelViewScrollPositionModel, IChannelStreamViewModel } from "../viewmodel/ChannelViewModel.js";
import { ChannelFiltersBar } from "./ChannelFiltersBar.js";
import { ChannelStreamMessageViewRenderer } from "./ChannelStreamMessageViewRenderer.js";
import { CollectionView2 } from "./CollectionView2.js";
import { CollectionViewLightweight } from "./CollectionViewLightweight.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { StatusDotLightweight } from "./StatusDot.js";

enum ScrollSuppressionReason {
    NotConnectedToDocument = "NotConnectedToDocument",
    CMCVNotReady = "CMCVNotReady",
    CMCVUpdatingElements = "CMCVUpdatingElements",
    ResettingScroll = "ResettingScroll",
    ResettingScrollInternal = "ResettingScrollInternal",
    ScrollingStreamTo = "ScrollingStreamTo",
    ScrollingStreamToSmooth = "ScrollingStreamToSmooth",
}

@componentElement("x-channelstream")
export class ChannelStream extends ComponentBase<IChannelStreamViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <x-channelfiltersbar class="filtersbar" id="elFiltersBar"></x-channelfiltersbar>
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
        const elFiltersBar = this.$("elFiltersBar") as ChannelFiltersBar;

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

        let currentScrollToVm: IChannelStreamViewModel | null = null;
        this._scrollManager = new DefaultStreamScrollManager(elMessageContainer, iterateElements, getElementByIdentity, (v) => {
            //this.logger.logDebug("setting scrolledTo", v, this.viewModel?.collectiveName);
            const vm = currentScrollToVm;
            if (vm) {
                if ((v ?? null) != vm.scrolledTo) {
                    this.logger.logDebug("DefaultStreamScrollManager.scrolledTo change", v, vm.title);
                    if (v) {
                        vm.scrolledTo = v;
                    }
                    else {
                        vm.scrolledTo = null;
                    }
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
                    //this.logger.logDebug("cmcv updatingelements", this.viewModel?.messages?.length ?? "null", elMessageContainer.childElementCount);
                    this.suppressScrollRecording(ScrollSuppressionReason.CMCVUpdatingElements);
                }
            };
            cmcv.updatedElements = () => {
                if (this.viewModel === vm) {
                    //this.logger.logDebug("cmcv updatedelements", this.viewModel?.messages?.length ?? "null", elMessageContainer.childElementCount);
                    this.resumeScrollRecording(ScrollSuppressionReason.CMCVUpdatingElements);
                    if (!firstRenderComplete) {
                        firstRenderComplete = true;
                        this.resumeScrollRecording(ScrollSuppressionReason.CMCVNotReady);
                    }

                    this.updateCollapseHostMonitoring();
                }
            };
            // HTMLUtils.clearChildren(elMessageContainer);
            // const tn = document.createElement("div");
            // elMessageContainer.appendChild(tn);
            cmcv.element = elMessageContainer;
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
        }, true);
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

        this.watchExpr(vm => vm.showFilterBar, sfb => {
            elFiltersBar.classList.toggle("hidden", !sfb);
        });

        this.watchExpr(vm => vm.newMessagesBelowNotify, v => {
            updateAlerts();
        });
        this.watchExpr(vm => [vm, vm.scrolledTo], (vx) => {
            if (vx) {
                const vm = vx[0];
                const v = vx[1];
                currentScrollToVm = vm;
                if (v != this._scrollManager.scrolledTo) {
                    this.logger.logInfo("vm.scrolledTo change", v, vm.title);
                    this._scrollManager.scrolledTo = v ?? null;
                }
                updateAlerts();
            }
            else {
                currentScrollToVm = null;
            }
        });
        this.watchExpr(vm => vm.pendingSendsCount, len => {
            len = len ?? 0;
            elSending.classList.toggle("shown", (len > 0));
        });

        this.watchExpr(vm => vm.getConfigSettingById("highlightMyMessages"), hmm => {
            elMessageContainer.classList.toggle("highlight-from-me", !!hmm);
        });

        this.whenConnected(() => {
            this._scrollManager.enabled = true;
            const resizeObserver = new ResizeObserverNice((entries) => {
                this._scrollManager.resetScroll();
            });
            resizeObserver.observe(this.$("elMessageContainer") as HTMLDivElement);
    
            this.resumeScrollRecording(ScrollSuppressionReason.NotConnectedToDocument);
        
            return asDisposable(() => {
                this._scrollManager.enabled = false;
                resizeObserver?.disconnect();
        
                this.suppressScrollRecording(ScrollSuppressionReason.NotConnectedToDocument);
            });
        });

        this.whenConnectedWithViewModel(vm => {
            const isMessage = (el: HTMLElement) => el.classList.contains("collapse-host");
            const hem = new AutohideElementsManager({
                name: "ChannelStream",
                rootEl: this.$("elMessageContainer") as HTMLElement,
                includePredicate: isMessage,
                watchAttributes: ["data-messageid"],
                intersectionMargin: "100% 0px 100% 0px",
                handleActiveSelection: true
            });
            return asDisposable(() => {
                hem.dispose();
            });
        });

        this.watchExpr(vm => vm.isHistoricalView, v => {
            this.elMain.classList.toggle("historical-view", !!v);
        });
    }

    private _previousCollapseHostRO: ResizeObserver | null = null;
    private _roAnimHandle: IDisposable | null = null;
    private _roAnimEntries: ResizeObserverEntry[] = [];
    private readonly _previousCollapseHostROObserved: Set<Element> = new Set();
    updateCollapseHostMonitoring() {
        // this.logDebug("updateCollapseHostMonitoring");
        // const vm = this.viewModel;
        // const elMessageContainer = this.$("elMessageContainer") as HTMLDivElement;

        // if (!vm) {
        //     if (this._previousCollapseHostRO) {
        //         this._previousCollapseHostRO.disconnect();
        //         this._previousCollapseHostRO = null;
        //     }
        //     this._previousCollapseHostROObserved.clear();
        //     return;
        // }

        // if (!this._previousCollapseHostRO) {
        //     const ro = new ResizeObserver(entries => {
        //         this._roAnimEntries.push(...entries);
        //         if (this._roAnimHandle == null) {
        //             this._roAnimHandle = Scheduler.scheduleNamedCallback("ChannelStream.collapseHostSize", ["frame", "idle", 250], () => {
        //                 this._roAnimHandle = null;
        //                 const entries = this._roAnimEntries;
        //                 this._roAnimEntries = [];
        //                 let overflowHeight: number | null = null;
        //                 for (let entry of entries) {
        //                     const target = entry.target;
        //                     if (target.classList.contains("messageitem")) {
        //                         const mheight = entry.contentRect.height;
        //                         if (mheight > 0) {
        //                             const mvm = (target as any)["__vm"] as ChannelMessageViewModel;
        //                             overflowHeight = overflowHeight ?? +(window.getComputedStyle(target).getPropertyValue("--ad-collapse-max-height-numeric") ?? "40");
        //                             const isOversized = (mheight > overflowHeight);
        //                             if (isOversized != mvm.isOversized) {
        //                                 mvm.isOversized = (mheight > overflowHeight);
        //                                 this.logger.logDebug("ad oversize changed", target, isOversized);
        //                             }
        //                         }
        //                     }
        //                 }
        //             });
        //         }
        //     });
        //     this._previousCollapseHostRO = ro;
        // }

        // const tro = this._previousCollapseHostRO;
        // const thisObserve = new Set<Element>();
        // elMessageContainer.querySelectorAll(".collapse-host.collapsible .messageitem").forEach(el => { 
        //     if (!this._previousCollapseHostROObserved.has(el)) {
        //         tro.observe(el); 
        //     }
        //     thisObserve.add(el);
        // });
        // for (let removeEl of [...this._previousCollapseHostROObserved.difference(thisObserve).values()]) {
        //     tro.unobserve(removeEl);
        //     this._previousCollapseHostROObserved.delete(removeEl);
        // }
    }

    protected get myRequiredStylesheets() {
        return [ 
            ...super.myRequiredStylesheets,
            `styles/components/ChannelMessageCollectionView-import.css`
        ];
    }

    //get viewModel(): (ChannelViewModel | null) { return super.viewModel; }

    private _scrollManager: DefaultStreamScrollManager;

    get hasTextSelection(): boolean {
        const elMessageContainer = this.$("elMessageContainer") as HTMLDivElement;

        const root = getRoot(elMessageContainer as Node);
        if (!root) return false;
        
        const sel = (root as Document).getSelection();
        if (sel?.type != "Range") return false;

        return true;
    }

    private _suppressScrollRecording: number = 0;

    private suppressScrollRecording(reason: ScrollSuppressionReason) {
        this._scrollManager.suppressScrollRecording(reason);
    }
    private resumeScrollRecording(reason: ScrollSuppressionReason, dontResetOnZero?: boolean) {
        this._scrollManager.resumeScrollRecording(reason, dontResetOnZero);
    }
}

@componentElement("x-channelmessagecollectionview")
export class ChannelMessageCollectionView extends ComponentBase<ReadOnlyStdObservableCollection<KeyValuePair<any, ChannelMessageViewModel>>> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, "<slot></slot>");

        this.whenConnectedWithViewModel(vm => {
            const mo = new MutationObserver(entries => {
                for (let entry of entries) {
                    if (entry.target == this) {
                        this.containerElementChild.value = this.firstElementChild as (HTMLElement | null);
                    }
                }
            });
            mo.observe(this, {
                childList: true
            });

            this.containerElementChild.value = this.firstElementChild as (HTMLElement | null);

            const colWatch = this.watchExpr(vm => { return { containerElement: this.containerElementChild.value, vm: vm }; }, items => {
                if (items) {
                    this._renderer.setElementAndCollection(items.containerElement, items.vm);
                }
                else {
                    this._renderer.setElementAndCollection(null, null);
                }
            });

            return asDisposable(() => {
                colWatch.dispose();
                mo.disconnect();
                this.containerElementChild.value = null;
                this._renderer.setElementAndCollection(null, null);
            });
        });
    }

    private readonly containerElementChild: ObservableValue<HTMLElement | null> = new ObservableValue(null);

    private readonly _renderer: ChannelStreamMessageViewRenderer = new ChannelStreamMessageViewRenderer();
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

        this._disposables.push(asDisposable(() => {
            asDisposable(...this._enabledDisposables).dispose();
            this._enabledDisposables = [];
        }));
    }

    private _enabledDisposables: IDisposable[] = [];

    private _enabled: boolean = false;
    get enabled() { return this._enabled; }
    set enabled(value) {
        if (this._disposed) { value = false; }
        if (value !== this._enabled) {
            if (this._enabledDisposables) {
                asDisposable(...this._enabledDisposables).dispose();
                this._enabledDisposables = [];
            }

            this._enabled = value;

            if (value) {
                this._enabledDisposables.push(EventListenerUtil.addDisposableEventListener(this.containerElement, "scroll", (e: Event) => this.containerScrolled()));
                this._enabledDisposables.push(EventListenerUtil.addDisposableEventListener(window, "resize", (e: Event) => this.resetScroll()));
                this._enabledDisposables.push(EventListenerUtil.addDisposableEventListener(window, "focus", (e: Event) => this.resetScroll(false, true)));
            }
        }
    }

    private _disposables: IDisposable[] = [];
    private _suppressionCount: number = 0;
    private _knownSize: { width: number, cheight: number, sheight: number } = { width: 0, cheight: 0, sheight: 0 };

    private _disposed: boolean = false;
    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            this.enabled = false;
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
        
        //this.logger.logDebug("^^^ _suppressionCount", this._suppressionCount, this.buildReasonsString());
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

        //this.logger.logDebug("vvv _suppressionCount", this.buildReasonsString());
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
                Scheduler.scheduleNamedCallback("DefaultStreamScrollManager.resumeScrollRecordingWhenTop(tick)", ["nextframe", 250], tick);
            }
            else {
                this.resumeScrollRecording(ScrollSuppressionReason.ScrollingStreamToSmooth);
            }
        };
        Scheduler.scheduleNamedCallback("DefaultStreamScrollManager.resumeScrollRecordingWhenTop(tick)", ["nextframe", 250], tick);
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

    private readonly _pendingResetScroll: FirstInAnimationFrameManager = new FirstInAnimationFrameManager();
    private _nextUpdateIsSmooth: boolean = false;
    private _pendingScrollSmooth: boolean = false;

    setNextUpdateIsSmooth() {
        this._nextUpdateIsSmooth = true;
        Scheduler.scheduleNamedCallback("ChannelStream.setNextUpdateIsSmooth", 100, () => this._nextUpdateIsSmooth = false);
    }

    resetScroll(smooth?: boolean, immediate?: boolean) {
        this._pendingScrollSmooth = smooth ?? this._nextUpdateIsSmooth;

        if (!this._pendingResetScroll.hasPendingOrExecutingAnimationFrame) {
            this.suppressScrollRecording(ScrollSuppressionReason.ResettingScroll);
            this._pendingResetScroll.requestAnimationFrame(() => {
                this.resetScrollInternal();
                this.resumeScrollRecording(ScrollSuppressionReason.ResettingScroll);
            });
        }

        if (immediate) {
            this._pendingResetScroll.executeImmediately();
        }
    }

    private resetScrollInternal() {
        this.suppressScrollRecording(ScrollSuppressionReason.ResettingScrollInternal);

        let isSmoothScroll = this._pendingScrollSmooth;
        let isScrolledToMaximum: boolean;
        let scrollToY: number;
        //this.logger.logDebug("resetting scroll", this.scrolledTo);
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
        //this.logger.logDebug("resetting scroll ==> ", scrollToY, isScrolledToMaximum);
        if (isScrolledToMaximum && this._suppressionCount == 1) {
            this.scrolledTo = null;
        }

        this._knownSize.width = this.containerElement.clientWidth;
        this._knownSize.cheight = this.containerElement.clientHeight;
        this._knownSize.sheight = this.containerElement.scrollHeight - this.containerElement.clientHeight;

        this.resumeScrollRecording(ScrollSuppressionReason.ResettingScrollInternal);
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