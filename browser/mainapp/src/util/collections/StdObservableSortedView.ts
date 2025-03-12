import { CallbackSet } from "../CallbackSet";
import { IDisposable, asDisposable } from "../Disposable";
import { ObjectUniqueId } from "../ObjectUniqueId";
import { Observable } from "../Observable";
import { ObservableExpression } from "../ObservableExpression";
import BTree from "../btree/btree";
import { ReadOnlyStdObservableCollection, StdObservableCollectionChange, StdObservableCollectionChangeType, StdObservableCollectionObserver } from "./ReadOnlyStdObservableCollection";
import { SnapshottableSet } from "./SnapshottableSet";

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