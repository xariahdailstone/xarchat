import { EmptyDisposable, IDisposable, asDisposable } from "./Disposable";
import { ObjectUniqueId } from "./ObjectUniqueId";
import { Observable, ObservableValue, PropertyChangeEvent, PropertyChangeEventListener, ValueSubscription } from "./Observable";
import { observableProperty, setupValueSubscription } from "./ObservableBase";
import { CollectionChangeEventListener, KeyedCollection, ObservableCollection } from "./ObservableCollection";
import { Predicate } from "./Predicate";
import BTree from "./btree/btree";
import { KeyValuePair } from "./collections/KeyValuePair";
import { ReadOnlyStdObservableCollection, StdObservableCollectionChange, StdObservableCollectionChangeType, StdObservableCollectionObserver } from "./collections/ReadOnlyStdObservableCollection";
import { SnapshottableSet } from "./collections/SnapshottableSet";

export interface ReadOnlyObservableOrderedDictionary<TKey, TItem> extends Observable, ReadOnlyStdObservableCollection<KeyValuePair<TKey, TItem>> {
    get(key: TKey): TItem | undefined;
    has(key: TKey): boolean;
    get size(): number;

    values(): Iterable<TItem>;
    minKey(): TKey | undefined;

    addEventListener(eventName: "dictionarychange", callback: (ev: DictionaryChangeEvent<TKey, TItem>) => void): IDisposable;
    addEventListener(eventName: "propertychange", callback: PropertyChangeEventListener): IDisposable;

    removeEventListener(eventName: "propertychange", callback: PropertyChangeEventListener): void;

    addValueSubscription(propertyPath: string, handler: (value: any) => any): ValueSubscription;
}

export interface ObservableOrderedDictionary<TKey, TItem> extends ReadOnlyObservableOrderedDictionary<TKey, TItem> {
    set(key: TKey, value: TItem): void;
    delete(key: TKey): boolean;
}

export interface ObservableKeyExtractedOrderedDictionary<TKey, TItem> extends Omit<ObservableOrderedDictionary<TKey, TItem>, "set"> {
    add(value: TItem): void;
}

export interface ObservableOrderedSet<TItem> extends ObservableKeyExtractedOrderedDictionary<TItem, TItem> { }

export enum DictionaryChangeType {
    ITEM_ADDED,
    ITEM_REMOVED
}

export class DictionaryChangeEvent<TKey, TItem> {
    constructor(
        public readonly type: DictionaryChangeType, 
        public readonly key: TKey, 
        public readonly item: TItem, 
        public readonly beforeKey?: TKey, 
        public readonly beforeItem?: TItem, 
        public readonly afterKey?: TKey, 
        public readonly afterItem?: TItem) {
    }
}

export type DictionaryChangeEventHandler<TKey, TItem> = (ev: DictionaryChangeEvent<TKey, TItem>) => void;

export class ObservableOrderedSetImpl<TKey, TItem> implements ReadOnlyStdObservableCollection<TItem> {
    constructor(
        private readonly keyExtractor: (item: TItem) => TKey, 
        keyComparator?: (a: TKey, b: TKey) => number) {

        this._inner = new ObservableOrderedDictionaryImpl<TKey, TItem>(keyExtractor, keyComparator);
        this._inner.addCollectionObserver(changes => {
            const mappedChanges: StdObservableCollectionChange<TItem>[] = [];
            for (let change of changes) {
                mappedChanges.push(new StdObservableCollectionChange<TItem>(change.changeType, change.item.value, 
                    change.before?.value, change.after?.value));
            }
            this._observers.forEachValueSnapshotted(obs => {
                try { obs(mappedChanges); }
                catch { }
            });
        });
    }

    private readonly _inner: ObservableOrderedDictionaryImpl<TKey, TItem>;

    private readonly _observers: SnapshottableSet<StdObservableCollectionObserver<TItem>> = new SnapshottableSet();

    addCollectionObserver(observer: StdObservableCollectionObserver<TItem>): IDisposable {
        this._observers.add(observer);
        return asDisposable(() => {
            this.removeCollectionObserver(observer);
        });
    }

    removeCollectionObserver(observer: StdObservableCollectionObserver<TItem>): void {
        this._observers.delete(observer);
    }

    @observableProperty
    get length(): number { return this._inner.size; }

    clear() {
        while (this._inner.size > 0) {
            this._inner.delete(this._inner.minKey()!);
        }
    }

    add(item: TItem) {
        this._inner.add(item);
    }

    delete(item: TItem) {
        const key = this.keyExtractor(item);
        this._inner.delete(key);
    }

    *values(): Iterable<TItem> {
        for (let kvp of this._inner.iterateValues()) {
            yield kvp.value;
        }
    }

    iterateValues(): Iterable<TItem> {
        return this.values();    
    }
}

export class ObservableOrderedDictionaryImpl<TKey, TItem> implements ObservableKeyExtractedOrderedDictionary<TKey, TItem> {
    constructor(
        private readonly keyExtractor: (item: TItem) => TKey, keyComparator?: (a: TKey, b: TKey) => number) {

        this._id = ObservableOrderedDictionaryImpl._nextId++;
        this._btree = new BTree(undefined, keyComparator);
    }

    private static _nextId: number = 0;
    private readonly _id: number;
    private readonly _btree: BTree<TKey, KeyValuePair<TKey, TItem>>;

    get(key: TKey): TItem | undefined {
        if (this._btree.has(key)) {
            const result = this._btree.get(key)!;
            Observable.publishNamedRead(this.getHasEventName(key), true);
            Observable.publishNamedRead(this.getValueEventName(key), result.value);
            return result.value;
        }
        else {
            Observable.publishNamedRead(this.getHasEventName(key), false);
            Observable.publishNamedRead(this.getValueEventName(key), undefined);
        }
    }

    add(value: TItem): void {
        const key = this.keyExtractor(value);
        if (!this._btree.has(key)) {
            const kvp = new KeyValuePair(key, value);
            this._btree.set(key, kvp, true);
            this.raiseItemChangeEvent(DictionaryChangeType.ITEM_ADDED, kvp);
            this.raiseLengthChangeEvent();
        }
    }

    private getHasEventName(key: TKey) { return `ObservableOrderedDictionaryImpl#${this._id}.has(${key})`; }
    private getValueEventName(key: TKey) { return `ObservableOrderedDictionaryImpl#${this._id}.has(${key})`; }

    has(key: TKey): boolean {
        const result = this._btree.has(key);
        Observable.publishNamedRead(this.getHasEventName(key), result);
        return result;
    }

    hasValue(item: TItem) {
        const key = this.keyExtractor(item);
        return this.has(key);
    }

    delete(key: TKey): boolean {
        const item = this._btree.get(key);
        if (item !== undefined) {
            this._btree.delete(key);
            this.raiseItemChangeEvent(DictionaryChangeType.ITEM_REMOVED, item);
            this.raiseLengthChangeEvent();
            return true;
        }
        else {
            return false;
        }
    }

    deleteByValue(value: TItem) {
        const key = this.keyExtractor(value);
        this.delete(key);
    }

    clear() {
        while (this.size > 0) {
            this.delete(this.minKey()!);
        }
    }

    private readonly _valuesVersion: ObservableValue<number> = new ObservableValue(0);

    @observableProperty
    get size(): number { 
        const v = this._valuesVersion;
        const size = this._btree.size;
        return size;
    }

    @observableProperty
    get length(): number { 
        const v = this._valuesVersion;
        const size = this._btree.size;
        return size;
    }

    *values(): Iterable<TItem> {
        const v = this._valuesVersion;
        for (let v of this._btree.values()) {
            yield v.value;
        }
    }

    *iterateValues(): Iterable<KeyValuePair<TKey, TItem>> {
        const v = this._valuesVersion;
        for (let kvp of this._btree.values()) {
            yield kvp;
        }
    }

    minKey() {
        const v = this._valuesVersion;
        return this._btree.minKey();
    }

    private readonly _dictionaryChangeCallbacks: SnapshottableSet<DictionaryChangeEventHandler<TKey, TItem>> = new SnapshottableSet();
    private readonly _propertyChangeCallbacks: SnapshottableSet<((ev: Event) => void)> = new SnapshottableSet();

    addEventListener(eventName: "propertychange", callback: PropertyChangeEventListener): IDisposable;
    addEventListener(eventName: "dictionarychange", callback: DictionaryChangeEventHandler<TKey, TItem>): IDisposable;
    addEventListener(eventName: string, callback: any): IDisposable;
    addEventListener(eventName: string, callback: any): IDisposable {
        if (eventName == "dictionarychange") {
            this._dictionaryChangeCallbacks.add(callback as any);
            return asDisposable(() => {
                this._dictionaryChangeCallbacks.delete(callback as any);
            });
        }
        else if (eventName == "propertychange") {
            this._propertyChangeCallbacks.add(callback as any);
            return asDisposable(() => {
                this._propertyChangeCallbacks.delete(callback as any);
            });
        }
        return EmptyDisposable;
    }

    removeEventListener(eventName: string, callback: PropertyChangeEventListener): void {
        if (eventName == "dictionarychange") {
            this._dictionaryChangeCallbacks.delete(callback as any);
        }
        else if (eventName == "propertychange") {
            this._propertyChangeCallbacks.delete(callback as any);
        }
    }

    protected raiseItemChangeEvent(type: DictionaryChangeType, kvp: KeyValuePair<TKey, TItem>) {
        const after = this._btree.nextLowerPair(kvp.key);
        const before = this._btree.nextHigherPair(kvp.key);

        if (this._dictionaryChangeCallbacks.size > 0) {
            Observable.enterObservableFireStack(() => {
                const ev = new DictionaryChangeEvent<TKey, TItem>(type, kvp.key, kvp.value, 
                    before?before[0]:undefined, before?before[1].value:undefined, 
                    after?after[0]:undefined, after?after[1].value:undefined);

                this._dictionaryChangeCallbacks.forEachValueSnapshotted(handler => {
                    try { handler(ev); }
                    catch { }
                });
            });
        }
        if (this._stdColObservers.size > 0) {
            Observable.enterObservableFireStack(() => {
                const changes = [
                    new StdObservableCollectionChange<KeyValuePair<TKey, TItem>>(
                        (type == DictionaryChangeType.ITEM_ADDED) ? StdObservableCollectionChangeType.ITEM_ADDED : StdObservableCollectionChangeType.ITEM_REMOVED,
                        kvp,
                        before ? before[1] : undefined,
                        after ? after[1] : undefined
                    )
                ];
                this._stdColObservers.forEachValueSnapshotted(handler => {
                    try { handler(changes); }
                    catch { }
                });
            });
        }

        this.raisePropertyChangeEvent(`item(${kvp.key})`, this.size);
        Observable.publishNamedUpdate(this.getHasEventName(kvp.key), type == DictionaryChangeType.ITEM_ADDED);
        Observable.publishNamedUpdate(this.getValueEventName(kvp.key), type == DictionaryChangeType.ITEM_ADDED ? kvp.value : undefined);
        this._valuesVersion.value = this._valuesVersion.value + 1;
    }

    private raiseLengthChangeEvent() {
        this.raisePropertyChangeEvent("size", this.size);
        this.raisePropertyChangeEvent("length", this.length);
        this._valuesVersion.value = this._valuesVersion.value + 1;
    }

    raisePropertyChangeEvent(propertyName: string, propertyValue: unknown) {
        Observable.enterObservableFireStack(() => {
            this._propertyChangeCallbacks.forEachValueSnapshotted(handler => {
                try { handler(new PropertyChangeEvent(propertyName, propertyValue)); }
                catch { }
            });
        });
    }

    addValueSubscription(propertyPath: string, handler: (value: any) => any): ValueSubscription {
        return setupValueSubscription(this, propertyPath, handler);
    }


    private readonly _stdColObservers: SnapshottableSet<StdObservableCollectionObserver<KeyValuePair<TKey, TItem>>> = new SnapshottableSet();

    addCollectionObserver(observer: StdObservableCollectionObserver<KeyValuePair<TKey, TItem>>): IDisposable {
        this._stdColObservers.add(observer);
        return asDisposable(() => {
            this.removeCollectionObserver(observer);
        });
    }
    
    removeCollectionObserver(observer: StdObservableCollectionObserver<KeyValuePair<TKey, TItem>>): void {
        this._stdColObservers.delete(observer);
    }
}
