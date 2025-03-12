import { CallbackSet } from "../CallbackSet";
import { IDisposable, asDisposable } from "../Disposable";
import BTree from "../btree/btree";
import { ReadOnlyStdObservableCollection, StdObservableCollectionChange, StdObservableCollectionChangeType, StdObservableCollectionObserver } from "./ReadOnlyStdObservableCollection";
import { SnapshottableSet } from "./SnapshottableSet";

export class StdObservableList<T> implements ReadOnlyStdObservableCollection<T> {
    constructor() {
        const self = this;

        const asNumericPropertyKey = (p: string | symbol): number | null => {
            return null;
        };
        return new Proxy(self, {
            get(target: StdObservableList<T>, p: string | symbol, receiver: any): any {
                const npk = asNumericPropertyKey(p);
                if (npk != null) {
                    return self.getItem(npk);
                }
                else {
                    return (self as any)[p];
                }
            },
            set(target: StdObservableList<T>, p: string | symbol, newValue: any, receiver: any): boolean {
                const npk = asNumericPropertyKey(p);
                if (npk != null) {
                    self.setItem(npk, newValue);
                }
                else {
                    (self as any)[p] = newValue;
                }
                return true;
            }
        });
    }

    private _items: T[] = [];

    get length(): number { return this._items.length; }

    getItem(index: number): T {
        return this._items[index];
    }

    setItem(index: number, value: T) {
        this._items[index] = value;
    }

    push(...items: T[]): number {
        if (items.length > 0) {
            let insertAfter = this._items.length > 0 ? this._items[this._items.length - 1] : undefined;
            const result = this._items.push(...items);

            const entries: StdObservableCollectionChange<T>[] = [];
            for (let titem of items) {
                const entry = new StdObservableCollectionChange<T>(
                    StdObservableCollectionChangeType.ITEM_ADDED,
                    titem,
                    undefined,
                    insertAfter
                );
                entries.push(entry);
                insertAfter = titem;
            }

            return result;
        }
        return 0;
    }

    pop(): T | undefined {
        const items = this._items;
        if (items.length > 0) {
            const result = this._items.pop()!;
            this.onCollectionChange([ new StdObservableCollectionChange<T>(
                StdObservableCollectionChangeType.ITEM_REMOVED,
                result,
                undefined,
                items.length > 0 ? items[items.length - 1] : undefined
            )]);
            return result;
        }
        return undefined;
    }

    unshift(...items: T[]): number {
        if (items.length > 0) {
            const insertBefore = this._items.length > 0 ? this._items[0] : undefined;
            const result = this._items.unshift(...items);

            let insertAfter: (T | undefined) = undefined;
            const entries: StdObservableCollectionChange<T>[] = [];
            for (let titem of items) {
                const entry = new StdObservableCollectionChange<T>(
                    StdObservableCollectionChangeType.ITEM_ADDED,
                    titem,
                    insertBefore,
                    insertAfter
                );
                entries.push(entry);
                insertAfter = titem;
            }

            return result;
        }
        return 0;
    }

    shift(): T | undefined {
        const items = this._items;
        if (items.length > 0) {
            const result = this._items.shift()!;
            this.onCollectionChange([ new StdObservableCollectionChange<T>(
                StdObservableCollectionChangeType.ITEM_REMOVED,
                result,
                items.length > 0 ? items[0] : undefined,
                undefined
            )]);
            return result;
        }
        return undefined;
    }

    private readonly _observers2: CallbackSet<StdObservableCollectionObserver<T>> = new CallbackSet("StdObservableList-observers");

    protected onCollectionChange(changes: StdObservableCollectionChange<T>[]) {
        this._observers2.invoke(changes);
    }

    addCollectionObserver(observer: StdObservableCollectionObserver<T>): IDisposable {
        return this._observers2.add(observer);
    }

    removeCollectionObserver(observer: StdObservableCollectionObserver<T>): void {
        this._observers2.delete(observer);
    }

    *values(): Iterable<T> {
        for (let item of this._items) {
            yield item;
        }
    }

    [Symbol.iterator](): Iterable<T> {
        return this.values();
    }

    iterateValues(): Iterable<T> {
        return this.values();
    }
}

export class StdObservableSortedList<TSortKey, TItem extends object> implements ReadOnlyStdObservableCollection<TItem> {
    constructor(
        private readonly keyExtractor: (item: TItem) => TSortKey,
        keyComparer?: (a: TSortKey, b: TSortKey) => number) {

        this._btree = new BTree(undefined, keyComparer);
    }

    private readonly _btree: BTree<TSortKey, TItem>;
    private readonly _sortKeys: Map<TItem, TSortKey> = new Map();

    private initializeSortKey(item: TItem): TSortKey {
        const sortKey = this.keyExtractor(item);
        this._sortKeys.set(item, sortKey);
        return sortKey;
    }

    private getSortKey(item: TItem): TSortKey | undefined {
        const sortKey = this._sortKeys.get(item);
        return sortKey;
    }

    private clearSortKey(item: TItem): TSortKey {
        const sortKey = this._sortKeys.get(item)!;
        this._sortKeys.delete(item);
        return sortKey;
    }

    add(item: TItem) {
        const sortKey = this.initializeSortKey(item);
        this._btree.set(sortKey, item);

        const lowerPair = this._btree.nextLowerPair(sortKey);
        const higherPair = this._btree.nextHigherPair(sortKey);
        
        this.notifyObservers([
            new StdObservableCollectionChange<TItem>(
                StdObservableCollectionChangeType.ITEM_ADDED,
                item,
                higherPair ? higherPair[1] : undefined,
                lowerPair ? lowerPair[1] : undefined
            )
        ]);
    }

    delete(item: TItem) {
        const sortKey = this.clearSortKey(item);

        const lowerPair = this._btree.nextLowerPair(sortKey);
        const higherPair = this._btree.nextHigherPair(sortKey);

        this._btree.delete(sortKey);

        this.notifyObservers([
            new StdObservableCollectionChange<TItem>(
                StdObservableCollectionChangeType.ITEM_REMOVED,
                item,
                higherPair ? higherPair[1] : undefined,
                lowerPair ? lowerPair[1] : undefined
            )
        ]);
    }

    has(item: TItem): boolean {
        const result = !!(this.getSortKey(item));
        return result;
    }

    get length(): number { return this._btree.size; }

    private readonly _observers2: CallbackSet<StdObservableCollectionObserver<TItem>> = new CallbackSet("StdObservableSortedList-observers");

    private notifyObservers(entries: StdObservableCollectionChange<TItem>[]) {
        this._observers2.invoke(entries);
    }

    addCollectionObserver(observer: StdObservableCollectionObserver<TItem>): IDisposable {
        return this._observers2.add(observer);
    }

    removeCollectionObserver(observer: StdObservableCollectionObserver<TItem>): void {
        return this._observers2.delete(observer);
    }

    [Symbol.iterator](): Iterable<TItem> {
        return this.values();
    }

    *values(): Iterable<TItem> {
        for (let item of this._btree.values()) {
            yield item;
        }
    }

    iterateValues(): Iterable<TItem> {
        return this.values();
    }
}

class LinkedList<T extends object> {
    constructor(
        private readonly debug: boolean = true) {
    }

    private readonly _members: Set<T> = new Set();
    private readonly _nexts: Map<T, T> = new Map();
    private readonly _prevs: Map<T, T> = new Map();

    private _head: (T | undefined) = undefined;

    private getIsMember(item: T): boolean {
        return this._members.has(item);
    }
    
    get head(): (T | undefined) { return this._head; }
    getPrev(item: (T | undefined)): (T | undefined) {
        if (item !== undefined) {
            return this._prevs.get(item);
        }
        else {
            return undefined;
        }
    }
    getNext(item: (T | undefined)): (T | undefined) {
        if (item !== undefined) {
            return this._nexts.get(item);
        }
        else {
            return undefined;
        }
    }

    private setIsMember(item: T, isMember: boolean) {
        if (isMember) {
            this._members.add(item);
        }
        else {
            this._members.delete(item);
        }
    }
    private setPrev(item: T, prev: (T | undefined)): void {
        if (prev !== undefined) {
            this._prevs.set(item, prev);
        }
        else {
            this._prevs.delete(item);
        }
    }
    private setNext(item: T, next: (T | undefined)): void {
        if (next !== undefined) {
            this._nexts.set(item, next);
        }
        else {
            this._nexts.delete(item);
        }
    }

    add(item: T, before: (T | undefined), after: (T | undefined)) {
        if (this.debug) {
            if (this.getIsMember(item)) {
                debugger; // item is already a member of this linked list!
            }
            if (before !== undefined && after !== undefined) {
                const beforesAfter = this.getPrev(before);
                const aftersBefore = this.getNext(after);
                if (beforesAfter != after || aftersBefore != before) {
                    debugger; // item not being inserted in a sensical order!
                }
            }
        }
        this.setPrev(item, after);
        this.setNext(item, before);
        if (before) {
            this.setPrev(before, item);
        }
        if (after) {
            this.setNext(after, item);
        }
        else {
            this._head = item;
        }
        this._length++;
    }

    delete(item: T) {
        if (!this.getIsMember(item)) {
            return;
        }

        const prev = this.getPrev(item);
        const next = this.getNext(item);
        this.setPrev(item, undefined);
        this.setNext(item, undefined);
        if (prev) {
            this.setNext(prev, next);
        }
        else {
            this._head = next;
        }
        if (next) {
            this.setPrev(next, prev);
        }
        this._length--;
    }

    private _length: number = 0;
    get length(): number { return this._length; }

    contains(item: T) {
        return this.getIsMember(item);
    }

    *values() {
        let curItem = this._head;
        while (curItem !== undefined) {
            yield curItem;
            curItem = this.getNext(curItem);
        }
    }
}

function getRebuildEntries<T>(obs: ReadOnlyStdObservableCollection<T>) {
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

export class StdObservableMappedView<TOuter extends object, TInner extends object> implements ReadOnlyStdObservableCollection<TOuter>, IDisposable {
    constructor(
        private readonly inner: ReadOnlyStdObservableCollection<TInner>,
        private readonly mappingFunction: (item: TInner) => TOuter) {

        const initEntries = getRebuildEntries(inner);
        this.innerCollectionChange(initEntries);

        this._innerSubscription = inner.addCollectionObserver(entries => this.innerCollectionChange(entries));
    }

    private _disposed: boolean = false;
    private readonly _innerSubscription: IDisposable;

    private _mappedItems: LinkedList<TOuter> = new LinkedList();

    private readonly _innerToOuter: Map<TInner, TOuter> = new Map();
    private readonly _outerToInner: Map<TOuter, TInner> = new Map();

    private getInner(outer: (TOuter | undefined)): (TInner | undefined) {
        if (outer !== undefined) {
            return this._outerToInner.get(outer);
        }
        else {
            return undefined;
        }
    }
    private setInner(outer: TOuter, inner: (TInner | undefined)) {
        if (inner !== undefined) {
            this._outerToInner.set(outer, inner);
        }
        else {
            this._outerToInner.delete(outer);
        }
    }
    private getOuter(inner: (TInner | undefined)): (TOuter | undefined) {
        if (inner !== undefined) {
            return this._innerToOuter.get(inner);
        }
        else {
            return undefined;
        }
    }
    private setOuter(inner: TInner, outer: (TOuter | undefined)) {
        if (outer !== undefined) {
            this._innerToOuter.set(inner, outer);
        }
        else {
            this._innerToOuter.delete(inner);
        }
    }

    get length() { return this._mappedItems.length; }

    dispose(): void {
        if (!this._disposed) {
            this._disposed = true;
            this._innerSubscription.dispose();

            const ll = this._mappedItems;
            let entries: StdObservableCollectionChange<TInner>[] = [];
            for (let item of this._mappedItems.values()) {
                const innerItem = this.getInner(item)!;
                const prev = this.getInner(ll.getPrev(item));
                const next = this.getInner(ll.getNext(item));

                const entry = new StdObservableCollectionChange<TInner>(
                    StdObservableCollectionChangeType.ITEM_REMOVED,
                    innerItem,
                    next,
                    prev);
                entries.push(entry);
            }
            this.innerCollectionChange(entries);
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }

    private innerCollectionChange(entries: StdObservableCollectionChange<TInner>[]) {
        const resultEntries: StdObservableCollectionChange<TOuter>[] = [];

        for (let entry of entries) {
            switch (entry.changeType) {
                case StdObservableCollectionChangeType.ITEM_ADDED:
                    {
                        const newOuter = this.createMappedObject(entry.item, entry.before, entry.after);
                        resultEntries.push(new StdObservableCollectionChange<TOuter>(
                            StdObservableCollectionChangeType.ITEM_ADDED,
                            newOuter,
                            this._mappedItems.getNext(newOuter),
                            this._mappedItems.getPrev(newOuter)
                        ));
                    }
                    break;
                case StdObservableCollectionChangeType.ITEM_REMOVED:
                    {
                        const outer = this.getOuter(entry.item)!;
                        const beforeOuter = this._mappedItems.getNext(outer);
                        const afterOuter = this._mappedItems.getPrev(outer);
                        this.destroyMappedObject(entry.item);

                        resultEntries.push(new StdObservableCollectionChange<TOuter>(
                            StdObservableCollectionChangeType.ITEM_REMOVED,
                            outer,
                            beforeOuter,
                            afterOuter
                        ));
                    }
                    break;
            }
        }

        this.notifyObservers(resultEntries);
    }

    private createMappedObject(inner: TInner, before: TInner | undefined, after: TInner | undefined): TOuter {
        const outer = this.mappingFunction(inner);
        this.setInner(outer, inner);
        this.setOuter(inner, outer);
        this._mappedItems.add(outer, this.getOuter(before), this.getOuter(after));
        return outer;
    }

    private destroyMappedObject(inner: TInner) {
        const outer = this.getOuter(inner)!;
        this._mappedItems.delete(outer);
        this.setInner(outer, undefined);
        this.setOuter(inner, undefined);

        if (typeof (inner as any).dispose == "function") {
            try { (inner as any).dispose(); }
            catch { }
        }
    }

    private readonly _observers2: CallbackSet<StdObservableCollectionObserver<TOuter>> = new CallbackSet("StdObservableMappedView-observers");

    addCollectionObserver(observer: StdObservableCollectionObserver<TOuter>): IDisposable {
        return this._observers2.add(observer);
    }

    removeCollectionObserver(observer: StdObservableCollectionObserver<TOuter>): void {
        return this._observers2.delete(observer);
    }

    private notifyObservers(entries: StdObservableCollectionChange<TOuter>[]) {
        this._observers2.invoke(entries);
    }

    [Symbol.iterator](): Iterable<TOuter> {
        return this.values();    
    }

    *values(): Iterable<TOuter> {
        return this._mappedItems.values();
    }

    iterateValues(): Iterable<TOuter> {
        return this.values();
    }
}

const MAX_FILTERSORTKEY = 999_999_999_999_999;
const MIN_FILTERSORTKEY = -999_999_999_999_999;
export class StdObservableFilteredView<T extends object> implements ReadOnlyStdObservableCollection<T>, IDisposable {
    constructor(
        private readonly inner: ReadOnlyStdObservableCollection<T>,
        private readonly filter: (item: T) => boolean) {
        
        this._btree = new BTree();

        const initEntries = getRebuildEntries(inner);
        this.innerCollectionChange(initEntries);

        this._innerSubscription = inner.addCollectionObserver(entries => this.innerCollectionChange(entries));
    }

    private _disposed = false;
    private readonly _innerSubscription: IDisposable;

    private readonly _sortKeys: Map<T, number> = new Map();
    private _btree: BTree<number, T>;

    dispose(): void {
        if (!this._disposed) {
            this._disposed = true;
            this._innerSubscription.dispose();
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }

    get length(): number { return this._btree.size; }

    private renumberSortKeys() {
        const filterPassItems = [...this._btree.values()];
        this._btree.clear();

        const range = (MAX_FILTERSORTKEY - MIN_FILTERSORTKEY);
        const step = (range / 2) / this.inner.length;
        let curKey = MIN_FILTERSORTKEY + (range / 4);
        this._sortKeys.clear();
        for (let item of this.inner.iterateValues()) {
            this.assignSortKey(item, curKey);
            curKey += step;
        }

        for (let filteredItem of filterPassItems) {
            const sortKey = this.getSortKey(filteredItem);
            this._btree.set(sortKey, filteredItem);
        }
    }

    private createSortKey(item: T, before: T | undefined, after: T | undefined): number {
        const upperBound = (before !== undefined) ? this.getSortKey(before) : MAX_FILTERSORTKEY;
        const lowerBound = (after !== undefined) ? this.getSortKey(after) : MIN_FILTERSORTKEY;
        const mySortKey = ((upperBound - lowerBound) / 2) + lowerBound;
        if (mySortKey > lowerBound && mySortKey < upperBound) {
            this._sortKeys.set(item, mySortKey);
            return mySortKey;
        }
        else {
            this.renumberSortKeys();
            return this.createSortKey(item, before, after);
        }
    }
    private assignSortKey(item: T, sortKey: number) {
        this._sortKeys.set(item, sortKey);
    }

    private getSortKey(item: T): number {
        return this._sortKeys.get(item)!;
    }

    private clearSortKey(item: T): number {
        const result = this._sortKeys.get(item)!;
        this._sortKeys.delete(item);
        return result;
    }

    private innerCollectionChange(entries: StdObservableCollectionChange<T>[]) {
        const resultEntries: StdObservableCollectionChange<T>[] = [];

        for (let entry of entries) {
            switch (entry.changeType) {
                case StdObservableCollectionChangeType.ITEM_ADDED:
                    {
                        const item = entry.item;
                        const sortKey = this.createSortKey(item, entry.before, entry.after);

                        const passesFilter = this.filter(item);
                        if (passesFilter) {
                            this._btree.set(sortKey, item);
                            const prevPair = this._btree.nextLowerPair(sortKey);
                            const nextPair = this._btree.nextHigherPair(sortKey);
                            const nentry = new StdObservableCollectionChange<T>(
                                StdObservableCollectionChangeType.ITEM_ADDED,
                                item,
                                nextPair ? nextPair[1] : undefined,
                                prevPair ? prevPair[1] : undefined
                            );
                            resultEntries.push(nentry);
                        }
                    }
                    break;
                case StdObservableCollectionChangeType.ITEM_REMOVED:
                    {
                        const item = entry.item;
                        const sortKey = this.clearSortKey(item);
                        if (this._btree.has(sortKey)) {
                            const prevPair = this._btree.nextLowerPair(sortKey);
                            const nextPair = this._btree.nextHigherPair(sortKey);
                            this._btree.delete(sortKey);
                            const nentry = new StdObservableCollectionChange<T>(
                                StdObservableCollectionChangeType.ITEM_REMOVED,
                                item,
                                nextPair ? nextPair[1] : undefined,
                                prevPair ? prevPair[1] : undefined
                            );
                            resultEntries.push(nentry);
                        }
                    }
                    break;
            }
        }

        this.notifyObservers(resultEntries);
    }

    private readonly _observers2: CallbackSet<StdObservableCollectionObserver<T>> = new CallbackSet("StdObservableFilteredView-observers");

    private notifyObservers(entries: StdObservableCollectionChange<T>[]) {
        this._observers2.invoke(entries);
    }

    addCollectionObserver(observer: StdObservableCollectionObserver<T>): IDisposable {
        return this._observers2.add(observer);
    }

    removeCollectionObserver(observer: StdObservableCollectionObserver<T>): void {
        this._observers2.delete(observer);
    }

    [Symbol.iterator](): Iterable<T> {
        return this.values();
    }

    values(): Iterable<T> {
        return this._btree.values();
    }

    iterateValues(): Iterable<T> {
        return this.values();
    }
}