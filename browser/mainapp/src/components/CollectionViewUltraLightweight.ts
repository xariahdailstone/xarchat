import { IDisposable, EmptyDisposable } from "../util/Disposable";
import { Optional } from "../util/Optional";
import { ReadOnlyStdObservableCollection, StdObservableCollectionChange, StdObservableCollectionChangeType } from "../util/collections/ReadOnlyStdObservableCollection";
import { SnapshottableSet } from "../util/collections/SnapshottableSet";

export abstract class CollectionViewUltraLightweight<TViewModel> implements IDisposable {

    constructor(
        private readonly containerElement: HTMLElement) {
    }

    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            this.viewModel = null;
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    *entries(): Iterator<[TViewModel, HTMLElement]> {
        let tchild = this.containerElement.firstElementChild;
        while (tchild) {
            yield [ this.getViewModelForElementInternal(tchild as HTMLElement), tchild as HTMLElement ];
            tchild = tchild.nextElementSibling;
        }
    }

    private readonly SYM_VIEWMODEL = Symbol();
    private readonly SYM_ELEMENT = Symbol();
    private readonly SYM_DISPOSABLE = Symbol();

    private _disposed: boolean = false;
    private _elements: SnapshottableSet<HTMLElement> = new SnapshottableSet();
    private _collectionObserverHandle: IDisposable | null = null;

    private _viewModel: ReadOnlyStdObservableCollection<TViewModel> | null = null;
    get viewModel() { return this._viewModel; }
    set viewModel(value) {
        if (value != null && this._disposed) return;

        if (value != this._viewModel) {
            if (this._viewModel) {
                this._collectionObserverHandle?.dispose();
                this._collectionObserverHandle = null;
                this.teardownAllElements();
            }

            this._viewModel = value;

            if (this._viewModel) {
                this.standupAllElements();
                this._collectionObserverHandle = this._viewModel.addCollectionObserver(entries => this.viewModelCollectionChange(entries));
            }
        }
    }

    private viewModelCollectionChange(entries: StdObservableCollectionChange<TViewModel>[]) {
        const ce = this.containerElement;
        for (let entry of entries) {
            switch (entry.changeType) {
                case StdObservableCollectionChangeType.ITEM_ADDED:
                    {
                        const itemVm = entry.item;
                        const itemEl = this.createItemElementInternal(itemVm);
                        if (entry.before) {
                            const beforeEl = this.getElementForViewModelInternal(entry.before);
                            ce.insertBefore(itemEl, beforeEl);
                        }
                        else {
                            ce.appendChild(itemEl);
                        }
                    }
                    break;
                case StdObservableCollectionChangeType.ITEM_REMOVED:
                    {
                        const itemEl = this.getElementForViewModelInternal(entry.item);
                        this.destroyItemElementInternal(entry.item, itemEl);
                    }
                    break;
                case StdObservableCollectionChangeType.CLEARED:
                    {
                        this.teardownAllElements();
                    }
                    break;
            }
        }
    }

    getElementForViewModel(vm: TViewModel): Optional<HTMLElement> {
        return (vm as any)[this.SYM_ELEMENT];
    }

    getViewModelForElement(el: HTMLElement): Optional<TViewModel> {
        return (el as any)[this.SYM_VIEWMODEL];
    }

    private getViewModelForElementInternal(el: HTMLElement): TViewModel {
        return (el as any)[this.SYM_VIEWMODEL];
    }

    private getElementForViewModelInternal(vm: TViewModel): HTMLElement {
        return (vm as any)[this.SYM_ELEMENT];
    }

    private teardownAllElements() {
        this._elements.forEachValueSnapshotted(itemEl => {
            const itemVm = (itemEl as any)[this.SYM_VIEWMODEL];
            this.destroyItemElementInternal(itemVm, itemEl);
        });
    }

    private standupAllElements() {
        const docFrag = new DocumentFragment();
        for (let itemVm of this.viewModel!.iterateValues()) {
            const itemEl = this.createItemElementInternal(itemVm);
            docFrag.appendChild(itemEl);
        }
        this.containerElement.appendChild(docFrag);
    }

    private createItemElementInternal(viewModel: TViewModel): HTMLElement {
        const r = this.createItemElement(viewModel);
        const el = r[0];

        (el as any)[this.SYM_VIEWMODEL] = viewModel;
        (el as any)[this.SYM_DISPOSABLE] = r[1] ?? EmptyDisposable;
        (viewModel as any)[this.SYM_ELEMENT] = el;
        this._elements.add(el);

        return el;
    }

    abstract createItemElement(viewModel: TViewModel): [HTMLElement, IDisposable];

    private destroyItemElementInternal(viewModel: TViewModel, element: HTMLElement) {
        element.remove();
        this._elements.delete(element);

        const d = (element as any)[this.SYM_DISPOSABLE] as Optional<IDisposable>;
        if (d) {
            try { d.dispose(); }
            catch { }
        }

        this.destroyItemElement(viewModel, element);
    }

    destroyItemElement(viewModel: TViewModel, element: HTMLElement) { }
}