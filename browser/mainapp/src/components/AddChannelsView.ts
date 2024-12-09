import { ChannelName } from "../shared/ChannelName";
import { IDisposable } from "../util/Disposable";
import { EL } from "../util/EL";
import { HTMLUtils } from "../util/HTMLUtils";
import { IterableUtils } from "../util/IterableUtils";
import { StringUtils } from "../util/StringUtils";
import { KeyValuePair } from "../util/collections/KeyValuePair";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel";
import { AddChannelsItemViewModel, AddChannelsViewModel } from "../viewmodel/AddChannelsViewModel";
import { CollectionViewLightweight } from "./CollectionViewLightweight";
import { ComponentBase, componentElement } from "./ComponentBase";
import { stageViewFor } from "./Stage";

@componentElement("x-addchannelsview")
@stageViewFor(AddChannelsViewModel)
export class AddChannelsView extends ComponentBase<AddChannelsViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="title-section">
                Join Channels
            </div>

            <div class="search-section">
                <div class="search-title">Find:</div>
                <input class="search-field theme-textbox" type="text" id="elSearchText" />
            </div>

            <div class="chantype-section public-section">
                <div class="chantype-section-title">Public Channels</div>
                <div class="chantype-section-list">
                    <div class="chantype-section-list-table">
                        <div class="chantype-section-list-thead">
                            <div class="chantype-section-list-tr">
                                <div class="chantype-section-list-th">Title</div>
                                <div class="chantype-section-list-th">Count</div>
                            </div>
                        </div>
                        <x-addchannellist modelpath="publicChannelsSortedView" id="elPublicChannelsList">
                            <div class="chantype-section-list-tbody"></div>
                        </x-addchannellist>
                    </div>
                </div>
            </div>

            <div class="chantype-section private-section">
                <div class="chantype-section-title">Private Channels</div>
                <div class="chantype-section-list">
                    <div class="chantype-section-list-table">
                        <div class="chantype-section-list-thead">
                            <div class="chantype-section-list-tr">
                                <div class="chantype-section-list-th">Title</div>
                                <div class="chantype-section-list-th">Count</div>
                            </div>
                        </div>
                        <x-addchannellist modelpath="privateChannelsSortedView" id="elPrivateChannelsList">
                            <div class="chantype-section-list-tbody"></div>
                        </x-addchannellist>
                    </div>
                </div>
            </div>
        `);

        const elSearchText = this.$("elSearchText") as HTMLInputElement;
        const elPublicChannelsList = this.$("elPublicChannelsList") as AddChannelList;
        const elPrivateChannelsList = this.$("elPrivateChannelsList") as AddChannelList;

        const searchTextChanged = () => {
            if (this.viewModel && elSearchText.value != this.viewModel.channelFilter) {
                this.viewModel.channelFilter = elSearchText.value;
            }
        };
        elSearchText.addEventListener("input", () => searchTextChanged());
        elSearchText.addEventListener("change", () => searchTextChanged());
        this.watchExpr(vm => vm.channelFilter, (value) => {
            if (value != elSearchText.value) {
                elSearchText.value = value ?? "";
            }
        });

        const updateHighlightedChannels = () => {
            const vm = this.viewModel;
            if (vm) {
                const names: ChannelName[] = [];
                for (let ch of vm.activeLoginViewModel.openChannels.iterateValues()) {
                    names.push(ch.name);
                }
                elPublicChannelsList.highlightChannels(names);
                elPrivateChannelsList.highlightChannels(names);
            }
        };

        this.watch(".", () => {
            elPublicChannelsList.activeLoginViewModel = this.viewModel?.activeLoginViewModel ?? null;
            elPrivateChannelsList.activeLoginViewModel = this.viewModel?.activeLoginViewModel ?? null;
            updateHighlightedChannels();
        });
        this.watch("parent.openChannels.length", () => updateHighlightedChannels());

        this.elMain.addEventListener("click", (ev: MouseEvent) => {
            const vm = this.viewModel;
            if (!vm) return;

            const targetEl = ev.target as HTMLElement;
            const listItemEl = targetEl?.closest("*[data-channelname]");
            if (listItemEl) {
                const chanName = ChannelName.create(listItemEl.getAttribute("data-channelname")!);
                const wasJoined = listItemEl.classList.contains("joined");
                if (!wasJoined) {
                    vm.activeLoginViewModel.chatConnection.joinChannelAsync(chanName);
                }
            }
        });
    }
}

@componentElement("x-addchannellist")
export class AddChannelList extends CollectionViewLightweight<AddChannelsItemViewModel> {
    constructor() {
        super();
    }

    activeLoginViewModel: (ActiveLoginViewModel | null) = null;

    highlightChannels(names: ChannelName[]) {
        const newHighlightedElements = new Set<HTMLElement>();
        for (let name of names) {
            const el = this._elementsByChannelName.get(name);
            if (el) {
                newHighlightedElements.add(el);
                this._highlightedElements.delete(el);
            }
        }
        for (let x of this._highlightedElements.values()) {
            x.classList.remove("joined");
        }
        for (let x of newHighlightedElements.values()) {
            x.classList.add("joined");
        }
        this._highlightedElements = newHighlightedElements;
    }

    private readonly _elementsByChannelName: Map<ChannelName, HTMLElement> = new Map();
    private _highlightedElements: Set<HTMLElement> = new Set();

    createUserElement(vm: AddChannelsItemViewModel): HTMLElement | [HTMLElement, IDisposable] {
        const el = EL("div", { class: "channelllistitem chantype-section-list-tr", "data-channelname": vm.name.value, "data-sortablename": vm.sortableTitle }, [ 
            EL("div", { class: "channellistitem-title chantype-section-list-td" }, [ vm.title ]),
            EL("div", { class: "channellistitem-count chantype-section-list-td" }, [ StringUtils.numberToString(vm.count, {}) ] )
        ]);
        if (this.activeLoginViewModel) {
            if (this.activeLoginViewModel.openChannelsByChannelName.has(vm.name)) {
                this._highlightedElements.add(el);
                el.classList.add("joined");
            }
        }
        this._elementsByChannelName.set(vm.name, el);
        return el;
    }

    destroyUserElement(vm: AddChannelsItemViewModel, el: HTMLElement): void {
        const name = ChannelName.create(el.getAttribute("data-channelname")!);
        this._elementsByChannelName.delete(name);
        this._highlightedElements.delete(el);
    }
}