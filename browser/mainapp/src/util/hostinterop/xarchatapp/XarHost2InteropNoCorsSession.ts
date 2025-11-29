import { CancellationToken } from "../../CancellationTokenSource";
import { PromiseSource } from "../../PromiseSource";
import { NoCorsFetchArgs, NoCorsFetchResult, NoCorsHeaderSet } from "../IHostInterop";
import { XarHost2InteropSession } from "./XarHost2InteropSession";

export class XarHost2InteropNoCorsSession extends XarHost2InteropSession {
    constructor() {
        super();
    }

    prefix = "nocorsproxy.";

    async performFetchAsync(args: NoCorsFetchArgs, pcs: PromiseSource<NoCorsFetchResult>, cancellationToken: CancellationToken): Promise<void> {
        const fromNoCorsHeaderSet = (x: NoCorsHeaderSet | null | undefined) => {
            const res: { [headerName: string]: string[] } = {};
            if (x) {
                for (let kvp of x) {
                    if (res[kvp.name]) {
                        res[kvp.name].push(kvp.value);
                    }
                    else {
                        res[kvp.name] = [kvp.value];
                    }
                }
            }
            return res;
        }
        const toNoCorsHeaderSet = (x: { [headerName: string]: string[] } | null | undefined) => {
            const res: NoCorsHeaderSet = [];
            if (x) {
                for (let k of Object.getOwnPropertyNames(x)) {
                    const vs = x[k];
                    for (let v of vs) {
                        res.push({ name: k, value: v });
                    }
                }
            }
            return res;
        };

        const prArgs: XarHost2PerformRequestArgs = {
            method: args.method,
            url: args.url,
            requestHeaders: fromNoCorsHeaderSet(args.requestHeaders),
            contentHeaders: fromNoCorsHeaderSet(args.contentHeaders),
            body: args.body ?? undefined
        }
        const recvBuilder: string[] = [];
        const recvCompletePS: PromiseSource<string> = new PromiseSource();
        await this.sendAndReceiveAsync("performRequest", prArgs, cancellationToken, 
            (cmd, data) => {

                if (cmd == "requestResponseStart") {
                    const tdata: XarHost2PerformRequestSuccessStartResponse = data;

                    const res: NoCorsFetchResult = {
                        status: tdata.status,
                        responseHeaders: toNoCorsHeaderSet(tdata.responseHeaders),
                        contentHeaders: toNoCorsHeaderSet(tdata.contentHeaders),
                        text: () => {
                            return recvCompletePS.promise;
                        },
                        json: async () => {
                            const d = await recvCompletePS.promise;
                            return JSON.parse(d);
                        }
                    };
                    pcs.resolve(res);
                }
                else if (cmd == "requestResponseContinue") {
                    const tdata: XarHost2PerformRequestSuccessContinueResponse = data;
                    if (tdata.data.length > 0) {
                        recvBuilder.push(tdata.data);
                    }
                    if (tdata.isComplete) {
                        recvCompletePS.tryResolve(recvBuilder.join(""));
                    }
                }
                else if (cmd == "requestFailed") {
                    const tdata: XarHost2PerformRequestFailedResponse = data;
                    pcs.tryReject("NoCors request failed: " + tdata.reason);
                    recvCompletePS.tryReject("NoCors request failed: " + tdata.reason);
                }

            });
    }
}

interface XarHost2PerformRequestArgs {
    method: string;
    url: string;
    requestHeaders: { [headerName: string]: string[] };
    contentHeaders?: { [headerName: string]: string[] };
    body?: string;
    responseBufferSize?: number;
}
interface XarHost2PerformRequestSuccessStartResponse {
    status: number;
    responseHeaders: { [headerName: string]: string[] };
    contentHeaders: { [headerName: string]: string[] };
}
interface XarHost2PerformRequestSuccessContinueResponse {
    data: string;
    isComplete: boolean;
}
interface XarHost2PerformRequestFailedResponse {
    reason: string;
}