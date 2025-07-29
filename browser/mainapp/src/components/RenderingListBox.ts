import { VNode } from "../snabbdom/index";
import { ReadOnlyStdObservableCollection, StdObservableCollectionChange, StdObservableCollectionChangeType } from "../util/collections/ReadOnlyStdObservableCollection";
import { asDisposable, IDisposable } from "../util/Disposable";
import { ComponentBase } from "./ComponentBase";

export abstract class VirtualizedRenderingListBox<T> extends ComponentBase<ReadOnlyStdObservableCollection<T>> {
    constructor() {
        super();

        this.whenConnectedWithViewModel(vm => {
            this.populateFromNewViewModel(vm);
            const collObs = vm.addCollectionObserver(entries => {

            });
            return asDisposable(
                collObs, 
                () => { this.depopulate(vm); });
        });
    }

    private readonly _sym_itemToElement = Symbol();
    private readonly _sym_elementToItem = Symbol();
    private readonly _sym_elementRenderState = Symbol();

    private readonly _elementsByHeightCategory: Map<string, Set<HTMLElement>> = new Map();

    private populateFromNewViewModel(vm: ReadOnlyStdObservableCollection<T>) {
        for (let item of vm.iterateValues()) {

        }
    }

    private depopulate(vm: ReadOnlyStdObservableCollection<T>) {
        for (let item of vm.iterateValues()) {
            this.removeItem(item);
        }
    }

    private processCollectionChange(change: StdObservableCollectionChange<T>) {
        switch (change.changeType) {
            case StdObservableCollectionChangeType.ITEM_ADDED:
            case StdObservableCollectionChangeType.ITEM_REMOVED:
                this.removeItem(change.item);
                break;
        }
    }

    private removeItem(item: T) {
        const element = (item as any)[this._sym_itemToElement] as HTMLElement;
        const elementRenderState = (item as any)[this._sym_elementRenderState] as ElementRenderState;

        element.remove();
        if (elementRenderState.lastRenderDisposable) {
            elementRenderState.lastRenderDisposable.dispose();
        }

        delete (item as any)[this._sym_itemToElement];
        delete (element as any)[this._sym_elementToItem];
        delete (item as any)[this._sym_elementRenderState];
        
        const ebhcSet = this._elementsByHeightCategory.get(elementRenderState.heightCategory)!;
        ebhcSet.delete(element);
        if (ebhcSet.size == 0) {
            this._elementsByHeightCategory.delete(elementRenderState.heightCategory);
        }
        else if (elementRenderState.isHeightCategoryRepresentative) {
            this.selectHeightCategoryRepresentative(elementRenderState.heightCategory);
        }
    }

    private selectHeightCategoryRepresentative(category: string) {
        // TODO:
    }


    abstract getItemHeightCategory(item: T): string;

    abstract renderItem(item: T): VNode;
}

interface ElementRenderState {
    heightCategory: string;
    isHeightCategoryRepresentative: boolean;
    lastRenderDisposable: IDisposable | null;
}