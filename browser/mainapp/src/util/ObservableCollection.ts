import { CallbackSet } from "./CallbackSet.js";
import { IDisposable, asDisposable } from "./Disposable.js";
import { Observable, ObservableValue, PropertyChangeEvent, PropertyChangeEventListener } from "./Observable.js";
import { Predicate } from "./Predicate.js";
import { ReadOnlyStdObservableCollection, StdObservableCollectionChange, StdObservableCollectionChangeType, StdObservableCollectionObserver } from "./collections/ReadOnlyStdObservableCollection.js";
import { SnapshottableSet } from "./collections/SnapshottableSet.js";

export interface ReadOnlyObservableCollection<T> extends ReadOnlyStdObservableCollection<T> {
    readonly [index: number]: (T | undefined);
    get length(): number;
    [Symbol.iterator](): Iterator<T>;
    addEventListener(eventName: "collectionchange", handler: CollectionChangeEventListener<T>): IDisposable;
    removeEventListener(eventName: "collectionchange", handler: CollectionChangeEventListener<T>): void;
}

export interface ObservableCollection<T> extends ReadOnlyObservableCollection<T> {
    [index: number]: (T | undefined);
    //get length(): number;
    push(...items: T[]): number;
    pop(): (T | undefined);
    shift(): (T | undefined);
    unshift(...items: T[]): number;
    remove(item: T): void;
    removeAt(index: number): void;
    removeWhere(predicate: Predicate<T>): void;
    //[Symbol.iterator](): Iterator<T>;

    filter(predicate: Predicate<T>): T[];
    contains(value: T): boolean;

    raisePropertyChangeEvent(propertyName: string, propertyValue: unknown): void;

    setPushSort(sortFunc: (SortFunction<T> | null)): void;
}

export type CollectionChangeEventListener<T> = (event: CollectionChangeEvent<T>) => any;

export class CollectionChangeEvent<T> extends Event {
    static itemChanged<T>(index: number, oldValue: T): CollectionChangeEvent<T> {
        return new CollectionChangeEvent(CollectionChangeType.ITEM_CHANGED, index, 1, oldValue);
    }

    static itemsUnshifted<T>(numItems: number): CollectionChangeEvent<T> {
        return new CollectionChangeEvent(CollectionChangeType.ITEMS_UNSHIFTED, 0, numItems);
    }

    static itemsPushed<T>(startIndex: number, numItems: number): CollectionChangeEvent<T> {
        return new CollectionChangeEvent(CollectionChangeType.ITEMS_PUSHED, startIndex, numItems);
    }

    static itemPopped<T>(oldValue: T): CollectionChangeEvent<T> {
        return new CollectionChangeEvent(CollectionChangeType.ITEM_POPPED, undefined, undefined, oldValue);
    }

    static itemShifted<T>(oldValue: T): CollectionChangeEvent<T> {
        return new CollectionChangeEvent(CollectionChangeType.ITEM_SHIFTED, undefined, undefined, oldValue);
    }

    static itemRemoved<T>(index: number, oldValue: T): CollectionChangeEvent<T> {
        return new CollectionChangeEvent(CollectionChangeType.ITEM_REMOVED, index, 1, oldValue);
    }

    constructor(
        public readonly collectionChangeType: CollectionChangeType, 
        public readonly index?: number,
        public readonly count?: number,
        public readonly removedItem?: T) {
        super("collectionchange");
    }
}

export enum CollectionChangeType {
    ITEM_CHANGED,
    ITEMS_UNSHIFTED,
    ITEMS_PUSHED,
    ITEM_POPPED,
    ITEM_SHIFTED,
    ITEM_REMOVED,
    ITEM_INSERTED
}

function isNumeric(value: string) {
    return /^\d+$/.test(value);
}

export interface KeyedCollection<TItem, TKey> extends ObservableCollection<TItem> {
    containsKey(key: TKey): boolean;
    removeByKey(key: TKey): void;
}

export class Collection<T> implements ObservableCollection<T>, Observable {
    [index: number]: (T | undefined);

    constructor() {
        const target = this;
        return new Proxy(this, {
            get(target: any, prop: PropertyKey, receiver: any) {
                if (typeof prop == "number" || isNumeric(prop.toString())) {
                    return target.getByIndex(+prop.toString());
                }
                else {
                    return (target as any)[prop];
                }
            },
            set(target: any, prop: PropertyKey, value: any, receiver: any) {
                if (typeof prop == "number" || isNumeric(prop.toString())) {
                    target.setByIndex(+prop.toString(), value);
                }
                else {
                    (target as any)[prop] = value;
                }
                return true;
            }
        });
    }

    private readonly _items: T[] = [];
    private readonly _itemsEnumerated: ObservableValue<object> = new ObservableValue<object>({});

    private readonly _itemsLength: ObservableValue<number> = new ObservableValue<number>(0);
    private readonly _itemsVersion: ObservableValue<number> = new ObservableValue<number>(0);

    private incrementVersion() {
        this._itemsVersion.value = this._itemsVersion.value + 1;
    }
    private dependOnVersion() {
        this._itemsVersion.takeReadDependency();
    }

    get length(): number { return this._itemsLength.value; }

    add(item: T): T {
        this.push(item);
        return item;
    }

    addAt(item: T, index: number): T {
        if (this._items.length == index) {
            this.add(item);
            return item;
        }
        else if (index == 0) {
            this.unshift(item);
            return item;
        }
        else {
            this._items.splice(index, 0, item);
            this.raiseCollectionChangeEvent(CollectionChangeType.ITEM_INSERTED, index, 1);
            this.raisePropertyChangeEvent("length", this._items.length);
            this.incrementVersion();
            return item;
        }
    }

    push(...items: T[]): number {
        if (this._pushSort != null) {
            return this.pushSorted(this._pushSort, ...items);
        }
        else {
            const _items = this._items;
            const addedItemsLength = items.length;

            const result = _items.push(...items);
            this.raiseCollectionChangeEvent(CollectionChangeType.ITEMS_PUSHED, _items.length - addedItemsLength, addedItemsLength);
            this.raisePropertyChangeEvent("length", this._items.length);
            this.incrementVersion();
            return result;
        }
    }

    pushSorted(sortFunc: SortFunction<T>, ...items: T[]): number {
        for (let item of items) {
            const insertIdx = this.findSortedInsertIndex(sortFunc, item);
            if (insertIdx == 0) {
                this._items.unshift(item);
                this.raiseCollectionChangeEvent(CollectionChangeType.ITEMS_UNSHIFTED, 0, 1);
            }
            else if (insertIdx == this._items.length) {
                this._items.push(item);
                this.raiseCollectionChangeEvent(CollectionChangeType.ITEMS_PUSHED, this._items.length - 1, 1);
            }
            else {
                this._items.splice(insertIdx, 0, item);
                this.raiseCollectionChangeEvent(CollectionChangeType.ITEM_INSERTED, insertIdx, 1);
            }
        }
        this.raisePropertyChangeEvent("length", this._items.length);
        this.incrementVersion();
        return items.length;
    }

    private findSortedInsertIndex(sortFunc: SortFunction<T>, item: T): number {
        if (this._items.length == 0) {
            return 0;
        }
        if (sortFunc(item, this._items[this._items.length - 1]) >= 0) {
            return this._items.length;
        }
        // TODO: optimize me
        for (let i = 0; i < this._items.length; i++) {
            const compareResult = sortFunc(item, this._items[i]);
            if (compareResult == -1) {
                return i;
            }
        }
        // let minIdx = 0;
        // let maxIdx = this._items.length - 1;
        // while (minIdx != maxIdx) {
        //     const checkIdx = minIdx + Math.floor((maxIdx - minIdx) / 2);
        //     const compareResult = sortFunc(item, this._items[checkIdx]);
        //     if (compareResult == -1) {
        //         maxIdx = checkIdx - 1;
        //     }
        //     else if (compareResult == 1) {
        //         minIdx = checkIdx;
        //     }
        //     else {
        //         return checkIdx;
        //     }
        // }
        return 0;
    }

    pop(): (T | undefined) {
        if (this._items.length > 0) {
            const result = this._items.pop();
            this.raiseCollectionChangeEvent(CollectionChangeType.ITEM_POPPED, undefined, undefined, result);
            this.raisePropertyChangeEvent("length", this._items.length);
            this.incrementVersion();
            return result;
        }
        else {
            return undefined;
        }
    }

    shift(): (T | undefined) {
        if (this._items.length > 0) {
            const result = this._items.shift();
            this.raiseCollectionChangeEvent(CollectionChangeType.ITEM_SHIFTED, undefined, undefined, result);
            this.raisePropertyChangeEvent("length", this._items.length);
            this.incrementVersion();
            return result;
        }
        else {
            return undefined;
        }
    }

    unshift(...items: T[]): number {
        const result = this._items.unshift(...items);
        this.raiseCollectionChangeEvent(CollectionChangeType.ITEMS_UNSHIFTED, 0, items.length);
        this.raisePropertyChangeEvent("length", this._items.length);
        this.incrementVersion();
        return result;
    }

    remove(item: T) {
        for (let x = 0; x < this._items.length; x++) {
            const titem = this._items[x];
            if (titem === item) {
                this.removeAt(x);
                x--;
            }
        }
    }

    removeAt(index: number) {
        if (index >= 0 && index < this._items.length) {
            const removedItems = this._items.splice(index, 1);
            this.raiseCollectionChangeEvent(CollectionChangeType.ITEM_REMOVED, index, 1, removedItems[0]);
            this.raisePropertyChangeEvent("length", this._items.length);
            this.incrementVersion();
        }
    }

    removeWhere(predicate: Predicate<T>): void {
        for (let x = 0; x < this._items.length; x++) {
            const titem = this._items[x];
            if (predicate(titem)) {
                this.removeAt(x);
                x--;
            }
        }
    }

    filter(predicate: Predicate<T>): T[] {
        this.dependOnVersion();
        return this._items.filter(predicate);
    }

    map<U>(func: (item: T) => U) {
        this.dependOnVersion();
        const results: U[] = [];
        for (let item of this._items) {
            results.push(func(item));
        }
        return results;
    }

    indexOf(value: T): number {
        this.dependOnVersion();
        const idx = this._items.indexOf(value);
        return idx;
    }

    contains(value: any): boolean {
        this.dependOnVersion();
        const idx = this._items.indexOf(value);
        return (idx != -1);
    }

    sortBy(compareFunc: (a: T, b: T) => number) {
        const sortedItems = [...this._items];
        sortedItems.sort(compareFunc);

        for (let i = 0; i < sortedItems.length; i++) {
            if (this[i] != sortedItems[i]) {
                this.remove(sortedItems[i]);
                this.addAt(sortedItems[i], i);
            }
        }
    }

    clear() {
        while (this._items.length > 0) {
            this.removeAt(0);
        }
    }

    *[Symbol.iterator](): Iterator<T> {
        const x = this._itemsEnumerated.value;
        this.dependOnVersion();
        for (let item of this._items) {
            yield item;
        }
    }

    private getByIndex(index: number) {
        const result = this._items[index];
        return result;
    }

    private setByIndex(index: number, value: T) {
        const existingValue = this._items[index];
        if (value !== existingValue) {
            const removedItem = this._items[index];
            this._items[index] = value;
            this.raiseCollectionChangeEvent(CollectionChangeType.ITEM_CHANGED, index, 1, removedItem);
            this.incrementVersion();
        }
    }

    private readonly _collectionChangeHandlers2 = new CallbackSet<CollectionChangeEventListener<T>>("ObservableCollection-collectionChangeHandlers");
    private readonly _propertyChangeHandlers2 = new CallbackSet<PropertyChangeEventListener>("ObservableCollection-propertyChangeHandlers");

    addEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): IDisposable;
    addEventListener(eventName: "collectionchange", handler: CollectionChangeEventListener<T>): IDisposable;
    addEventListener(eventName: string, handler: Function): IDisposable;
    addEventListener(eventName: string, handler: Function): IDisposable {
        if (eventName == "collectionchange") {
            return this._collectionChangeHandlers2.add(handler as CollectionChangeEventListener<T>);
        }
        else if (eventName == "propertychange") {
            return this._propertyChangeHandlers2.add(handler as PropertyChangeEventListener);
        }

        let disposed = false;
        return asDisposable(() => {
            if (!disposed) {
                disposed = true;
                this.removeEventListener(eventName, handler);
            }
        });
    }

    removeEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): void;
    removeEventListener(eventName: "collectionchange", handler: CollectionChangeEventListener<T>): void;
    removeEventListener(eventName: string, handler: Function): void;
    removeEventListener(eventName: string, handler: Function): void {
        if (eventName == "collectionchange") {
            this._collectionChangeHandlers2.delete(handler as CollectionChangeEventListener<T>);
        }
        else if (eventName == "propertychange") {
            this._propertyChangeHandlers2.delete(handler as PropertyChangeEventListener);
        }
    }

    protected raiseCollectionChangeEvent(type: CollectionChangeType, index?: number, count?: number, removedItem?: T): void {
        this._itemsLength.value = this._items.length;
        this._itemsEnumerated.value = {};
        if (this._collectionChangeHandlers2.size > 0) {
            const cce = new CollectionChangeEvent(type, index, count, removedItem);
            this._collectionChangeHandlers2.invoke(cce);
        }
        if (this._stdColObservers2.size > 0) {
            const changes: StdObservableCollectionChange<T>[] = [];

            switch (type) {
                case CollectionChangeType.ITEMS_PUSHED:
                    {
                        for (let x = 0; x < count!; x++) {
                            const idx = index! + x;
                            const titem = this._items[idx];
                            const tafter = (idx > 0) ? this._items[idx - 1] : undefined;
                            changes.push(new StdObservableCollectionChange<T>(
                                StdObservableCollectionChangeType.ITEM_ADDED,
                                titem,
                                undefined,
                                tafter));
                        }
                    }
                    break;
                case CollectionChangeType.ITEMS_UNSHIFTED:
                    {
                        for (let x = 0; x < count!; x++) {
                            const idx = index! + count! - x - 1;
                            const titem = this._items[idx];
                            const tbefore = (idx < this._items.length - 1) ? this._items[idx + 1] : undefined;
                            changes.push(new StdObservableCollectionChange<T>(
                                StdObservableCollectionChangeType.ITEM_ADDED,
                                titem,
                                tbefore,
                                undefined
                            ));
                        }
                    }
                    break;

                case CollectionChangeType.ITEM_POPPED:
                    {
                        const tafter = (this._items.length > 0) ? this._items[this._items.length - 1] : undefined;
                        changes.push(new StdObservableCollectionChange<T>(
                            StdObservableCollectionChangeType.ITEM_REMOVED,
                            removedItem!,
                            undefined,
                            tafter
                        ));
                    }
                    break;
                case CollectionChangeType.ITEM_SHIFTED:
                    {
                        const tbefore = (this._items.length > 0) ? this._items[0] : undefined;
                        changes.push(new StdObservableCollectionChange<T>(
                            StdObservableCollectionChangeType.ITEM_REMOVED,
                            removedItem!,
                            tbefore,
                            undefined
                        ));
                    }
                    break;

                case CollectionChangeType.ITEM_INSERTED:
                    {
                        for (let x = 0; x < count!; x++) {
                            const idx = index! + count! - x - 1;
                            const titem = this._items[idx];
                            const tbefore = (idx < this._items.length - 1) ? this._items[idx + 1] : undefined;
                            const tafter = (idx > 0) ? this._items[idx - 1] : undefined;
                            changes.push(new StdObservableCollectionChange<T>(
                                StdObservableCollectionChangeType.ITEM_ADDED,
                                titem,
                                tbefore,
                                tafter
                            ));
                        }
                    }
                    break;
                case CollectionChangeType.ITEM_REMOVED:
                    {
                        const tbefore = (index! < this._items.length - 1) ? this._items[index! + 1] : undefined;
                        const tafter = (index! > 0) ? this._items[index! - 1] : undefined;
                        changes.push(new StdObservableCollectionChange<T>(
                            StdObservableCollectionChangeType.ITEM_REMOVED,
                            removedItem!,
                            tbefore,
                            tafter
                        ));
                    }
                    break;

                case CollectionChangeType.ITEM_CHANGED:
                    {
                        const tbefore = (index! < this._items.length - 1) ? this._items[index! + 1] : undefined;
                        const tafter = (index! > 0) ? this._items[index! - 1] : undefined;
                            changes.push(new StdObservableCollectionChange<T>(
                                StdObservableCollectionChangeType.ITEM_REMOVED,
                                removedItem!,
                                tbefore,
                                tafter
                            ));
                        const titem = this._items[index!];
                        changes.push(new StdObservableCollectionChange<T>(
                            StdObservableCollectionChangeType.ITEM_ADDED,
                            titem,
                            tbefore,
                            tafter
                        ));
                    }
                    break;
            }

            Observable.enterObservableFireStack(() => {
                this._stdColObservers2.invoke(changes);
            });
        }
    }

    raisePropertyChangeEvent(propertyName: string, propertyValue: unknown) {
        Observable.enterObservableFireStack(() => {
            const pce = new PropertyChangeEvent(propertyName, propertyValue);
            this._propertyChangeHandlers2.invoke(pce);
        });
        //Observable.publishRead(this, propertyName, propertyValue);
    };

    private readonly _stdColObservers2: CallbackSet<StdObservableCollectionObserver<T>> = new CallbackSet("Collection-stdColObservers");

    addCollectionObserver(observer: StdObservableCollectionObserver<T>): IDisposable {
        return this._stdColObservers2.add(observer);
    }
    
    removeCollectionObserver(observer: StdObservableCollectionObserver<T>): void {
        this._stdColObservers2.delete(observer);
    }

    *iterateValues(): Iterable<T> {
        const x = this._itemsEnumerated.value;
        this.dependOnVersion();
        for (let item of this._items) {
            yield item;
        }
    }

    private _pushSort: (SortFunction<T> | null) = null;
    setPushSort(sortFunc: (SortFunction<T> | null)) {
        // Should be called before any items are added
        this._pushSort = sortFunc;
    }
}


type SortFunction<T> = (a: T, b: T) => number;