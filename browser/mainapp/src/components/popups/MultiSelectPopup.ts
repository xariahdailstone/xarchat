import { asDisposable, IDisposable } from "../../util/Disposable";
import { EventListenerUtil } from "../../util/EventListenerUtil";
import { HTMLUtils } from "../../util/HTMLUtils";
import { ObservableExpression } from "../../util/ObservableExpression";
import { MultiSelectChannelFilterOptionItem } from "../../viewmodel/ChannelViewModel";
import { MultiSelectPopupViewModel, MultiSelectPopupViewModelItem } from "../../viewmodel/popups/MultiSelectPopupViewModel";
import { CollectionViewLightweight } from "../CollectionViewLightweight";
import { componentArea, componentElement } from "../ComponentBase";
import { ContextPopupBase } from "./ContextPopupBase";
import { PopupBase, popupViewFor } from "./PopupFrame";

@componentArea("popups")
@componentElement("x-multiselectpopup")
@popupViewFor(MultiSelectPopupViewModel)
export class MultiSelectPopup extends ContextPopupBase<MultiSelectPopupViewModel> {

    constructor() {
        super();
        this.clickable = true;

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <x-multiselectitemcollectionview id="elCollectionView">
                <div class="items-container"></div>
            </x-multiselectitemcollectionview>
        `);

        const elCollectionView = this.$("elCollectionView") as MultiSelectItemCollectionView;

        this.watchExpr(vm => vm, vm => {
            if (vm) {
                elCollectionView.viewModel = vm.items;
            }
            else {
                elCollectionView.viewModel = null;
            }
        });
    }
    
}

@componentElement("x-multiselectitemcollectionview")
export class MultiSelectItemCollectionView extends CollectionViewLightweight<MultiSelectPopupViewModelItem> {
    createUserElement(vm: MultiSelectPopupViewModelItem): (HTMLElement | [HTMLElement, IDisposable]) {
        const disposables: IDisposable[] = [];

        const elLabel = document.createElement("label");
        const elCheckbox = document.createElement("input");
        const elLabelText = document.createElement("div");

        elLabel.classList.add("item");
        disposables.push(new ObservableExpression(
            () => vm.isEnabled,
            (isEnabled) => { 
                elLabel.classList.toggle("disabled", !isEnabled);
                elCheckbox.readOnly = !isEnabled;
            },
            () => { elCheckbox.checked = false; }
        ));
        
        elCheckbox.classList.add("item-checkbox");
        elCheckbox.type = "checkbox";
        disposables.push(new ObservableExpression(
            () => vm.isSelected,
            (isSel) => { elCheckbox.checked = !!isSel; },
            () => { elCheckbox.checked = false; }
        ));
        disposables.push(EventListenerUtil.addDisposableEventListener(elCheckbox, "change", (e: Event) => {
            vm.isSelected = elCheckbox.checked;
        }));
        
        elLabelText.classList.add("item-text");
        elLabelText.appendChild(document.createTextNode(vm.title));

        elLabel.appendChild(elCheckbox);
        elLabel.appendChild(elLabelText);

        return [elLabel, asDisposable(...disposables)];
    }

    destroyUserElement(vm: MultiSelectPopupViewModelItem, el: HTMLElement): (Promise<any> | void) {
    }
}