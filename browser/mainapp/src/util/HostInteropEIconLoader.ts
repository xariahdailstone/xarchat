import { CancellationToken } from "./CancellationTokenSource";
import { XarHost2InteropSession } from "./HostInteropLogSearch";

export class XarHost2HostInteropEIconLoader extends XarHost2InteropSession {
    
    override readonly prefix: string = "eiconloader.";

    async getEIconAsync(name: string, cancellationToken: CancellationToken): Promise<GotEIconData> {
        
        let resultError: Error | null = null;
        let resultObject: GotEIconData | null = null;

        await this.sendAndReceiveAsync("getEIconData", { name: name }, cancellationToken, (rcmd, rdata) => {
            if (rcmd == "gotEIconData") {
                if (rdata.contentType) {
                    resultObject = rdata as GotEIconData;
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

export interface GotEIconData {
    data: string;
    contentType: string;
    statusCode: number;
    headers: { key: string, value: string }[];
}