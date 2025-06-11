
export class StringPool {
    constructor(public readonly name: string) {
    }

    private readonly cachedStrings = new Map<string, WeakRef<PooledStringImpl>>();
    private readonly freg = new FinalizationRegistry<string>((heldValue) => {
        this.cachedStrings.delete(heldValue);
    });

    create(value: string): PooledString {
        const cachedRef = this.cachedStrings.get(value);
        const ref = cachedRef ? cachedRef.deref() : undefined;
        if (ref) {
            return ref;
        }

        const newValue = new PooledStringImpl(this, value);
        this.cachedStrings.set(value, new WeakRef(newValue));
        this.freg.register(newValue, value);
        return newValue;
    }
}

export interface PooledString {
    readonly value: string;
    toString(): string;
}

class PooledStringImpl implements PooledString {
    constructor(
        public readonly stringPool: StringPool,
        public readonly value: string) { }

    toString() { return this.value; }
}