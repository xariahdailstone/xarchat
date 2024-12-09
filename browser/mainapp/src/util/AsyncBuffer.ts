import { CancellationToken } from "./CancellationTokenSource";
import { EventListenerUtil } from "./EventListenerUtil";
import { PromiseSource } from "./PromiseSource";

export class AsyncBuffer<T> {
    constructor() {
    }

    private _buffer: T[] = [];
    private _waiters: (PromiseSource<T>)[] = [];

    enqueue(value: T) {
        if (this._waiters.length > 0) {
            const w = this._waiters.shift()!;
            w.tryResolve(value);
        }
        else {
            this._buffer.push(value);
        }
    }

    async dequeueAsync(cancellationToken?: CancellationToken): Promise<T> {
        if (this._buffer.length > 0) {
            const v = this._buffer.shift()!;
            return v;
        }
        else {
            const ps = new PromiseSource<T>();
            this._waiters.push(ps);
            let result: T;
            if (cancellationToken) {
                using _ = cancellationToken.register(() => {
                    this._waiters = this._waiters.filter(x => x !== ps);
                    ps.tryReject("cancelled");
                });

                result = await ps.promise;
            }
            else {
                result = await ps.promise;
            }
            return result;
        }
    }
}

export class SyncBuffer<T> {
    constructor() {
    }

    private _buffer: AsyncBuffer<SyncBufferEntry<T>> = new AsyncBuffer();

    async enqueueAsync(value: T): Promise<void> {
        const sbe = new SyncBufferEntry<T>(value);
        this._buffer.enqueue(sbe);
        await sbe.promise;
    }

    private _previousEntry: SyncBufferEntry<T> | null = null;
    async dequeueAsync(cancellationToken: CancellationToken): Promise<T> {
        if (this._previousEntry) {
            this._previousEntry.complete();
            this._previousEntry = null;
        }

        const thisEntry = await this._buffer.dequeueAsync(cancellationToken);
        this._previousEntry = thisEntry;
        return thisEntry.value;
    }
}

class SyncBufferEntry<T> {
    constructor(
        public readonly value: T
    ) {
        let fcomplete: () => void;
        this.promise = new Promise(resolve => {
            fcomplete = resolve;
        });
        this._complete = fcomplete!;
    }

    readonly promise: Promise<void>;
    private readonly _complete: () => void;

    complete() {
        this._complete();
    }
}