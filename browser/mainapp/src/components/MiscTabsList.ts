import { EL } from "../util/EL";
import { IDisposable, asDisposable } from "../util/Disposable";
import { KeyValuePair } from "../util/collections/KeyValuePair";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel";
import { MiscTabViewModel } from "../viewmodel/MiscTabViewModel";
import { CollectionViewLightweight } from "./CollectionViewLightweight";
import { ComponentBase, componentElement } from "./ComponentBase";
import { ObservableExpression } from "../util/ObservableExpression";
import { HTMLUtils } from "../util/HTMLUtils";

@componentElement("x-misctabslist")
export class MiscTabsList extends ComponentBase<ActiveLoginViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <x-misctabscollectionview id="elCollectionView">
                <div class="misctabs"></div>
            </x-misctabscollectionview>
        `);

        const elCollectionView = this.$("elCollectionView") as MiscTabsCollectionView;
        this.watchExpr(vm => vm.miscTabs, v => {
            elCollectionView.viewModel = v ?? null;
        });
    }
}

@componentElement("x-misctabscollectionview")
export class MiscTabsCollectionView extends CollectionViewLightweight<MiscTabViewModel> {
    constructor() {
        super();
    }

    createUserElement(vm: MiscTabViewModel): [HTMLElement, IDisposable] {
        const disposables: IDisposable[] = [];

        const elName = EL("div", { class: "tabitem-name" }, [ vm.title ]);
        disposables.push(new ObservableExpression(() => vm.title, title => {
            elName.innerText = title ?? "";
        }));

        const el = EL("div", { class: "tabitem" }, [
            elName
        ]);
        disposables.push(new ObservableExpression(() => vm.isSelected, isSel => {
            el.classList.toggle("selected", !!isSel);
        }));
        el.addEventListener("click", () => {
            vm.select();
        });

        return [el, asDisposable(...disposables)];
    }

    destroyUserElement(vm: MiscTabViewModel, el: HTMLElement): void {
    }
}