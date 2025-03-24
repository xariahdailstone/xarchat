import { Props } from "../../node_modules/snabbdom/build/index.js";
import { ChannelName } from "../shared/ChannelName.js";
import { CharacterGenderConvert } from "../shared/CharacterGender.js";
import { CharacterName } from "../shared/CharacterName.js";
import { OnlineStatus } from "../shared/OnlineStatus.js";
import { TypingStatus } from "../shared/TypingStatus.js";
import { Attrs, Fragment, jsx, On, VNode } from "../snabbdom/index.js";
import { AnimationFrameUtils } from "../util/AnimationFrameUtils.js";
import { addCharacterGenderListenerLightweight, addCharacterOnlineStatusListenerLightweight } from "../util/CharacterOnlineStatusListenerLightweight.js";
import { IDisposable, asDisposable, disposeWithThis } from "../util/Disposable.js";
import { EL } from "../util/EL.js";
import { EventListenerUtil, MouseButton } from "../util/EventListenerUtil.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { ObjectUniqueId } from "../util/ObjectUniqueId.js";
import { CalculatedObservable } from "../util/ObservableExpression.js";
import { Optional } from "../util/Optional.js";
import { WhenChangeManager } from "../util/WhenChange.js";
import { KeyValuePair } from "../util/collections/KeyValuePair.js";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel.js";
import { AddChannelsViewModel } from "../viewmodel/AddChannelsViewModel.js";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel.js";
import { ChatChannelViewModel } from "../viewmodel/ChatChannelViewModel.js";
import { PMConvoChannelViewModel } from "../viewmodel/PMConvoChannelViewModel.js";
import { ChannelDragIndicatorPopupViewModel } from "../viewmodel/popups/ChannelDragIndicatorPopupViewModel.js";
import { PopupViewModel } from "../viewmodel/popups/PopupViewModel.js";
import { CharacterStatusListener } from "./CharacterStatusListener.js";
import { CollapseButton } from "./CollapseButton.js";
import { CollectionViewLightweight } from "./CollectionViewLightweight.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { IconImage, IconImageLightweight } from "./IconImage.js";
import { LightweightComponentBase } from "./LightweightComponentBase.js";
import { RenderingComponentBase } from "./RenderingComponentBase.js";
import { StatusDot, StatusDotLightweight, StatusDotVNodeBuilder } from "./StatusDot.js";

const SYM_HEADERDOTSPANTEXT = Symbol();

const DragDataChannelName = "application/x-channelname";
const DragDataChannelTitle = "application/x-channeltitle";
const DragDataOwnerId = "application/x-ownerid";

let currentChannelDragData: { [DragDataChannelName]: ChannelName, [DragDataChannelTitle]: string, [DragDataOwnerId]: number } | null = null;

@componentElement("x-chatslist")
export class ChatsList extends RenderingComponentBase<ActiveLoginViewModel> {
    constructor() {
        super();

        this.whenConnected(() => {
            const disposables: IDisposable[] = [];

            disposables.push(this.setupScrollerAlertsNotifications());
            disposables.push(this.setupChannelDragHosts());

            return asDisposable(...disposables);
        });
    }

    private scrollToNextAlertAbove: ((() => void) | null) = null;
    private scrollToNextAlertBelow: ((() => void) | null) = null;

    private setupScrollerAlertsNotifications(): IDisposable {
        let io: IntersectionObserver | null = null;
        const elementsNotVisibleAbove = new Map<HTMLElement, number>();
        const elementsNotVisibleBelow = new Map<HTMLElement, number>();
        let lastHasAlertElements = new Set<HTMLElement>();

        const getHasAlertElementsSet = () => {
            const hasAlertEls = this.elMain.querySelectorAll("*[data-has-alert='true']");
            const result: Set<HTMLElement> = new Set();
            hasAlertEls.forEach(e => result.add(e as HTMLElement));
            return result;
        };
        const updateAlertNoticeVisibility = () => {
            this.cleanOutMissingElements(elementsNotVisibleAbove);
            this.cleanOutMissingElements(elementsNotVisibleBelow);
            this.elMain.classList.toggle("has-alerts-above", elementsNotVisibleAbove.size > 0);
            this.elMain.classList.toggle("has-alerts-below", elementsNotVisibleBelow.size > 0);
        };
        const recalculateAlertDisplay = () => {
            this.logger.logInfo("recalculatingAlertDisplay");
            if (io) {
                elementsNotVisibleAbove.clear();
                elementsNotVisibleBelow.clear();
                updateAlertNoticeVisibility();
                io.disconnect();
                io = null;
            }
            const scroller = this.$("scroller");
            if (scroller) {
                elementsNotVisibleAbove.clear();
                elementsNotVisibleBelow.clear();
                updateAlertNoticeVisibility();
                io = new IntersectionObserver(entries => {
                    for (let entry of entries) {
                        const target = entry.target as HTMLElement;
                        if (entry.intersectionRatio > 0.75) {
                            elementsNotVisibleAbove.delete(target);
                            elementsNotVisibleBelow.delete(target);
                        }
                        else if ((entry.boundingClientRect.top + (entry.boundingClientRect.height / 2)) > 
                            (entry.rootBounds!.top + (entry.rootBounds!.height / 2))) {
                            
                            elementsNotVisibleAbove.delete(target);
                            elementsNotVisibleBelow.set(target, entry.boundingClientRect.top);
                        }
                        else {
                            elementsNotVisibleAbove.set(target, entry.boundingClientRect.top + entry.boundingClientRect.height);
                            elementsNotVisibleBelow.delete(target);
                        }
                    }
                    this.cleanOutMissingElements(elementsNotVisibleAbove);
                    this.cleanOutMissingElements(elementsNotVisibleBelow);
                    updateAlertNoticeVisibility();
                }, {
                    root: scroller,
                    threshold: [0, 0.25, 0.5, 0.75, 0.99]
                });

                const hasAlertEls = this.elMain.querySelectorAll("*[data-has-alert='true']");
                hasAlertEls.forEach(el => {
                    io!.observe(el as HTMLElement);
                });
                this.logger.logInfo("recalculatingAlertDisplay watching element count", hasAlertEls.length);
            }
        };
        const scrollToNext = (map: Map<HTMLElement, number>, shouldTake: (curBound: number, maxBound: number) => boolean) => {
            if (map.size > 0) {
                let maxBound: number | null = null;
                let maxEl: HTMLElement | null = null;
                for (let kvp of map) {
                    const curEl = kvp[0];
                    const curBound = kvp[1];
                    if (maxBound == null || shouldTake(curBound, maxBound)) {
                        maxBound = curBound;
                        maxEl = curEl;
                    }
                }
                if (maxEl) {
                    maxEl.scrollIntoView({ block: "center", behavior: "smooth" });
                }
            }
            recalculateAlertDisplay();
        }
        this.scrollToNextAlertAbove = () => {
            scrollToNext(elementsNotVisibleAbove, (cur, max) => cur > max);
        };
        this.scrollToNextAlertBelow = () => {
            scrollToNext(elementsNotVisibleBelow, (cur, max) => cur < max);
        };

        const mo = new MutationObserver(entries => {
            const curHasAlertElementsSet = getHasAlertElementsSet();
            if (curHasAlertElementsSet.symmetricDifference(lastHasAlertElements).size > 0) {
                lastHasAlertElements = curHasAlertElementsSet;
                recalculateAlertDisplay();
            }
        });
        mo.observe(this.elMain, {
            subtree: true,
            childList: true,
            attributes: true
        });

        const winResizeEvt = EventListenerUtil.addDisposableEventListener(window, "resize", () => {
            recalculateAlertDisplay();
        });
        const appWindowStateChanged = new CalculatedObservable("ChatsList.appWindowStateChanged", () => this.viewModel?.appViewModel.appWindowState);
        const appWindowStateChangedSub = appWindowStateChanged.addValueChangeListener((v) => { recalculateAlertDisplay(); });

        return asDisposable(() => {
            if (io) {
                io.disconnect();
                io = null;
            }
            winResizeEvt?.dispose();
            appWindowStateChangedSub?.dispose();
            appWindowStateChanged?.dispose();
            mo.disconnect();
            this.scrollToNextAlertAbove = null;
            this.scrollToNextAlertBelow = null;
        });
    }

    private cleanOutMissingElements(map: Map<HTMLElement, any>) {
        let toRemove: Set<HTMLElement> | null = null;
        for (let k of map.keys()) {
            if (!this.isInElMain(k)) {
                toRemove ??= new Set();
                toRemove.add(k);
            }
        }
        if (toRemove) {
            for (let k of toRemove.values()) {
                map.delete(k);
            }
        }
    }
    private isInElMain(el: HTMLElement) {
        if (!el.isConnected) { return false; }
        let curEl: HTMLElement | null = el;
        while (curEl) {
            if (curEl == this.elMain) { return true; }
            curEl = curEl.parentElement;
        }
        return false;
    }

    private setupChannelDragHosts(): IDisposable {
        const existingDragDropHosts = new Map<HTMLElement, IDisposable>();

        const mo = new MutationObserver(entries => {
            const needDragDropHosts = new Set<HTMLElement>();

            this.elMain.querySelectorAll("*[data-dragdrophost='true']").forEach(el => {
                needDragDropHosts.add(el as HTMLElement);
            });

            for (let toRemove of [...existingDragDropHosts.keys()]) {
                if (needDragDropHosts.has(toRemove)) { continue; }
                existingDragDropHosts.get(toRemove)?.dispose();
                existingDragDropHosts.delete(toRemove);
            }
            for (let toAdd of needDragDropHosts.values()) {
                if (existingDragDropHosts.has(toAdd)) { continue; }
                existingDragDropHosts.set(toAdd, this.setupDragDropHost(toAdd));
            }
        });

        mo.observe(this.elMain, {
            subtree: true,
            childList: true,
            attributes: true
        });

        return asDisposable(() => {
            mo.disconnect();

            for (let d of existingDragDropHosts.values()) {
                d.dispose();
            }
            existingDragDropHosts.clear();
        });
    }

    private setupDragDropHost(hostEl: HTMLElement): IDisposable {
        const disposables: IDisposable[] = [];
        this.logger.logDebug("setupDragDropHost", hostEl);

        let dragIndicatorPopup: ChannelDragIndicatorPopupViewModel | null = null;

        const findDragIndex = (e: DragEvent): ([number, ("before" | "after"), ChannelViewModel, HTMLElement] | null) => {
            const vm = this.viewModel!;
            const y = e.clientY;
            let idx = 0;
            for (let i = 0; i < hostEl.childElementCount; i++) {
                const xEl = hostEl.children[i] as HTMLElement;
                const chanName = ChannelName.create(xEl.getAttribute("data-channel-name")!);

                const xRect = xEl.getBoundingClientRect();
                if (xRect.top <= y && xRect.bottom > y) {
                    this.logger.logDebug("e.clientY", y, idx);
                    const containerRect = hostEl.getBoundingClientRect();
                    if ((xRect.top + (xRect.height / 2)) > y) {
                        // in top half
                        return [(xRect.top - 1) - containerRect.top, "before", vm.getChannel(chanName)!, xEl];
                    }
                    else {
                        // in bottom half
                        return [(xRect.bottom - 1) - containerRect.top, "after", vm.getChannel(chanName)!, xEl];
                    }
                    break;
                }
                idx++;
            }
            this.logger.logDebug("e.clientY", y, "none");
            return null;
        }
        let lastPosition: (("before" | "after") | null) = null;
        let lastTargetElement: (HTMLElement | null) = null;
        const createDragCSS = (position: ("before" | "after"), targetElement: HTMLElement) => {
            if (lastPosition != position || lastTargetElement != targetElement) {
                this.logger.logDebug("createDragCSS", position, targetElement);
                if (!dragIndicatorPopup) {
                    dragIndicatorPopup = new ChannelDragIndicatorPopupViewModel(this.viewModel!.appViewModel); // TODO:
                    this.viewModel!.appViewModel.popups.add(dragIndicatorPopup);
                }
                dragIndicatorPopup.position = position;
                dragIndicatorPopup.targetElement = targetElement;
                lastPosition = position;
                lastTargetElement = targetElement;
            }
        }
        const removeDragCSS = () => {
            this.logger.logDebug("removeDragCSS");
            if (dragIndicatorPopup) {
                dragIndicatorPopup.dismissed();
                dragIndicatorPopup = null;

                lastPosition = null;
                lastTargetElement = null;
            }
        }

        const myOwnerId = ObjectUniqueId.get(hostEl);
        const dragEnterOrOver = (e: DragEvent) => {
            const dt = e.dataTransfer!;
            const dragDataOwner = currentChannelDragData![DragDataOwnerId];
            const dragDataChannelName = currentChannelDragData![DragDataChannelName];
            if (dragDataOwner == myOwnerId) {
                // TODO: show drag highlight
                const dragIdx = findDragIndex(e);
                if (dragIdx) {
                    createDragCSS(dragIdx[1], dragIdx[3]);
                }
                dt.dropEffect = "move";
                this.logger.logDebug("dragenter/over", dragDataChannelName);
                e.preventDefault();
            }
            else {
                this.logger.logDebug("dragenter/over skip, ownerid mismatch", dragDataOwner, myOwnerId);
                removeDragCSS();
            }
            e.stopPropagation();
        };
        disposables.push(EventListenerUtil.addDisposableEventListener(hostEl, "dragenter", dragEnterOrOver));
        disposables.push(EventListenerUtil.addDisposableEventListener(hostEl, "dragover", dragEnterOrOver));
        disposables.push(EventListenerUtil.addDisposableEventListener(hostEl, "dragleave", (e: DragEvent) => {
            this.logger.logDebug("dragleave");
            const dt = e.dataTransfer!;
            const dragDataOwner = currentChannelDragData![DragDataOwnerId];
            const dragDataChannelName = currentChannelDragData![DragDataChannelName];
            if (dragDataOwner == myOwnerId) {
                // TODO: remove drag highlight
                removeDragCSS();
                this.logger.logDebug("dragleave", dragDataChannelName);
            }
            else {
                removeDragCSS();
            }
            e.stopPropagation();            
        }));
        disposables.push(EventListenerUtil.addDisposableEventListener(hostEl, "drop", (e: DragEvent) => {
            this.logger.logDebug("drop");
            const dt = e.dataTransfer!;
            const dragDataOwner = currentChannelDragData![DragDataOwnerId];
            const dragDataChannelName = currentChannelDragData![DragDataChannelName];
            if (dragDataOwner == myOwnerId) {
                // TODO: remove drag highlight
                removeDragCSS();

                const dragIdx = findDragIndex(e);
                if (dragIdx) {
                    dragIdx[2].activeLoginViewModel.reorderChannel(dragDataChannelName, dragIdx[1], dragIdx[2]);
                }

                this.logger.logDebug("drop!", dragDataChannelName);
                e.preventDefault();
            }
            else {
                removeDragCSS();
            }
            e.stopPropagation();            
        }));

        disposables.push(asDisposable(() => removeDragCSS()));
        return asDisposable(...disposables);
    }

    protected render(): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        if (!vm) { return <></>; }

        return <>
            {this.renderScrollSection(vm)}
            <div key="new-alerts-above" id="elNewAlertsAbove" classList={["new-alerts", "new-alerts-above", "hidden"]} on={{
                    "click": () => {
                        if (this.scrollToNextAlertAbove) {
                            this.scrollToNextAlertAbove();
                        }
                    }
                }}>
                <x-iconimage attr-src="assets/ui/channel-ping.svg" classList={["new-alerts-ping-icon"]}></x-iconimage><div classList={["new-alerts-text"]}>Alerts Above</div></div>
            <div key="new-alerts-below" id="elNewAlertsBelow" classList={["new-alerts", "new-alerts-below", "hidden"]} on={{
                    "click": () => {
                        if (this.scrollToNextAlertBelow) {
                            this.scrollToNextAlertBelow();
                        }
                    }
                }}>
                <x-iconimage attr-src="assets/ui/channel-ping.svg" classList={["new-alerts-ping-icon"]}></x-iconimage><div classList={["new-alerts-text"]}>Alerts Below</div></div>
        </>;
    }

    private renderScrollSection(vm: ActiveLoginViewModel): VNode {

        return <div key="scroller" id="scroller">
            {this.renderPinnedChannelsSection(vm)}
            {this.renderUnpinnedChannelsSection(vm)}
            {this.renderPrivateMessagesSection(vm)}
        </div>;
    }

    private renderPrivateMessagesSection(vm: ActiveLoginViewModel): VNode | null {
        if (vm.pmConversations.length == 0) { return null; }

        const isExpanded = !vm.pmConvosCollapsed;

        const chanNodes: VNode[] = [];
        for (let pcvm of vm.pmConversations.iterateValues()) {
            chanNodes.push(this.renderChannelItem(pcvm, false));
        }

        const result = this.renderCollapsibleSection({
            vm: vm,
            id: "pmConvos",
            title: `Private Messages (${vm.pmConversations.length})`,
            isExpanded: isExpanded,
            toggleCollapse: () => { vm.pmConvosCollapsed = isExpanded; },
            supportDragDrop: false,
            getHeaderDot: () => !isExpanded ? this.renderHeaderDot(
                    "pmConvosHeaderDot", 
                    vm.pmConversations.filter(v => v.hasPing).length > 0,
                    false) 
                : null,
            renderContent: () => { 
                return <div classList={["sectionitems"]}>
                    {chanNodes}
                </div>;
            }
        });
        return result;
    }

    private renderUnpinnedChannelsSection(vm: ActiveLoginViewModel): VNode | null {
        const sectionTitle = (vm.pinnedChannels.length > 0) ? "Other Channels" : "Channels";
        const isExpanded = !vm.channelsCollapsed;

        const chanNodes: VNode[] = [];
        for (let ccvm of vm.unpinnedChannels.iterateValues()) {
            chanNodes.push(this.renderChannelItem(ccvm, true));
        }

        // TODO: add "Add Channels" button
        const result = this.renderCollapsibleSection({
            vm: vm,
            id: "unpinnedChannels",
            title: `${sectionTitle} (${vm.unpinnedChannels.length.toLocaleString()})`,
            isExpanded: isExpanded,
            toggleCollapse: () => { vm.channelsCollapsed = isExpanded; },
            supportDragDrop: true,
            addChannelButton: true,
            getHeaderDot: () => !isExpanded ? this.renderHeaderDot(
                    "unpinnedChannelsHeaderDot", 
                    vm.unpinnedChannels.filter(v => v.hasPing).length > 0,
                    vm.unpinnedChannels.filter(v => v.hasUnseenMessages).length > 0) 
                : null,
            renderContent: () => { 
                return <div classList={["sectionitems"]} attrs={{ "data-dragdrophost": "true" }}>
                    {chanNodes}
                </div>;
            }
        });
        return result;
    }

    private renderPinnedChannelsSection(vm: ActiveLoginViewModel): VNode | null {
        if (vm.pinnedChannels.length == 0) { return null; }

        const isExpanded = !vm.pinnedChannelsCollapsed;

        const chanNodes: VNode[] = [];
        for (let ccvm of vm.pinnedChannels.iterateValues()) {
            chanNodes.push(this.renderChannelItem(ccvm, true));
        }

        const result = this.renderCollapsibleSection({
            vm: vm,
            id: "pinnedChannels",
            title: `Pinned Channels (${vm.pinnedChannels.length})`,
            isExpanded: isExpanded,
            toggleCollapse: () => { vm.pinnedChannelsCollapsed = isExpanded; },
            supportDragDrop: true,
            getHeaderDot: () => !isExpanded ? this.renderHeaderDot(
                    "pinnedChannelsHeaderDot", 
                    vm.pinnedChannels.filter(v => v.hasPing).length > 0,
                    vm.pinnedChannels.filter(v => v.hasUnseenMessages).length > 0) 
                : null,
            renderContent: () => { 
                return <div classList={["sectionitems"]} attrs={{ "data-dragdrophost": "true" }}>
                    {chanNodes}
                </div>;
            }
        });
        return result;
    }

    private renderChannelItem(cvm: ChannelViewModel, supportsDragDrop: boolean): VNode {
        const isChatChannel = cvm instanceof ChatChannelViewModel;
        const isPMConvo = cvm instanceof PMConvoChannelViewModel;

        let itemKey: string | undefined;
        let typingIndicatorNode: VNode | null = null;
        let nameClasses: string[] = [];
        let title: string;
        let charStatusDot: VNode | null = null;
        if (isChatChannel) {
            const ccvm = cvm as ChatChannelViewModel;
            itemKey = `channel-${ccvm.name.canonicalValue}`;
            title = ccvm.title ?? "(none)";
        }
        else if (isPMConvo) {
            const pcvm = cvm as PMConvoChannelViewModel;
            const cs = cvm.activeLoginViewModel.characterSet.getCharacterStatus(pcvm.character);

            if (cs.status == OnlineStatus.OFFLINE) {
                nameClasses.push("gender-offline");
            }
            else {
                nameClasses.push(`gender-${CharacterGenderConvert.toString(cs.gender).toLowerCase()}`);
                if (cs.isBookmark) {
                    nameClasses.push("char-is-bookmark");
                }
                if (cs.isFriend) {
                    nameClasses.push("char-is-friend");
                }
            }

            itemKey = `pmconvo-${pcvm.character.canonicalValue}`;
            switch (cs.typingStatus) {
                case TypingStatus.NONE:
                    typingIndicatorNode = null;
                    break;
                case TypingStatus.IDLE:
                    typingIndicatorNode = <x-iconimage classList={["typingstatusindicator-icon","typingstatus-idle"]} attr-src="assets/ui/talking-idle.svg"></x-iconimage>;
                    break;
                case TypingStatus.TYPING:
                    typingIndicatorNode = <x-iconimage classList={["typingstatusindicator-icon","typingstatus-active"]} attr-src="assets/ui/talking.svg"></x-iconimage>;
                    break;
            }

            title = pcvm.character.value;

            charStatusDot = StatusDotVNodeBuilder.getStatusDotVNode(cs);
        }
        else {
            itemKey = undefined;
            title = "(None)";
        }

        const isSelected = cvm.activeLoginViewModel.selectedChannel == cvm;
        const showUnseenDot = cvm.hasUnseenMessages;
        const pingNode = cvm.hasPing
            ? <x-iconimage classList={["sectionitems-item-titleicon-image"]} attr-src="assets/ui/channel-ping.svg"></x-iconimage>
            : null;

        let clickSuppressed = false;
        const suppressThisClickAsSelection = () => {
            clickSuppressed = true;
        };

        const pinNode = cvm.canPin
            ? <button classList={["pin-icon"]} on={{
                    "click": (e: MouseEvent) => {
                        suppressThisClickAsSelection();
                        switch (e.button) {
                            case MouseButton.LEFT:
                                cvm.isPinned = !cvm.isPinned;
                                break;
                        }
                    }
                }}><x-iconimage attr-src="assets/ui/pin-icon.svg"></x-iconimage></button>
            : null;

        const closeNode = cvm.canClose
            ? <button classList={["close-icon"]} on={{
                    "click": (e: MouseEvent) => {
                        suppressThisClickAsSelection();
                        cvm.close();
                    }
                }}><x-iconimage attr-src="assets/ui/close-icon.svg"></x-iconimage></button>
            : null;

        const mainEvents: On = {
            "click": (e: MouseEvent) => {
                if (!clickSuppressed) {
                    try {
                        switch (e.button) {
                            case MouseButton.LEFT:
                                cvm.parent.selectedChannel = cvm;
                                break;
                            case MouseButton.RIGHT:
                                if (cvm instanceof PMConvoChannelViewModel) {
                                    cvm.showCharacterContextPopup(e.target as HTMLElement);
                                    e.preventDefault();
                                }
                                break;
                        }
                    }
                    catch { }
                }
                else {
                    clickSuppressed = false;
                }
            },
            "contextmenu": (e: MouseEvent) => {
                if (cvm instanceof PMConvoChannelViewModel) {
                    cvm.showCharacterContextPopup(e.target as HTMLElement);
                }
            }
        };
        const mainAttributes: Attrs = {
            "draggable": "true"
        };

        if (supportsDragDrop) {
            mainEvents["dragstart"] = (e: DragEvent) => {
                this.logger.logDebug("dragstart");
                if (cvm instanceof ChatChannelViewModel) {
                    const dt = e.dataTransfer!;
                    dt.effectAllowed = "move";

                    const ownerEl = (e.target as HTMLElement).parentElement!;
                    const ownerId = ObjectUniqueId.get(ownerEl);
                    currentChannelDragData = {
                        [DragDataChannelName]: cvm.name,
                        [DragDataChannelTitle]: cvm.title,
                        [DragDataOwnerId]: ownerId
                    };
                }
                else {
                    e.preventDefault();
                    return false;
                }
            };
            mainEvents["dragend"] = (e: MouseEvent) => {
                this.logger.logDebug("dragend");
            };
            mainAttributes["data-channel-name"] = (cvm instanceof ChatChannelViewModel) ? cvm.name.canonicalValue : "";
        }
        if (cvm.hasPing) {
            mainAttributes["data-has-alert"] = "true";
        }

        return <div key={itemKey} classList={["sectionitems-item"]} attrs={mainAttributes} on={mainEvents}>
            <div classList={["sectionitems-item-inner", 
                    isChatChannel ? "chatchannel" : isPMConvo ? "pmconvo" : "", 
                    isSelected ? "selected" : "not-selected"]}>
                <div classList={["sectionitems-item-unseen-container", showUnseenDot ? "shown" : "not-shown"]}>{"\u{2B24}"}</div>
                <div classList={["sectionitems-item-icon-container"]}>
                    <div classList={["sectionitems-item-icon"]}>
                        <x-iconimage classList={["iconimagelightweight-iconimage"]} attr-src={cvm.iconUrl}></x-iconimage>
                    </div>
                    <div classList={["sectionitems-item-icondot"]}>{charStatusDot}</div>
                    <div classList={["sectionitems-item-typingindicator-container"]}>{typingIndicatorNode}</div>
                </div>
                <div classList={["sectionitems-item-titleicon", cvm.hasPing ? "visible" : "not-visible"]}>{pingNode}</div>
                <div classList={["sectionitems-item-name", ...nameClasses]}>{title}</div>
                <div classList={["pin-icon-container"]}>{pinNode}</div>
                <div classList={["close-icon-container"]}>{closeNode}</div>
            </div>
        </div>;
    }

    private renderHeaderDot(key: string, hasPing: boolean, hasUnseen: boolean): VNode | null {
        let result: VNode | null;
        if (hasPing) {
            result = <span classList={["header-dot-container"]}><x-iconimage key={`${key}-iconimage`} attr-src="assets/ui/channel-ping.svg" classList={["header-ping-icon"]}></x-iconimage></span>;
        }
        else if (hasUnseen) {
            result = <span classList={["header-dot-container"]}>{"\u{2B24} "}</span>;
        }
        else {
            result = null;   
        }
        return result;
    }

    private renderCollapsibleSection(options: SectionOptions): VNode {
        const id = options.id;
        const title = options.title;

        const headerDot = options.getHeaderDot();

        let addChannelEl: VNode | null = null;
        if (options.addChannelButton ?? false) {
            const isSelected = options.vm.selectedTab instanceof AddChannelsViewModel;
            addChannelEl = <button classList={["sectiontitle-addbtn", isSelected ? "selected" : "not-selected" ]} id="elAddChannelsButton" attr-tabindex="-1" on={{
                    "click": () => {
                        options.vm.showAddChannels();
                    }
                }}>+</button>;
        }

        const unseenDotStyle = options.vm.getConfigSettingById("unseenIndicatorStyle");

        return <div key={id} id={id} classList={["section", `unseendot-${unseenDotStyle}`]}>
            <div classList={["sectiontitle"]}>
                <div classList={["sectiontitle-collapse"]}>
                    <button classList={["collapsebutton"]} attr-tabindex="-1" on={{
                            "click": () => { options.toggleCollapse(); }
                        }}>
                        <x-iconimage classList={["collapsearrow", options.isExpanded ? "expanded" : "collapsed"]} attr-src="assets/ui/collapse.svg"></x-iconimage>
                    </button>
                </div>
                <div classList={["sectiontitle-text"]}>{headerDot}{title}</div>
                {addChannelEl}
            </div>
            <div classList={["section-collapsebody", options.isExpanded ? "expanded" : "collapsed"]}>
                {options.renderContent()}
            </div>
        </div>;
    }
}

interface SectionOptions {
    vm: ActiveLoginViewModel,
    id: string,
    title: string,
    isExpanded: boolean,
    toggleCollapse: () => void,
    supportDragDrop: boolean,
    addChannelButton?: boolean,
    getHeaderDot: () => (VNode | null),
    renderContent: () => (VNode | VNode[] | null)
}