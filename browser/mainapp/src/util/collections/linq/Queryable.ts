import { Predicate } from "../../Predicate";

export interface IQueryable<T> extends Iterable<T> {
    where(predicate: Predicate<T>): IQueryable<T>;
    select<TOutput>(selector: (item: T) => TOutput): IQueryable<TOutput>;

    toArray(): T[];
}

export class Queryable<T> implements IQueryable<T> {
    private readonly _source: Iterable<T>;

    constructor(source: Iterable<T>) {
        this._source = source;
    }

    *[Symbol.iterator](): Iterator<T, any, undefined> {
        return this._source;
    }

    where(predicate: Predicate<T>): IQueryable<T> {
        const self = this;
        const filter = (function* () {
            for (let item of self._source) {
                if (predicate(item)) {
                    yield item;
                }
            }
        })();
        return new Queryable<T>(filter);
    }

    select<TOutput>(selector: (item: T) => TOutput): IQueryable<TOutput> {
        const self = this;
        const filter = (function* () {
            for (let item of self._source) {
                yield selector(item);
            }
        })();
        return new Queryable<TOutput>(filter);
    }

    toArray(): T[] {
        return [...this._source];
    }
}