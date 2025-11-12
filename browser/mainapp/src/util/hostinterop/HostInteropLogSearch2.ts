import { CharacterName } from "../../shared/CharacterName";
import { CancellationToken } from "../CancellationTokenSource";

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

