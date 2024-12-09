
export class ImmutableList<T> implements Iterable<T> {
    public static readonly EMPTY = new ImmutableList([]);

    private constructor(
        private readonly _items: T[]) {
    }

    add(item: T): ImmutableList<T> {
        return new ImmutableList<T>([...this._items, item]);
    }

    removeWhere(predicate: (item: T) => boolean): ImmutableList<T> {
        const x = this._items.filter(item => !predicate(item));
        return new ImmutableList<T>(x);
    }

    [Symbol.iterator](): Iterator<T, any, any> {
        return this._items[Symbol.iterator]();
    }
}