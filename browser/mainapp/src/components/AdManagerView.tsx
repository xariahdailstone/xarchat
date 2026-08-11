import { jsx, Fragment, VNode } from "../snabbdom/index";
import { VNodeTextInputBinding } from "../util/bindings/VNodeBinding";
import { CharacterLinkUtils } from "../util/CharacterLinkUtils";
import { IDisposable } from "../util/Disposable";
import { URLUtils } from "../util/URLUtils";
import { VNodeUtils } from "../util/VNodeUtils";
import { AdManagerShowFilter, AdManagerSortDirection, AdManagerSortField, IAdManagerViewModel } from "../viewmodel/ChannelAdManagerViewModel";
import { ChannelMessageViewModel, ChannelViewModel } from "../viewmodel/ChannelViewModel";
import { componentElement } from "./ComponentBase";
import { RenderArguments, RenderingComponentBase } from "./RenderingComponentBase";
import { StatusDotVNodeBuilder } from "./StatusDot";
import { XCSelectElement } from "./XCSelect";

@componentElement("x-admanagerview")
export class AdManagerView extends RenderingComponentBase<IAdManagerViewModel> {

    protected render(args: RenderArguments): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        if (!vm) { return VNodeUtils.createEmptyFragment(); }

        const curSelStr = (vm.sortField == AdManagerSortField.CHARACTER_NAME ? "charname"
            : vm.sortField == AdManagerSortField.POSTED_AT ? "timestamp"
            : "unknown") +
            (vm.sortDirection == AdManagerSortDirection.ASCENDING ? "" : "-desc");

        const createFieldOptionItem = (value: string, displayName: string) => <x-xcoption attrs={{ "value": value, "selected": curSelStr == value }}>{displayName}</x-xcoption>;
        const fieldOptionItems: VNode[] = [];
        fieldOptionItems.push(createFieldOptionItem("charname", "Character Name"));
        fieldOptionItems.push(createFieldOptionItem("charname-desc", "Character Name (descending)"));
        fieldOptionItems.push(createFieldOptionItem("timestamp", "Last Posted At"));
        fieldOptionItems.push(createFieldOptionItem("timestamp-desc", "Last Posted At (descending)"));
        const fieldOptionChanged = (ev: Event) => {
            const elSelect = ev.target as XCSelectElement;
            if (elSelect.value) {
                const isDesc = elSelect.value.includes("-desc");
                const fieldName = elSelect.value.split('-')[0];

                vm.setSort(
                    fieldName == "charname" ? AdManagerSortField.CHARACTER_NAME :
                    fieldName == "timestamp" ? AdManagerSortField.POSTED_AT :
                    AdManagerSortField.CHARACTER_NAME,
                    isDesc ? AdManagerSortDirection.DESCENDING : AdManagerSortDirection.ASCENDING);
            }
        };

        const createShowOptionItem = (value: AdManagerShowFilter, displayName: string) => <x-xcoption attrs={{ "value": value, "selected": vm.showFilter == value }}>{displayName}</x-xcoption>;
        const showOptionItems: VNode[] = [];
        showOptionItems.push(createShowOptionItem(AdManagerShowFilter.ALL, "All"));
        showOptionItems.push(createShowOptionItem(AdManagerShowFilter.ALLBUTUNINTERESTED, "All Except Uninterested"));
        showOptionItems.push(createShowOptionItem(AdManagerShowFilter.UNINTERESTEDONLY, "Uninterested Only"));
        const showOptionChanged = (ev: Event) => {
            const elSelect = ev.target as XCSelectElement;
            if (elSelect.value != null) {
                vm.showFilter = elSelect.value as AdManagerShowFilter;
            }
        }

        const resetFilters = () => {
            vm.resetFilters();
        };

        const elSearchTextNode = <input attrs={{ "type": "text" }} classList={[ "searchbar-field" ]} />
        VNodeTextInputBinding.bind(elSearchTextNode, vm.searchText, (str) => vm.searchText = str);

        const elSearchBar =
            <div classList={[ "searchbar" ]} key="searchbar">
                <div classList={[ "searchbar-label "]}>Search:</div>
                {elSearchTextNode}

                <div classList={[ "searchbar-label "]}>Sort:</div>
                <x-xcselect classList={[ "searchbar-field" ]} props={{ "value": curSelStr }}
                    on={{ "change": fieldOptionChanged }}>{ fieldOptionItems }</x-xcselect>

                <div classList={[ "searchbar-label "]}>Show:</div>
                <x-xcselect classList={[ "searchbar-field" ]} props={{ "value": vm.showFilter }}
                    on={{ "change": showOptionChanged }}>{ showOptionItems }</x-xcselect>

                <button classList={[ "searchbar-button" ]} on={{ "click": resetFilters }}>Reset</button>
            </div>;

        const resultItems: VNode[] = [];
        for (let titem of vm.activeAds.iterateValues()) {
            const elResult = this.renderAd(args, vm, titem);
            resultItems.push(elResult);
        }

        const elResultSection =
            <div classList={[ "resultsection" ]} key="resultsection">{ resultItems }</div>;
        
        return <div classList={[ "mainui" ]} key="mainui">
            { elSearchBar }
            { elResultSection }
        </div>
    }

    private renderAd(args: RenderArguments, vm: IAdManagerViewModel, mvm: ChannelMessageViewModel): VNode {
        const uniqueMessageId = mvm.uniqueMessageId;

        const elIcon = <img key={`msg-${uniqueMessageId}-icon`} classList={["icon"]} attr-src={URLUtils.getAvatarImageUrl(mvm.characterStatus.characterName)} attrs={{
                "data-copycontent": "",
                "loading": "lazy"
            }} />;

        const charStatus = vm.activeLoginViewModel.characterSet.getCharacterStatus(mvm.characterStatus.characterName);
        const elCharacterLink = CharacterLinkUtils.createStaticCharacterLinkVNode(
            vm.activeLoginViewModel, mvm.characterStatus.characterName, charStatus, mvm.channelViewModel as ChannelViewModel);
        const elStatusDot = StatusDotVNodeBuilder.getStatusDotVNode(charStatus);

        mvm.incrementParsedTextUsage();
        args.addDisposable(() => mvm.decrementParsedTextUsage());
        const elMessageText = <span classList={["messagetext"]}>{mvm.parseResult.asVNode()}</span>;

        const onResultItemContentVisibilityAutoStateChange = (ev: ContentVisibilityAutoStateChangeEvent) => {
            const target = ev.target as HTMLElement;
            if (target) {
                target.setAttribute("renderingskipped", ev.skipped ? "true" : "false");
            }
        }
        const elResult =
            <div classList={[ "resultitem" ]} key={`msg${mvm.uniqueMessageId}`} on={{
                "contentvisibilityautostatechange": onResultItemContentVisibilityAutoStateChange
            }}>
                { elIcon }
                <div classList={[ "resultitem-name "]}>{ elStatusDot }{ elCharacterLink }</div>
                <div classList={[ "resultitem-timestamp" ]}>{ mvm.timestamp.toLocaleString() }</div>
                <div classList={[ "resultitem-message" ]}>{ elMessageText }</div>
            </div>;
        return elResult;
    }
}