import { CharacterGenderConvert } from "../shared/CharacterGender";
import { CharacterName } from "../shared/CharacterName";
import { jsx, Fragment, VNode, init, propsModule, styleModule, eventListenersModule } from "../snabbdom/index";
import { CharacterLinkUtils } from "../util/CharacterLinkUtils";
import { KeyValuePair } from "../util/collections/KeyValuePair";
import { ReadOnlyStdObservableCollection } from "../util/collections/ReadOnlyStdObservableCollection";
import { DateUtils, TimeSpanUtils } from "../util/DateTimeUtils";
import { asDisposable, asNamedDisposable, DisposableOwnerField, IDisposable } from "../util/Disposable";
import { HTMLUtils } from "../util/HTMLUtils";
import { IterableUtils } from "../util/IterableUtils";
import { Observable } from "../util/Observable";
import { Scheduler } from "../util/Scheduler";
import { classListNewModule } from "../util/snabbdom/classList-new";
import { rawAttributesModule } from "../util/snabbdom/rawAttributes";
import { valueSyncModule } from "../util/snabbdom/valueSyncHook";
import { URLUtils } from "../util/URLUtils";
import { ChannelMessageDisplayStyle, ChannelMessageType, ChannelMessageViewModel } from "../viewmodel/ChannelViewModel";
import { LocaleViewModel } from "../viewmodel/LocaleViewModel";
import { RenderingComponentBase } from "./RenderingComponentBase";
import { StatusDotVNodeBuilder } from "./StatusDot";

function areSameDate(a: Date, b: Date) {
    const aDate = a.getFullYear().toString() + '-' + a.getMonth().toString() + '-' + a.getDate().toString();
    const bDate = b.getFullYear().toString() + '-' + b.getMonth().toString() + '-' + b.getDate().toString();
    return (aDate == bDate);
}

function createMessageContainerVNode(options: { 
    vm: ChannelMessageViewModel, 
    innerNode: VNode }): VNode {

    const vm = options.vm;
    const uniqueMessageId = vm.uniqueMessageId.toString();
    const innerNode = options.innerNode;

    const collapseAds = vm.type == ChannelMessageType.AD && (vm.channelViewModel?.getConfigSettingById("collapseAds") ?? false);
    if (collapseAds) {
        // const collapseHostStyles: string[] = [];
        // let collapseBtnEl: VNode;
        // if (vm.isOversized) {
        //     collapseHostStyles.push("is-oversized");
        //     if (vm.collapsed) {
        //         collapseHostStyles.push("collapsed");
        //         collapseBtnEl = <div classList={["collapse-button-container"]} attrs={{
        //                 "data-copycontent": ""
        //             }}><button classList={["collapse-button"]} attrs={{
        //                 "data-copycontent": "",
        //                 "data-iscollapsebutton": "true"
        //             }} on={{
        //                 "click": () => {
        //                     vm.collapsed = false;
        //                 }
        //             }}>Expand</button></div>;  
        //     }
        //     else {
        //         collapseHostStyles.push("expanded");
        //         collapseBtnEl = <div classList={["collapse-button-container"]} attrs={{
        //                 "data-copycontent": ""
        //             }}><button classList={["collapse-button"]} attrs={{
        //                 "data-copycontent": "",
        //                 "data-iscollapsebutton": "true"
        //             }} on={{
        //                 "click": () => {
        //                     vm.collapsed = true;
        //                 }
        //             }}>Collapse</button></div>;  
        //     }
        // }
        // else {
        //     collapseHostStyles.push("collapsed");
        //     collapseBtnEl = <div classList={["collapse-button-container"]} attrs={{
        //         "data-copycontent": ""
        //     }}><button classList={["collapse-button"]} attrs={{
        //         "data-copycontent": "",
        //         "data-iscollapsebutton": "true"
        //     }}>Expand</button></div>;  
        // }

        let outerEl = <div key={`msg-${uniqueMessageId}`} class={{
                "collapse-host": true,
                "collapsible": true,
                "collapsed": vm.collapsed ?? true,
                "expanded": !(vm.collapsed ?? true)
            }} attrs={{
                "data-messageid": uniqueMessageId,
                "data-copyinline": "true"
            }}>
                <div classList={["collapse-host-innera"]} attrs={{ "data-copyinline": "true" }}>
                    <div classList={["collapse-host-inner"]} attrs={{ "data-copyinline": "true" }}>
                        <button classList={[ "collapse-host-expandbuttonspacer", "collapse-button-appearance" ]} attrs={{ "data-copycontent": "" }}>Collapse</button>
                        <div classList={["collapse-host-inner-message"]} attrs={{ "data-copyinline": "true" }}>
                            {innerNode}
                        </div>
                    </div>
                    <div classList={["collapse-host-expandcollapsecontainer"]} attrs={{ "data-copycontent": "" }}>
                        <button classList={[ "collapse-host-collapsebutton", "collapse-button-appearance" ]} attrs={{ "data-copycontent": "" }}
                            on={{
                                "click": () => {
                                    vm.collapsed = !vm.collapsed;
                                }
                            }}><div classList={[ "collapse-host-collapsebutton-content" ]}></div></button>
                    </div>
                </div>
            </div>;
        return outerEl;
    }
    else {
        let outerEl = <div key={`msg-${uniqueMessageId}`} classList={["collapse-host"]} attrs={{
                "data-messageid": uniqueMessageId,
                "data-copyinline": "true"
            }}>{innerNode}</div>;
        return outerEl;
    }
}

export class ChannelStreamMessageViewRenderer implements IDisposable {
    constructor() {
        this.patch = init([classListNewModule, propsModule, rawAttributesModule, styleModule, eventListenersModule, valueSyncModule /* , idModule */], undefined, {
            experimental: {
                fragments: true
            }
        });
    }

    private _disposed: boolean = false;

    get isDisposed() { return this._disposed; }

    dispose() {
        this._element = null;
        this._collection = null;
        this.refreshBindings();
        this._previousCollObs.dispose();
        this._previousRenderDisposable.dispose();
    }
    [Symbol.dispose]() {
        this.dispose();
    }

    updatingElements: ((() => any) | null) = null;
    updatedElements: ((() => any) | null) = null;

    private _element: HTMLElement | null = null;
    private _collection: ReadOnlyStdObservableCollection<KeyValuePair<any, ChannelMessageViewModel>> | null = null;

    private _currentVNode: VNode | null = null;

    private readonly patch: any;

    private onUpdatingElements() {
        if (this.updatingElements) {
            this.updatingElements();
        }
    }
    private onUpdatedElements() {
        if (this.updatedElements) {
            this.updatedElements();
        }
    }

    get element() { return this._element; }
    set element(value) { 
        if (value !== this._element) {
            this._element = value;
            this.handleElementCollectionChange();
        }
    }

    get collection() { return this._collection; }
    set collection(value) { 
        if (value !== this._collection) {
            this._collection = value; 
            this.handleElementCollectionChange();
        }
    }

    setElementAndCollection(element: HTMLElement | null, collection: ReadOnlyStdObservableCollection<KeyValuePair<any, ChannelMessageViewModel>> | null) {
        if (element !== this._element ||
            collection !== this._collection) {

            this._element = element;
            this._collection = collection;
            this.handleElementCollectionChange();
        }
    }

    private _lastHandledElementCollection: [HTMLElement, ReadOnlyStdObservableCollection<KeyValuePair<any, ChannelMessageViewModel>>] | null = null;
    private handleElementCollectionChange() {
        if (this.element && this.collection) {
            let needRefresh = false;
            if (this._lastHandledElementCollection) {
                if (this._lastHandledElementCollection[0] != this.element ||
                    this._lastHandledElementCollection[1] != this.collection) {
                    
                    needRefresh = true;
                }
            }
            else {
                needRefresh = true;
            }

            if (needRefresh) {
                this._lastHandledElementCollection = [this.element, this.collection];
                this.refreshBindings();
            }
        }
        else {
            if (this._lastHandledElementCollection) {
                this._lastHandledElementCollection = null;
                this.refreshBindings();
            }
        }
    }

    private readonly _previousCollObs = new DisposableOwnerField();
    private readonly _previousRenderDisposable = new DisposableOwnerField();

    private _lastRenderedElement: HTMLElement | null = null;
    private _performRenderHandle: IDisposable | null = null;
    private performRender() {
        if (this._performRenderHandle == null) {
            this._performRenderHandle = Scheduler.scheduleNamedCallback("ChannelStreamMessageViewRenderer.performRender", ["frame", "idle", 250], () => {
                this._performRenderHandle = null;
                const element = this.element;
                const collection = this.collection;

                let needEnd = false;
                try {
                    if (this._lastRenderedElement != element) {
                        if (element != null) {
                            this.onUpdatingElements();
                            needEnd = true;
                            const initVNode = <></>;
                            const target = document.createElement("span");
                            HTMLUtils.clearChildren(element);
                            element.appendChild(target);
                            this._currentVNode = this.patch(target, initVNode);
                        }
                        this._lastRenderedElement = element;
                    }
        
                    this._previousRenderDisposable.value = null;
                    if (element && collection) {

                        let renderResult!: [VNode, IDisposable];
                        const depSet = Observable.getDependenciesMonitor(() => {
                            renderResult = this.render(collection);
                        });
                        const depChangeListener = depSet.addChangeListener(() => {
                            this.performRender();
                        });
                        renderResult[1] = asNamedDisposable("ChannelStreamMessageViewRenderer_PreviousRenderDisposable", renderResult[1], depChangeListener, depSet);

                        this._previousRenderDisposable.value = renderResult[1];
                        if (!needEnd) {
                            this.onUpdatingElements();
                            needEnd = true;
                        }
                        this._currentVNode = this.patch(this._currentVNode, renderResult[0]);
                    }
                    else if (this._currentVNode) {
                        this._currentVNode = this.patch(this._currentVNode, <></>);
                    }
                }
                finally {
                    if (needEnd) {
                        this.onUpdatedElements();
                    }
                }
            });
        }
    }

    private refreshBindings() {
        const element = this.element;
        const collection = this.collection;

        this._previousCollObs.value = null;

        if (element && collection) {
            const collObs = collection?.addCollectionObserver(entries => {
                this.performRender();
            });
            this._previousCollObs.value = collObs;
        }
        
        this.performRender();
    }

    protected render(vm: ReadOnlyStdObservableCollection<KeyValuePair<any, ChannelMessageViewModel>> | null): [VNode, IDisposable] {
        if (!vm) { return [<></>, asDisposable()]; }

        const renderStyle = (vm.length > 0)
            ? (IterableUtils.asQueryable(vm.iterateValues()).first().value.channelViewModel?.messageDisplayStyle ?? ChannelMessageDisplayStyle.FCHAT)
            : ChannelMessageDisplayStyle.FCHAT;

        let renderer: MessageRenderer;
        switch (renderStyle) {
            default:
            case ChannelMessageDisplayStyle.FCHAT:
                renderer = new ChannelStreamMessageViewRendererFChat();
                break;
            case ChannelMessageDisplayStyle.DISCORD:
                renderer = new ChannelStreamMessageViewRendererDiscord();
                break;
        }

        const result = renderer.render(vm);
        return result;
    }
}

interface MessageRenderer {
    render(vm: ReadOnlyStdObservableCollection<KeyValuePair<any, ChannelMessageViewModel>>): [VNode, IDisposable];
}

class ChannelStreamMessageViewRendererFChat implements MessageRenderer {
    render(vm: ReadOnlyStdObservableCollection<KeyValuePair<any, ChannelMessageViewModel>>): [VNode, IDisposable] {
        const resultDisposables: IDisposable[] = [];

        const messageNodes: VNode[] = [];
        for (let kvp of vm.iterateValues()) {
            try {
                const mvm = kvp.value;
                const rmResult = this.renderMessage(vm, mvm);
                messageNodes.push(rmResult[0]);
                resultDisposables.push(rmResult[1]);
            }
            catch (e) {
                // TODO: write to error log
                messageNodes.push(<div>(A message could not be displayed)</div>);
            }
        }

        const resVNode = <>{messageNodes}</>;
        return [resVNode, asDisposable(...resultDisposables)];
    }

    protected renderMessage(vm: ReadOnlyStdObservableCollection<KeyValuePair<any, ChannelMessageViewModel>>, mvm: ChannelMessageViewModel): [VNode, IDisposable] {
        switch (mvm.type) {
            case ChannelMessageType.CHAT:
            case ChannelMessageType.AD:
            case ChannelMessageType.ROLL:
            case ChannelMessageType.SPIN:
            case ChannelMessageType.SYSTEM:
            case ChannelMessageType.SYSTEM_IMPORTANT:
                return this.renderStandardUserElement(mvm);
            case ChannelMessageType.LOG_NAV_PROMPT:
                return this.createLogNavUserElement(mvm);
            case ChannelMessageType.TYPING_STATUS_INDICATOR:
                return this.createTypingStatusElement(mvm);
        }
    }

    private renderStandardUserElement(vm: ChannelMessageViewModel): [VNode, IDisposable] {
        const resultDisposables: IDisposable[] = [];
        //let resultDisposable: IDisposable = EmptyDisposable;

        const locale = vm.appViewModel.locale;

        const mainClasses: string[] = [];

        const displayStyle = vm.channelViewModel?.messageDisplayStyle ?? ChannelMessageDisplayStyle.FCHAT;
        let isSystemMessage = vm.type == ChannelMessageType.SYSTEM || vm.type == ChannelMessageType.SYSTEM_IMPORTANT;

        const vmtext = vm.text ?? "<<XarChat warning: invalid message, no text available>>";

        let emoteStyle: ("none" | "normal" | "possessive") = "none";
        if (vm.type == ChannelMessageType.CHAT && vmtext.startsWith("/me ")) {
            emoteStyle = "normal";
        }
        else if (vm.type == ChannelMessageType.CHAT && vmtext.startsWith("/me's ")) {
            emoteStyle = "possessive";
        }

        let isImportant = vm.type == ChannelMessageType.SYSTEM_IMPORTANT;
        if (vm.type == ChannelMessageType.CHAT && vmtext.startsWith("/warn ")) {
            const isChanOp = vm.channelViewModel?.isEffectiveOp(vm.characterStatus.characterName) ?? false;
            if (isChanOp) {
                isImportant = true;
            }
        }

        let elIcon: VNode | null = null;
        if (displayStyle == ChannelMessageDisplayStyle.DISCORD) {
            elIcon = <img classList={["icon"]} attr-src={URLUtils.getAvatarImageUrl(vm.characterStatus.characterName)} />;
        }

        const vmtimestamp = vm.timestamp;
        let tsText: string;
        let copyText: string;
        try {
            copyText = "[" + ( areSameDate(new Date(), vmtimestamp)
                ? locale.getShortTimeString(vmtimestamp) /* dtf.format(vm.timestamp) */
                : locale.getNumericDateWithShortTimeString(vmtimestamp) /* dtfWithDate.format(vm.timestamp) */ ) + "]";
            if (displayStyle == ChannelMessageDisplayStyle.DISCORD) {
                tsText = 
                    areSameDate(new Date(), vmtimestamp) ? ("Today at " + locale.getShortTimeString(vmtimestamp) /* dtf.format(vm.timestamp) */)
                    : areSameDate(DateUtils.addMilliseconds(new Date(), TimeSpanUtils.fromDays(-1)), vmtimestamp) ? ("Yesterday at " +
                        locale.getShortTimeString(vmtimestamp) /* dtf.format(vm.timestamp) */ ) 
                    : (locale.getNumericDateString(vmtimestamp) /* dtfDate.format(vm.timestamp) */ + 
                        " at " + locale.getShortTimeString(vmtimestamp) /* dtf.format(vm.timestamp) */);
            }
            else {
                tsText = copyText;
            }
        }
        catch (e) {
            tsText = "(invalid timestamp)";
            copyText = "(invalid timestamp)";
        }
        
        const elTimestamp = <span classList={["timestamp"]} attrs={{
                "data-copycontent": `[sub]${copyText}[/sub]`
            }}>{tsText}</span>

        let elDiceIcon: VNode | null = null;
        if (vm.type == ChannelMessageType.ROLL) {
            elDiceIcon = <span classList={["dice-icon"]} attr-title="Dice Roll">{"\u{1F3B2} "}</span>;
        }
        else if (vm.type == ChannelMessageType.SPIN) {
            elDiceIcon = <span classList={["dice-icon"]} attr-title="Bottle Spin">{"\u{1F37E} "}</span>;
        }
        else if (vm.type == ChannelMessageType.CHAT && isImportant) {
            elDiceIcon = <span classList={["dice-icon"]} attr-title="Alert">{"\u{1F6D1} "}</span>;
        }
        else if (vm.type == ChannelMessageType.AD) {
            elDiceIcon = <span classList={["dice-icon"]} attr-title="Ad">{"\u{1F4E2} "}</span>;
        }

        let targetContainer: VNode[] = [];

        if (!isSystemMessage) {
            var sdVNode = StatusDotVNodeBuilder.getStatusDotVNode(vm.characterStatus);
            sdVNode.data ??= {};
            sdVNode.data.class ??= {};
            sdVNode.data.class["character-status"] = true;
            sdVNode.data.attrs ??= {};
            sdVNode.data.attrs["data-copycontent"] = "";
            targetContainer.push(sdVNode);

            targetContainer.push(<span classList={["character-status-spacer"]} attrs={{
                    "data-copycontent": ""
                }}>{" "}</span>);
        }

        const usernameClasses: string[] = [];
        usernameClasses.push("character");
        const usernameAttrs: { [key: string]: string } = {};

        let elUsername: VNode;
        if (!isSystemMessage) {
            elUsername = CharacterLinkUtils.createStaticCharacterLinkVNode(vm.activeLoginViewModel, vm.characterStatus.characterName, vm.characterStatus, vm.channelViewModel);
            elUsername.data ??= {};
            elUsername.data.attrs ??= {};
            elUsername.data.attrs["data-copycontent"] = `[user]${vm.characterStatus.characterName.value}[/user]`;
            elUsername.data.class ??= {};
            elUsername.data.class["character"] = true;
        }
        else {
            elUsername = <span classList={["character"]}>System</span>;
        }
        targetContainer.push(elUsername);


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
        targetContainer.push(<span classList={["character-spacer"]}>{spacerText}</span>);


        vm.incrementParsedTextUsage();
        resultDisposables.push(asDisposable(() => vm.decrementParsedTextUsage()));
        targetContainer.push(<span classList={["messagetext"]}>{vm.parseResult.asVNode()}</span>);

        const toggleMainClass = (name: string, shouldHave: boolean) => {
            if (shouldHave) {
                mainClasses.push(name);
            }
        };
        toggleMainClass("emote", (emoteStyle != "none"));
        toggleMainClass("ad", (vm.type == ChannelMessageType.AD));
        toggleMainClass("roll", (vm.type == ChannelMessageType.ROLL));
        toggleMainClass("spin", (vm.type == ChannelMessageType.SPIN));
        toggleMainClass("chat", (vm.type == ChannelMessageType.CHAT));
        toggleMainClass("system", isSystemMessage);
        toggleMainClass("important", isImportant);
        toggleMainClass("has-ping", vm.containsPing);
        toggleMainClass("from-me", CharacterName.equals(vm.characterStatus.characterName, vm.activeLoginViewModel.characterName));
        


        //if (displayStyle == ChannelMessageDisplayStyle.DISCORD && emoteStyle != "none") {
            const mcContent = targetContainer;
            targetContainer = [<span classList={[ "message-content" ]}>{mcContent}</span>];
        //}

        mainClasses.push("messageitem");
        mainClasses.push(`displaystyle-${displayStyle.toString().toLowerCase()}`);
        const innerNode = <div classList={mainClasses} props={{
                "__vm": vm
            }}>
            {elIcon}
            {elTimestamp}
            <span classList={["timestamp-spacer"]}>{" "}</span>
            {elDiceIcon}
            {targetContainer}
        </div>;

        const uniqueMessageId = vm.uniqueMessageId.toString();

        const messageContainerVNode = createMessageContainerVNode({ vm, innerNode });
        return [messageContainerVNode, asDisposable(...resultDisposables)];
    }

    private createLogNavUserElement(vm: ChannelMessageViewModel): [VNode, IDisposable] {
        let resultDisposables: IDisposable[] = [];

        vm.incrementParsedTextUsage();
        resultDisposables.push(asDisposable(() => vm.decrementParsedTextUsage()));

        const uniqueMessageId = vm.uniqueMessageId.toString();

        const innerNode = <div classList={["messageitem", "messageitem-lognav"]} on={{
                        "click": () => {
                            if (vm.onClick) {
                                vm.onClick();
                            }
                        }
                    }}>
                    <div classList={["lognavtext"]}>{vm.parseResult.asVNode()}</div>
                </div>;

        const messageContainerVNode = createMessageContainerVNode({ vm, innerNode });
        return [messageContainerVNode, asDisposable(...resultDisposables)];
    }

    private createTypingStatusElement(vm: ChannelMessageViewModel): [VNode, IDisposable] {
        const resultDisposables: IDisposable[] = [];

        vm.incrementParsedTextUsage();
        resultDisposables.push(asDisposable(() => vm.decrementParsedTextUsage()));

        const uniqueMessageId = vm.uniqueMessageId.toString();
        let resultEl = <div key={`msg-${uniqueMessageId}`} classList={["messageitem", "typingstatusindicator"]}>
            <span classList={["messagetext"]}>{vm.text != "" ? vm.parseResult.asVNode() : " "}</span>
        </div>;

        return [resultEl, asDisposable(...resultDisposables)];
    }
}

class ChannelStreamMessageViewRendererDiscord implements MessageRenderer {
    render(vm: ReadOnlyStdObservableCollection<KeyValuePair<any, ChannelMessageViewModel>>): [VNode, IDisposable] {
        const resultDisposables: IDisposable[] = [];

        let previousRMC: PreviousRenderedMessageContainer | null = null;
        const messageNodes: VNode[] = [];
        for (let kvp of vm.iterateValues()) {
            try {
                const mvm = kvp.value;
                const rmResult = this.renderMessage(vm, mvm, previousRMC);
                if (rmResult[0]) {
                    messageNodes.push(rmResult[0]);
                }
                resultDisposables.push(rmResult[1]);
                previousRMC = rmResult[2];
            }
            catch (e) {
                previousRMC = null;
                // TODO: write to error log
                messageNodes.push(<div>(A message could not be displayed)</div>);
            }
        }

        const resVNode = <>{messageNodes}</>;
        return [resVNode, asDisposable(...resultDisposables)];
    }

    protected renderMessage(
        vm: ReadOnlyStdObservableCollection<KeyValuePair<any, ChannelMessageViewModel>>,
        mvm: ChannelMessageViewModel, 
        previousRMC: PreviousRenderedMessageContainer | null): [VNode | null, IDisposable, PreviousRenderedMessageContainer | null] {

        let res: [VNode | null, IDisposable, PreviousRenderedMessageContainer | null];
        switch (mvm.type) {
            case ChannelMessageType.CHAT:
            case ChannelMessageType.AD:
            case ChannelMessageType.ROLL:
            case ChannelMessageType.SPIN:
            case ChannelMessageType.SYSTEM:
            case ChannelMessageType.SYSTEM_IMPORTANT:
                res = this.renderStandardUserElement(mvm, previousRMC);
                break;
            case ChannelMessageType.LOG_NAV_PROMPT:
                res = this.createLogNavUserElement(mvm, previousRMC);
                break;
            case ChannelMessageType.TYPING_STATUS_INDICATOR:
                res = this.createTypingStatusElement(mvm, previousRMC);
                break;
        }
        if (res[0]) {
            res[0].key = `msg-${mvm.uniqueMessageId}`;
        }
        return res;
    }

    private getTimestampDisplay(locale: LocaleViewModel, dt: Date) {
        const tsText = 
            areSameDate(new Date(), dt) ? ("Today at " + locale.getShortTimeString(dt) /* dtf.format(dt) */)
            : areSameDate(DateUtils.addMilliseconds(new Date(), TimeSpanUtils.fromDays(-1)), dt) ? ("Yesterday at " +
                locale.getShortTimeString(dt) /* dtf.format(dt) */) 
            : (locale.getNumericDateString(dt) /* dtfDate.format(dt) */ + " at " + 
                locale.getShortTimeString(dt) /* dtf.format(dt) */);
        return tsText;
    }

    private renderStandardUserElement(vm: ChannelMessageViewModel, previousRMC: PreviousRenderedMessageContainer | null): [VNode | null, IDisposable, PreviousRenderedMessageContainer | null] {
        const resultDisposables: IDisposable[] = [];

        const uniqueMessageId = vm.uniqueMessageId.toString();

        const locale = vm.appViewModel.locale;

        let isImportant = vm.type == ChannelMessageType.SYSTEM_IMPORTANT;
        if (vm.type == ChannelMessageType.CHAT && vm.text.startsWith("/warn ")) {
            const isChanOp = vm.channelViewModel?.isEffectiveOp(vm.characterStatus.characterName) ?? false;
            if (isChanOp) {
                isImportant = true;
            }
        }

        const canIncludeInPrevious =
            !isImportant
            && (vm.type == ChannelMessageType.CHAT)
            && previousRMC != null
            && CharacterName.equals(previousRMC.speakingCharacterName, vm.characterStatus.characterName)
            && this.areWithinMessageCombineInterval(previousRMC.lastTimestamp, vm.timestamp);
        const canIncludeSubsequent = 
            !isImportant
            && (vm.type == ChannelMessageType.CHAT);

        const rbody = this.renderStandardUserElementBody(vm, resultDisposables, canIncludeInPrevious ? previousRMC : null);

        if (canIncludeInPrevious) {
            previousRMC!.appendMessageContent(rbody);
            return [null, asDisposable(...resultDisposables), { ...previousRMC, lastTimestamp: vm.timestamp }];
        }
        else {
            const elIcon = <img key={`msg-${uniqueMessageId}-icon`} classList={["icon"]} attr-src={URLUtils.getAvatarImageUrl(vm.characterStatus.characterName)} attrs={{
                    "data-copycontent": ""
                }} />;

            const vmtimestamp = vm.timestamp;
            let copyText: string;
            let tsText: string;
            try {
                copyText = "[" + ( areSameDate(new Date(), vm.timestamp) 
                    ? locale.getShortTimeString(vm.timestamp) /* dtf.format(vm.timestamp) */
                    : locale.getNumericDateWithShortTimeString(vm.timestamp) /* dtfWithDate.format(vm.timestamp) */ ) + "]";
                tsText = this.getTimestampDisplay(locale, vm.timestamp);
            }
            catch (e) {
                copyText = "(invalid timestamp)";
                tsText = "(invalid timestamp)";
            }
            const elTimestamp = <span key={`msg-${uniqueMessageId}-timestamp`} classList={["timestamp"]} attrs={{
                    "data-copycontent": ""
                }}>{tsText}</span>

            let elDiceIcon: VNode | null = null;
            if (vm.type == ChannelMessageType.ROLL) {
                //elDiceIcon = <span classList={["dice-icon"]} attrs={{"data-copycontent":""}}>{"\u{1F3B2} "}</span>;
            }
            else if (vm.type == ChannelMessageType.SPIN) {
                //elDiceIcon = <span classList={["dice-icon"]} attrs={{"data-copycontent":""}}>{"\u{1F37E} "}</span>;
            }
            else if (vm.type == ChannelMessageType.CHAT && isImportant) {
                elDiceIcon = <span key={`msg-${uniqueMessageId}-diceicon`} classList={["dice-icon"]} attr-title="Alert" attrs={{"data-copycontent":""}}>{"\u{1F6D1} "}</span>;
            }
            else if (vm.type == ChannelMessageType.AD) {
                elDiceIcon = <span key={`msg-${uniqueMessageId}-diceicon`} classList={["dice-icon"]} attr-title="Ad" attrs={{"data-copycontent":""}}>{"\u{1F4E2} "}</span>;
            }

            const msgContainer = <div classList={[ "message-content-container" ]} attrs={{"data-copyinline": "true"}}>{rbody}</div>;

            let emoteStyle: ("none" | "normal" | "possessive") = "none";
            if (vm.type == ChannelMessageType.CHAT && vm.text.startsWith("/me ")) {
                emoteStyle = "normal";
            }
            else if (vm.type == ChannelMessageType.CHAT && vm.text.startsWith("/me's ")) {
                emoteStyle = "possessive";
            }

            const shouldShowUsername = (emoteStyle == "none") && (vm.type != ChannelMessageType.ROLL) && (vm.type != ChannelMessageType.SPIN);

            let elUsername: VNode;
            if (vm.characterStatus.characterName != CharacterName.SYSTEM) {
                if (shouldShowUsername) {
                    elUsername = CharacterLinkUtils.createStaticCharacterLinkVNode(vm.activeLoginViewModel, vm.characterStatus.characterName, vm.characterStatus, vm.channelViewModel);
                    elUsername.key = `msg-${uniqueMessageId}-elUsername`
                    elUsername.data ??= {};
                    elUsername.data.class ??= {};
                    elUsername.data.class["character"] = true;

                    const sdVNode = StatusDotVNodeBuilder.getStatusDotVNode(vm.characterStatus);
                    sdVNode.key = `msg-${uniqueMessageId}-sdVNode`
                    sdVNode.data ??= {};
                    sdVNode.data.class ??= {};
                    sdVNode.data.class["character-status"] = true;
                    
                    elUsername = <span key={`msg-${uniqueMessageId}-charcontainer`} classList={["character-container"]} attrs={{"data-copycontent":""}}>{sdVNode}{elUsername}</span>;
                }
                else {
                    elUsername = <></>;
                }
            }
            else {
                elUsername = <span key={`msg-${uniqueMessageId}-charcontainer`} classList={["character-container", "is-system"]} attrs={{"data-copycontent":""}}>System</span>;
            }

            const innerNode = <div key={`msg-${uniqueMessageId}-innerNode`} classList={[ "messageitem", "displaystyle-discordn" ]} attrs={{
                    "data-copyinline": "true"
                }} props={{
                    "__vm": vm
                }}>
                {elIcon}
                {elUsername}
                {elTimestamp}
                {elDiceIcon}
                {msgContainer}
            </div>;

            const collapseAds = vm.type == ChannelMessageType.AD && (vm.channelViewModel?.getConfigSettingById("collapseAds") ?? false);

            const messageContainerVNode = createMessageContainerVNode({ vm, innerNode });
            return [ 
                messageContainerVNode, 
                asDisposable(...resultDisposables), 
                collapseAds 
                    ? null
                    : canIncludeSubsequent
                        ? {
                            speakingCharacterName: vm.characterStatus.characterName,
                            appendMessageContent: (vnode: VNode) => {
                                msgContainer.children!.push(vnode);
                            },
                            lastTimestamp: vm.timestamp
                        } 
                        : null
            ];
        }
    }
    areWithinMessageCombineInterval(a: Date, b: Date) {
        const diffMs = Math.abs(a.getTime() - b.getTime());
        return diffMs < TimeSpanUtils.fromMinutes(2);
    }

    private renderStandardUserElementBody(vm: ChannelMessageViewModel, resultDisposables: IDisposable[], previousRMC: PreviousRenderedMessageContainer | null): VNode {
        const mainClasses: string[] = [];

        const locale = vm.appViewModel.locale;

        let isSystemMessage = vm.type == ChannelMessageType.SYSTEM || vm.type == ChannelMessageType.SYSTEM_IMPORTANT;

        const vmtext = vm.text ?? "<<XarChat warning: invalid message text>>";

        let emoteStyle: ("none" | "normal" | "possessive") = "none";
        if (vm.type == ChannelMessageType.CHAT && vmtext.startsWith("/me ")) {
            emoteStyle = "normal";
        }
        else if (vm.type == ChannelMessageType.CHAT && vmtext.startsWith("/me's ")) {
            emoteStyle = "possessive";
        }

        let isImportant = vm.type == ChannelMessageType.SYSTEM_IMPORTANT;
        if (vm.type == ChannelMessageType.CHAT && vmtext.startsWith("/warn ")) {
            const isChanOp = vm.channelViewModel?.isEffectiveOp(vm.characterStatus.characterName) ?? false;
            if (isChanOp) {
                isImportant = true;
            }
        }

        let elDiceIcon: VNode | null = null;
        let elDiceText: string = "";
        let elDiceTextTitle: string = "";
        if (vm.type == ChannelMessageType.ROLL) {
            elDiceText = "\u{1F3B2} ";
            elDiceTextTitle = "Dice Roll";
        }
        else if (vm.type == ChannelMessageType.SPIN) {
            elDiceText = "\u{1F37E} ";
            elDiceTextTitle = "Bottle Spin";
        }
        else if (vm.type == ChannelMessageType.CHAT && isImportant) {
            elDiceText = "\u{1F6D1} ";
            elDiceTextTitle = "Alert";
        }
        else if (vm.type == ChannelMessageType.AD) {
            elDiceText = "\u{1F4E2} ";
            elDiceTextTitle = "Ad";
        }
        if (elDiceText != "") {
            elDiceIcon = <span classList={["dice-icon"]} attr-title={elDiceTextTitle} attrs={{"data-copycontent":""}}>{elDiceText}</span>;
        }

        let targetContainer: VNode[] = [];

        if (elDiceIcon && (vm.type == ChannelMessageType.ROLL || vm.type == ChannelMessageType.SPIN)) {
            targetContainer.push(elDiceIcon);
        }

        if (!isSystemMessage) {
            var sdVNode = StatusDotVNodeBuilder.getStatusDotVNode(vm.characterStatus);
            sdVNode.data ??= {};
            sdVNode.data.class ??= {};
            sdVNode.data.class["character-status"] = true;
            sdVNode.data.attrs ??= {};
            sdVNode.data.attrs["data-copycontent"] = "";
            targetContainer.push(sdVNode);

            targetContainer.push(<span classList={["character-status-spacer"]} attrs={{
                    "data-copycontent": ""
                }}>{" "}</span>);
        }

        let elUsername: VNode;
        if (!isSystemMessage) {
            elUsername = CharacterLinkUtils.createStaticCharacterLinkVNode(vm.activeLoginViewModel, vm.characterStatus.characterName, vm.characterStatus, vm.channelViewModel);
            elUsername.data ??= {};
            elUsername.data.attrs ??= {};
            elUsername.data.attrs["data-copycontent"] = "";
            elUsername.data.class ??= {};
            elUsername.data.class["character"] = true;
        }
        else {
            elUsername = <span classList={["character"]} attrs={{"data-copycontent":""}}>System</span>;
        }
        targetContainer.push(elUsername);

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
        targetContainer.push(<span classList={["character-spacer"]} attrs={{"data-copycontent":""}}>{spacerText}</span>);

        vm.incrementParsedTextUsage();
        resultDisposables.push(asDisposable(() => vm.decrementParsedTextUsage()));
        targetContainer.push(<span classList={["messagetext"]}>{vm.parseResult.asVNode()}</span>);

        const toggleMainClass = (name: string, shouldHave: boolean) => {
            if (shouldHave) {
                mainClasses.push(name);
            }
        };
        toggleMainClass("emote", (emoteStyle != "none"));
        toggleMainClass("ad", (vm.type == ChannelMessageType.AD));
        toggleMainClass("roll", (vm.type == ChannelMessageType.ROLL));
        toggleMainClass("spin", (vm.type == ChannelMessageType.SPIN));
        toggleMainClass("chat", (vm.type == ChannelMessageType.CHAT));
        toggleMainClass("system", isSystemMessage);
        toggleMainClass("important", isImportant);
        toggleMainClass("has-ping", vm.containsPing);
        toggleMainClass("from-me", CharacterName.equals(vm.characterStatus.characterName, vm.activeLoginViewModel.characterName));

        const copyPrefix: string[] = [];

        let timestampCopyText: string;
        try {
            timestampCopyText = "[" + ( areSameDate(new Date(), vm.timestamp) 
                ? locale.getShortTimeString(vm.timestamp) /* dtf.format(vm.timestamp) */
                : locale.getNumericDateWithShortTimeString(vm.timestamp) /* dtfWithDate.format(vm.timestamp) */ ) + "]";
        }
        catch (e) {
            timestampCopyText = "[(invalid timestamp)]";
        }
        copyPrefix.push("[sub]");
        copyPrefix.push(timestampCopyText);
        copyPrefix.push("[/sub] ");
        copyPrefix.push(elDiceText);
        copyPrefix.push("[user]");
        copyPrefix.push(vm.characterStatus.characterName.value);
        copyPrefix.push("[/user]");
        copyPrefix.push(spacerText);

        let timestampHintNode: VNode | null = null;
        if (previousRMC != null) {
            // const prevTSStr = this.getTimestampDisplay(previousRMC.lastTimestamp);
            // const thisTSStr = this.getTimestampDisplay(vm.timestamp);
            // if (thisTSStr != prevTSStr) {
            //     timestampHintNode = <div classList={[ "timestamp" ]} attrs={{ "data-copycontent": "" }}>{thisTSStr}</div>;
            // }
        }

        return <div classList={[ "message-content", ...mainClasses ]}>{timestampHintNode}<span classList={["header-info"]}>{copyPrefix.join("")}</span>{targetContainer}</div>;
    }

    private createLogNavUserElement(vm: ChannelMessageViewModel, previousRMC: PreviousRenderedMessageContainer | null): [VNode, IDisposable, PreviousRenderedMessageContainer | null] {
        let resultDisposables: IDisposable[] = [];

        vm.incrementParsedTextUsage();
        resultDisposables.push(asDisposable(() => vm.decrementParsedTextUsage()));

        const uniqueMessageId = vm.uniqueMessageId.toString();

        const innerNode = <div classList={["messageitem", "messageitem-lognav"]} on={{
                        "click": () => {
                            if (vm.onClick) {
                                vm.onClick();
                            }
                        }
                    }}>
                    <div classList={["lognavtext"]}>{vm.parseResult.asVNode()}</div>
                </div>;

        const messageContainerVNode = createMessageContainerVNode({ vm, innerNode });
        return [messageContainerVNode, asDisposable(...resultDisposables), null];
    }

    private createTypingStatusElement(vm: ChannelMessageViewModel, previousRMC: PreviousRenderedMessageContainer | null): [VNode, IDisposable, PreviousRenderedMessageContainer | null] {
        const resultDisposables: IDisposable[] = [];

        vm.incrementParsedTextUsage();
        resultDisposables.push(asDisposable(() => vm.decrementParsedTextUsage()));

        const uniqueMessageId = vm.uniqueMessageId.toString();
        let resultEl = <div key={`msg-${uniqueMessageId}`} classList={["messageitem", "typingstatusindicator"]}>
            <span classList={["messagetext"]}>{vm.text != "" ? vm.parseResult.asVNode() : " "}</span>
        </div>;

        return [resultEl, asDisposable(...resultDisposables), null];
    }
}

interface PreviousRenderedMessageContainer {
    speakingCharacterName: CharacterName;
    appendMessageContent: (vnode: VNode) => void;
    lastTimestamp: Date;
}