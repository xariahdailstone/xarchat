import { IDisposable } from "../Disposable";

class SnapshottedMap<K, V> implements ReadonlyMap<K, V>, IDisposable {
    constructor(
        private readonly _map: ReadonlyMap<K, V>,
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

    forEach(callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: any): void {
        this._map.forEach((v, k, map) => callbackfn(v, k, this), thisArg);
    }

    get(key: K): V | undefined {
        return this._map.get(key);
    }

    has(key: K): boolean {
        return this._map.has(key);
    }

    get size(): number { return this._map.size; }

    entries(): MapIterator<[K, V]> {
        return this._map.entries();
    }

    keys(): MapIterator<K> {
        return this._map.keys();
    }

    values(): MapIterator<V> {
        return this._map.values();
    }

    [Symbol.iterator](): MapIterator<[K, V]> {
        return this._map[Symbol.iterator]();
    }
}

export interface ISnapshottableMap<K, V> extends Map<K, V> {
    snapshot(): (ReadonlyMap<K, V> & IDisposable);
    forEachEntrySnapshotted(callbackfn: (kvp: [K, V], set: Map<K, V>) => void, thisArg?: any): void;
    forEachKeySnapshotted(callbackfn: (key: K, set: Map<K, V>) => void, thisArg?: any): void;
    forEachValueSnapshotted(callbackfn: (value: V, set: Map<K, V>) => void, thisArg?: any): void;
}

export class SnapshottableMap<K, V> implements ISnapshottableMap<K, V> {

    private _map: Map<K, V> = new Map();
    private _cowCount: number = 0;

    private updatingMap() {
        if (this._cowCount > 0) {
            this._map = new Map<K, V>(this._map);
            this._cowCount = 0;
        }
    }

    snapshot(): (ReadonlyMap<K, V> & IDisposable) {
        const self = this;
        const capturedMap = this._map;
        this._cowCount++;

        return new SnapshottedMap<K, V>(capturedMap, () => {
            if (self._map === capturedMap) {
                self._cowCount--;
            }
        });
    }

    clear(): void {
        if (this._map.size > 0) {
            this.updatingMap();
            this._map.clear();
        }
    }

    delete(key: K): boolean {
        if (this._map.has(key)) {
            this.updatingMap();
            return this._map.delete(key);
        }
        else {
            return false;
        }
    }

    forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void {
        return this._map.forEach((v, k, map) => callbackfn(v, k, this), thisArg);
    }

    forEachEntrySnapshotted(callbackfn: (kvp: [K, V], set: Map<K, V>) => void, thisArg?: any): void {
        const ss = this.snapshot();
        try {
            ss.forEach((v, k, set) => callbackfn([k, v], this), thisArg);
        }
        finally {
            ss.dispose();
        }
    }

    forEachKeySnapshotted(callbackfn: (key: K, set: Map<K, V>) => void, thisArg?: any): void {
        const ss = this.snapshot();
        try {
            ss.forEach((v, k, set) => callbackfn(k, this), thisArg);
        }
        finally {
            ss.dispose();
        }
    }

    forEachValueSnapshotted(callbackfn: (value: V, set: Map<K, V>) => void, thisArg?: any): void {
        const ss = this.snapshot();
        try {
            ss.forEach((v, k, set) => callbackfn(v, this), thisArg);
        }
        finally {
            ss.dispose();
        }
    }
    
    get(key: K): V | undefined {
        return this._map.get(key);
    }

    has(key: K): boolean {
        return this._map.has(key);
    }

    set(key: K, value: V): this {
        if (this._map.get(key) !== value) {
            this.updatingMap();
            this._map.set(key, value);
        }
        return this;
    }

    get size(): number { return this._map.size; }

    entries(): MapIterator<[K, V]> {
        return this._map.entries();
    }

    keys(): MapIterator<K> {
        return this._map.keys();
    }

    values(): MapIterator<V> {
        return this._map.values();
    }

    [Symbol.iterator](): MapIterator<[K, V]> {
        return this._map[Symbol.iterator]();
    }

    get [Symbol.toStringTag](): string { return this._map[Symbol.toStringTag]; }
}