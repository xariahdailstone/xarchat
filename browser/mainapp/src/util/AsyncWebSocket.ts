import { CancellationToken } from "./CancellationTokenSource";
import { IDisposable } from "./Disposable";
import { PromiseSource } from "./PromiseSource";

export class AsyncWebSocket implements IDisposable, Disposable {
    static createAsync(url: string): Promise<AsyncWebSocket> {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);
            let aws: (AsyncWebSocket | null) = null;
            ws.onopen = () => { 
                aws = new AsyncWebSocket(ws);
                resolve(aws);
            };
            ws.onmessage = (e) => {
                if (aws) {
                    aws.onMessage(e.data);
                }
            };
            ws.onerror = () => { 
                if (aws) {
                    aws.onClose();
                }
                else {
                    reject("Failed to open web socket");
                }
            };
            ws.onclose = (e) => {
                if (aws) {
                    aws.onClose();
                }
                else {
                    reject("Failed to open web socket");
                }
            };
        });
    }

    private constructor(private readonly ws: WebSocket) {
    }

    private _readerQueue: PromiseSource<any>[] = [];
    private _dataQueue: any[] = [];

    private onMessage(data: any) {
        if (this._readerQueue.length > 0) {
            const treader = this._readerQueue.shift()!;
            treader.tryResolve(data);
        }
        else {
            this._dataQueue.push(data);
        }
    }

    private onClose() {
        const err = new Error(`WebSocket is in ${this.ws.readyState} status`);
        while (this._readerQueue.length > 0) {
            const treader = this._readerQueue.shift()!;
            treader.tryReject(err);
        }
    }

    private _disposed: boolean = false;
    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            if (this.ws.readyState == WebSocket.OPEN) {
                this.ws.close();
                this.onClose();
            }
        }
    }

    [Symbol.dispose]() {
        this.dispose();
    }

    get isDisposed() { return this._disposed; }

    get readyState() { return this.ws.readyState; }

    readDataAsync(cancellationToken: CancellationToken): Promise<any> {
        const ps = new PromiseSource<any>();

        if (this.ws.readyState != WebSocket.OPEN) {
            ps.tryReject(new Error(`WebSocket is in ${this.ws.readyState} status`));
        }
        else {
            if (this._dataQueue.length > 0) {
                const result = this._dataQueue.shift()!;
                ps.resolve(result);
            }
            else {
                const ctreg = cancellationToken.register(() => {
                    this._readerQueue = this._readerQueue.filter(x => x != ps);
                    ps.trySetCancelled();
                });
                ps.promise.then(() => ctreg.dispose(), () => ctreg.dispose());

                this._readerQueue.push(ps);
            }
        }

        return ps.promise;
    }

    writeData(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (this.ws.readyState == WebSocket.OPEN) {
            this.ws.send(data);
        }
        else {
            throw new Error(`WebSocket is in ${this.ws.readyState} status`)
        }
    }
}