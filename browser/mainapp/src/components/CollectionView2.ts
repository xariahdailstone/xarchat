import { IDisposable } from "../util/Disposable.js";
import { Collection, CollectionChangeEvent, CollectionChangeType, ObservableCollection } from "../util/ObservableCollection.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";

export interface CollectionView2Events {
    updatingelements: (e: Event) => void;
    updatedelements: (e: Event) => void;
}

@componentElement("x-collectionview2")
export class CollectionView2<T> extends ComponentBase<ObservableCollection<any>> {
    private SYM_VIEWMODEL = Symbol();
    private SYM_ELEMENT = Symbol();
    private SYM_ELEMENTDISPOSE = Symbol();

    constructor() {
        super();

        const templateSlot = document.createElement("slot");
        templateSlot.name = "template";
        templateSlot.id = "elItemTemplateSlot";

        const containerSlot = document.createElement("slot");
        containerSlot.name = "container";
        containerSlot.id = "elItemContainerSlot";

        this.elMain.appendChild(templateSlot);
        this.elMain.appendChild(containerSlot);
        // this.elMain.innerHTML = `
        //     <slot name="template" id="elItemTemplateSlot"></slot>
        //     <slot name="container" el="elItemContainerSlot"></slot>
        // `;
    }

    override get fastEvents(): string[] { return [...super.fastEvents, "updatingelements", "updatedelements" ]; }

    private get elItemContainer() { return this.querySelector("*[slot='container']") as (HTMLElement | null); }
    private get elItemTemplate() { return this.querySelector("template") as (HTMLTemplateElement | null); }

    private _dataSourceEventReg: (IDisposable | null) = null;

    protected override viewModelChanged(): void {
        const vm = this.viewModel;

        if (this._dataSourceEventReg) {
            this._dataSourceEventReg.dispose();
            this._dataSourceEventReg = null;
        }

        if (vm && vm instanceof Collection) {
            this.initializeAllItems();
            this._dataSourceEventReg = vm.addEventListener("collectionchange", e => this.collectionChanged(e));
        }
        else {
            this.teardownAllItems();
        }
    }

    public getElementForViewModel(vm: any): (HTMLElement | null) {
        const element = (vm as any)[this.SYM_ELEMENT];
        return element ? element : null;
    }

    public getViewModelForElement(element: (HTMLElement | null)): (T | null) {
        const vm = (element as any)[this.SYM_VIEWMODEL];
        return vm ? vm : null;
    }

    private collectionChanged(e: CollectionChangeEvent<T>) {
        const viewModel = this.viewModel!;

        this.dispatchEvent(new Event("updatingelements"));

        switch (e.collectionChangeType) {
            case CollectionChangeType.ITEM_POPPED:
            case CollectionChangeType.ITEM_SHIFTED:
                {
                    const vm = e.removedItem!;
                    this.teardownViewModel(vm);
                }
                break;
            case CollectionChangeType.ITEM_CHANGED:
                {
                    const index = e.index!;
                    const removedVm = e.removedItem!;
                    const assignedVm = viewModel[index]!;
                    this.teardownViewModel(removedVm);
                    const newEl = this.createElement(assignedVm);
                    if (index == viewModel.length - 1) {
                        this.elItemContainer!.appendChild(newEl);
                    }
                    else {
                        const beforeEl = this.elItemContainer!.children.item(index);
                        this.elItemContainer!.insertBefore(newEl, beforeEl);
                    }
                }
                break;
            case CollectionChangeType.ITEMS_PUSHED:
                {
                    const count = e.count!
                    const startIndex = e.index!;
                    for (let x = startIndex; x < viewModel.length; x++) {
                        const vm = viewModel[x]!;
                        const newEl = this.createElement(vm);
                        this.elItemContainer!.appendChild(newEl);
                    }
                }
                break;
            case CollectionChangeType.ITEMS_UNSHIFTED:
                {
                    let count = e.count!;
                    while (count > 0) {
                        count--;
                        const el = this.elItemContainer!.firstElementChild as HTMLElement;
                        this.teardownElement(el);
                    }
                }
                break;
            case CollectionChangeType.ITEM_REMOVED:
                {
                    const removedItem = e.removedItem!;
                    this.teardownViewModel(removedItem);
                }
                break;
            case CollectionChangeType.ITEM_INSERTED:
                {
                    const vm = viewModel[e.index!]!;
                    const newEl = this.createElement(vm);
                    const beforeEl  = this.elItemContainer?.children.item(e.index!) as HTMLElement;
                    this.elItemContainer!.insertBefore(newEl, beforeEl);
                }
                break;
        }

        this.dispatchEvent(new Event("updatedelements"));
    }

    private initializeAllItems() {
        //this.logger.logDebug("initializing all items...");
        const elItemContainer = this.elItemContainer;

        this.teardownAllItems();

        if (elItemContainer) {
            //this.logger.logDebug("initializing all items 2...");
            this.dispatchEvent(new Event("updatingelements"));
            for (let item of this.viewModel!) {
                const el = this.createElement(item);
                elItemContainer.appendChild(el);
            }
            this.dispatchEvent(new Event("updatedelements"));
        }
    }

    private teardownAllItems() {
        //this.logger.logDebug("teardown all items...");
        const elItemContainer = this.elItemContainer;
        if (elItemContainer) {
            //this.logger.logDebug("teardown all items 2...");
            this.dispatchEvent(new Event("updatingelements"));
            while (elItemContainer.firstElementChild) {
                this.teardownElement(elItemContainer.firstElementChild as HTMLElement);
            }
            this.dispatchEvent(new Event("updatedelements"));
        }
    }

    private createElement(vm: any): HTMLElement {
        //this.logger.logDebug("creating element");
        const el = document.createElement("x-collectionview2item") as CollectionView2Item;

        //this.logger.logDebug("creating element 2");
        (vm as any)[this.SYM_ELEMENT] = el;
        (el as any)[this.SYM_VIEWMODEL] = vm;

        //this.logger.logDebug("creating element 3");
        el.viewModel = vm;

        if (this.oncreateelementcontent) {
            const cres = this.oncreateelementcontent(el, vm);
            if (cres) {
                (el as any)[this.SYM_ELEMENTDISPOSE] = cres;
            }
        }
        else {
            const itemFrag = this.elItemTemplate?.content.cloneNode(true) as DocumentFragment;
            el.appendChild(itemFrag);
        }

        if (this.oncreatedelement) {
            try {
                this.oncreatedelement(el, vm);
            }
            catch { }
        }

        //this.logger.logDebug("createdElement", el);
        return el;
    }

    private async teardownElement(element: HTMLElement) {
        const vm = (element as any)[this.SYM_VIEWMODEL];

        const cres = (element as any)[this.SYM_ELEMENTDISPOSE];
        if (cres) {
            delete (element as any)[this.SYM_ELEMENTDISPOSE];

            try { (cres as IDisposable).dispose(); }
            catch { }
        }

        delete (element as any)[this.SYM_VIEWMODEL];
        delete (vm as any)[this.SYM_ELEMENT];

        if (this.ontearingdownelement) {
            try {
                const tdeResult = this.ontearingdownelement(element, vm);
                if (tdeResult) {
                    await tdeResult;
                }
            }
            catch { }
        }

        element.remove();
    }

    oncreateelementcontent: (CreateElementContentHandler<T> | null) = null;
    oncreatedelement: (CreatedElementHandler<T> | null) = null;
    ontearingdownelement: (TeardownElementHandler<T> | null) = null;

    private teardownViewModel(vm: any) {
        const element = (vm as any)[this.SYM_ELEMENT];
        this.teardownElement(element);
    }
}

export type CreateElementContentHandler<T> = (element: HTMLElement, viewModel: T) => (IDisposable | void);
export type CreatedElementHandler<T> = (element: HTMLElement, viewModel: T) => void;
export type TeardownElementHandler<T> = (element: HTMLElement, viewModel: T) => (void | Promise<any>);

@componentElement("x-collectionview2item")
class CollectionView2Item extends ComponentBase<unknown> {
    constructor() {
        super();

        this.elMain.appendChild(document.createElement("slot"));
    }
}
