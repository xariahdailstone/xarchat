import { CharacterName } from "../shared/CharacterName.js";
import { TypingStatus } from "../shared/TypingStatus.js";
import { Fragment, jsx, VNode } from "../snabbdom/index.js";
import { AnimationFrameUtils } from "../util/AnimationFrameUtils.js";
import { addCharacterGenderListenerLightweight, addCharacterOnlineStatusListenerLightweight } from "../util/CharacterOnlineStatusListenerLightweight.js";
import { IDisposable, asDisposable } from "../util/Disposable.js";
import { EL } from "../util/EL.js";
import { EventListenerUtil, MouseButton } from "../util/EventListenerUtil.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { Optional } from "../util/Optional.js";
import { WhenChangeManager } from "../util/WhenChange.js";
import { KeyValuePair } from "../util/collections/KeyValuePair.js";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel.js";
import { AddChannelsViewModel } from "../viewmodel/AddChannelsViewModel.js";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel.js";
import { ChatChannelViewModel } from "../viewmodel/ChatChannelViewModel.js";
import { PMConvoChannelViewModel } from "../viewmodel/PMConvoChannelViewModel.js";
import { CharacterStatusListener } from "./CharacterStatusListener.js";
import { CollapseButton } from "./CollapseButton.js";
import { CollectionViewLightweight } from "./CollectionViewLightweight.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { IconImage, IconImageLightweight } from "./IconImage.js";
import { LightweightComponentBase } from "./LightweightComponentBase.js";
import { StatusDot, StatusDotLightweight } from "./StatusDot.js";

@componentElement("x-chatslist")
export class ChatsList extends ComponentBase<ActiveLoginViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div id="scroller">
                <div id="elPinnedChannelsSection" class="section">
                    <div class="sectiontitle">
                        <x-collapsebutton class="sectiontitle-collapse" target="elPinnedChannelsCollapseBody"
                            collapseclass="collapsed" modelpath="pinnedChannelsCollapsed" id="elPinnedChannelsCollapse"></x-collapsebutton>
                        <div class="sectiontitle-text"><span id="elPinnedChannelsHeaderDot" class="header-dot-container"></span>Pinned Channels (<span id="elPinnedChannelCount">0</span>)</div>
                    </div>
                    <x-collapsebody id="elPinnedChannelsCollapseBody">
                        <x-sortedchannelcollectionview modelpath="pinnedChannels" id="elPinnedChannelsCollectionView">
                            <div class="sectionitems pinnedchatchannels" id="elPinnedChannels"></div>
                        </x-sortedchannelcollectionview>
                    </x-collapsebody>
                </div>

                <div id="elUnpinnedChannelsSection" class="section">
                    <div class="sectiontitle">
                        <x-collapsebutton class="sectiontitle-collapse" target="elUnpinnedChannelsCollapseBody"
                            collapseclass="collapsed" modelpath="channelsCollapsed" id="elUnpinnedChannelsCollapse"></x-collapsebutton>
                        <div class="sectiontitle-text"><span id="elUnpinnedChannelsHeaderDot" class="header-dot-container"></span><span id="elOtherChannelsTitle">Other Channels</span> (<span id="elUnpinnedChannelCount">0</span>)</div>
                        <button class="sectiontitle-addbtn" id="elAddChannelsButton" tabindex="-1">+</button>
                    </div>
                    <x-collapsebody id="elUnpinnedChannelsCollapseBody">
                        <x-sortedchannelcollectionview modelpath="unpinnedChannels" id="elUnpinnedChannelsCollectionView">
                            <div class="sectionitems unpinnedchatchannels" id="elUnpinnedChannels"></div>
                        </x-sortedchannelcollectionview>
                    </x-collapsebody>
                </div>

                <div id="elPrivateMessagesSection" class="section">
                    <div class="sectiontitle">
                        <x-collapsebutton class="sectiontitle-collapse" target="elPmConvosCollapseBody" 
                            collapseclass="collapsed" modelpath="pmConvosCollapsed" id="elPMConvosCollapse"></x-collapsebutton>
                        <div class="sectiontitle-text"><span id="elPmConvosHeaderDot" class="header-dot-container"></span>Private Messages (<span id="elPMConvoCount">0</span>)</div>
                    </div>
                    <x-collapsebody id="elPmConvosCollapseBody">
                        <x-sortedchannelcollectionview modelpath="pmConversations" id="elPmConversationsCollectionView">
                            <div class="sectionitems pmconvo" id="elPmConvos"></div>
                        </x-sortedchannelcollectionview>
                    </x-collapsebody>
                </div>
            </div>

            <div id="elNewAlertsAbove" class="new-alerts new-alerts-above hidden">
                <x-iconimage src="assets/ui/channel-ping.svg" class="new-alerts-ping-icon"></x-iconimage><div class="new-alerts-text">Alerts Above</div></div>
            <div id="elNewAlertsBelow" class="new-alerts new-alerts-below hidden">
                <x-iconimage src="assets/ui/channel-ping.svg" class="new-alerts-ping-icon"></x-iconimage><div class="new-alerts-text">Alerts Below</div></div>
        `);

        const elPinnedChannelsHeaderDot = this.$("elPinnedChannelsHeaderDot") as HTMLSpanElement;
        const elUnpinnedChannelsHeaderDot = this.$("elUnpinnedChannelsHeaderDot") as HTMLSpanElement;
        const elPmConvosHeaderDot = this.$("elPmConvosHeaderDot") as HTMLSpanElement;

        const elPinnedChannelCount = this.$("elPinnedChannelCount") as HTMLSpanElement;
        const elUnpinnedChannelCount = this.$("elUnpinnedChannelCount") as HTMLSpanElement;
        const elPMConvoCount = this.$("elPMConvoCount") as HTMLSpanElement;

        const elPinnedChannelsCollapse = this.$("elPinnedChannelsCollapse") as CollapseButton;
        const elUnpinnedChannelsCollapse = this.$("elUnpinnedChannelsCollapse") as CollapseButton;
        const elPMConvosCollapse = this.$("elPMConvosCollapse") as CollapseButton;

        const elPinnedChannelsCollectionView = this.$("elPinnedChannelsCollectionView") as SortedChannelCollectionView;
        const elUnpinnedChannelsCollectionView = this.$("elUnpinnedChannelsCollectionView") as SortedChannelCollectionView;
        const elPmConversationsCollectionView = this.$("elPmConversationsCollectionView") as SortedChannelCollectionView;

        const elAddChannelsButton = this.$("elAddChannelsButton") as HTMLButtonElement;

        const elNewAlertsAbove = this.$("elNewAlertsAbove") as HTMLElement;
        const elNewAlertsBelow  = this.$("elNewAlertsBelow") as HTMLElement;

        elPinnedChannelsCollectionView.onmentionspingschanged = () => { 
            this.updateHeaderDot(elPinnedChannelsCollapse, elPinnedChannelsHeaderDot, elPinnedChannelsCollectionView); 
        };
        elUnpinnedChannelsCollectionView.onmentionspingschanged = () => { 
            this.updateHeaderDot(elUnpinnedChannelsCollapse, elUnpinnedChannelsHeaderDot, elUnpinnedChannelsCollectionView); 
        };
        elPmConversationsCollectionView.onmentionspingschanged = () => { 
            this.updateHeaderDot(elPMConvosCollapse, elPmConvosHeaderDot, elPmConversationsCollectionView); 
        };

        elNewAlertsBelow.addEventListener("click", () => {
            let minTop = 9999999;
            let minTopEl: HTMLElement | null = null;
            for (let el of this._elementsWithAlertsNotVisibleBelow.keys()) {
                const thisTop = el.offsetTop;
                if (thisTop < minTop) {
                    minTop = thisTop;
                    minTopEl = el;
                }
            }
            if (minTopEl) {
                minTopEl.scrollIntoView({ block: "center", behavior: "smooth" });
                if (this._resetIntersectionObserver) {
                    this._resetIntersectionObserver();
                }
            }
        });
        elNewAlertsAbove.addEventListener("click", () => {
            let maxTop = -1;
            let maxTopEl: HTMLElement | null = null;
            for (let el of this._elementsWithAlertsNotVisibleAbove.keys()) {
                const thisTop = el.offsetTop;
                if (thisTop > maxTop) {
                    maxTop = thisTop;
                    maxTopEl = el;
                }
            }
            if (maxTopEl) {
                maxTopEl.scrollIntoView({ block: "center", behavior: "smooth" });
                if (this._resetIntersectionObserver) {
                    this._resetIntersectionObserver();
                }
            }
        });

        this.watch(".", v => {
            this.elMain.classList.add("viewmodelchange");
            elPinnedChannelsCollapse.disableAnimation = true;
            elUnpinnedChannelsCollapse.disableAnimation = true;
            elPMConvosCollapse.disableAnimation = true;

            window.setTimeout(() => { 
                this.elMain.classList.remove("viewmodelchange"); 
                elPinnedChannelsCollapse.disableAnimation = false;
                elUnpinnedChannelsCollapse.disableAnimation = false;
                elPMConvosCollapse.disableAnimation = false;
            }, 100);
        });
        this.watch("pinnedChannels.size", v => {
            const elPinnedChannelsSection = this.$("elPinnedChannelsSection") as HTMLDivElement;
            const elOtherChannelsTitle = this.$("elOtherChannelsTitle") as HTMLSpanElement;

            if (v && v > 0) {
                elPinnedChannelCount.innerText = (v != null) ? ("" + v) : "x";
                elPinnedChannelsSection.classList.remove("hidden");
                elOtherChannelsTitle.innerText = "Other Channels";
            }
            else {
                elPinnedChannelsSection.classList.add("hidden");
                elOtherChannelsTitle.innerText = "Channels";
                if (this.viewModel) {
                    this.viewModel.pinnedChannelsCollapsed = false;
                }
            }

            this.updateHeaderDot(elPinnedChannelsCollapse, elPinnedChannelsHeaderDot, elPinnedChannelsCollectionView); 
        });
        this.watch("unpinnedChannels.size", v => {
            elUnpinnedChannelCount.innerText = (v != null) ? ("" + v) : "x";
            this.updateHeaderDot(elUnpinnedChannelsCollapse, elUnpinnedChannelsHeaderDot, elUnpinnedChannelsCollectionView); 
        });
        this.watch("pmConversations.size", v => {
            elPMConvoCount.innerText = (v != null) ? ("" + v) : "x";
            this.updateHeaderDot(elPMConvosCollapse, elPmConvosHeaderDot, elPmConversationsCollectionView); 
        });
        this.watch("pinnedChannelsCollapsed", v => {
            this.updateHeaderDot(elPinnedChannelsCollapse, elPinnedChannelsHeaderDot, elPinnedChannelsCollectionView); 
        });
        this.watch("channelsCollapsed", v => {
            this.updateHeaderDot(elUnpinnedChannelsCollapse, elUnpinnedChannelsHeaderDot, elUnpinnedChannelsCollectionView); 
        });
        this.watch("pmConvosCollapsed", v => {
            this.updateHeaderDot(elPMConvosCollapse, elPmConvosHeaderDot, elPmConversationsCollectionView); 
        });

        this.watch("selectedTab", v => {
            elAddChannelsButton.classList.toggle("selected", (v instanceof AddChannelsViewModel));
        });

        elAddChannelsButton.addEventListener("click", () => {
            const vm = this.viewModel;
            if (vm) {
                vm.showAddChannels();
            }
        });

        this.whenConnected(() => {
            // this._intersectionObserver = new IntersectionObserver(ioentries => {
            //     for (let ioentry of ioentries) {
            //         //console.log("io entry", ioentry);
            //         if (this._elementsWithAlerts.has(ioentry.target as HTMLElement)) {
            //             const vis = ioentry.intersectionRatio == 1;
            //             if (!vis) {
            //                 if (ioentry.boundingClientRect.y - (ioentry.rootBounds?.y ?? 0) < 0) {
            //                     this._elementsWithAlertsNotVisibleAbove.add(ioentry.target as HTMLElement);
            //                 }
            //                 else {
            //                     this._elementsWithAlertsNotVisibleBelow.add(ioentry.target as HTMLElement);
            //                 }
                            
            //             }
            //             else {
            //                 this._elementsWithAlertsNotVisibleAbove.delete(ioentry.target as HTMLElement);
            //                 this._elementsWithAlertsNotVisibleBelow.delete(ioentry.target as HTMLElement);
            //             }
            //         }
            //     }
            // }, { root: this.elMain, threshold: 0.8 });
            // for (let x of this._elementsWithAlerts) {
            //     this._intersectionObserver.observe(x);
            //     //console.log("observing", x);
            // }

            const scroller = this.$("scroller") as HTMLElement;
            // let hadElsAbove: (boolean | null) = null;
            // let hadElsBelow: (boolean | null) = null;

            // let cachedScrollerScrollTop = scroller.scrollTop;
            // const scrollListener = EventListenerUtil.addDisposableEventListener(scroller, "scroll", (e: Event) => {
            //     cachedScrollerScrollTop = scroller.scrollTop;
            // });

            // let cachedScrollerClientHeight = scroller.clientHeight;
            const ro = new ResizeObserver((entries) => {
                resetIntersectionObserver();
            });

            ro.observe(scroller);

            let io: IntersectionObserver = null!;
            const resetIntersectionObserver = () => {
                this._elementsWithAlertsNotVisibleAbove.clear();
                this._elementsWithAlertsNotVisibleBelow.clear();
                if (io != null) {
                    io.disconnect();
                }
                io = new IntersectionObserver((entries) => {
                    for (let entry of entries) {
                        const target = entry.target as HTMLElement;;
                        if (entry.intersectionRatio > 0.75) {
                            //this.log("alert element visible", target, entry.intersectionRatio);
                            this._elementsWithAlertsNotVisibleAbove.delete(target);
                            this._elementsWithAlertsNotVisibleBelow.delete(target);
                        }
                        else if ((entry.boundingClientRect.top + (entry.boundingClientRect.height / 2)) > 
                                (entry.rootBounds!.top + (entry.rootBounds!.height / 2))) {
                            //this.log("alert element below", target, entry.intersectionRatio);
                            this._elementsWithAlertsNotVisibleAbove.delete(target);
                            this._elementsWithAlertsNotVisibleBelow.set(target, 0);
                        }
                        else {
                            //this.log("alert element above", target, entry.intersectionRatio);
                            this._elementsWithAlertsNotVisibleAbove.set(target, 0);
                            this._elementsWithAlertsNotVisibleBelow.delete(target);
                        }
                    }
    
                    elNewAlertsAbove.classList.toggle("hidden", this._elementsWithAlertsNotVisibleAbove.size == 0);
                    elNewAlertsBelow.classList.toggle("hidden", this._elementsWithAlertsNotVisibleBelow.size == 0);
                }, { 
                    root: scroller,
                    threshold: [0, 0.25, 0.5, 0.75, 0.99]
                });
                for (let el of this._elementsWithAlerts.values()) {
                    io.observe(el);
                }
                this._alertElAdd = (el) => io.observe(el);
                this._alertElRemove = (el) => io.unobserve(el);
            };
            this._resetIntersectionObserver = resetIntersectionObserver;
            resetIntersectionObserver();

            // const animDisposable = AnimationFrameUtils.createWithIntervals(200, () => {
            //     //const visScrollTop = scroller.scrollTop;
            //     const visScrollTop = cachedScrollerScrollTop;
            //     //const visScrollBot = visScrollTop + scroller.clientHeight;
            //     const visScrollBot = visScrollTop + cachedScrollerClientHeight;

            //     let hasElsAbove = false;
            //     let hasElsBelow = false;

            //     for (let el of this._elementsWithAlerts.values()) {
            //         const elOfsTop = el.offsetTop; // this.offsetTopInContainer(el, this.elMain);
            //         const elOfsBot = elOfsTop + el.offsetHeight;

            //         hasElsBelow = hasElsBelow || (elOfsTop > visScrollBot) || ((elOfsBot - (el.offsetHeight * 0.2)) > visScrollBot);
            //         hasElsAbove = hasElsAbove || (elOfsBot < visScrollTop) || ((elOfsTop + (el.offsetHeight * 0.2)) < visScrollTop);
            //     }
            //     // elNewAlertsAbove.classList.toggle("hidden", this._elementsWithAlertsNotVisibleAbove.size == 0);
            //     // elNewAlertsBelow.classList.toggle("hidden", this._elementsWithAlertsNotVisibleBelow.size == 0);
            //     if (hasElsAbove != hadElsAbove) {
            //         hadElsAbove = hasElsAbove;
            //         elNewAlertsAbove.classList.toggle("hidden", !hasElsAbove);
            //     }
            //     if (hasElsBelow != hadElsBelow) {
            //         hadElsBelow = hasElsBelow;
            //         elNewAlertsBelow.classList.toggle("hidden", !hasElsBelow);
            //     }
            // });

            return asDisposable(/* animDisposable, scrollListener, */ () => {
                io.disconnect();
                this._alertElAdd = null;
                this._alertElRemove = null;
                this._resetIntersectionObserver = null;

                ro.disconnect();
                //this._intersectionObserver?.disconnect();
                //this._intersectionObserver = null;
            })
        })
    }

    private offsetTopInContainer(el: HTMLElement, containerEl: HTMLElement) {
        let ctop = 0;
        let curEl: (HTMLElement | null) = el;
        while (curEl) {
            ctop += curEl.offsetTop;
            curEl = curEl.offsetParent as (HTMLElement | null);
            if (curEl == containerEl) break;
        }
        return ctop;
    }

    //private _intersectionObserver: IntersectionObserver | null = null;
    private _elementsWithAlerts: Set<HTMLElement> = new Set();
    private _elementsWithAlertsNotVisibleAbove: Map<HTMLElement, number> = new Map();
    private _elementsWithAlertsNotVisibleBelow: Map<HTMLElement, number> = new Map();

    private _alertElAdd: ((el: HTMLElement) => void) | null = null;
    private _alertElRemove: ((el: HTMLElement) => void) | null = null;
    private _resetIntersectionObserver: (() => void) | null = null;

    private static SYM_HEADERDOTSPANTEXT = Symbol();
    private updateHeaderDot(collapseButton: CollapseButton, headerDotSpan: HTMLSpanElement, collectionView: SortedChannelCollectionView) {
        const isCollapsed = collapseButton.collapsed;

        let headerDotText = "";
        if (isCollapsed) {
            if (collectionView.hasPings) {
                headerDotText = `<x-iconimage src="assets/ui/channel-ping.svg" class="header-ping-icon"></x-iconimage> `;
            }
            else if (collectionView.hasMentions) {
                headerDotText = "\u{2B24} ";
            }
            else {
                headerDotText = "";    
            }
        }
        else {
            headerDotText = "";
        }

        if ((headerDotSpan as any)[ChatsList.SYM_HEADERDOTSPANTEXT] != headerDotText) {
            (headerDotSpan as any)[ChatsList.SYM_HEADERDOTSPANTEXT] = headerDotText;
            HTMLUtils.assignStaticHTMLFragment(headerDotSpan, headerDotText);
        }

        this.updateWatchedAlertElements();
    }

    private updateWatchedAlertElements() {
        const vm = this.viewModel;
        if (!vm) return;

        const elPinnedChannelsCollectionView = this.$("elPinnedChannelsCollectionView") as SortedChannelCollectionView;
        const elUnpinnedChannelsCollectionView = this.$("elUnpinnedChannelsCollectionView") as SortedChannelCollectionView;
        const elPmConversationsCollectionView = this.$("elPmConversationsCollectionView") as SortedChannelCollectionView;
        
        const elPinnedChannelsHeaderDot = this.$("elPinnedChannelsHeaderDot") as HTMLSpanElement;
        const elUnpinnedChannelsHeaderDot = this.$("elUnpinnedChannelsHeaderDot") as HTMLSpanElement;
        const elPmConvosHeaderDot = this.$("elPmConvosHeaderDot") as HTMLSpanElement;

        const elsToWatch = new Set<HTMLElement>();
        for (let cvEl of [
            !vm.pinnedChannelsCollapsed ? elPinnedChannelsCollectionView : null, 
            !vm.channelsCollapsed ? elUnpinnedChannelsCollectionView : null, 
            !vm.pmConvosCollapsed ? elPmConversationsCollectionView : null]) {

            if (!cvEl) continue;
            
            try {
                for (let pair of cvEl.values()) {
                    const el = pair[0];
                    const vm = pair[1].value;
                    if (vm.hasPing) {
                        elsToWatch.add(el);
                    }
                }
            }
            catch (e) {
                console.log("cvEl.values() fail", cvEl, cvEl.constructor);
            }
        }
        
        if (vm.pinnedChannelsCollapsed && elPinnedChannelsCollectionView.hasPings) {
            elsToWatch.add(elPinnedChannelsHeaderDot);
        }
        if (vm.channelsCollapsed && elUnpinnedChannelsCollectionView.hasPings) {
            elsToWatch.add(elUnpinnedChannelsHeaderDot);
        }
        if (vm.pmConvosCollapsed && elPmConversationsCollectionView.hasPings) {
            elsToWatch.add(elPmConvosHeaderDot);
        }

        for (let el of this._elementsWithAlerts.values()) {
            if (!elsToWatch.has(el)) {
                //this.log("stop watching", el);
                this._elementsWithAlerts.delete(el);
                this._elementsWithAlertsNotVisibleAbove.delete(el);
                this._elementsWithAlertsNotVisibleBelow.delete(el);
                if (this._alertElRemove != null) {
                    this._alertElRemove(el);
                }
            }
        }
        for (let el of elsToWatch.values()) {
            if (!this._elementsWithAlerts.has(el)) {
                //this.log("now watching", el);
                this._elementsWithAlerts.add(el);
                if (this._alertElAdd != null) {
                    this._alertElAdd(el);
                }
            }
        }
    }
}

export class ChannelListItemLightweight extends LightweightComponentBase<ChatChannelViewModel | PMConvoChannelViewModel> {
    constructor(
        element: HTMLElement,
        viewModelFunc?: () => Optional<ChatChannelViewModel | PMConvoChannelViewModel>) {

        super(element, viewModelFunc);

        let elMain: HTMLDivElement;
        let elUnseenIndicator: HTMLDivElement;
        let elTitleIcon: HTMLDivElement;
        let elTitle: HTMLDivElement;
        //let elIcon: IconImage;
        let elIconDiv: HTMLDivElement;
        let elStatusDot: HTMLDivElement;
        let elTypingIndicatorContainer: HTMLDivElement;
        let elPinContainer: HTMLDivElement;
        let elCloseContainer: HTMLDivElement;

        this.element.appendChild(
            elMain = EL("div", { class: "sectionitems-item-inner" }, [
                elUnseenIndicator = EL("div", { class: "sectionitems-item-unseen-container" }, [ "\u{2B24}" ]),
                EL("div", { class: "sectionitems-item-icon-container" }, [
                   //elIcon = (EL("x-iconimage", { class: "sectionitems-item-icon" }) as IconImage),
                   elIconDiv = EL("div", { class: "sectionitems-item-icon" }),
                   elStatusDot = EL("div", { class: "sectionitems-item-icondot" }),
                   elTypingIndicatorContainer = EL("div", { class: "sectionitems-item-typingindicator-container" }),
                ]),
                elTitleIcon = EL("div", { class: "sectionitems-item-titleicon" }),
                elTitle = EL("div", { class: "sectionitems-item-name" }),
                elPinContainer = EL("div", { class: "pin-icon-container" }),
                elCloseContainer = EL("div", { class: "close-icon-container" })
            ])
        );

        const elIconLW = new IconImageLightweight(elIconDiv);

        this.watchExpr(() => this.viewModel, vm => {
            elMain.classList.toggle("chatchannel", (vm instanceof ChatChannelViewModel));
            elMain.classList.toggle("pmconvo", (vm instanceof PMConvoChannelViewModel));
        });

        const wcm = new WhenChangeManager();
        this.watchExpr(() => this.viewModel instanceof PMConvoChannelViewModel ? this.viewModel.character : null, ch => {
            const characterSet = this.viewModel?.activeLoginViewModel.characterSet;
            const charName = ch as (CharacterName | null);
            wcm.assign({ charName, characterSet }, () => {
                if (charName && characterSet) {
                    const csl = addCharacterGenderListenerLightweight(characterSet, charName, elTitle, true);

                    let lastTypingStatus = TypingStatus.NONE;
                    const statusListener = characterSet.addStatusListener(charName, (cs) => {
                        if (cs.typingStatus != lastTypingStatus) {
                            lastTypingStatus = cs.typingStatus;

                            HTMLUtils.clearChildren(elTypingIndicatorContainer);
                            switch (lastTypingStatus) {
                                case TypingStatus.TYPING:
                                    {
                                        const ico = new IconImage();
                                        ico.classList.add("typingstatusindicator-icon");
                                        ico.classList.add("typingstatus-active");
                                        ico.src = "assets/ui/talking.svg";
                                        elTypingIndicatorContainer.appendChild(ico);
                                    }
                                    break;
                                case TypingStatus.IDLE:
                                    {
                                        const ico = new IconImage();
                                        ico.classList.add("typingstatusindicator-icon");
                                        ico.classList.add("typingstatus-idle");
                                        ico.src = "assets/ui/talking-idle.svg";
                                        elTypingIndicatorContainer.appendChild(ico);
                                    }
                                    break;
                                case TypingStatus.NONE:
                                default:
                                    break;
                            }
                        }
                    });

                    return asDisposable(csl, statusListener);
                }
            });
        });

        this.watchExpr(() => this.viewModel?.unseenMessageCount, ct => {
            elUnseenIndicator.classList.toggle("shown", (ct != null && ct > 0));
        });

        this.watchExpr(() => this.viewModel?.hasPing, hp => {
            if (hp) {
                const iconEl = new IconImage();
                iconEl.classList.add("sectionitems-item-titleicon-image");
                iconEl.src = "assets/ui/channel-ping.svg";
                elTitleIcon.appendChild(iconEl);
                elTitleIcon.classList.add("visible");
                return asDisposable(() => {
                    elTitleIcon.classList.remove("visible");
                    iconEl.remove();
                });
            }
        });

        this.watchExpr(() => this.viewModel?.title, t => {
            elTitle.innerText = t ? t : "(none)";
        });

        this.watchExpr(() => this.viewModel?.iconUrl, u => {
            elIconLW.src = u ? u : null;
            //elIcon.src = u ? u : null;
        });

        this.watchExpr(() => this.viewModel?.parent.selectedChannel, sc => {
            elMain.classList.toggle("selected", sc == this.viewModel);
        });

        let clickSuppressed = false;
        const suppressThisClickAsSelection = () => {
            clickSuppressed = true;
            window.requestIdleCallback(() => clickSuppressed = false);
        };

        this.watchExpr(() => this.viewModel?.canPin, cp => {
            if (cp) { 
                const btn = document.createElement("button");
                btn.classList.add("pin-icon");
                btn.addEventListener("click", (e) => {
                    suppressThisClickAsSelection();
                    const vm = this.viewModel;
                    if (vm) {
                        switch (e.button) {
                            case MouseButton.LEFT:
                                vm.isPinned = !vm.isPinned;
                                break;
                        }
                    }
                });
                const pinIco = document.createElement("x-iconimage");
                pinIco.setAttribute("src", "assets/ui/pin-icon.svg");
                btn.appendChild(pinIco);
                elPinContainer.appendChild(btn);

                return asDisposable(() => {
                    btn.remove();
                });
            }
        });

        this.watchExpr(() => this.viewModel?.canClose, cc => {
            if (cc) {
                const btn = document.createElement("button");
                btn.classList.add("close-icon");
                btn.addEventListener("click", () => {
                    suppressThisClickAsSelection();
                    const vm = this.viewModel;
                    if (vm) {
                        vm.close();
                    }
                });
                const closeIco = document.createElement("x-iconimage");
                closeIco.setAttribute("src", "assets/ui/close-icon.svg");
                btn.appendChild(closeIco);
                elCloseContainer.appendChild(btn);

                return asDisposable(() => {
                    btn.remove();
                });
            }
        });

        elMain.addEventListener("click", (e) => {
            if (!clickSuppressed) {
                const vm = this.viewModel;
                if (vm) {
                    try {
                        switch (e.button) {
                            case MouseButton.LEFT:
                                vm.parent.selectedChannel = vm;
                                break;
                            case MouseButton.RIGHT:
                                if (vm instanceof PMConvoChannelViewModel) {
                                    vm.showCharacterContextPopup(elMain);
                                    e.preventDefault();
                                    return false;
                                }
                                break;
                        }
                    }
                    catch { }
                }
            }
        });
        elMain.addEventListener("contextmenu", (e) => {
            const vm = this.viewModel;
                if (vm) {
                if (vm instanceof PMConvoChannelViewModel) {
                    vm.showCharacterContextPopup(elMain);
                }
            }
            e.preventDefault();
            return false;
        });

        this.watchExpr(() => this.viewModel instanceof PMConvoChannelViewModel ? this.viewModel : null, vm => {
            if (vm) {
                const elStatusDotInner = new StatusDotLightweight();
                elStatusDotInner.characterSet = vm.parent.characterSet;
                elStatusDotInner.character = vm.character;
                elStatusDot.appendChild(elStatusDotInner.element);

                return asDisposable(() => {
                    elStatusDotInner.element.remove();
                    elStatusDotInner.dispose();
                });
            }
        });
    }
}

@componentElement("x-sortedchannelcollectionview")
export class SortedChannelCollectionView extends CollectionViewLightweight<KeyValuePair<any, ChannelViewModel>> {
    constructor() {
        super();
    }

    createUserElement(kvm: KeyValuePair<any, ChannelViewModel>): [HTMLElement, IDisposable] {
        const vm = kvm.value;

        const el = document.createElement("div");
        el.classList.add("sectionitems-item");
        const elListItem = new ChannelListItemLightweight(el);
        elListItem.viewModel = vm as (ChatChannelViewModel | PMConvoChannelViewModel);
        (el as any)["__ChannelListItemLightweight"] = elListItem;
        
        const propChangeListener = vm.addEventListener("propertychange", (e) => {
            if (e.propertyName == "unseenMessageCount" || e.propertyName == "hasPing") {
                this.updateItemMentionsPings(elListItem);
            }
        });
        this.updateItemMentionsPings(elListItem);
        return [
            el,
            asDisposable(() => el.remove(), propChangeListener, elListItem)
        ];
    }

    destroyUserElement(vm: KeyValuePair<any, ChannelViewModel>, el: HTMLElement): void {
        this._mentions.delete((el as any)["__ChannelListItemLightweight"] as ChannelListItemLightweight);
        this._pings.delete((el as any)["__ChannelListItemLightweight"] as ChannelListItemLightweight);
        this.pushMentionsPings();
    }

    // createUserElementOLD(kvm: KeyValuePair<any, ChannelViewModel>): [HTMLElement, Disposable] {
    //     const vm = kvm.value;
    //     const el = new ChannelListItem(this);
    //     el.viewModel = vm as (ChatChannelViewModel | PMConvoChannelViewModel);
    //     const propChangeListener = vm.addEventListener("propertychange", (e) => {
    //         if (e.propertyName == "unseenMessageCount" || e.propertyName == "hasPing") {
    //             this.updateItemMentionsPings(el);
    //         }
    //     });
    //     this.updateItemMentionsPings(el);
    //     return [el, propChangeListener];
    // }

    // destroyUserElementOLD(vm: KeyValuePair<any, ChannelViewModel>, el: HTMLElement): void {
    //     this._mentions.delete(el as ChannelListItem);
    //     this._pings.delete(el as ChannelListItem);
    //     this.pushMentionsPings();
    // }

    private _mentions: Set<ChannelListItemLightweight> = new Set();
    private _pings: Set<ChannelListItemLightweight> = new Set();

    updateItemMentionsPings(cli: ChannelListItemLightweight) {
        if (cli.viewModel!.unseenMessageCount > 0) {
            this._mentions.add(cli);
        }
        else {
            this._mentions.delete(cli);
        }
        
        if (cli.viewModel instanceof ChannelViewModel && cli.viewModel.hasPing) {
            this._pings.add(cli);
        }
        else {
            this._pings.delete(cli);
        }
        this.pushMentionsPings();
    }

    private _hasMentions: boolean = false;
    private _hasPings: boolean = false;

    get hasMentions() { return this._hasMentions; }
    get hasPings() { return this._hasPings; }

    private pushMentionsPings() {
        const newHasMentions = this._mentions.size > 0;
        const newHasPings = this._pings.size > 0;

        if (newHasMentions != this._hasMentions || newHasPings != this._hasPings) {
            this._hasMentions = newHasMentions;
            this._hasPings = newHasPings;
        }
        if (this.onmentionspingschanged) {
            this.onmentionspingschanged();
        }
    }

    onmentionspingschanged: (() => void) | null = null;
}
