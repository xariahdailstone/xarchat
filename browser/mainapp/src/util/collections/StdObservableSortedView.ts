import { CallbackSet } from "../CallbackSet";
import { Comparer, DelegateComparer, NumberComparer } from "../Comparer";
import { IDisposable, asDisposable, maybeDispose } from "../Disposable";
import { ObjectUniqueId } from "../ObjectUniqueId";
import { Observable } from "../Observable";
import { ObservableExpression } from "../ObservableExpression";
import BTree from "../btree/btree";
import { ReadOnlyStdObservableCollection, StdObservableCollectionChange, StdObservableCollectionChangeType, StdObservableCollectionObserver } from "./ReadOnlyStdObservableCollection";
import { SnapshottableSet } from "./SnapshottableSet";

export class StdObservableFilteredView2<TItem extends object> implements ReadOnlyStdObservableCollection<TItem>, IDisposable {

    constructor(
        private readonly innerCollection: ReadOnlyStdObservableCollection<TItem>,
        comparer: Comparer<TItem>) {

        this._obsName = `StdObservableFilteredView2-${ObjectUniqueId.get(this)}`;

        this._comparer = new DelegateComparer<TItem>((a: TItem, b: TItem) => {
            const xresult = comparer.compare(a, b);
            if (xresult != 0) { return xresult; }

            let aIdx = -1;
            let bIdx = -1;
            let curIdx = -1;
            for (let x of innerCollection.iterateValues()) {
                curIdx++;
                if (a == x) { aIdx = curIdx; }
                if (b == x) { bIdx = curIdx; }
                if (aIdx != -1 && bIdx != -1) { break; }
            }
            
            const yresult = NumberComparer.instance.compare(aIdx, bIdx);
            if (yresult != 0) { return yresult; }

            const aId = ObjectUniqueId.get(a);
            const bId = ObjectUniqueId.get(b);
            return NumberComparer.instance.compare(aId, bId);
        });

        this._btree = new BTree([], (a, b) => this._comparer.compare(a, b));
        for (let item of innerCollection.iterateValues()) {
            this._btree.set(item, item, true);
        }

        this._disposables.add(innerCollection.addCollectionObserver(changes => {
            this.onInnerCollectionChanged(changes);
        }));            
    }

    private readonly _obsName: string;

    private readonly _comparer: Comparer<TItem>;
    private readonly _btree: BTree<TItem, TItem>;
    private _version = 0;

    private readonly _disposables: Set<IDisposable> = new Set();
    private _isDisposed: boolean = false;
    get isDisposed(): boolean { return this._isDisposed; }
    [Symbol.dispose](): void { this.dispose(); }
    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            for (let d of [...this._disposables.values()]) {
                maybeDispose(d);
            }
            this._disposables.clear();
        }
    }

    private onInnerCollectionChanged(changes: StdObservableCollectionChange<TItem>[]) {
        for (let titem of changes) {
            const item = titem.item;
            switch (titem.changeType) {
                case StdObservableCollectionChangeType.ITEM_ADDED:
                    this.onItemAdded(item);
                    break;
                case StdObservableCollectionChangeType.ITEM_REMOVED:
                    this.onItemRemoved(item);
                    break;
                case StdObservableCollectionChangeType.CLEARED:
                    this.onCleared();
                    break;
            }
        }

        this._version++;
        Observable.publishNamedUpdate(this._obsName, this._version);
    }

    private onItemAdded(item: TItem): StdObservableCollectionChange<TItem> {
        this._btree.set(item, item, true);

        const nextLowerPair = this._btree.nextLowerPair(item);
        const nextHigherPair = this._btree.nextHigherPair(item);

        return {
            changeType: StdObservableCollectionChangeType.ITEM_ADDED,
            item: item,
            after: nextLowerPair ? nextLowerPair[0] : undefined,
            before: nextHigherPair ? nextHigherPair[0] : undefined
        };
    }

    private onItemRemoved(item: TItem): StdObservableCollectionChange<TItem> {
        const nextLowerPair = this._btree.nextLowerPair(item);
        const nextHigherPair = this._btree.nextHigherPair(item);

        this._btree.delete(item);

        return {
            changeType: StdObservableCollectionChangeType.ITEM_REMOVED,
            item: item,
            after: nextLowerPair ? nextLowerPair[0] : undefined,
            before: nextHigherPair ? nextHigherPair[0] : undefined
        };        
    }

    private onCleared(): StdObservableCollectionChange<TItem> {
        this._btree.clear();

        return {
            changeType: StdObservableCollectionChangeType.CLEARED,
            item: undefined!
        };
    }
    
    private readonly _collectionObservers2: CallbackSet<StdObservableCollectionObserver<TItem>> = new CallbackSet("StdObservableSortedView2-collectionObservers");

    addCollectionObserver(observer: StdObservableCollectionObserver<TItem>): IDisposable {
        return this._collectionObservers2.add(observer);
    }

    removeCollectionObserver(observer: StdObservableCollectionObserver<TItem>): void {
        this._collectionObservers2.delete(observer);
    }

    *iterateValues(): Iterable<TItem> {
        Observable.publishNamedRead(this._obsName, this._version);
        for (let v of this._btree.values()) {
            yield v;
        }
    }

    [Symbol.iterator](): Iterable<TItem> {
        return this.iterateValues();
    }    

    get length(): number { 
        Observable.publishNamedRead(this._obsName, this._version);
        return this._btree.size; 
    }
}

export class StdObservableSortedView<TItem extends object, TSortKey> implements ReadOnlyStdObservableCollection<TItem>, IDisposable {
    static _nextSortedViewId: number = 0;

    constructor(
        private readonly innerCollection: ReadOnlyStdObservableCollection<TItem>,
        private readonly keyExtractor: (item: TItem) => TSortKey,
        keyComparer: (a: TSortKey, b: TSortKey) => number) {

        const myViewId = StdObservableSortedView._nextSortedViewId++;
        this._updatesKey = `StdObservableSortedView-${myViewId}`;

        const innerKeyComparer = (a: SortedViewItem<TItem, TSortKey>, b: SortedViewItem<TItem, TSortKey>) => {
            let ir: number;

            if (a.currentSortKey == undefined && b.currentSortKey == undefined) {
                ir = a.uniqueId - b.uniqueId;
            }
            else if (a.currentSortKey == undefined) {
                return 1;
            }
            else if (b.currentSortKey == undefined) {
                return -1;
            }
            else {
                ir = keyComparer(a.currentSortKey, b.currentSortKey);
            }

            if (ir == 0) {
                return a.uniqueId - b.uniqueId;
            }
            return ir;
        };

        this._btree = new BTree([], innerKeyComparer);

        const initEntries = this.getRebuildEntries(innerCollection);
        this.onInnerCollectionChanged(initEntries);

        this._disposables.add(innerCollection.addCollectionObserver(changes => {
            this.onInnerCollectionChanged(changes);
        }));
    }
    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            
            for (let d of this._disposables) {
                d.dispose();
            }
            for (let v of this._btree.values()) {
                const item = v.item;
                delete (item as any)[this._skitem];
                v.sortKeyExpression.dispose();
            }
            this._btree.clear();
        }
    }

    private getRebuildEntries<T>(obs: ReadOnlyStdObservableCollection<T>) {
        let prevItem: (T | undefined) = undefined;

        const entries: StdObservableCollectionChange<T>[] = [];
        for (let item of obs.iterateValues()) {
            //if (prevItem) {
                const pentry = new StdObservableCollectionChange<T>(
                    StdObservableCollectionChangeType.ITEM_ADDED,
                    item,
                    undefined,
                    prevItem
                );
                entries.push(pentry);
            //}
            prevItem = item;
        }
        return entries;
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }

    private readonly _skitem: symbol = Symbol("StdObservableSortedView tracking item");

    private _disposed = false;
    private readonly _disposables: Set<IDisposable> = new Set();

    private readonly _btree: BTree<SortedViewItem<TItem, TSortKey>, SortedViewItem<TItem, TSortKey>>;

    private insertItemInternal(item: TItem) {
        const myUniqueId = ObjectUniqueId.get(item);
        const sk: SortedViewItem<TItem, TSortKey> = {
            uniqueId: myUniqueId,
            inserted: false,
            item: item,
            currentSortKey: null!,
            sortKeyExpression: null!
        };
        (item as any)[this._skitem] = sk;

        const doKeyChange = (newSortKey: TSortKey | undefined) => {
            if (newSortKey != sk.currentSortKey) {
                const origNextLowerItem = sk.inserted ? this._btree.nextLowerKey(sk) : undefined;
                const origNextHigherItem = sk.inserted ? this._btree.nextHigherKey(sk) : undefined;

                if (sk.inserted) {
                    this._btree.delete(sk);
                }
                sk.currentSortKey = newSortKey;
                this._btree.set(sk, sk);

                const newNextLowerItem = this._btree.nextLowerKey(sk);
                const newNextHigherItem = this._btree.nextHigherKey(sk);

                if (!sk.inserted || origNextLowerItem != newNextLowerItem || origNextHigherItem != newNextHigherItem) {
                    const changeItems = [];
                    if (sk.inserted) {
                        changeItems.push(
                            new StdObservableCollectionChange<TItem>(
                                StdObservableCollectionChangeType.ITEM_REMOVED, sk.item, 
                                origNextHigherItem?.item ?? undefined,
                                origNextLowerItem?.item ?? undefined
                            )
                        );
                    }
                    sk.inserted = true;
                    changeItems.push(
                        new StdObservableCollectionChange<TItem>(
                            StdObservableCollectionChangeType.ITEM_ADDED, sk.item,
                            newNextHigherItem?.item ?? undefined,
                            newNextLowerItem?.item ?? undefined
                        )
                    );
                    this.onChange(changeItems);
                }
            }
        };

        sk.sortKeyExpression = new ObservableExpression<TSortKey>(() => this.keyExtractor(item),
            (sortKey) => { doKeyChange(sortKey); },
            (err) => { doKeyChange(undefined); });
    }

    private removeItemInternal(item: TItem) {
        const sk = (item as any)[this._skitem] as SortedViewItem<TItem, TSortKey>;
        delete (item as any)[this._skitem];

        const nextLowerItem = this._btree.nextLowerKey(sk);
        const nextHigherItem = this._btree.nextHigherKey(sk);

        this._btree.delete(sk);
        sk.sortKeyExpression.dispose();

        this.onChange([
            new StdObservableCollectionChange<TItem>(
                StdObservableCollectionChangeType.ITEM_REMOVED,
                sk.item,
                nextHigherItem?.item ?? undefined,
                nextLowerItem?.item ?? undefined
            )
        ]);
    }

    private _changesCollector: StdObservableCollectionChange<TItem>[] | null = null;
    private onInnerCollectionChanged(changes: StdObservableCollectionChange<TItem>[]) {
        if (this._disposed) { return; }

        const myChanges: StdObservableCollectionChange<TItem>[] = [];
        const prevChangesCollector = this._changesCollector;
        this._changesCollector = myChanges;
        try
        {
            for (let change of changes) {
                this.onInnerCollectionChangedSingle(change);
            }
        }
        finally {
            this._changesCollector = prevChangesCollector;
            this.onChange(myChanges);
        }
    }

    private onInnerCollectionChangedSingle(change: StdObservableCollectionChange<TItem>) {
        switch (change.changeType) {
            case StdObservableCollectionChangeType.ITEM_ADDED:
                {
                    const item = change.item;
                    this.insertItemInternal(item);
                }
                break;

            case StdObservableCollectionChangeType.ITEM_REMOVED:
                {
                    const item = change.item;
                    this.removeItemInternal(item);
                }
                break;

            case StdObservableCollectionChangeType.CLEARED:
                throw new Error("not implemented");
        }
    }

    private readonly _updatesKey: string;
    private _updatesVersion: number = 0;

    private onChange(changes: StdObservableCollectionChange<TItem>[]) {
        if (this._changesCollector) {
            this._changesCollector.push(...changes);
        }
        else {
            this._collectionObservers2.invoke(changes);
            Observable.publishNamedUpdate(this._updatesKey, this._updatesVersion++);
        }
    }

    private readonly _collectionObservers2: CallbackSet<StdObservableCollectionObserver<TItem>> = new CallbackSet("StdObservableSortedView-collectionObservers");

    addCollectionObserver(observer: StdObservableCollectionObserver<TItem>): IDisposable {
        return this._collectionObservers2.add(observer);
    }

    removeCollectionObserver(observer: StdObservableCollectionObserver<TItem>): void {
        this._collectionObservers2.delete(observer);
    }
    
    *iterateValues(): Iterable<TItem> {
        Observable.publishNamedRead(this._updatesKey, this._updatesVersion);
        for (let k of this._btree.valuesArray()) {
            yield k.item;
        }
    }

    [Symbol.iterator](): Iterable<TItem> {
        return this.iterateValues();
    }

    get length(): number { 
        Observable.publishNamedRead(this._updatesKey, this._updatesVersion);
        return this._btree.size; 
    }
}

interface SortedViewItem<TItem, TSortKey> {
    uniqueId: number;
    inserted: boolean;
    item: TItem;
    currentSortKey: TSortKey | undefined;
    sortKeyExpression: ObservableExpression<TSortKey>;
}