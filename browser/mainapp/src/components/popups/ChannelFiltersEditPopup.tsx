import { jsx, Fragment, VNode } from "../../snabbdom/index";
import { IDisposable } from "../../util/Disposable";
import { HTMLUtils } from "../../util/HTMLUtils";
import { ChannelFiltersViewModel, ChannelNamedFilterViewModel } from "../../viewmodel/ChannelFiltersViewModel";
import { ChannelFiltersEditPopupViewModel } from "../../viewmodel/popups/ChannelFiltersEditPopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { RenderingComponentBase } from "../RenderingComponentBase";
import { ContextPopupBase } from "./ContextPopupBase";
import { popupViewFor } from "./PopupFrame";

@componentArea("popups")
@componentElement("x-channelfilterseditpopup")
@popupViewFor(ChannelFiltersEditPopupViewModel)
export class ChannelFiltersEditPopup extends ContextPopupBase<ChannelFiltersEditPopupViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, '<x-channelfilterseditrenderingpopup></x-channelfilterseditrenderingpopup>');
        this.clickable = true;
        this.freezePosition = true;
    }
}

const UP_ARROW: string = "\u2191";
const DOWN_ARROW: string = "\u2193";

@componentArea("popups")
@componentElement("x-channelfilterseditrenderingpopup")
export class ChannelFiltersEditRenderingPopup extends RenderingComponentBase<ChannelFiltersEditPopupViewModel> {
    constructor() {
        super();
    }

    render(): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        if (!vm) {
            return <></>;
        }
        else
        {
            const selIdx = vm.filtersViewModel.selectedFilter ? vm.filtersViewModel.namedFilters.indexOf(vm.filtersViewModel.selectedFilter) : -1;
            const hasSelection = selIdx != -1;
            const canMoveUp = selIdx > 0;
            const canMoveDown = selIdx != -1 && (selIdx < (vm.filtersViewModel.namedFilters.length - 1));

            return <>
                <div classList={[ "namedfilterslist-container-outer" ]}>
                    <div classList={[ "namedfilterlist-container-title" ]}>Filter Tabs</div>
                    <div classList={[ "namedfilterlist-container" ]}>
                        { this.renderNamedFilterRows(vm.filtersViewModel) }
                    </div>
                    <button classList={[ "move-filter-up-button",  "theme-button", "theme-button-smaller", (!canMoveUp ? "disabled" : "") ]} props={{
                        "inert": !canMoveUp
                    }} on={{
                        "click": () => { vm.filtersViewModel.moveUp(); }
                    }}>{UP_ARROW}</button>
                    <button classList={[ "move-filter-down-button",  "theme-button", "theme-button-smaller", (!canMoveDown ? "disabled" : "") ]} props={{
                        "inert": !canMoveDown
                    }} on={{
                        "click": () => { vm.filtersViewModel.moveDown(); }
                    }}>{DOWN_ARROW}</button>
                    <button classList={[ "add-filter-button", "theme-button", "theme-button-smaller" ]} on={{
                        "click": () => { vm.filtersViewModel.addTab(); }
                    }}>Add Tab</button>
                    <button classList={[ "delete-filter-button", "theme-button", "theme-button-smaller", (!hasSelection ? "disabled" : "") ]} props={{
                        "disabled": !hasSelection
                    }} on={{
                        "click": () => { vm.filtersViewModel.deleteTab(); }
                    }}>Delete Tab</button>
                </div>
                <div classList={[ "currentfilter-container-outer", (!hasSelection ? "hidden": "") ]}>
                    <div classList={[ "currentfilter-container-title" ]}>Selected Tab</div>
                    <label classList={[ "currentfilter-container-name" ]}>
                        <div classList={[ "currentfilter-container-name-label" ]}>Name:</div>
                        <input attr-type="text" attr-maxlength="20" classList={[ "currentfilter-container-name-textbox", "theme-textbox" ]} 
                            props={{ "value": hasSelection ? vm.filtersViewModel.selectedFilter!.name : "" }} on={{
                                "input": (e) => { if (vm.filtersViewModel.selectedFilter) { vm.filtersViewModel.selectedFilter.name = (e.target as any).value; } },
                                "change": (e) => { if (vm.filtersViewModel.selectedFilter) { vm.filtersViewModel.selectedFilter.name = (e.target as any).value; } },
                            }}></input>
                    </label>
                    <div classList={[ "currentfilter-container" ]}>
                        { hasSelection ? this.renderCurrentFilterCategoriesCheckboxes(vm.filtersViewModel, vm.filtersViewModel.selectedFilter!) : null }
                    </div>
                </div>
            </>;
        }
    }

    private renderNamedFilterRows(vm: ChannelFiltersViewModel): VNode[] {
        const results: VNode[] = [];

        for (let nf of vm.namedFilters) {
            const isSelected = (vm.selectedFilter == nf);
            results.push(<div classList={[ "namedfilterslist-item", (isSelected ? "namedfilterslist-item-selected" : "") ]}
                on={{
                    "click": () => {
                        vm.selectedFilter = nf;
                    }
                }}>
                { nf.name.trim() != "" ? nf.name : "(No Name)" }
            </div>);
        }

        return results;
    }

    private renderCurrentFilterCategoriesCheckboxes(vm: ChannelFiltersViewModel, nf: ChannelNamedFilterViewModel): VNode[] {
        const results: VNode[] = [];

        for (let c of vm.availableCategories) {
            const isChecked = nf.selectedCategories.indexOf(c) != -1;
            results.push(<label classList={[]}>
                <input attr-type="checkbox" props={{ "checked": isChecked }} on={{
                    "change": (e) => { nf.toggleCategory(c, (e.target as HTMLInputElement).checked); }
                }}></input>
                <div>{c.title}</div>
            </label>);
        }

        return results;
    }
}