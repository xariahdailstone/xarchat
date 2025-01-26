import { jsx, Fragment, VNode } from "../../../snabbdom/index";
import { asDisposable, IDisposable } from "../../../util/Disposable";
import { HTMLUtils } from "../../../util/HTMLUtils";
import { SuggestTextboxPopupViewModel } from "../../../viewmodel/newlogsearch/popups/SuggestTextboxPopupViewModel";
import { SuggestTextboxDropdownState, SuggestTextboxItemViewModel } from "../../../viewmodel/newlogsearch/SuggestTextboxViewModel";
import { componentArea, componentElement } from "../../ComponentBase";
import { PopupBase, popupViewFor } from "../../popups/PopupFrame";
import { RenderingComponentBase } from "../../RenderingComponentBase";

@componentArea("newlogsearch/popups")
@componentElement("x-suggesttextboxpopup")
@popupViewFor(SuggestTextboxPopupViewModel)
export class SuggestTextboxPopup extends PopupBase<SuggestTextboxPopupViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, "<x-suggesttextboxpopupinner></x-suggesttextboxpopupinner>");
    }
}

@componentArea("newlogsearch/popups")
@componentElement("x-suggesttextboxpopupinner")
export class SuggestTextboxPopupInner extends RenderingComponentBase<SuggestTextboxPopupViewModel> {
    render(): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        if (vm) {
            switch (vm.suggestionsState) {
                case SuggestTextboxDropdownState.POPULATING:
                    return this.renderPopulating(vm);
                case SuggestTextboxDropdownState.FAILED:
                    return this.renderFailed(vm);
                case SuggestTextboxDropdownState.IDLE:
                    return this.renderList(vm);
                default:
                    return <></>;
            }
        }
        else {
            return <></>;
        }
    }

    private renderPopulating(vm: SuggestTextboxPopupViewModel): (VNode | [VNode, IDisposable]) {
        return <div classList={[ "populating-message" ]}>Please wait...</div>;
    }

    private renderFailed(vm: SuggestTextboxPopupViewModel): (VNode | [VNode, IDisposable]) {
        return <div classList={[ "failed-message" ]}>Failed.</div>;
    }

    private renderList(vm: SuggestTextboxPopupViewModel): (VNode | [VNode, IDisposable]) {
        const disposables: IDisposable[] = [];    
        const itemNodes: VNode[] = [];

        for (let i of vm.suggestions) {
            const isSelected = vm.selectedItem == i;
            const rr = this.renderItem(vm, i, disposables);
            itemNodes.push(rr);
        }

        const resVNode = <div classList={[ "items-container" ]}>
            { itemNodes }
        </div>;
        return [resVNode, asDisposable(...disposables)];
    }

    renderItem(vm: SuggestTextboxPopupViewModel, i: SuggestTextboxItemViewModel, disposables: IDisposable[]): VNode {
        return <div classList={[ "item", (vm.selectedItem == i) ? "selected" : "not-selected" ]} on={{
            "click": () => { vm.select(i); }
        }}>{i.displayText}</div>;
    }
}