import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { Collection, ObservableCollection } from "../../util/ObservableCollection";
import { AppViewModel } from "../AppViewModel";
import { ContextPopupViewModel, PopupViewModel } from "./PopupViewModel";

export class MultiSelectPopupViewModel extends ContextPopupViewModel {
    constructor(parent: AppViewModel, el: HTMLElement) {
        super(parent, el);
    }

    @observableProperty
    readonly items: Collection<MultiSelectPopupViewModelItem> = new Collection();

    override dismissed(): void {
        
        super.dismissed();
    }
}

export class MultiSelectPopupViewModelItem extends ObservableBase {
    constructor(
        title: string,
        value: string) {

        super();

        this.title = title;
        this.value = value;
    }

    @observableProperty
    title: string;

    @observableProperty
    value: string;

    @observableProperty
    isSelected: boolean = false;

    @observableProperty
    isEnabled: boolean = true;
}