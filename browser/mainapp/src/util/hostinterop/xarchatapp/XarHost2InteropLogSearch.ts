import { CharacterName } from "../../../shared/CharacterName";
import { CancellationToken } from "../../CancellationTokenSource";
import { HostInteropLogSearch, LogSearchKind, DateAnchor, LogSearchResult, RecentConversationResult } from "../HostInteropLogSearch";
import { XarHost2InteropSession } from "./XarHost2InteropSession";

export class XarHost2InteropLogSearch extends XarHost2InteropSession implements HostInteropLogSearch {
    constructor() {
        super();
    }

    prefix = "logsearch.";

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

    async performSearchAsync(logsFor: CharacterName, kind: LogSearchKind, searchText: string,
        dateAnchor: DateAnchor, date: Date, maxEntries: number, cancellationToken: CancellationToken): Promise<LogSearchResult[]> {

        let results: LogSearchResult[] = [];
        if (kind == LogSearchKind.Channels) {
            await this.sendAndReceiveAsync("performChannelSearch", {
                logsFor: logsFor.value,
                dateAnchor: dateAnchor,
                date: date.getTime(),
                searchText: searchText,
                maxEntries: maxEntries,
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
                maxEntries: maxEntries,
            }, cancellationToken, (rcmd, rdata) => {
                if (rcmd == "performedPMConvoSearch") {
                    results = rdata.results;
                }
            });
        }
        return results;
    }

    async getRecentConversationsAsync(
        logsFor: CharacterName, resultLimit: number, cancellationToken: CancellationToken): Promise<RecentConversationResult[]> {

        let results: RecentConversationResult[] = [];

        await this.sendAndReceiveAsync("getRecentConversations", {
            logsFor: logsFor.value,
            resultLimit: resultLimit
        }, cancellationToken, (rcmd, rdata) => {
            if (rcmd == "gotRecentConversations") {
                results = rdata.results;
            }
        });

        return results;
    }
}
