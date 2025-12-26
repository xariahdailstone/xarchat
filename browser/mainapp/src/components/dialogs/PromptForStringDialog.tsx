import { jsx, toVNode, Fragment, VNode } from "../../snabbdom/index";
import { BBCodeUtils } from "../../util/BBCodeUtils";
import { IDisposable, EmptyDisposable, asDisposable } from "../../util/Disposable";
import { HTMLUtils } from "../../util/HTMLUtils";
import { KeyCodes } from "../../util/KeyCodes";
import { VNodeUtils } from "../../util/VNodeUtils";
import { PromptForStringViewModel } from "../../viewmodel/dialogs/PromptViewModel";
import { SuggestTextBoxViewModel } from "../../viewmodel/SuggestTextBoxViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { makeRenderingComponent } from "../RenderingComponentBase";
import { SuggestTextBox } from "../SuggestTextBox";
import { dialogViewFor, DialogComponentBase } from "./DialogFrame";


@componentArea("dialogs")
@componentElement("x-promptforstringdialog")
@dialogViewFor(PromptForStringViewModel)
export class PromptForStringDialog extends DialogComponentBase<PromptForStringViewModel> {
    constructor() {
        super();

        makeRenderingComponent(this, {
            render: () => this.render()
        });
    }

    private _suggestVM: SuggestTextBoxViewModel | null = null;
    render(): [VNode, IDisposable] {
        const vm = this.viewModel;
        if (!vm) { return [VNodeUtils.createEmptyFragment(), EmptyDisposable]; }

        const disposables: IDisposable[] = [];
        const addDisposable = (d: IDisposable) => disposables.push(d);

        const onInputChange = (e: Event) => {
            const target = e.target as (HTMLInputElement | HTMLTextAreaElement | SuggestTextBox);
            if (target instanceof SuggestTextBox) {
            }
            else if (target.value != vm.value) {
                vm.value = target.value;
            }
        };

        let inputNode: VNode;
        if (vm.multiline) {
            inputNode = <textarea classList={["textbox", "themed"]} id="txtValue" data-initial-focus="true"></textarea>;
        }
        else if (vm.suggestionFunc) {
            if (!this._suggestVM || this._suggestVM.appViewModel != vm.parent || this._suggestVM.populateSuggestionsFunc != vm.suggestionFunc) {
                const svm = new SuggestTextBoxViewModel(vm.parent, vm.suggestionFunc);
                svm.onValueChangedFunc = (e) => {
                    vm.value = svm.value;
                };
                this._suggestVM = svm;
            }
            inputNode = <x-suggesttextbox attr-type="text" classList={["textbox", "themed"]} id="txtValue" data-initial-focus="true"
                props={{ "viewModel": this._suggestVM }}></x-suggesttextbox>
        }
        else {
            inputNode = <input attr-type="text" classList={["textbox", "themed"]} id="txtValue" data-initial-focus="true" />;
        }
        inputNode.data ??= {};
        inputNode.data.on ??= {};
        inputNode.data.on["input"] = onInputChange;
        inputNode.data.on["change"] = onInputChange;
        //inputNode.data.on["focus"] = () => { this._textAreaHasFocus = vm.multiline && true; };
        //inputNode.data.on["blur"] = () => { this._textAreaHasFocus = false; };
        inputNode.data.on["keydown"] = (ev: KeyboardEvent) => {
            if (vm.multiline && ev.keyCode == KeyCodes.RETURN && ev.shiftKey) {
                //EventUtils.preventDialogShortcutHandling(ev);
                //ev.preventDefault();
                ev.stopPropagation();
            }
        };
        inputNode.data.props ??= {};
        inputNode.data.props["value"] = vm.value;

        if (vm.isBBCodeString && vm.multiline) {
            BBCodeUtils.addEditingShortcutsVNode(inputNode, {
                appViewModelGetter: () => vm.parent,
                onTextChanged: (value: string) => {
                    if (vm.value != value) {
                        vm.value = value;
                    }
                },
                activeLoginViewModelGetter: () => vm.activeLoginViewModel ?? null,
                channelViewModelGetter: () => vm.channelViewModel ?? null
            });
        }

        const vnode = <>
            <div classList={["message"]} id="elMessage">{vm.messageAsHtml ? toVNode(HTMLUtils.htmlToFragment(vm.message)) : vm.message}</div>
            {inputNode}
        </>;

        return [vnode, asDisposable(...disposables)];
    }

    // private _textAreaHasFocus: boolean = false;
    
    // override shouldPreventKeyboardDefault(ev: KeyboardEvent): boolean {
    //     if (this._textAreaHasFocus) {
    //         if (ev.keyCode == KeyCodes.RETURN && ev.shiftKey) {
    //             return true;
    //         }
    //     }
    //     return false;
    // }
}
