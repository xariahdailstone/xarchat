import { CharacterName } from "../../shared/CharacterName";
import { CancellationToken } from "../CancellationTokenSource";

export interface HostInteropLogSearch {
    getHintsFromTermAsync(logsFor: CharacterName, kind: LogSearchKind, term: string, cancellationToken: CancellationToken): Promise<string[]>

    validateSearchTextAsync(logsFor: CharacterName, kind: LogSearchKind, searchText: string, cancellationToken: CancellationToken): Promise<boolean>;

    performSearchAsync(logsFor: CharacterName, kind: LogSearchKind, searchText: string, 
        dateAnchor: DateAnchor, date: Date, maxEntries: number, cancellationToken: CancellationToken): Promise<LogSearchResult[]>;

    getRecentConversationsAsync(logsFor: CharacterName, resultLimit: number, cancellationToken: CancellationToken): Promise<RecentConversationResult[]>;
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

export interface RecentConversationResult {
    channelId: number;
    interlocutorName: string;
    lastMessageAt: number;
}

export interface LogSearchResultChannelMessage extends LogSearchResult {
    channelName: string;
    channelTitle: string;
}

export interface LogSearchResultPMConvoMessage extends LogSearchResult {
    myCharacterName: string;
    interlocutorName: string;
}

