import { jsx, Fragment, VNode } from "../snabbdom/index";
import { IDisposable } from "../util/Disposable";
import { ObservableExpression } from "../util/ObservableExpression";
import { ChannelFilterOptions, MultiSelectChannelFilterOptions, SingleSelectChannelFilterOptions } from "../viewmodel/ChannelViewModel";
import { MultiSelectPopupViewModel, MultiSelectPopupViewModelItem } from "../viewmodel/popups/MultiSelectPopupViewModel";
import { ComponentBase, componentElement } from "./ComponentBase";
import { RenderingComponentBase } from "./RenderingComponentBase";

@componentElement("x-channelheaderfilter")
export class ChannelHeaderFilter extends RenderingComponentBase<ChannelFilterOptions | null> {

    render(): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        let contentNode: VNode | null = null;

        if (vm instanceof SingleSelectChannelFilterOptions) {
            contentNode = this.renderSingleSelect(vm);
        }
        else if (vm instanceof MultiSelectChannelFilterOptions) {
            contentNode = this.renderMultiSelect(vm);
        }
        else {
            return <></>;
        }

        return <>
            <x-iconimage id="elFilterIcon" attr-src="assets/ui/filter-icon.svg"></x-iconimage>
            { contentNode }
        </>;
    }

    renderMultiSelect(vm: MultiSelectChannelFilterOptions): VNode {
        return <button classList={["theme-button"]}
            on={{
                "click": (e) => {
                    this.showMultiSelectPopup(vm, e.target as HTMLElement);
                }
            }}>Filter</button>
    }

    async showMultiSelectPopup(vm: MultiSelectChannelFilterOptions, el: HTMLElement) {
        const disposables: IDisposable[] = [];

        let dismissed = false;

        const popupvm = new MultiSelectPopupViewModel(vm.channel.appViewModel, el);
        for (let vmitem of vm.items) {
            const popupitemvm = new MultiSelectPopupViewModelItem(vmitem.title, vmitem.value);
            popupitemvm.isSelected = vmitem.isSelected;
            disposables.push(new ObservableExpression(
                () => popupitemvm.isSelected,
                (isSel) => {
                    if (!dismissed) {
                        vmitem.isSelected = !!isSel;
                    }
                },
                () => {}
            ));
            popupvm.items.add(popupitemvm);
        }
        vm.channel.appViewModel.popups.push(popupvm);
        await popupvm.waitForDismissalAsync();
        dismissed = true;

        for (let d of disposables) {
            d.dispose();
        }
    }

    renderSingleSelect(vm: SingleSelectChannelFilterOptions): VNode {
        const itemNodes: VNode[] = [];
        let selIndex = 0;

        for (let idx = 0; idx < vm.items.length; idx++) {
            const i = vm.items[idx]!;
            const tnode = <option value={i.value} attrs={{ "selected": i.isSelected }}>{i.title}</option>
            if (i.isSelected) { selIndex = idx; }
            itemNodes.push(tnode);
        }

        return <select classList={["theme-select", "theme-select-smaller"]} attr-tabindex="-1"
            on={{
                "change": (e) => {
                    const selEl = e.target as HTMLSelectElement;
                    if (selEl.selectedIndex >= 0) {
                        vm.items[selEl.selectedIndex]!.isSelected = true;
                    }
                }
            }}>
            { itemNodes }
        </select>;
    }
}