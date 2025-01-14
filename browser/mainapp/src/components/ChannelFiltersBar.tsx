import { jsx, Fragment, VNode } from "../snabbdom/index";
import { IDisposable } from "../util/Disposable";
import { HTMLUtils } from "../util/HTMLUtils";
import { ChannelFiltersViewModel } from "../viewmodel/ChannelFiltersViewModel";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel";
import { ChannelFiltersEditPopupViewModel } from "../viewmodel/popups/ChannelFiltersEditPopupViewModel";
import { ComponentBase, componentElement } from "./ComponentBase";
import { RenderingComponentBase } from "./RenderingComponentBase";

@componentElement("x-channelfiltersbar")
export class ChannelFiltersBar extends RenderingComponentBase<ChannelViewModel> {
    constructor() {
        super();
    }

    override render(): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        if (!vm || !vm.channelFilters) { return <></>; }

        return <>
            <div classList="filtericon"><x-iconimage id="elFilterIcon" attr-src="assets/ui/filter-icon.svg"></x-iconimage></div>
            <div classList="filtertabscontainer">
                { this.renderTabs(vm.channelFilters) }
            </div>
            <div classList="editbutton">
                <div classList="filtertab" on={{
                    "click": (e) => {
                        if (vm.channelFilters) {
                            const povm = new ChannelFiltersEditPopupViewModel(vm.appViewModel, e.target as HTMLElement, vm.channelFilters);
                            vm.appViewModel.popups.push(povm);
                        }
                    }
                }}><x-iconimage id="elEditIcon" attr-src="assets/ui/edit.svg"></x-iconimage></div>
            </div>
        </>;
    }

    private renderTabs(vm: ChannelFiltersViewModel): VNode[] {
        const results: VNode[] = [];

        for (let nf of vm.namedFilters) {
            const isSelected = vm.selectedFilter == nf;
            results.push(<div classList={["filtertab", (isSelected ? "selected" : "")]} on={{
                "click": () => { vm.selectedFilter = nf; }
            }}>{ nf.name.trim() != "" ? nf.name : "(No Name)" }</div>);
        }

        return results;
    }
}