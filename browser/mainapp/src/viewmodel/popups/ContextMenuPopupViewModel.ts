import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { StdObservableList } from "../../util/collections/StdObservableView";
import { AppViewModel } from "../AppViewModel";
import { ContextPopupViewModel, PopupViewModel } from "./PopupViewModel";

export class ContextMenuPopupViewModel<TSelectedValue> extends ContextPopupViewModel {
    constructor(parent: AppViewModel, contextElement: HTMLElement);
    constructor(parent: AppViewModel, contextRect: DOMRect);
    constructor(parent: AppViewModel, contextAnchor: HTMLElement | DOMRect) {
        super(parent, contextAnchor);
        this.items = new StdObservableList<ContextMenuPopupItemViewModel<TSelectedValue>>();
    }

    @observableProperty
    items: StdObservableList<ContextMenuPopupItemViewModel<TSelectedValue>>;

    onValueSelected: (((value: TSelectedValue) => void) | null) = null;

    addMenuItem(title: string, value: TSelectedValue, enabled: boolean = true) {
        const item = new ContextMenuPopupItemViewModel<TSelectedValue>(title, value, enabled);
        this.items.push(item);
        return item;
    }

    addSeparator() {
        const result = this.addMenuItem("-", null!, false);
        return result;
    }
}

export class ContextMenuPopupItemViewModel<TSelectedValue> extends ObservableBase {
    constructor(
        title: string, 
        value: TSelectedValue,
        enabled: boolean = true) {

        super();
        this.title = title;
        this.value = value;
        this.enabled = enabled;
    }

    @observableProperty
    title: string;

    @observableProperty
    value: TSelectedValue;

    @observableProperty
    enabled: boolean = true;
}