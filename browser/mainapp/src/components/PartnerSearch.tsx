import { CharacterGenderConvert } from "../shared/CharacterGender";
import { OnlineStatusConvert } from "../shared/OnlineStatus";
import { jsx, Fragment, VNode } from "../snabbdom/index";
import { ChatBBCodeParser } from "../util/bbcode/BBCode";
import { CharacterLinkUtils } from "../util/CharacterLinkUtils";
import { asDisposable, IDisposable } from "../util/Disposable";
import { HTMLUtils } from "../util/HTMLUtils";
import { Collection } from "../util/ObservableCollection";
import { URLUtils } from "../util/URLUtils";
import { PartnerSearchState, PartnerSearchViewModel } from "../viewmodel/PartnerSearchViewModel";
import { componentElement } from "./ComponentBase";
import { RenderingStageViewComponent, stageViewFor } from "./Stage";
import { StatusDotVNodeBuilder } from "./StatusDot";
import { XCSelectElement } from "./XCSelect";

@componentElement("x-partnersearch")
@stageViewFor(PartnerSearchViewModel)
export class PartnerSearch extends RenderingStageViewComponent<PartnerSearchViewModel> {
    constructor() {
        super();

        this.whenConnectedWithViewModel(vm => {
            vm.initialize();
        });
    }

    render(): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        if (vm) {
            const renderDisposables: IDisposable[] = [];
            const isInert = !(vm.currentState == PartnerSearchState.Idle);

            const searchButtonAttrs: Record<string, any> = {};
            if (!vm.canSearch) {
                searchButtonAttrs["disabled"] = true;
            }

            const result = <>
                <div classList={[ "parameters" ]} props={{ "inert": isInert }}>
                    <div classList={[ "parameters-section", "parameters-genders" ]}>
                        <div classList={[ "parameters-section-title" ]}>Genders</div>
                        { this.renderSelectionListbox(vm, vm.searchGenders, vm.partnerSearchFields?.genders) }
                    </div>
                    <div classList={[ "parameters-section", "parameters-orientations" ]}>
                        <div classList={[ "parameters-section-title" ]}>Orientations</div>
                        { this.renderSelectionListbox(vm, vm.searchOrientations, vm.partnerSearchFields?.orientations) }
                    </div>
                    <div classList={[ "parameters-section", "parameters-roles" ]}>
                        <div classList={[ "parameters-section-title" ]}>Roles</div>
                        { this.renderSelectionListbox(vm, vm.searchRoles, vm.partnerSearchFields?.roles) }
                    </div>
                    <div classList={[ "parameters-section", "parameters-positions" ]}>
                        <div classList={[ "parameters-section-title" ]}>Positions</div>
                        { this.renderSelectionListbox(vm, vm.searchPositions, vm.partnerSearchFields?.positions) }
                    </div>
                    <div classList={[ "parameters-section", "parameters-languages" ]}>
                        <div classList={[ "parameters-section-title" ]}>Languages</div>
                        { this.renderSelectionListbox(vm, vm.searchLanguages, vm.partnerSearchFields?.languages) }
                    </div>
                    <div classList={[ "parameters-section", "parameters-furryprefs" ]}>
                        <div classList={[ "parameters-section-title" ]}>Furry Preference</div>
                        { this.renderSelectionListbox(vm, vm.searchFurryPrefs, vm.partnerSearchFields?.furryprefs) }
                    </div>
                    <div classList={[ "parameters-section", "parameters-kinks" ]}>
                        <div classList={[ "parameters-section-title" ]}>Kinks</div>
                        { this.renderKinksSet(vm) }
                    </div>
                    <div classList={[ "parameters-buttons" ]}>
                        <button classList={[ "parameters-buttons-search", "theme-button" ]} attrs={searchButtonAttrs} on={{
                            "click": () => { vm.executeSearch(); }
                        }}>Search</button>
                        <button classList={[ "parameters-buttons-reset", "theme-button" ]} on={{
                            "click": () => { vm.resetSearch(); }
                        }}>Reset</button>
                    </div>
                </div>
                <div classList={[ "results" ]}>
                    { this.renderResults(vm, renderDisposables) }
                </div>
            </>;

            return [result, asDisposable(...renderDisposables)];
        }
        else {
            return <></>;
        }
    }

    renderResults(vm: PartnerSearchViewModel, renderDisposables: IDisposable[]): VNode {
        if (vm.currentState == PartnerSearchState.Uninitialized) {
            return <div classList={[ "results-message" ]}>Search is not yet initialized.</div>
        }
        if (vm.currentState == PartnerSearchState.LoadingPartnerSearchFields) {
            return <div classList={[ "results-message" ]}>Please wait, loading search fields...</div>
        }
        if (vm.currentState == PartnerSearchState.AwaitingSearchResults) {
            return <div classList={[ "results-message" ]}>Searching...</div>
        }
        if (vm.currentState == PartnerSearchState.FailedToLoadPartnerSearchFields) {
            return <div classList={[ "results-message", "results-error" ]}>Failed to initialize search fields.</div>
        }
        if (vm.errorMessage != null) {
            return <div classList={[ "results-message", "results-error" ]}>{vm.errorMessage}</div>
        }

        if (!vm.searchResults) {
            return <></>;
        }

        const resultRows: VNode[] = [];
        for (let item of vm.searchResults) {
            if (item.status.ignored) { continue; }

            const statusParse = item.status.statusMessage ? ChatBBCodeParser.parse(item.status.statusMessage, { 
                sink: vm.activeLoginViewModel.bbcodeSink, 
                addUrlDomains: true, 
                appViewModel: vm.appViewModel, 
                activeLoginViewModel: vm.activeLoginViewModel,
                channelViewModel: undefined,
                imagePreviewPopups: true,
                syncGifs: true
            }) : null;
        
            const genderStr = CharacterGenderConvert.toString(item.status.gender).toLowerCase();
            const assignParseResult = (oldNode: VNode, newNode: VNode) => {
                HTMLUtils.clearChildren((newNode.elm as HTMLElement));
                if (statusParse) {
                    (newNode.elm as HTMLElement).appendChild(statusParse.element);
                }
            };
            resultRows.push(<div classList={[ "results-list-item" ]}>
                <div classList={[ "results-list-item-avatar" ]}>
                    <img classList={[ "results-list-item-avatar-image" ]} attr-src={URLUtils.getAvatarImageUrl(item.characterName)}></img>
                </div>
                <div classList={[ "results-list-item-name" ]}>
                    { StatusDotVNodeBuilder.getStatusDotVNode(item.status) }
                    { CharacterLinkUtils.createStaticCharacterLinkVNode(vm.activeLoginViewModel, item.characterName, item.status, null) }
                </div>
                <div classList={[ "results-list-item-message" ]} hook={{
                    create: assignParseResult,
                    update: assignParseResult
                }}></div>
            </div>);
        }

        return <div classList={[ "results-list" ]}>
            {resultRows}
        </div>;
    }

    renderKinksSet(vm: PartnerSearchViewModel): VNode {
        const items: VNode[] = [];
        for (let i = 0; i < vm.searchKinks.length; i++) {
            const tnode = this.renderKinksSetItem(vm, i);
            items.push(tnode);
        }

        return <div classList={[ "parameters-kinks-set" ]}>
            { items }
            { this.renderKinksSetItem(vm, -1) }
        </div>;
    }

    renderKinksSetItem(vm: PartnerSearchViewModel, index: number) {
        const thisItem = index != -1 ? vm.searchKinks[index] : null;

        const notIncludedKinks = new Set<string>();
        for (let x = 0; x < vm.searchKinks.length; x++) {
            if (x != index) {
                notIncludedKinks.add(vm.searchKinks[x]!.fetish_id);
            }
        }

        const optionNodes: VNode[] = [];
        if (index == -1) {
            optionNodes.push(<x-xcoption key={"-1"} attrs={{ value: "-1", selected: "" }}>Select a Kink</x-xcoption>);
        }
        if (vm.partnerSearchFields) {
            for (let k of vm.partnerSearchFields?.kinks) {
                if (!notIncludedKinks.has(k.fetish_id)) {
                    let attrs: Record<string, any> = {
                        "value": k.fetish_id
                    };
                    if (thisItem?.fetish_id == k.fetish_id) {
                        attrs["selected"] = true;
                    }
                    optionNodes.push(<x-xcoption key={k.fetish_id} attrs={attrs}>{k.name}</x-xcoption>);
                }
            }
        }

        let removeNode: VNode | null = null;
        if (index != -1) {
            removeNode = <div classList={[ "parameters-kinks-set-item-remove" ]} on={{
                "click": () => {
                    vm.searchKinks.removeAt(index);
                }
            }}><x-iconimage attr-src="assets/ui/iconify-window-close.svg"></x-iconimage></div>
        }

        const selectionChanged = (ev: Event) => {
            if (vm.partnerSearchFields) {
                const elSelect = ev.target as XCSelectElement;
                if (index == -1) {
                    if (elSelect.value != "-1" && elSelect.value != "") {
                        const k = vm.partnerSearchFields.kinks.filter(k => k.fetish_id == elSelect.value);
                        if (k && k.length == 1) {
                            vm.searchKinks.add(k[0]);
                        }
                    }
                }
                else {
                    const k = vm.partnerSearchFields.kinks.filter(k => k.fetish_id == elSelect.value);
                    if (k && k.length == 1) {
                        vm.searchKinks[index] = k[0];
                    }
                }
            }
        };

        return <div classList={[ "parameters-kinks-set-item" ]}>
            <x-xcselect classList={[ "parameters-kinks-set-item-select" ]} props={{ "value": thisItem?.fetish_id ?? "-1" }} on={{
                "change": selectionChanged
            }}>{ optionNodes }</x-xcselect>
            { removeNode }
        </div>;
    }

    renderSelectionListbox(vm: PartnerSearchViewModel, selectedCollection: Collection<string>, availableValues: readonly string[] | undefined): VNode {
        const items: VNode[] = [];
        selectedCollection.length; // for dependency tracking
        if (availableValues) {
            for (let av of availableValues) {
                const isSelected = selectedCollection.contains(av);
                items.push(<div class={{
                    "parameters-section-listbox-item": true,
                    "is-selected": isSelected
                }} on={{
                    "click": (ev: MouseEvent) => {
                        if (isSelected) {
                            selectedCollection.remove(av);
                        }
                        else {
                            selectedCollection.add(av);
                        }
                    }
                }}>{av}</div>)
            }
        }

        return <div classList={[ "parameters-section-listbox" ]}>
            { items }
        </div>;
    }
}