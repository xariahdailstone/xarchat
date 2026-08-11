import { jsx, Fragment, VNode } from "../snabbdom/index";
import { IDisposable } from "../util/Disposable";
import { HTMLUtils } from "../util/HTMLUtils";
import { VNodeUtils } from "../util/VNodeUtils";
import { ChannelFiltersViewModel } from "../viewmodel/ChannelFiltersViewModel";
import { ChannelActivePanel, ChannelViewModel } from "../viewmodel/ChannelViewModel";
import { ChatChannelMessageMode, ChatChannelViewModel } from "../viewmodel/ChatChannelViewModel";
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
        if (!vm || !vm.channelFilters) { return VNodeUtils.createEmptyFragment(); }

        let elAdManagerButton: VNode | null = null;
        if (vm instanceof ChatChannelViewModel) {
            elAdManagerButton = <div classList="admanagerbutton">
                <div classList={[ "filtertab", (vm.activePanel == ChannelActivePanel.AD_MANAGER ? "selected" : "") ]} on={{
                        "click": () => { vm.activePanel = ChannelActivePanel.AD_MANAGER; }
                    }}>
                    Ads ({vm.channelAdManager.adCount})
                </div>
            </div>;
        }

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
            {elAdManagerButton}
        </>;
    }

    private renderTabs(vm: ChannelFiltersViewModel): VNode[] {
        const results: VNode[] = [];

        for (let nf of vm.namedFilters) {
            if (vm.channelViewModel instanceof ChatChannelViewModel) {
                if (!nf.showInChatOnlyChannel && vm.channelViewModel.messageMode == ChatChannelMessageMode.CHAT_ONLY) { continue; }
                if (!nf.showInAdsOnlyChannel && vm.channelViewModel.messageMode == ChatChannelMessageMode.ADS_ONLY) { continue; }
                if (!nf.showInBothAdsAndChatChannel && vm.channelViewModel.messageMode == ChatChannelMessageMode.BOTH) { continue; }
            }

            const isSelected = (vm.selectedFilter == nf && vm.channelViewModel.activePanel == ChannelActivePanel.MESSAGE_STREAM);
            results.push(<div classList={["filtertab", (isSelected ? "selected" : "")]} on={{
                "click": () => { vm.selectedFilter = nf; vm.channelViewModel.activePanel = ChannelActivePanel.MESSAGE_STREAM; }
            }}>{ nf.name.trim() != "" ? nf.name : "(No Name)" }</div>);
        }

        return results;
    }
}