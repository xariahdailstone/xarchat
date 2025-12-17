import { CancellationToken, CancellationTokenSource } from "../../CancellationTokenSource";
import { HostInteropLogImport } from "../HostInteropLogImport";
import { XarHost2InteropSession } from "./XarHost2InteropSession";


export class XarHost2InteropLogImport extends XarHost2InteropSession implements HostInteropLogImport {

    readonly prefix: string = "logimport.";

    protected async sendAndReceiveMappedAsync(
        cmd: string, data: object, cancellationToken: CancellationToken,
        responseMapObj: { [cmd: string]: (data: any) => void }) {

        const responseMap = new Map<string, ((data: any) => void)>();
        for (let pn of Object.getOwnPropertyNames(responseMapObj)) {
            responseMap.set(pn.toLowerCase(), responseMapObj[pn]);
        }

        await super.sendAndReceiveAsync(cmd, data, cancellationToken,
            (rcmd, data) => {
                if (rcmd == "error") {
                    throw new Error(data.message ?? "Unknown error.");
                }
                else {
                    const cb = responseMap.get(rcmd.toLowerCase());
                    if (cb) {
                        cb(data);
                    }
                }
            }
        );
    }

    async getAvailableImportersAsync(cancellationToken: CancellationToken): Promise<string[]> {
        let results: string[] = [];
        await this.sendAndReceiveMappedAsync("getImportOptions", {}, cancellationToken, {
            "gotImportOptions": (data: { names: string[] }) => {
                results = data.names;
            }
        });
        return results;
    }

    async executeImporterFlowAsync(
        importerName: string, cancellationToken: CancellationToken, 
        stepReceivedFunc: (stepName: string, stepBody: any) => Promise<any>): Promise<void> {

        using cts = CancellationTokenSource.createLinkedSource(cancellationToken);

        await this.sendAndReceiveMappedAsync("beginImportSession", { name: importerName }, cts.token, {
            "gotImportStep": async (data: { stepType: string, stepValue: any, msgid: any }) => {
                try {
                    const resp = await stepReceivedFunc(data.stepType, data.stepValue);
                    await this.sendWithoutReceiveAsync("submitStep", { handleData: resp ?? null, msgid: data.msgid }, cts.token);
                }
                catch {
                    cts.cancel();
                }
            }
        });
    }

}
