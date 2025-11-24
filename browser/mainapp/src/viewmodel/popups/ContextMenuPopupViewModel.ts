import { IDisposable } from "../../util/Disposable";
import { ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { Collection } from "../../util/ObservableCollection";
import { StdObservableCollectionChangeType } from "../../util/collections/ReadOnlyStdObservableCollection";
import { AppViewModel } from "../AppViewModel";
import { ContextPopupViewModel, PopupViewModel } from "./PopupViewModel";

export class ContextMenuPopupViewModel<TSelectedValue> extends ContextPopupViewModel {
    constructor(parent: AppViewModel, contextElement: HTMLElement);
    constructor(parent: AppViewModel, contextRect: DOMRect);
    constructor(parent: AppViewModel, contextAnchor: HTMLElement | DOMRect) {
        super(parent, contextAnchor);
        this.items = new Collection<ContextMenuPopupItemViewModel<TSelectedValue>>();

        this._itemsObserver = this.items.addCollectionObserver(entries => {
            this.logger.logInfo("items collection observation", entries);
            for (let entry of entries) {
                switch (entry.changeType) {
                    case StdObservableCollectionChangeType.ITEM_ADDED:
                        this.logger.logInfo("menu item owner set", entry.item);
                        entry.item.owner = this;
                        break;
                    case StdObservableCollectionChangeType.ITEM_REMOVED:
                        this.logger.logInfo("menu item owner clear", entry.item);
                        entry.item.owner = null;
                        break;
                }
            }
        })
    }

    private _itemsObserver: IDisposable;

    @observableProperty
    items: Collection<ContextMenuPopupItemViewModel<TSelectedValue>>;

    private readonly _highlightedItem: ObservableValue<ContextMenuPopupItemViewModel<TSelectedValue> | null> = new ObservableValue(null);

    get highlightedItem(): ContextMenuPopupItemViewModel<TSelectedValue> | null { return this._highlightedItem.value; }
    set highlightedItem(value: ContextMenuPopupItemViewModel<TSelectedValue> | null) { this._highlightedItem.value = value; }

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

    private readonly _owner: ObservableValue<ContextMenuPopupViewModel<TSelectedValue> | null> = new ObservableValue(null);
    get owner(): ContextMenuPopupViewModel<TSelectedValue> | null { return this._owner.value; }
    set owner(value: ContextMenuPopupViewModel<TSelectedValue> | null) { this._owner.value = value; }

    get isHighlightedItem() {
        if (this.owner != null) {
            return this.owner.highlightedItem == this;
        }
        else {
            return false;
        }
    }

    @observableProperty
    title: string;

    @observableProperty
    value: TSelectedValue;

    @observableProperty
    enabled: boolean = true;
}