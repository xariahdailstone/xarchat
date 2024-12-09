import { IDisposable } from "../Disposable";

export interface ReadOnlyStdObservableCollection<TItem> {
    addCollectionObserver(observer: StdObservableCollectionObserver<TItem>): IDisposable;
    removeCollectionObserver(observer: StdObservableCollectionObserver<TItem>): void;

    iterateValues(): Iterable<TItem>;

    readonly length: number;
}

export type StdObservableCollectionObserver<TItem> = (changes: StdObservableCollectionChange<TItem>[]) => void;

export enum StdObservableCollectionChangeType {
    ITEM_ADDED,
    ITEM_REMOVED,
    CLEARED
}

export class StdObservableCollectionChange<TItem> {
    constructor(changeType: StdObservableCollectionChangeType, item: TItem, before?: TItem, after?: TItem) {
        this.changeType = changeType;
        this.item = item;
        this.before = before;
        this.after = after;
    }

    readonly changeType: StdObservableCollectionChangeType;
    readonly item: TItem;
    readonly before?: TItem;
    readonly after?: TItem;
}