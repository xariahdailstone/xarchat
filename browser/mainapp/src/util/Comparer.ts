
export interface Comparer<T> {
    compare(a: T, b: T): number;
}

export class StringComparer implements Comparer<string> {

    static Ordinal: StringComparer = new StringComparer((a, b) => a < b ? -1 : a == b ? 0 : 1);

    constructor(
        private readonly compareFunc: (a: string, b: string) => number) {

    }

    compare(a: string, b: string): number {
        return this.compareFunc(a, b);
    }
}

export class NumberComparer implements Comparer<number> {
    compare(a: number, b: number): number {
        return a - b;
    }
}

class TupleComparerImpl implements Comparer<any> {
    compare(a: any, b: any): number {
        if (!(a instanceof Array)) {
            a = [a];
        }
        if (!(b instanceof Array)) {
            b = [b];
        }

        const minLen = Math.min(a.length, b.length);
        for (let i = 0; i < minLen; i++) {
            const aItem = a[i];
            const bItem = b[i];

            if (aItem < bItem) { return -1; }
            if (aItem > bItem) { return 1; }
        }

        return a.length - b.length;
    }
}

export const TupleComparer = new TupleComparerImpl();