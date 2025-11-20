import { CancellationToken } from "../../CancellationTokenSource";
import { HostInteropLogSearch2, PerformSearchOptions, LogSearch2Results } from "../HostInteropLogSearch2";
import { XarHost2InteropSession } from "./XarHost2InteropSession";


export class XarHost2HostInteropLogSearch2Impl extends XarHost2InteropSession implements HostInteropLogSearch2 {

    override readonly prefix: string = "logsearch2.";

    async performSearchAsync(searchOptions: PerformSearchOptions, cancellationToken: CancellationToken): Promise<LogSearch2Results> {

        let searchHandle: number = -1;

        await this.sendAndReceiveAsync("performSearch", searchOptions, cancellationToken, (rcmd, rdata) => {
            if (rcmd == "searchResult") {
                searchHandle = rdata.searchHandle as number;
            }
        });

        // TODO:
        throw "not implemented";
    }
}
