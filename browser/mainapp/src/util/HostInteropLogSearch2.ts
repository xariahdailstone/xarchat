import { CharacterName } from "../shared/CharacterName";
import { CancellationToken } from "./CancellationTokenSource";
import { IHostInterop, IXarHost2HostInterop } from "./HostInterop";
import { XarHost2InteropSession } from "./HostInteropLogSearch";

export interface HostInteropLogSearch2 {
    performSearchAsync(searchOptions: PerformSearchOptions, cancellationToken: CancellationToken): Promise<LogSearch2Results>;
}

export interface LogSearch2Results {
    resultCount: number;
}

export interface PerformSearchOptions {
    whoSpec: PerformSearchWhoSpec | null;
    streamSpec: PerformSearchPMConvoStreamSpec | PerformSearchChannelStreamSpec | null;
    textSpec: PerformSearchTextSpec | null;
    timeSpec: PerformSearchTimeSpec | null;
}

export interface PerformSearchWhoSpec {
    speakingCharacter: CharacterName;
}

export interface PerformSearchPMConvoStreamSpec {
    type: "pmconvo";
    myCharacterName: CharacterName;
    interlocutorCharacterName: CharacterName;
}
export interface PerformSearchChannelStreamSpec {
    type: "channel";
    channelTitle: string;
}

export interface PerformSearchTextSpec {
    searchText: string;
}

export interface PerformSearchTimeSpec {
    before: Date | null;
    after: Date | null;
}

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