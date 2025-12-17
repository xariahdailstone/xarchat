import { CancellationToken, CancellationTokenSource } from "../../CancellationTokenSource";
import { Logger, Logging } from "../../Logger";
import { PromiseSource } from "../../PromiseSource";


export abstract class XarHost2InteropSession {
    protected logger: Logger = Logging.createLogger(`${this.constructor.name}`);

    abstract readonly prefix: string;

    receiveMessage(cmd: string, data: object) {
        const msgid = +(data as any)["msgid"];
        const rh = this._msgResponseHandlers.get(msgid);
        if (rh) {
            rh(cmd, data);
            if (cmd == "endresponse") {
                this._msgResponseHandlers.delete(msgid);
            }
        }
    }

    protected async sendWithoutReceiveAsync(cmd: string, dat: object, cancellationToken: CancellationToken) {
        this.writeMessage(`${cmd} ${JSON.stringify(dat)}`);
    }

    private _nextId: number = 1;
    private _msgResponseHandlers: Map<number, (cmd: string, data: object) => void> = new Map();
    protected async sendAndReceiveAsync(cmd: string, data: object, cancellationToken: CancellationToken, onReply: (cmd: string, data: any) => void) {
        const myId = this._nextId++;
        (data as any)["msgid"] = myId;
        this.writeMessage(`${cmd} ${JSON.stringify(data)}`);

        using combinedCTS = CancellationTokenSource.createLinkedSource(cancellationToken);

        using ctreg = cancellationToken.register(() => {
            this.writeMessage(`cancel ${JSON.stringify({ msgid: myId })}`);
        });

        let responseEndedNormally = false;
        const ps = new PromiseSource<void>();
        this._msgResponseHandlers.set(myId, (cmd: string, data: object) => {
            if (cmd == "endresponse") {
                responseEndedNormally = true;
                ps.resolve();
            }
            else {
                try {
                    onReply(cmd, data);
                }
                catch (e) {
                    responseEndedNormally = false;
                    ps.reject(e);
                }
            }
        });

        try {
            await ps.promise;
        }
        finally {
            if (!responseEndedNormally) {
                this.writeMessage(`cancel ${JSON.stringify({ msgid: myId })}`);
            }
        }
    }

    writeMessage: (message: string) => void = (m) => { };
}
