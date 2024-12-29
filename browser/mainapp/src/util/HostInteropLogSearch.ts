import { CharacterName } from "../shared/CharacterName";
import { CancellationToken } from "./CancellationTokenSource";
import { PromiseSource } from "./PromiseSource";

export interface HostInteropLogSearch {
    getHintsFromTermAsync(logsFor: CharacterName, kind: LogSearchKind, term: string, cancellationToken: CancellationToken): Promise<string[]>

    validateSearchTextAsync(logsFor: CharacterName, kind: LogSearchKind, searchText: string, cancellationToken: CancellationToken): Promise<boolean>;

    performSearchAsync(logsFor: CharacterName, kind: LogSearchKind, searchText: string, dateAnchor: DateAnchor, date: Date, cancellationToken: CancellationToken): Promise<LogSearchResult[]>;
}

export enum LogSearchKind {
    PrivateMessages = "pmconvo",
    Channels = "channel"
}

export enum DateAnchor {
    Before = "before",
    After = "after"
}

export interface LogSearchResult {
    gender: number;
    messageText: string;
    messageType: number;
    speakerName: string;
    status: number;
    timestamp: number;
}

export abstract class XarHost2InteropSession {
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

    writeMessage: (message: string) => void = (m) => {};
}

export class XarHost2InteropWindowCommand extends XarHost2InteropSession {
    constructor() {
        super();
    }

    override readonly prefix: string = "windowcommand.";

    async performWindowCommand(windowId: number, args: object, cancellationToken: CancellationToken): Promise<object> {
        
        let resultError: Error | null = null;
        let resultObject: object | null = null;

        await this.sendAndReceiveAsync("executeWindowCommand", { windowId: windowId, args: args }, cancellationToken, (rcmd, rdata) => {
            if (rcmd == "executedWindowCommand") {
                if (rdata.result) {
                    resultObject = rdata.result as object;
                }
                else if (rdata.errorMessage) {
                    resultError = new Error(rdata.errorMessage);
                }
            }
        });

        if (resultError != null) {
            throw resultError;
        }
        else {
            return resultObject!;
        }
    }
}


export class XarHost2InteropLogSearch implements HostInteropLogSearch {
    constructor(
        private readonly writeMessage: (message: string) => void) {
    }

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
    private sendAndReceiveAsync(cmd: string, data: object, cancellationToken: CancellationToken, onReply: (cmd: string, data: any) => void) {
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

    async getHintsFromTermAsync(logsFor: CharacterName, kind: LogSearchKind, term: string, cancellationToken: CancellationToken): Promise<string[]> { 
        let result: string[] = [];
        await this.sendAndReceiveAsync("getHintsFromTerm", { logsFor: logsFor.value, kind: kind, term: term }, cancellationToken, (rcmd, rdata) => {
            if (rcmd == "gotHintsFromTerm") {
                const hints: string[] = rdata.hints;
                result = hints;
            }
        });
        if (!result) {
            result = [];
        }
        return result;
    }

    async validateSearchTextAsync(logsFor: CharacterName, kind: LogSearchKind, searchText: string, cancellationToken: CancellationToken): Promise<boolean> {
        let result: boolean = false;
        await this.sendAndReceiveAsync("validateSearchText", { logsFor: logsFor.value, kind: kind, searchText: searchText }, cancellationToken, (rcmd, rdata) => {
            if (rcmd == "validatedSearchText") {
                const isValid: boolean = rdata.isValid;
                result = isValid;
            }
        });
        return result;
    }

    async performSearchAsync(logsFor: CharacterName, kind: LogSearchKind, searchText: string, dateAnchor: DateAnchor, date: Date, cancellationToken: CancellationToken): Promise<LogSearchResult[]> {
        let results: LogSearchResult[] = [];
        if (kind == LogSearchKind.Channels) {
            await this.sendAndReceiveAsync("performChannelSearch", { 
                    logsFor: logsFor.value, 
                    dateAnchor: dateAnchor, 
                    date: date.getTime(), 
                    searchText: searchText,
                    maxEntries: 200,
                }, cancellationToken, (rcmd, rdata) => {
                if (rcmd == "performedChannelSearch") {
                    results = rdata.results;
                }
            });
        }
        else if (kind == LogSearchKind.PrivateMessages) {
            await this.sendAndReceiveAsync("performPMConvoSearch", {
                    logsFor: logsFor.value,
                    dateAnchor: dateAnchor,
                    date: date.getTime(),
                    searchText: searchText,
                    maxEntries: 200,
                }, cancellationToken, (rcmd, rdata) => {
                if (rcmd == "performedPMConvoSearch") {
                    results = rdata.results;
                }
            });
        }
        return results;
    }
}