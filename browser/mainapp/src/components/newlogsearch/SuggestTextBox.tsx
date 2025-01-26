import { jsx, Fragment, VNode } from "../../snabbdom/index";
import { IDisposable } from "../../util/Disposable";
import { SuggestTextboxViewModel } from "../../viewmodel/newlogsearch/SuggestTextboxViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { RenderingComponentBase } from "../RenderingComponentBase";

@componentArea("newlogsearch")
@componentElement("x-suggesttextbox")
export class SuggestTextBox extends RenderingComponentBase<SuggestTextboxViewModel> {
    constructor() {
        super();
    }

    render(): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        if (vm) {
            const tbChange = (e: Event) => { 
                const el = e.target as HTMLInputElement;
                const v = el.value;
                if (v != vm.value) {
                    vm.value = v;
                    vm.openDropdown();
                }
            };

            return <input attr-type="text" props={{
                    "value": vm.value
                }} on={{
                    "input": tbChange,
                    "change": tbChange
                }} />
        }
        else {
            return <></>;
        }
    }
}