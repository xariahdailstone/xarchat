import { jsx, Fragment, VNode } from "../snabbdom/index";
import { asDisposable, ConvertibleToDisposable, IDisposable } from "../util/Disposable";
import { ObjectUniqueId } from "../util/ObjectUniqueId";
import { AccordionCollapseGroupViewModel, AccordionEntryViewModel, AccordionSetViewModel } from "../viewmodel/accordion/AccordionSetViewModel";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel";
import { ComponentBase, componentElement } from "./ComponentBase";
import { RenderingComponentBase } from "./RenderingComponentBase";

@componentElement("x-chatslistaccordion")
export class ChatsListAccordion extends RenderingComponentBase<AccordionSetViewModel> {

    protected render(): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        if (!vm) { return <></>; }

        const disposables: ConvertibleToDisposable[] = [];

        const relIds: string[] = [];
        const relHeights: string[] = [];
        const tvnodes: VNode[] = [];
        let isFirst = true;
        for (let item of vm.items) {
            const canResize = isFirst;
            isFirst = false;
            const tid = `item${ObjectUniqueId.get(item)}`;
            relHeights.push(`${item.relativeHeight}fr`);
            relIds.push(`#${tid}`);
            const tvnode = this.renderAccordionEntry(tid, canResize, item, d => disposables.push(d));
            tvnodes.push(tvnode);
        }

        const sizeStyle = `.accordionset { grid-template-rows: ${relHeights}; }`

        const vnode = <div key="toplevelset" classList="accordionset" attrs={{ style: sizeStyle }}>{tvnodes}</div>;

        return [vnode, asDisposable(...disposables)];
    }

    protected renderAccordionEntry(tid: string, canResize: boolean, vm: AccordionEntryViewModel, addDisposable: (x: ConvertibleToDisposable) => void): VNode {
        const tvnodes: VNode[] = [];
        for (let item of vm.items) {
            const tvnode = this.renderCollapseGroup(item, addDisposable);
            tvnodes.push(tvnode);
        }

        const eclasses: string[] = [];
        eclasses.push("accordionentry");
        if (canResize) {
            eclasses.push("accordionentry-resizable");
        }

        return <div id={tid} key={ObjectUniqueId.get(vm)} classList={eclasses}>
            <div key={`${ObjectUniqueId.get(vm)}-title`} classList="accordionentry-title">{ vm.title }</div>
            <div key={`${ObjectUniqueId.get(vm)}-items`} classList="accordionentry-items" data-dragdrophost='true'>{ tvnodes }</div>
        </div>;
    }

    protected renderCollapseGroup(vm: AccordionCollapseGroupViewModel, addDisposable: (x: ConvertibleToDisposable) => void): VNode {
        const tvnodes: VNode[] = [];
        for (let ch of vm.items) {
            const tvnode = this.renderChannelItem(ch, addDisposable);
            tvnodes.push(tvnode);
        }

        const eclasses: string[] = [];
        eclasses.push("collapsegroup");
        if (vm.collapsed) {
            eclasses.push("collapsegroup-collapsed");
        }

        return <div key={ObjectUniqueId.get(vm)} classList={eclasses}>
            <div key={`${ObjectUniqueId.get(vm)}-title`} classList="collapsegroup-title">{ vm.title }</div>
            <div key={`${ObjectUniqueId.get(vm)}-items`} classList="collapsegroup-items" data-dragdrophost='true'>{ vm.title }</div>
        </div>;
    }

    protected renderChannelItem(vm: ChannelViewModel, addDisposable: (x: ConvertibleToDisposable) => void): VNode {

        return <div key={`${ObjectUniqueId.get(vm)}-title`} classList="channelitem">{ vm.title }</div>;
    }
}