import { CharacterName } from "../../../shared/CharacterName";
import { CancellationToken } from "../../CancellationTokenSource";
import { HostInteropLogSearch, LogSearchKind, DateAnchor, LogSearchResult, RecentConversationResult, LogSearchResultPMConvoMessage, LogSearchResultChannelMessage, ExplicitDate } from "../HostInteropLogSearch";
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

    private async sendAndReceiveWithResultAsync<T>(
        command: string, 
        args: any, 
        resultCommand: string,
        errorCommand: string,
        cancellationToken: CancellationToken): Promise<T> {

        let gotError: boolean = false;
        let gotResult: boolean = false;
        let result: T | null = null;
        let error: string | null = null;

        await this.sendAndReceiveAsync(command, args, cancellationToken,
            (rcmd, rdata) => {
                if (rcmd.toLowerCase() == resultCommand.toLowerCase()) {
                    gotResult = true;
                    result = rdata.result;
                }
                else if (rcmd.toLowerCase() == errorCommand.toLowerCase()) {
                    gotError = true;
                    error = rdata.message;
                }
            }
        );

        if (gotError) {
            throw new Error(error ?? "Undefined error.");
        }
        else if (gotResult) {
            return result!;
        }
        else {
            throw new Error("No result returned");
        }
    }

    async getHintsForChannelTitle(titlePartial: string, cancellationToken: CancellationToken): Promise<string[]> {
        const result = await this.sendAndReceiveWithResultAsync<string[]>(
                "getHintsForChannelTitle", 
                { title: titlePartial }, 
                "gotHintsForChannelTitle",
                "gotHintsForChannelTitleError",
                cancellationToken);
        return result;
    }
    async getHintsForMyCharacterName(myCharNamePartial: string, cancellationToken: CancellationToken): Promise<string[]> {
        const result = await this.sendAndReceiveWithResultAsync<string[]>(
                "getHintsForMyCharacterName", 
                { myName: myCharNamePartial }, 
                "gotHintsForMyCharacterName",
                "gotHintsForMyCharacterNameError",
                cancellationToken);
        return result;
    }
    async getHintsForInterlocutorCharacterName(myCharName: string, interlocutorCharNamePartial: string, cancellationToken: CancellationToken): Promise<string[]> {
        const result = await this.sendAndReceiveWithResultAsync<string[]>(
                "getHintsForInterlocutorCharacterName", 
                { myName: myCharName, interlocutorName: interlocutorCharNamePartial }, 
                "gotHintsForInterlocutorCharacterName",
                "gotHintsForInterlocutorCharacterNameError",
                cancellationToken);
        return result;
    }
    async searchChannelMessageDatesAsync(title: string, cancellationToken: CancellationToken): Promise<ExplicitDate[]> {
        const result = await this.sendAndReceiveWithResultAsync<ExplicitDate[]>(
                "searchChannelMessageDates", 
                { title: title }, 
                "searchedChannelMessageDates",
                "searchedChannelMessageDatesError",
                cancellationToken);
        return result;
    }
    async searchPMConversationDatesAsync(myCharName: string, interlocutorCharName: string, cancellationToken: CancellationToken): Promise<ExplicitDate[]> {
        const result = await this.sendAndReceiveWithResultAsync<ExplicitDate[]>(
                "searchPMConversationDates", 
                { myCharName: myCharName, interlocutorCharName: interlocutorCharName }, 
                "searchedPMConversationDates",
                "searchedPMConversationDatesError",
                cancellationToken);
        return result;
    }
    async getChannelMessagesAsync(
        title: string,
        fromDate: ExplicitDate, toDate: ExplicitDate, cancellationToken: CancellationToken): Promise<LogSearchResultChannelMessage[]> {

        const result = await this.sendAndReceiveWithResultAsync<LogSearchResultChannelMessage[]>(
                "getChannelMessages", 
                { title: title, fromDate: fromDate, toDate: toDate }, 
                "gotChannelMessages",
                "gotChannelMessagesError",
                cancellationToken);
        return result;
    }
    async getPMConversationMessagesAsync(
        myCharName: string, interlocutorCharName: string,
        fromDate: ExplicitDate, toDate: ExplicitDate, cancellationToken: CancellationToken): Promise<LogSearchResultPMConvoMessage[]> {

        const result = await this.sendAndReceiveWithResultAsync<LogSearchResultPMConvoMessage[]>(
                "getPMConversationMessages", 
                { myCharName: myCharName, interlocutorCharName: interlocutorCharName, fromDate: fromDate, toDate: toDate }, 
                "gotPMConversationMessages",
                "gotPMConversationMessagesError",
                cancellationToken);
        return result;
    }

    private getTimeZoneOffset(): number {
        const d = (new Date()).getTimezoneOffset();
        return d;
    }
}

