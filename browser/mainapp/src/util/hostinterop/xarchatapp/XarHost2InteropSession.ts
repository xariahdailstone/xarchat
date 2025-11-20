import { CancellationToken } from "../../CancellationTokenSource";
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

    private _nextId: number = 1;
    private _msgResponseHandlers: Map<number, (cmd: string, data: object) => void> = new Map();
    protected sendAndReceiveAsync(cmd: string, data: object, cancellationToken: CancellationToken, onReply: (cmd: string, data: any) => void) {
        const ps = new PromiseSource<void>();

        const myId = this._nextId++;
        (data as any)["msgid"] = myId;
        this.writeMessage(`${cmd} ${JSON.stringify(data)}`);

        const ctreg = cancellationToken.register(() => {
            this.writeMessage(`cancel ${JSON.stringify({ msgid: myId })}`);
        });

        this._msgResponseHandlers.set(myId, (cmd: string, data: object) => {
            if (cmd == "endresponse") {
                ctreg.dispose();
                ps.resolve();
            }
            else {
                onReply(cmd, data);
            }
        });

        return ps.promise;
    }

    writeMessage: (message: string) => void = (m) => { };
}
