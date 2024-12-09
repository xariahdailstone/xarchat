import { Comparer } from "./Comparer";

export class IterableUtils {
    static *combine<T>(...iterables: Iterable<T>[]) {
        if (iterables) {
            for (let iterable of iterables) {
                if (iterable) {
                    for (let item of iterable) {
                        yield item;
                    }
                }
            }
        }
    }

    static asQueryable<T>(iterable: Iterable<T>) {
        return new QueryableImpl<T>(iterable);
    }
}

export interface Queryable<T> extends Iterable<T> {
    where(filter: (item: T) => boolean): Queryable<T>;
    select<TOutput>(mapFunc: (item: T) => TOutput): Queryable<TOutput>;
    any(): boolean;
    first(): T;
    firstOrNull(): T | null;
    toArray(): T[];
    orderBy<TValue>(sortKeySelector: (item: T) => TValue, comparer: Comparer<TValue>): Queryable<T>;
}

class QueryableImpl<T> implements Queryable<T> {
    constructor(private readonly iterable: Iterable<T>) {
    }

    where(filter: (item: T) => boolean): Queryable<T> {
        const result = new QueryableImpl<T>(this.whereInternal(filter));
        return result;
    }

    *whereInternal(filter: (item: T) => boolean) {
        for (let item of this.iterable) {
            if (filter(item)) {
                yield item;
            }
        }
    }

    select<TOutput>(mapFunc: (item: T) => TOutput): Queryable<TOutput> {
        const result = new QueryableImpl<TOutput>(this.selectInternal(mapFunc));
        return result;
    }

    *selectInternal<TOutput>(mapFunc: (item: T) => TOutput) {
        for (let item of this.iterable) {
            yield mapFunc(item);
        }
    }

    orderBy<TValue>(sortKeySelector: (item: T) => TValue, comparer: Comparer<TValue>): Queryable<T> {
        const result = new QueryableImpl<T>(this.orderByInternal(sortKeySelector, comparer));
        return result;
    }

    *orderByInternal<TValue>(sortKeySelector: (item: T) => TValue, comparer: Comparer<TValue>) {
        const items = this.toArray();
        const sortedItems = items.sort((a, b) => {
            const ma = sortKeySelector(a);
            const mb = sortKeySelector(b);
            return comparer.compare(ma, mb);
        })
        for (let item of sortedItems) {
            yield item;
        }
    }

    any(): boolean {
        for (let item of this.iterable) {
            return true;
        }
        return false;
    }

    first(): T {
        for (let item of this.iterable) {
            return item;
        }
        throw new Error("Iterable is empty");
    }

    firstOrNull(): T | null {
        for (let item of this.iterable) {
            return item;
        }
        return null;
    }

    toArray(): T[] {
        const result = [...this.iterable];
        return result;
    }

    *values() {
        for (let item of this.iterable) {
            yield item;
        }
    }

    [Symbol.iterator](): Iterator<T, any, undefined> {
        return this.values();
    }
}