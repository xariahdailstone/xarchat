import { IDisposable, EmptyDisposable } from "../../util/Disposable";
import { HTMLUtils } from "../../util/HTMLUtils";
import { ContextMenuPopupItemViewModel, ContextMenuPopupViewModel } from "../../viewmodel/popups/ContextMenuPopupViewModel";
import { CollectionViewUltraLightweight } from "../CollectionViewUltraLightweight";
import { componentArea, componentElement } from "../ComponentBase";
import { ContextPopupBase } from "./ContextPopupBase";
import { popupViewFor } from "./PopupFrame";

@componentArea("popups")
@componentElement("x-contextmenupopup")
@popupViewFor(ContextMenuPopupViewModel<any>)
export class ContextMenuPopup extends ContextPopupBase<ContextMenuPopupViewModel<any>> {

    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div id="elContent" class="content">
            </div>
        `);
        this.clickable = true;

        const elContent = this.$("elContent") as HTMLDivElement;
        const collView = new ContextMenuPopupItemView(elContent, this);

        this.watchExpr(vm => vm.items, items => { collView.viewModel = items ?? null; });
    }

    selectValue(value: any) {
        if (this.viewModel && this.viewModel.onValueSelected) {
            this.viewModel.onValueSelected(value);
        }
    }

}

export class ContextMenuPopupItemView extends CollectionViewUltraLightweight<ContextMenuPopupItemViewModel<any>> {

    constructor(
        containerElement: HTMLElement,
        private readonly parent: ContextMenuPopup) {

        super(containerElement);
    }

    createItemElement(viewModel: ContextMenuPopupItemViewModel<any>): [HTMLElement, IDisposable] {
        let el: HTMLDivElement;
        if (viewModel.title == "-" && !viewModel.enabled) {
            el = document.createElement("div");
            el.classList.add("menu-separator");
        }
        else {
            el = document.createElement("div");
            el.classList.add("menu-item");
            
            const elText = document.createElement("div");
            elText.classList.add("menu-item-text");
            elText.innerText = viewModel.title;
            el.appendChild(elText);

            el.addEventListener("click", () => {
                this.parent.selectValue(viewModel.value);
            }, true);
        }

        if (!viewModel.enabled) {
            el.classList.add("disabled");
        }

        return [el, EmptyDisposable];
    }

}