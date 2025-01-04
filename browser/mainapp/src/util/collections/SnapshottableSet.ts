import { IDisposable } from "../Disposable";

class SnapshottedSet<T> implements ReadonlySet<T>, IDisposable {
    constructor(
        private readonly _set: ReadonlySet<T>,
        private readonly _onDispose: () => any) {
    }

    private _disposed = false;

    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            this._onDispose();
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    get isDisposed() { return this._disposed; }

    forEach(callbackfn: (value: T, value2: T, set: ReadonlySet<T>) => void, thisArg?: any): void {
        this._set.forEach((value, value2, set) => callbackfn(value, value2, this), thisArg);
    }

    has(value: T): boolean {
        return this._set.has(value);
    }

    get size(): number { return this._set.size; }

    entries(): SetIterator<[T, T]> {
        return this._set.entries();
    }

    keys(): SetIterator<T> {
        return this._set.keys();
    }

    values(): SetIterator<T> {
        return this._set.values();
    }

    union<U>(other: ReadonlySetLike<U>): Set<T | U> {
        return this._set.union(other);
    }

    intersection<U>(other: ReadonlySetLike<U>): Set<T & U> {
        return this._set.intersection(other);
    }

    difference<U>(other: ReadonlySetLike<U>): Set<T> {
        return this._set.difference(other);
    }

    symmetricDifference<U>(other: ReadonlySetLike<U>): Set<T | U> {
        return this._set.symmetricDifference(other);
    }

    isSubsetOf(other: ReadonlySetLike<unknown>): boolean {
        return this._set.isSubsetOf(other);
    }

    isSupersetOf(other: ReadonlySetLike<unknown>): boolean {
        return this._set.isSupersetOf(other);
    }

    isDisjointFrom(other: ReadonlySetLike<unknown>): boolean {
        return this._set.isDisjointFrom(other);
    }

    [Symbol.iterator](): SetIterator<T> {
        return this._set[Symbol.iterator]();
    }
}

export class SnapshottableSet<T> implements Set<T> {

    private _set: Set<T> = new Set<T>();
    private _cowCount: number = 0;
    
    private updatingSet() {
        if (this._cowCount > 0) {
            this._set = new Set<T>(this._set);
            this._cowCount = 0;
        }
    }

    snapshot(): (ReadonlySet<T> & IDisposable) {
        const self = this;
        const capturedSet = this._set;
        this._cowCount++;

        return new SnapshottedSet<T>(capturedSet, () => {
            if (self._set === capturedSet) {
                self._cowCount--;
            }
        });
    }

    add(value: T): this {
        if (!this._set.has(value)) {
            this.updatingSet();
            this._set.add(value);
        }
        return this;
    }

    clear(): void {
        if (this._set.size > 0) {
            this.updatingSet();
            this._set.clear();
        }
    }

    delete(value: T): boolean {
        if (this._set.has(value)) {
            this.updatingSet();
            return this._set.delete(value);
        }
        else {
            return false;
        }
    }

    forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: any): void {
        this._set.forEach((v, v2, set) => callbackfn(v, v2, this), thisArg);
    }

    forEachEntrySnapshotted(callbackfn: (kvp: [T, T], set: Set<T>) => void, thisArg?: any): void {
        const ss = this.snapshot();
        try {
            ss.forEach((v, v2, set) => callbackfn([v2, v], this), thisArg);
        }
        finally {
            ss.dispose();
        }
    }

    forEachKeySnapshotted(callbackfn: (key: T, set: Set<T>) => void, thisArg?: any): void {
        const ss = this.snapshot();
        try {
            ss.forEach((v, set) => callbackfn(v, this), thisArg);
        }
        finally {
            ss.dispose();
        }
    }

    forEachValueSnapshotted(callbackfn: (value: T, set: Set<T>) => void, thisArg?: any): void {
        const ss = this.snapshot();
        try {
            ss.forEach((v, set) => callbackfn(v, this), thisArg);
        }
        finally {
            ss.dispose();
        }
    }

    has(value: T): boolean {
        return this._set.has(value);
    }

    get size(): number { return this._set.size; }

    entries(): SetIterator<[T, T]> {
        return this._set.entries();
    }

    keys(): SetIterator<T> {
        return this._set.keys();
    }

    values(): SetIterator<T> {
        return this._set.values();
    }

    union<U>(other: ReadonlySetLike<U>): Set<T | U> {
        return this._set.union(other);
    }

    intersection<U>(other: ReadonlySetLike<U>): Set<T & U> {
        return this._set.intersection(other);
    }

    difference<U>(other: ReadonlySetLike<U>): Set<T> {
        return this._set.difference(other);
    }

    symmetricDifference<U>(other: ReadonlySetLike<U>): Set<T | U> {
        return this._set.symmetricDifference(other);
    }

    isSubsetOf(other: ReadonlySetLike<unknown>): boolean {
        return this._set.isSubsetOf(other);
    }

    isSupersetOf(other: ReadonlySetLike<unknown>): boolean {
        return this._set.isSubsetOf(other);
    }

    isDisjointFrom(other: ReadonlySetLike<unknown>): boolean {
        return this._set.isDisjointFrom(other);
    }

    [Symbol.iterator](): SetIterator<T> {
        return this._set[Symbol.iterator]();
    }

    get [Symbol.toStringTag](): string { return this._set[Symbol.toStringTag]; }
}