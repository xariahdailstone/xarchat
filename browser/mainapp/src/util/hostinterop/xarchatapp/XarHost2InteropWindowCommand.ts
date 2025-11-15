import { CancellationToken } from "../../CancellationTokenSource";
import { XarHost2InteropSession } from "./XarHost2InteropSession";

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
