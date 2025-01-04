import { AsyncBuffer } from "../util/AsyncBuffer";
import { CancellationToken } from "../util/CancellationTokenSource";
import { IDisposable } from "../util/Disposable";
import { PromiseSource } from "../util/PromiseSource";
import { HandleableChatMessage } from "./ChatConnectionFactory";


export class IncomingMessageSink implements IDisposable, Disposable {
    constructor(
        private readonly onDispose: () => any, 
        private readonly cancellationToken: CancellationToken) {

        this._cancellationTokenReg = cancellationToken.register(() => {
            this.dispose();
        });
    }

    private _cancellationTokenReg: IDisposable;
    private _disposed: boolean = false;

    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            this._cancellationTokenReg.dispose();
            this._buffer.enqueue({ message: null, complete: null });
            this.onDispose();
        }
    }

    [Symbol.dispose]() {
        this.dispose();
    }

    get isDisposed() { return this._disposed; }

    private _buffer: AsyncBuffer<BufferedMessage> = new AsyncBuffer();

    async readMessage(handleMessage: (msg: HandleableChatMessage) => (Promise<any> | void), cancellationToken?: CancellationToken): Promise<void> {
        const bm = await this._buffer.dequeueAsync(cancellationToken);
        const msg = bm.message;
        const complete = bm.complete;
        if (msg == null) {
            this._buffer.enqueue({ message: null, complete: null });
            throw new Error("connection ended");
        }
        else {
            try {
                const r = handleMessage(msg);
                if (r) {
                    await r;
                }
            }
            finally {
                if (complete) {
                    complete.tryResolve();
                }
            }
        }
    }

    async handleAsync(msg: HandleableChatMessage | null): Promise<void> {
        const ps = new PromiseSource<void>();

        if (!this._disposed) {
            this._buffer.enqueue({ message: msg, complete: ps });
        }

        await ps.promise;
    }
}

interface BufferedMessage {
    message: HandleableChatMessage | null;
    complete: PromiseSource<void> | null;
}