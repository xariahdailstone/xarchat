import { h } from "../../snabbdom/h";
import { IDisposable, asDisposable } from "../Disposable";
import { Observable, PropertyChangeEvent, PropertyChangeEventListener, ValueSubscription } from "../Observable";
import { setupValueSubscription } from "../ObservableBase";
import { ReadOnlyStdObservableCollection, StdObservableCollectionChange, StdObservableCollectionChangeType, StdObservableCollectionObserver } from "./ReadOnlyStdObservableCollection";
import { SnapshottableSet } from "./SnapshottableSet";

export class StdObservableConcatCollectionView<TItem> implements ReadOnlyStdObservableCollection<TItem>, Observable, IDisposable {
    constructor(innerCollections: ReadOnlyStdObservableCollection<TItem>[]) {
        this._innerCollections = innerCollections;

        const disposables: IDisposable[] = [];

        for (let x = 0; x < innerCollections.length; x++) {
            const prevX = x - 1;
            const thisInner = innerCollections[x];
            const nextX = x + 1;

            const tObserverHandle = thisInner.addCollectionObserver(obs => { 
                for (let tchange of obs) {
                    switch (tchange.changeType) {
                        case StdObservableCollectionChangeType.ITEM_ADDED:
                            {
                                if (tchange.after === undefined) {
                                    this._innerCollectionFirstItems.set(thisInner, tchange.item);
                                }
                                if (tchange.before === undefined) {
                                    this._innerCollectionLastItems.set(thisInner, tchange.item);
                                }

                                const myAfter = (tchange.after !== undefined) ? tchange.after : this.getInnerCollectionLastItem(prevX);
                                const myBefore = (tchange.before !== undefined) ? tchange.before : this.getInnerCollectionFirstItem(nextX);
                                const arg = new StdObservableCollectionChange<TItem>(
                                    StdObservableCollectionChangeType.ITEM_ADDED,
                                    tchange.item,
                                    myBefore, myAfter);
                                this.raiseChangeEvent(arg);
                            }
                            break;
                        case StdObservableCollectionChangeType.ITEM_REMOVED:
                            {
                                if (tchange.after === undefined) {
                                    this._innerCollectionFirstItems.set(thisInner, tchange.before);
                                }
                                if (tchange.before === undefined) {
                                    this._innerCollectionLastItems.set(thisInner, tchange.after);
                                }

                                const myAfter = (tchange.after !== undefined) ? tchange.after : this.getInnerCollectionLastItem(prevX);
                                const myBefore = (tchange.before !== undefined) ? tchange.before : this.getInnerCollectionFirstItem(nextX);
                                const arg = new StdObservableCollectionChange<TItem>(
                                    StdObservableCollectionChangeType.ITEM_REMOVED,
                                    tchange.item,
                                    myBefore, myAfter);
                                this.raiseChangeEvent(arg);
                            }
                            break;
                        case StdObservableCollectionChangeType.CLEARED:
                        default:
                    }
                }
            });
            disposables.push(tObserverHandle);
        }

        this._disposables = disposables;
    }

    private readonly _innerCollections: ReadOnlyStdObservableCollection<TItem>[];
    private readonly _disposables: IDisposable[];

    private readonly _innerCollectionFirstItems: Map<ReadOnlyStdObservableCollection<TItem>, TItem | undefined> = new Map();
    private readonly _innerCollectionLastItems: Map<ReadOnlyStdObservableCollection<TItem>, TItem | undefined> = new Map();

    getInnerCollectionFirstItem(x: number): (TItem | undefined) {
        while (x < this._innerCollections.length) {
            const inner = this._innerCollections[x];
            if (inner.length > 0) {
                if (!this._innerCollectionFirstItems.has(inner)) {
                    let v: TItem | undefined = undefined;
                    for (let i of inner.iterateValues()) {
                        v = i;
                        break;
                    }
                    this._innerCollectionFirstItems.set(inner, v);
                }
        
                return this._innerCollectionFirstItems.get(inner);
            }
            x++;
        }
        return undefined;
    }

    getInnerCollectionLastItem(x: number): (TItem | undefined) {
        while (x >= 0) {
            const inner = this._innerCollections[x];
            if (inner.length > 0) {
                if (!this._innerCollectionLastItems.has(inner)) {
                    let v: TItem | undefined = undefined;
                    for (let i of inner.iterateValues()) {
                        v = i;
                    }
                    this._innerCollectionLastItems.set(inner, v);
                }

                return this._innerCollectionLastItems.get(inner);
            }
            x--;
        }
        return undefined;
    }

    private _disposed: boolean = false;
    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            for (let d of this._disposables) {
                try { d.dispose(); }
                catch { }
            }
        }
    }

    [Symbol.dispose]() { this.dispose(); }

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

    private raiseChangeEvent(evt: StdObservableCollectionChange<TItem>): void {
        this._observers.forEachValueSnapshotted(observer => {
            try { observer([ evt ]); }
            catch { }
        });
        this.raisePropertyChangeEvent("length", this.length);
    }

    *iterateValues(): Iterable<TItem> {
        for (let ic of this._innerCollections) {
            for (let v of ic.iterateValues()) {
                yield v;
            }
        }
    }

    get length(): number { 
        let result = 0;
        for (let ic of this._innerCollections) {
            result += ic.length;
        }
        Observable.publishRead(this, "length", result);
        return result;
    }

    private readonly _propertyChangeListeners: SnapshottableSet<PropertyChangeEventListener> = new SnapshottableSet();

    addEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): IDisposable {
        this._propertyChangeListeners.add(handler);
        return asDisposable(() => {
            this.removeEventListener(eventName, handler);
        });
    }
    removeEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): void {
        this._propertyChangeListeners.delete(handler);
    }
    raisePropertyChangeEvent(propertyName: string, propValue: unknown): void {
        const pce = new PropertyChangeEvent(propertyName, propValue);
        this._propertyChangeListeners.forEachValueSnapshotted(thandler => {
            try { thandler(pce); }
            catch { }
        });
    }
    addValueSubscription(propertyPath: string, handler: (value: any) => any): ValueSubscription {
        return setupValueSubscription(this, propertyPath, handler);
    }
}