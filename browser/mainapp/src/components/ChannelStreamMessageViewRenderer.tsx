import { CharacterGenderConvert } from "../shared/CharacterGender";
import { CharacterName } from "../shared/CharacterName";
import { jsx, Fragment, VNode, init, propsModule, styleModule, eventListenersModule } from "../snabbdom/index";
import { CharacterLinkUtils } from "../util/CharacterLinkUtils";
import { KeyValuePair } from "../util/collections/KeyValuePair";
import { ReadOnlyStdObservableCollection } from "../util/collections/ReadOnlyStdObservableCollection";
import { asDisposable, IDisposable } from "../util/Disposable";
import { HTMLUtils } from "../util/HTMLUtils";
import { Observable } from "../util/Observable";
import { ObservableExpression } from "../util/ObservableExpression";
import { classListNewModule } from "../util/snabbdom/classList-new";
import { rawAttributesModule } from "../util/snabbdom/rawAttributes";
import { valueSyncModule } from "../util/snabbdom/valueSyncHook";
import { URLUtils } from "../util/URLUtils";
import { ChannelMessageDisplayStyle, ChannelMessageType, ChannelMessageViewModel } from "../viewmodel/ChannelViewModel";
import { RenderingComponentBase } from "./RenderingComponentBase";
import { StatusDotVNodeBuilder } from "./StatusDot";

const dtf = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const dtfDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'numeric', year: 'numeric' });
const dtfWithDate = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });

function areSameDate(a: Date, b: Date) {
    const aDate = a.getFullYear().toString() + '-' + a.getMonth().toString() + '-' + a.getDate().toString();
    const bDate = b.getFullYear().toString() + '-' + b.getMonth().toString() + '-' + b.getDate().toString();
    return (aDate == bDate);
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

    private _previousCollObs: IDisposable | null = null;
    private _previousRenderDisposable: IDisposable | null = null;

    private disposePreviousRender() {
        if (this._previousRenderDisposable) {
            this._previousRenderDisposable.dispose();
            this._previousRenderDisposable = null;
        }
    }

    private _lastRenderedElement: HTMLElement | null = null;
    private _performRenderHandle: number | null = null;
    private performRender() {
        if (this._performRenderHandle == null) {
            this._performRenderHandle = window.requestAnimationFrame(() => {
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
        
                    this.disposePreviousRender();
                    if (element && collection) {

                        let renderResult!: [VNode, IDisposable];
                        const depSet = Observable.getDependenciesMonitor(() => {
                            renderResult = this.render(collection);
                        });
                        const depChangeListener = depSet.addChangeListener(() => {
                            this.performRender();
                        });
                        renderResult[1] = asDisposable(renderResult[1], depChangeListener, depSet);

                        this._previousRenderDisposable = renderResult[1];
                        if (!needEnd) {
                            this.onUpdatingElements();
                            needEnd = true;
                        }
                        this._currentVNode = this.patch(this._currentVNode, renderResult[0]);
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

        if (this._previousCollObs) {
            this._previousCollObs.dispose();
            this._previousCollObs = null;
        }

        if (element && collection) {
            const collObs = collection?.addCollectionObserver(entries => {
                this.performRender();
            });
            this._previousCollObs = collObs;
        }
        
        this.performRender();
    }

    protected render(vm: ReadOnlyStdObservableCollection<KeyValuePair<any, ChannelMessageViewModel>> | null): [VNode, IDisposable] {
        if (!vm) { return [<></>, asDisposable()]; }

        const resultDisposables: IDisposable[] = [];

        const messageNodes: VNode[] = [];
        for (let kvp of vm.iterateValues()) {
            const mvm = kvp.value;
            const rmResult = this.renderMessage(vm, mvm);
            messageNodes.push(rmResult[0]);
            resultDisposables.push(rmResult[1]);
        }

        const resVNode = <>{messageNodes}</>;
        return [resVNode, asDisposable(...resultDisposables)];
    }

    renderMessage(vm: ReadOnlyStdObservableCollection<KeyValuePair<any, ChannelMessageViewModel>>, mvm: ChannelMessageViewModel): [VNode, IDisposable] {
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

        const mainClasses: string[] = [];

        const displayStyle = vm.channelViewModel?.messageDisplayStyle ?? ChannelMessageDisplayStyle.FCHAT;
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
            const isChanOp = vm.channelViewModel?.isEffectiveOp(vm.characterStatus.characterName) ?? false;
            if (isChanOp) {
                isImportant = true;
            }
        }

        let elIcon: VNode | null = null;
        if (displayStyle == ChannelMessageDisplayStyle.DISCORD) {
            elIcon = <img classList={["icon"]} attr-src={URLUtils.getAvatarImageUrl(vm.characterStatus.characterName)} />;
        }

        let tsText: string;
        let copyText: string = "[" + ( areSameDate(new Date(), vm.timestamp) ? dtf.format(vm.timestamp) : dtfWithDate.format(vm.timestamp) ) + "]";
        if (displayStyle == ChannelMessageDisplayStyle.DISCORD) {
            tsText = ( areSameDate(new Date(), vm.timestamp) ? ("Today at " + dtf.format(vm.timestamp)) : (dtfDate.format(vm.timestamp) + " at " + dtf.format(vm.timestamp)) )
        }
        else {
            tsText = copyText;
        }
        const elTimestamp = <span classList={["timestamp"]} attrs={{
                "data-copycontent": `[sub]${copyText}[/sub]`
            }}>{tsText}</span>

        let elDiceIcon: VNode | null = null;
        if (vm.type == ChannelMessageType.ROLL) {
            elDiceIcon = <span classList={["dice-icon"]}>{"\u{1F3B2} "}</span>;
        }
        else if (vm.type == ChannelMessageType.SPIN) {
            elDiceIcon = <span classList={["dice-icon"]}>{"\u{1F37E} "}</span>;
        }
        else if (vm.type == ChannelMessageType.CHAT && isImportant) {
            elDiceIcon = <span classList={["dice-icon"]}>{"\u{1F6D1} "}</span>;
        }
        else if (vm.type == ChannelMessageType.AD) {
            elDiceIcon = <span classList={["dice-icon"]}>{"\u{1F4E2} "}</span>;
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

        const collapseAds = vm.type == ChannelMessageType.AD && (vm.channelViewModel?.getConfigSettingById("collapseAds") ?? false);
        if (collapseAds) {
            const collapseHostStyles: string[] = [];
            let collapseBtnEl: VNode;
            if (vm.isOversized) {
                collapseHostStyles.push("is-oversized");
                if (vm.collapsed) {
                    collapseHostStyles.push("collapsed");
                    collapseBtnEl = <div classList={["collapse-button-container"]} attrs={{
                            "data-copycontent": ""
                        }}><button classList={["collapse-button"]} attrs={{
                            "data-copycontent": "",
                            "data-iscollapsebutton": "true"
                        }} on={{
                            "click": () => {
                                vm.collapsed = false;
                            }
                        }}>Expand</button></div>;  
                }
                else {
                    collapseHostStyles.push("expanded");
                    collapseBtnEl = <div classList={["collapse-button-container"]} attrs={{
                            "data-copycontent": ""
                        }}><button classList={["collapse-button"]} attrs={{
                            "data-copycontent": "",
                            "data-iscollapsebutton": "true"
                        }} on={{
                            "click": () => {
                                vm.collapsed = true;
                            }
                        }}>Collapse</button></div>;  
                }
            }
            else {
                collapseHostStyles.push("collapsed");
                collapseBtnEl = <div classList={["collapse-button-container"]} attrs={{
                    "data-copycontent": ""
                }}><button classList={["collapse-button"]} attrs={{
                    "data-copycontent": "",
                    "data-iscollapsebutton": "true"
                }}>Expand</button></div>;  
            }

            let outerEl = <div key={`msg-${uniqueMessageId}`} classList={["collapse-host", "collapsible", ...collapseHostStyles]} attrs={{
                    "data-messageid": uniqueMessageId,
                    "data-copyinline": "true"
                }}>{collapseBtnEl}{innerNode}</div>;
            return [outerEl, asDisposable(...resultDisposables)];
            // TODO: AdCollapseManager.add(vm, outerEl, elMain);
        }
        else {
            let outerEl = <div key={`msg-${uniqueMessageId}`} classList={["collapse-host"]} attrs={{
                    "data-messageid": uniqueMessageId,
                    "data-copyinline": "true"
                }}>{innerNode}</div>;
            return [outerEl, asDisposable(...resultDisposables)];
        }
    }

    private createLogNavUserElement(vm: ChannelMessageViewModel): [VNode, IDisposable] {
        let resultDisposables: IDisposable[] = [];

        vm.incrementParsedTextUsage();
        resultDisposables.push(asDisposable(() => vm.decrementParsedTextUsage()));

        const uniqueMessageId = vm.uniqueMessageId.toString();

        let resultEl = <div key={`msg-${uniqueMessageId}`} classList={["collapse-host"]} attrs={{
                "data-messageid": vm.uniqueMessageId.toString(),
                "data-copyinline": "true"
            }}>
                <div classList={["messageitem", "messageitem-lognav"]} on={{
                        "click": () => {
                            if (vm.onClick) {
                                vm.onClick();
                            }
                        }
                    }}>
                    <div classList={["lognavtext"]}>{vm.parseResult.asVNode()}</div>
                </div>
            </div>;

        return [resultEl, asDisposable(...resultDisposables)];
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