
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