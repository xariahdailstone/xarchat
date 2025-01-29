import { IDisposable, asDisposable } from "../util/Disposable";
import { HTMLUtils } from "../util/HTMLUtils";
import { Collection } from "../util/ObservableCollection";
import { DictionaryChangeEvent, DictionaryChangeType, ObservableOrderedDictionary } from "../util/ObservableKeyedLinkedList";
import { WhenChangeManager } from "../util/WhenChange";
import { KeyValuePair } from "../util/collections/KeyValuePair";
import { ReadOnlyStdObservableCollection, StdObservableCollectionChange, StdObservableCollectionChangeType } from "../util/collections/ReadOnlyStdObservableCollection";
import { ComponentBase } from "./ComponentBase";

export abstract class CollectionViewLightweight<TViewModel> extends ComponentBase<ReadOnlyStdObservableCollection<TViewModel>> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, "<slot></slot>");
    }

    protected override get requiredStylesheets(): string[] {
        return [ ...super.requiredStylesheets, "styles/components/CollectionViewLightweight.css" ]
    }

    private readonly _wcm: WhenChangeManager = new WhenChangeManager();
    private _mo: (MutationObserver | null) = null;

    protected get containerElement(): (HTMLElement | null) {
        const result = this.firstElementChild as (HTMLElement | null);
        return result;
    }

    override get fastEvents(): string[] { return [...super.fastEvents, "connectedtodocument", "updatingelements", "updatedelements", "delayedremovecomplete" ] };

    protected override viewModelChanged(): void {
        this.updateState();
    }

    protected override connectedToDocument(): void {
        this._mo = new MutationObserver(() => this.updateState());
        this._mo.observe(this, { childList: true });
        this.updateState();
        this.dispatchEvent(new Event("connectedtodocument"));
    }

    protected override disconnectedFromDocument(): void {
        //this.dispatchEvent(new Event("disconnectedfromdocument"));
        this._mo?.disconnect();
        this._mo = null;
        this.updateState();
    }

    protected repopulate() {
        this._wcm.cleanup();
        this.updateState();
    }

    *values(): Iterable<[ HTMLElement, TViewModel ]> {
        for (let el of this._allElements.values()) {
            const vm = this.getViewModelForElement(el);
            yield [ el, vm ];
        }
    }

    private updateState() {
        const vm = this.viewModel as (ReadOnlyStdObservableCollection<TViewModel> | null);
        const containerEl = this.containerElement;
        const isConnected = this.isComponentConnected;

        this._wcm.assign({ vm, containerEl, isConnected }, () => {
            if (vm != null && containerEl && isConnected) {
                const ccHandler = vm.addCollectionObserver(changes => {
                    this.startingElementUpdate();
                    for (let chg of changes) {
                        this.onCollectionChange(containerEl, vm, chg);
                    }
                    this.finishingElementUpdate();
                });
                // const ccHandler = vm.addEventListener("dictionarychange", ccel => {
                //     this.onCollectionChange(containerEl, vm, ccel);
                // });

                // Initial populate
                let prevItem: TViewModel | null = null;
                this.startingElementUpdate();
                for (let item of vm.iterateValues()) {
                    this.onCollectionChange(containerEl, vm, new StdObservableCollectionChange<TViewModel>(
                        StdObservableCollectionChangeType.ITEM_ADDED,
                        item,
                        undefined,
                        prevItem ?? undefined
                    ));
                    // this.onCollectionChange(containerEl, vm, new DictionaryChangeEvent(DictionaryChangeType.ITEM_ADDED, item.character, item,
                    //     undefined, undefined, prevItem?.character ?? undefined, prevItem ?? undefined));
                    prevItem = item;
                }
                this.finishingElementUpdate();

                return asDisposable(() => {
                    ccHandler.dispose();

                    // Depopulate
                    this.onCollectionChange(containerEl, vm, null);
                });
            }
        });
    }

    getElementForViewModel(vm: TViewModel): HTMLElement | null {
        const result = this.getRelatedElement(vm) ?? null;
        return result;
    }
    getViewModelForElement(el: HTMLElement): TViewModel {
        const result = this.getRelatedViewModel(el);
        return result;
    }

    private readonly _allElements: Set<HTMLElement> = new Set();
    private readonly _symElement = Symbol();
    private readonly _symVM = Symbol();

    private setRelatedElement(vm: TViewModel, el: HTMLElement) {
        (vm as any)[this._symElement] = el;
        (el as any)[this._symVM] = vm;
        el.setAttribute("data-cvlw-hasVM", "true");
    }
    private getRelatedElement(vm: TViewModel): HTMLElement {
        return (vm as any)[this._symElement] as HTMLElement;
    }
    private getRelatedViewModel(el: HTMLElement) {
        return (el as any)[this._symVM];
    }
    private clearRelatedElement(vm: TViewModel) {
        const el = (vm as any)[this._symElement] as HTMLElement;
        delete (vm as any)[this._symElement];
        delete (el as any)[this._symVM];
        el.removeAttribute("data-cvlw-hasVM");
    }

    private _elementUpdateCount: number = 0;
    private startingElementUpdate() {
        if (this._elementUpdateCount == 0) {
            this.dispatchEvent(new Event("updatingelements"));    
        }
        this._elementUpdateCount++;
    }
    private finishingElementUpdate() {
        this._elementUpdateCount--;
        if (this._elementUpdateCount == 0) {
            this.dispatchEvent(new Event("updatedelements"));    
        }
    }

    private readonly SYM_EL_DISPOSABLE = Symbol();

    protected recreateElements() {
        const containerEl = this.containerElement;
        const vm = this.viewModel as (ReadOnlyStdObservableCollection<TViewModel> | null);

        if (containerEl) {
            this.startingElementUpdate();

            const emptyColl = vm ?? new Collection<TViewModel>();
            this.onCollectionChange(containerEl, emptyColl, null);

            if (vm) {
                let prevItem: TViewModel | null = null;
                for (let item of vm.iterateValues()) {
                    this.onCollectionChange(containerEl, vm, new StdObservableCollectionChange<TViewModel>(
                        StdObservableCollectionChangeType.ITEM_ADDED,
                        item,
                        undefined,
                        prevItem ?? undefined
                    ));
                    // this.onCollectionChange(containerEl, vm, new DictionaryChangeEvent(DictionaryChangeType.ITEM_ADDED, item.character, item,
                    //     undefined, undefined, prevItem?.character ?? undefined, prevItem ?? undefined));
                    prevItem = item;
                }
            }

            this.finishingElementUpdate();
        }
    }

    private onCollectionChange(containerEl: HTMLElement,
        coll: ReadOnlyStdObservableCollection<TViewModel>,
        ev: StdObservableCollectionChange<TViewModel> | null) {

        this.startingElementUpdate();

        if (ev == null) {
            // Remove all items
            const elementsToRemove: HTMLElement[] = [];
            for (let i = 0; i < containerEl.children.length; i++) {
                elementsToRemove.push(containerEl.children.item(i) as HTMLElement);
            }
            for (let x = 0; x < elementsToRemove.length; x++) {
                const el = elementsToRemove[x];
                const v = this.getRelatedViewModel(el);
                if (v) {
                    this.clearRelatedElement(v);
                }
                this.destroyUserElementInternal(v, el);
            }
        }
        else {
            switch (ev.changeType) {
                case StdObservableCollectionChangeType.ITEM_ADDED:
                    {
                        const createResult = this.createUserElementInternal(ev.item);
                        let el: HTMLElement = createResult[0];
                        (el as any)[this.SYM_EL_DISPOSABLE] = createResult[1];
                        this.setRelatedElement(ev.item, el);
                        if (ev.before == undefined) {
                            containerEl.appendChild(el);
                        }
                        else if (ev.after == undefined) {
                            containerEl.insertBefore(el, containerEl.firstElementChild);
                        }
                        else {
                            const beforeEl = this.getRelatedElement(ev.before);
                            containerEl.insertBefore(el, beforeEl);
                        }
                    }
                    break;
                case StdObservableCollectionChangeType.ITEM_REMOVED:
                    {
                        const el = this.getRelatedElement(ev.item);
                        this.clearRelatedElement(ev.item);
                        this.destroyUserElementInternal(ev.item, el);
                    }
                    break;
            }
        }

        this.finishingElementUpdate();
    }

    private createUserElementInternal(vm: TViewModel): [HTMLElement, IDisposable] {
        const result = this.createUserElement(vm);
        if (result instanceof Array) {
            const el = result[0];
            const disp = result[1];
            this._allElements.add(el);
            return [el, asDisposable(disp, () => {
                this._allElements.delete(el);
            })];
        }
        else {
            const el = result;
            this._allElements.add(el);
            return [el, asDisposable(() => {
                this._allElements.delete(el);
            })];
        }
    }

    abstract createUserElement(vm: TViewModel): (HTMLElement | [HTMLElement, IDisposable]);

    private destroyUserElementInternal(vm: TViewModel, el: HTMLElement): void {
        const d = (el as any)[this.SYM_EL_DISPOSABLE];
        if (d) {
            try { (d as IDisposable).dispose(); }
            catch { }
        }
        try {
            const maybePromise = this.destroyUserElement(vm, el);
            if (maybePromise) {
                maybePromise.then(() => {
                    el.remove();
                    this.dispatchEvent(new Event("delayedremovecomplete"));
                });
            }
            else {
                el.remove();
            }
        }
        catch {
            el.remove();
        }
    }

    abstract destroyUserElement(vm: TViewModel, el: HTMLElement): (Promise<any> | void);
}