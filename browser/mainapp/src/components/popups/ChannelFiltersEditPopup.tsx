import { jsx, Fragment, VNode } from "../../snabbdom/index";
import { IDisposable } from "../../util/Disposable";
import { HTMLUtils } from "../../util/HTMLUtils";
import { ChannelFiltersViewModel, ChannelNamedFilterViewModel } from "../../viewmodel/ChannelFiltersViewModel";
import { ChatChannelViewModel } from "../../viewmodel/ChatChannelViewModel";
import { ChannelFiltersEditPopupViewModel } from "../../viewmodel/popups/ChannelFiltersEditPopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { makeRenderingComponent, RenderingComponentBase } from "../RenderingComponentBase";
import { ContextPopupBase } from "./ContextPopupBase";
import { popupViewFor } from "./PopupFrame";

const UP_ARROW: string = "\u2191";
const DOWN_ARROW: string = "\u2193";

@componentArea("popups")
@componentElement("x-channelfilterseditpopup")
@popupViewFor(ChannelFiltersEditPopupViewModel)
export class ChannelFiltersEditPopup extends ContextPopupBase<ChannelFiltersEditPopupViewModel> {
    constructor() {
        super();
        makeRenderingComponent(this, {
            render: () => this.render()
        });

        this.clickable = true;
        this.freezePosition = true;
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

            const canUntoggleControlsUnseenDot = 
                vm.filtersViewModel.selectedFilter && !vm.filtersViewModel.selectedFilter.controlsUnseenDot;
            const toggleControlsUnseenDot = () => {
                if (canUntoggleControlsUnseenDot) {
                    vm.filtersViewModel.selectedFilter!.toggleControlsUnseenDot();
                }
            };
            const toggleCanPing = () => {
                if (vm.filtersViewModel.selectedFilter) {
                    vm.filtersViewModel.selectedFilter.toggleCanPing();
                }
            };
            const toggleShowInAdsOnlyChannel = () => {
                if (vm.filtersViewModel.selectedFilter) {
                    vm.filtersViewModel.selectedFilter.toggleShowInAdsOnlyChannel();
                }
            };
            const toggleShowInChatOnlyChannel = () => {
                if (vm.filtersViewModel.selectedFilter) {
                    vm.filtersViewModel.selectedFilter.toggleShowInChatOnlyChannel();
                }
            };
            const toggleShowInBothAdsAndChatChannel = () => {
                if (vm.filtersViewModel.selectedFilter) {
                    vm.filtersViewModel.selectedFilter.toggleShowInBothAdsAndChatChannel();
                }
            };
            
            return <>
                <div classList={[ "namedfilterslist-container-outer" ]}>
                    <div classList={[ "namedfilterlist-container-title" ]}>Filters</div>
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
                    <div classList={[ "currentfilter-container-title" ]}>Selected Filter</div>
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

                    <div classList={[ "currentfilter-optionset" ]}>
                    <div classList={[ "currentfilter-optionset-title" ]}>Filter Options</div>
                        <label classList={[ "currentfilter-optionset-option" ]}>
                            <input attr-type="checkbox" classList={[ "currentfilter-optionset-option-checkbox" ]}
                                props={{ "checked": vm.filtersViewModel.selectedFilter?.controlsUnseenDot ?? false, "readonly": !canUntoggleControlsUnseenDot }} on={{
                                    "change": toggleControlsUnseenDot
                                }}></input>
                            <div classList={[ "currentfilter-optionset-option-title" ]}>
                                This filter controls the unseen messages dot for the channel.
                            </div>
                        </label>
                        <label classList={[ "currentfilter-optionset-option" ]}>
                            <input attr-type="checkbox" classList={[ "currentfilter-optionset-option-checkbox" ]}
                                props={{ "checked": vm.filtersViewModel.selectedFilter?.canPing ?? false }} on={{
                                    "change": toggleCanPing
                                }}></input>
                            <div classList={[ "currentfilter-optionset-option-title" ]}>
                                Messages in this filter can ping.
                            </div>
                        </label>
                        { vm.filtersViewModel.channelViewModel instanceof ChatChannelViewModel ?
                            <>
                                <label classList={[ "currentfilter-optionset-option" ]}>
                                    <input attr-type="checkbox" classList={[ "currentfilter-optionset-option-checkbox" ]}
                                        props={{ "checked": vm.filtersViewModel.selectedFilter?.showInAdsOnlyChannel ?? false }} on={{
                                            "change": toggleShowInAdsOnlyChannel
                                        }}></input>
                                    <div classList={[ "currentfilter-optionset-option-title" ]}>
                                        Show filter in an Ads-Only channel.
                                    </div>
                                </label>
                                <label classList={[ "currentfilter-optionset-option" ]}>
                                    <input attr-type="checkbox" classList={[ "currentfilter-optionset-option-checkbox" ]}
                                        props={{ "checked": vm.filtersViewModel.selectedFilter?.showInChatOnlyChannel ?? false }} on={{
                                            "change": toggleShowInChatOnlyChannel
                                        }}></input>
                                    <div classList={[ "currentfilter-optionset-option-title" ]}>
                                        Show filter in a Chat-Only channel.
                                    </div>
                                </label>
                                <label classList={[ "currentfilter-optionset-option" ]}>
                                    <input attr-type="checkbox" classList={[ "currentfilter-optionset-option-checkbox" ]}
                                        props={{ "checked": vm.filtersViewModel.selectedFilter?.showInBothAdsAndChatChannel ?? false }} on={{
                                            "change": toggleShowInBothAdsAndChatChannel
                                        }}></input>
                                    <div classList={[ "currentfilter-optionset-option-title" ]}>
                                        Show filter in an Ads-or-Chat channel.
                                    </div>
                                </label>
                            </>
                            : <></> }
                    </div>
                </div>
            </>;
        }
    }

    private renderNamedFilterRows(vm: ChannelFiltersViewModel): VNode[] {
        const results: VNode[] = [];

        for (let nf of vm.namedFilters) {
            const isSelected = (vm.selectedFilter == nf);
            let effName = nf.name.trim() != "" ? nf.name : "(No Name)";
            if (nf.controlsUnseenDot) {
                effName = `${effName} \u2022`;
            }
            results.push(<div classList={[ "namedfilterslist-item", (isSelected ? "namedfilterslist-item-selected" : "") ]}
                on={{
                    "click": () => {
                        vm.selectedFilter = nf;
                    }
                }}>
                { effName }
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