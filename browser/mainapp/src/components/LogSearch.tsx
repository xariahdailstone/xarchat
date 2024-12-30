import { AppViewModel } from "../viewmodel/AppViewModel";
import { ExtendSearchResultItem, LogSearchResultItem, LogSearchViewModel, LoggedMessagesSearchResultItem, PleaseWaitSearchResultItem, PromptForParametersSearchResultItem, ScrollToCommand } from "../viewmodel/LogSearchViewModel";
import { ComponentBase, componentElement } from "./ComponentBase";
import { RenderingComponentBase } from "./RenderingComponentBase";
import { Fragment, jsx, VNode } from "../snabbdom/index.js";
import { IDisposable, asDisposable } from "../util/Disposable.js";
import { stageViewFor } from "./Stage";
import { DateAnchor, LogSearchKind } from "../util/HostInteropLogSearch";
import { CollectionViewLightweight } from "./CollectionViewLightweight";
import { EL } from "../util/EL";
import { ChannelMessageCollectionView, DefaultStreamScrollManager } from "./ChannelStream";
import { ScrollAnchorTo } from "../util/ScrollAnchorTo";
import { TextboxBinding } from "../util/bindings/TextboxBinding";
import { getMappedValueReference, getValueReference } from "../util/ValueReference";
import { CharacterName } from "../shared/CharacterName";

@componentElement("x-logsearch")
@stageViewFor(LogSearchViewModel)
export class LogSearch extends RenderingComponentBase<LogSearchViewModel> {
    constructor() {
        super();

        this.watchExpr(vm => vm.scrollToCommand, stc => {
            this.setScrollToCommand(stc ?? null);
            if (stc && this.viewModel) {
                this.viewModel.scrollToCommand = null;
            }
        });
        this.watchExpr(vm => vm.scrollAnchorTo, sat => {
            const elCollectionView = this.$("elCollectionView") as (LogSearchResultItemCollectionView | null);
            if (elCollectionView) {
                elCollectionView.scrollAnchorTo = sat ?? null;
            }
        });
        this.watchExpr(vm => vm.updatingElements, ue => {
            const elCollectionView = this.$("elCollectionView") as (LogSearchResultItemCollectionView | null);
            if (elCollectionView) {
                this.logger.logInfo("LogSearch updatingElements", ue);
                elCollectionView.updatingElements = ue ?? false;
            }
        });
    }

    private _storedScrollToCommand: ScrollToCommand | null = null;
    private _scrollToHandle: number | null = null;

    private setScrollToCommand(stc: ScrollToCommand | null) {
        if (stc != null) {
            this._storedScrollToCommand = stc;
            if (this._scrollToHandle == null) {
                this._scrollToHandle = window.requestAnimationFrame(() => {
                    this._scrollToHandle = null;
                    this.executeScrollToCommand();
                });
            }
        }
    }

    private executeScrollToCommand() {
        const stc = this._storedScrollToCommand;
        if (stc) {
            const elCollectionView = this.$("elCollectionView") as LogSearchResultItemCollectionView | null;
            if (elCollectionView && elCollectionView.isConnected) {
                this._storedScrollToCommand = null;

                let el = elCollectionView.getElementForViewModel(stc.targetResultItem) as HTMLElement | null;
                if (el) {
                    if (el instanceof ChannelMessageCollectionView) {
                        el = el.firstElementChild as HTMLElement | null;
                    }
                    if (el) {
                        const sblock = stc.scrollTo == "top" ? "start" : "end";
                        this.logger.logInfo("el.scrollIntoView", el, `block=${sblock}`);
                        el.scrollIntoView({
                            behavior: stc.behavior,
                            block: sblock
                        });
                    }
                }
            }
        }
    }

    render(): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        if (!vm) { return <div class={{ "logsearchui": true }}></div>; }

        const isChannelSearch = vm.searchKind == LogSearchKind.Channels;
        const isPMConvoSearch = vm.searchKind == LogSearchKind.PrivateMessages;

        const el = 
            <div class={{ "logsearchui": true }}>
                <div class={{ "devalert": true }}>
                    This tool is still in development!  Do not expect it to work properly!
                </div>
                <div class={{ "searchforbar": true }}>
                    <div class={{ "searchforbar-logsforlabel": true }}>Logs for</div>
                    <input attr-type="text" class={{ "searchforbar-logsforfield": true, "theme-textbox": true }}
                        id="elLogsFor" attr-readonly="readonly" />

                    <select class={{ "searchforbar-timeanchorfield": true, "theme-select": true }} id="elTimeAnchorType" on={{
                            "change": (e) => vm.dateAnchor = (e.target as HTMLSelectElement).value as DateAnchor
                        }}>
                        <option attr-value={DateAnchor.Before}>Before</option>
                        <option attr-value={DateAnchor.After}>After</option>
                    </select>
                    <input attr-type="datetime-local" class={{ "searchforbar-timeanchordate": true, "theme-textbox": true }} id="elTimeAnchorDate" />
                </div>

                <div class={{ "searchkindbar": true, "pmconvo": isPMConvoSearch, "channel": isChannelSearch }}>
                    <div class={{ "searchkindbar-kindlabel": true }}>View</div>
                    <select class={{ "searchkindbar-kindfield": true, "theme-select": true }} id="elSearchKind" on={{
                            "change": (e) => vm.searchKind = (e.target as HTMLSelectElement).value as LogSearchKind
                        }} attr-value={vm.searchKind}>
                        <option attr-value={LogSearchKind.PrivateMessages}>Private Messages</option>
                        <option attr-value={LogSearchKind.Channels}>Channel</option>
                    </select>

                    <div class={{ "searchkindbar-kindargs-pmconvo": true }}>
                        <div class={{ "searchkindbar-characterlabel": true }}>with</div>
                        <input attr-type="text" class={{ "searchkindbar-characterfield": true, "theme-textbox": true }} id="elConvoCharacter" />
                    </div>

                    <div class={{ "searchkindbar-kindargs-channel": true }}>
                        <input attr-type="text" class={{ "searchkindbar-channelfield": true, "theme-textbox": true }} id="elChannel"  />
                    </div>
                </div>

                <div class={{ "searchsubmitbar": true }}>
                    <button class={{ "theme-button": true, "searchsubmitbar-submit": true }} props={{
                            "disabled": !vm.canSearch
                        }} id="elSubmitSearch">Search</button>
                </div>

                <x-logsearchresultitemcollectionview attr-modelpath="results" id="elCollectionView" on={{
                        "updatedelements": (e: Event) => { this.executeScrollToCommand(); },
                        "connectedtodocument": (e: Event) => { this.executeScrollToCommand(); }
                    }}>
                    <div classList="logsearchresultmessagecontainer" id="elMessageContainer">
                    </div>
                </x-logsearchresultitemcollectionview>
            </div>;

        return el;
    }

    protected override *afterRender(): Iterable<IDisposable> {
        if (this.viewModel) {
            const vm = this.viewModel;

            const elLogsFor = this.$("elLogsFor") as (HTMLInputElement | null);
            if (elLogsFor) {
                yield new TextboxBinding(elLogsFor, getMappedValueReference(vm, "logsFor",
                    (x) => x.value,
                    (x) => CharacterName.create(x)
                ));
            }

            const elConvoCharacter = this.$("elConvoCharacter") as (HTMLInputElement | null);
            if (elConvoCharacter) {
                yield new TextboxBinding(elConvoCharacter, getValueReference(this.viewModel, "searchText"));
            }

            const elChannel = this.$("elChannel") as (HTMLInputElement | null);
            if (elChannel) {
                yield new TextboxBinding(elChannel, getValueReference(this.viewModel, "searchText"));
            }
        }
    }

    protected get myRequiredStylesheets() {
        return [ 
            ...super.myRequiredStylesheets,
            `styles/components/ChannelMessageCollectionView-import.css`
        ];
    }
}

@componentElement("x-logsearchresultitemcollectionview")
class LogSearchResultItemCollectionView extends CollectionViewLightweight<LogSearchResultItem> {

    scrollAnchorTo: ScrollAnchorTo | null = null;

    constructor() {
        super();

        let savedScrollPos: number | null = null

        const completeElementUpdate = () => {
            if (this.updatingElements) { this.logger.logDebug("early exit, updatingElements"); return; }

            const ssp = savedScrollPos;
            const sat = this.scrollAnchorTo;
            window.requestAnimationFrame(() => {
                const containerElement = this.containerElement;
                if (containerElement != null && ssp != null) {
                    switch (sat) {
                        case ScrollAnchorTo.BOTTOM:
                            // const scrollHandler = (e: Event) => { 
                                this.logger.logDebug("restoring scroll (ssp)...", ssp);
                                this.logger.logDebug("restoring scrolltop scrollTop...", containerElement.scrollTop);
                                this.logger.logDebug("restoring scrolltop scrollheight...", containerElement.scrollHeight);
                                const newScrollTop = containerElement.scrollHeight - ssp;
                                this.logger.logDebug("restoring scrolltop newScrollTop...", newScrollTop);
                                containerElement.scroll(0, newScrollTop);
                            // };
                            // containerElement.addEventListener("scroll", scrollHandler);
                            // window.setTimeout(() => { 
                            //     containerElement.removeEventListener("scroll", scrollHandler);
                            // }, 100);
                            break;
                        case ScrollAnchorTo.TOP:
                        default:
                            break;
                    }
                }
            });
            savedScrollPos = null;
        };

        this.addEventListener("updatingelements", () => {
            this.logger.logDebug("updating elements...");

            if (savedScrollPos != null) { return; }

            const containerElement = this.containerElement;
            if (containerElement) {
                switch (this.scrollAnchorTo) {
                    case ScrollAnchorTo.BOTTOM:
                        savedScrollPos = containerElement.scrollHeight - containerElement.scrollTop;
                        this.logger.logDebug("saving containerElement.scrollTop", containerElement.scrollTop);
                        this.logger.logDebug("saving containerElement.scrollHeight", containerElement.scrollHeight);
                        this.logger.logDebug("saving savedScrollPos (pos from bottom)", savedScrollPos);
                        break;
                    case ScrollAnchorTo.TOP:
                    default:
                        savedScrollPos = null;
                        break;
                }
            }
            else {
                savedScrollPos = null;
            }
        });
        this.addEventListener("updatedelements", () => { this.logger.logDebug("updated elements..."); completeElementUpdate(); });
        this._onUpdatedElements = () => { this.logger.logDebug("onupdatedelements...", this.updatingElements); completeElementUpdate(); };
    }

    private _onUpdatedElements: () => void;
    private _updatingElements: boolean = false;
    get updatingElements() { return this._updatingElements; }
    set updatingElements(value: boolean) {
        if (value != this._updatingElements) {
            this._updatingElements = value;
            this._onUpdatedElements();
        }
    }

    createUserElement(vm: LogSearchResultItem): HTMLElement | [HTMLElement, IDisposable] {
        if (vm instanceof PromptForParametersSearchResultItem) {
            return this.createPromptForParametersSearchResultItemUserElement(vm);
        }
        else if (vm instanceof LoggedMessagesSearchResultItem) {
            return this.createLoggedMessagesSearchResultItemUserElement(vm);
        }
        else if (vm instanceof PleaseWaitSearchResultItem) {
            return this.createPleaseWaitSearchResultItemUserElement(vm);
        }
        else if (vm instanceof ExtendSearchResultItem) {
            return this.createExtendSearchResultItemUserElement(vm);
        }
        else {
            const el = EL("div", { "class": "resultitem-unknowntype" }, [
            ]);
            (el as any)["__item"] = vm;
            return [ el, asDisposable() ];
        }
    }

    private createExtendSearchResultItemUserElement(vm: ExtendSearchResultItem): HTMLElement | [HTMLElement, IDisposable] {
        const el = EL("div", { class: "resultitem-extendsearchresult" }, [
            vm.text
        ]);
        if (vm.canClick) {
            el.classList.add("clickable");
            el.addEventListener("click", () => { vm.click(); });
        }
        return [el, asDisposable()];
    }

    private createPleaseWaitSearchResultItemUserElement(vm: PleaseWaitSearchResultItem): HTMLElement | [HTMLElement, IDisposable] {
        const el = EL("div", { class: "resultitem-pleasewait" }, [
            vm.title
        ]);
        return [el, asDisposable()];
    }

    private createPromptForParametersSearchResultItemUserElement(vm: PromptForParametersSearchResultItem) : [HTMLElement, IDisposable] {
        const el = EL("div", { class: "resultitem-promptforparameters" }, [
            vm.text
        ]);
        return [el, asDisposable()];
    }

    private createLoggedMessagesSearchResultItemUserElement(vm: LoggedMessagesSearchResultItem): HTMLElement | [HTMLElement, IDisposable] {
        const el = new ChannelMessageCollectionView();
        el.classList.add("resultitem-loggedmessages");
        el.setAttribute("data-count", vm.messages.size.toString());
        const innerDiv = document.createElement("div");
        innerDiv.classList.add("messagecontainer");
        el.viewModel = vm.messages;
        el.appendChild(innerDiv);
        // const el = EL("x-channelmessagecollectionview", { class: "resultitem-loggedmessages", "data-count": vm.messages.size.toString() }, [
        //     EL("div", { class: "messagecontainer" })
        // ]);
        // (el as ComponentBase<any>).viewModel = vm.messages;
        return [el, asDisposable()];
    }

    destroyUserElement(vm: LogSearchResultItem, el: HTMLElement): void | Promise<any> {
    }

}