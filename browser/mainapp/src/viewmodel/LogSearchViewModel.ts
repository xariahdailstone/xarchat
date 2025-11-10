import { ChannelName } from "../shared/ChannelName";
import { CharacterName } from "../shared/CharacterName";
import { CancellationToken, CancellationTokenSource } from "../util/CancellationTokenSource";
import { HostInterop } from "../util/hostinterop/HostInterop";
import { DateAnchor, LogSearchKind, LogSearchResult } from "../util/hostinterop/HostInteropLogSearch";
import { ObservableValue } from "../util/Observable";
import { ObservableBase, observableProperty } from "../util/ObservableBase";
import { Collection } from "../util/ObservableCollection";
import { ScrollAnchorTo } from "../util/ScrollAnchorTo";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";
import { AppViewModel } from "./AppViewModel";
import { ChannelMessageViewModel, ChannelMessageViewModelOrderedDictionary, ChannelViewModel } from "./ChannelViewModel";

export type LogSearchDate = (Date | SearchDate);

export class SearchDate {
    static readonly Now: SearchDate = new SearchDate("Now", () => new Date());
    static readonly Earliest: SearchDate = new SearchDate("Earliest", () => new Date(0));

    private constructor(public readonly title: string, public readonly getDate: () => Date) { }
}
const SearchDateNow: object = {};

export class LogSearchViewModel extends ObservableBase {
    constructor(
        public readonly activeLoginViewModel: ActiveLoginViewModel,
        public readonly appViewModel: AppViewModel,
        private readonly defaultCharacterName: CharacterName) {

        super();
        this._logsFor = defaultCharacterName;
    }

    private _logsFor: CharacterName;
    @observableProperty
    get logsFor(): CharacterName { return this._logsFor; }
    set logsFor(value: CharacterName) {
        if (value != this._logsFor) {
            this._logsFor = value;
            this.updateCanSearch();
        }
    }

    private _searchKind: LogSearchKind = LogSearchKind.PrivateMessages;
    @observableProperty
    get searchKind(): LogSearchKind { return this._searchKind; }
    set searchKind(value: LogSearchKind) {
        if (value != this._searchKind) {
            this._searchKind = value;
            this._searchText = "";
            this.updateCanSearch();
        }
    }

    private _dateAnchor: DateAnchor = DateAnchor.Before;
    @observableProperty
    get dateAnchor(): DateAnchor { return this._dateAnchor; }
    set dateAnchor(value: DateAnchor) {
        if (value != this._dateAnchor) {
            this._dateAnchor = value;
            this.updateCanSearch();
        }
    }

    private _date: (Date | SearchDate) = SearchDate.Now;
    @observableProperty
    get date(): Date | SearchDate { return this._date; }
    set date(value: Date | SearchDate) {
        if (value != this._date) {
            this._date = value;
            this.updateCanSearch();
        }
    }

    private _searchText: string = "";
    @observableProperty
    get searchText(): string { return this._searchText; }
    set searchText(value: string) {
        if (value != this._searchText) {
            this._searchText = value;
            this.updateCanSearch();
        }
    }

    @observableProperty
    canSearch: boolean = false;

    @observableProperty
    searchTextHints: string[] = [];

    @observableProperty
    results: Collection<LogSearchResultItem> = new Collection<LogSearchResultItem>();

    @observableProperty
    scrollToCommand: (ScrollToCommand | null) = null;

    private readonly _updatingElementsOV: ObservableValue<boolean> = new ObservableValue(false);
    get updatingElements(): boolean { return this._updatingElementsOV.value; }
    set updatingElements(value: boolean) { this._updatingElementsOV.value = value; }

    @observableProperty
    scrollAnchorTo: (ScrollAnchorTo | null) = null;

    private _currentCanSearchKey: object = {};
    private _previousCanSearchTS: (CancellationTokenSource | null) = null;
    private async updateCanSearch() {
        const myCanSearchKey = {};
        const myCTS = new CancellationTokenSource();
        this._currentCanSearchKey = myCanSearchKey;
        if (this._previousCanSearchTS) { this._previousCanSearchTS.cancel(); }
        this._previousCanSearchTS = myCTS;

        const cancellationToken = myCTS.token;

        const isSearchTextValid = await this.validateSearchTextAsync(this.logsFor, this.searchKind, this.searchText, cancellationToken);
        if (this._currentCanSearchKey != myCanSearchKey) { return; }

        this.canSearch = isSearchTextValid;
    }

    private _currentSearchKey: object = {};
    private _previousSearchCTS: (CancellationTokenSource | null) = null;
    private async runTopLevelSearch() {
        if (this._multiArgumentSetCount > 0) return;

        const mySearchKey = {};
        const myCTS = new CancellationTokenSource();
        this._currentSearchKey = mySearchKey;
        if (this._previousSearchCTS) { this._previousSearchCTS.cancel(); }
        this._previousSearchCTS = myCTS;

        const cancellationToken = myCTS.token;

        this.results = new Collection<LogSearchResultItem>();
        if (this.searchText == "") {
            this.results.push(new PromptForParametersSearchResultItem("Please enter your search above."));
        }
        else {
            this.results.push(new PleaseWaitSearchResultItem("Please wait..."));

            const isSearchTextValid = await this.validateSearchTextAsync(this.logsFor, this.searchKind, this.searchText, cancellationToken);
            if (this._currentSearchKey != mySearchKey) return;
            if (!isSearchTextValid) {
                const newResults = new Collection<LogSearchResultItem>();
                if (this.searchKind == LogSearchKind.Channels) {
                    newResults.push(new PromptForParametersSearchResultItem(`No logs for a channel named "${this.searchKind}" were found.  Please modify your search.`));
                }
                else if (this.searchKind == LogSearchKind.PrivateMessages) {
                    newResults.push(new PromptForParametersSearchResultItem(`No logs for a character named "${this.searchKind}" were found.  Please modify your search.`));
                }
                
                this.results = newResults;
            }
            else {
                const logsFor = this.logsFor;
                const searchKind = this.searchKind;
                const searchText = this.searchText;
                const dateAnchor = this.dateAnchor;
                const sdate = this.date instanceof Date ? this.date : this.date.getDate();

                const lsrs = await this.performSearchAsync(this.logsFor, this.searchKind, this.searchText, this.dateAnchor, sdate, 200, cancellationToken);
                if (this._currentSearchKey != mySearchKey) return;

                const newResults = new Collection<LogSearchResultItem>();
                newResults.push(new ExtendSearchResultItem("Get earlier log entries", (esri) => { 
                    this.getEarlierLogEntries(esri, lsrs, logsFor, searchKind, searchText); 
                }));
                const ri = this.convertLogSearchResultsToResultItem(this.searchKind, lsrs);
                newResults.push(ri);
                newResults.push(new ExtendSearchResultItem("Get later log entries", (esri) => { 
                    this.getLaterLogEntries(esri, lsrs, logsFor, searchKind, searchText);
                }));
                this.results = newResults;
                this.scrollToCommand = { targetResultItem: ri, scrollTo: (dateAnchor == DateAnchor.After) ? "top" : "bottom", behavior: "instant" };
            }
        }
    }

    private async getEarlierLogEntries(esri: ExtendSearchResultItem, lsrs: LogSearchResult[],
        logsFor: CharacterName, searchKind: LogSearchKind, searchText: string) {

        esri.isLoading = true;
        this.updatingElements = true;
        try {
            const minTimestamp = lsrs.map(lsr => lsr.timestamp).reduce((prev, curr) => Math.min(prev, curr)) - 1;
            const newLsrs = await this.performSearchAsync(logsFor, searchKind, searchText, DateAnchor.Before, new Date(minTimestamp), 200, CancellationToken.NONE);

            const idx = this.results.indexOf(esri);
            if (idx != -1) {
                this.scrollAnchorTo = ScrollAnchorTo.BOTTOM;
                if (newLsrs.length > 0) {
                    const ri = this.convertLogSearchResultsToResultItem(this.searchKind, newLsrs);

                    this.results.removeAt(idx);
                    const newEsri = new ExtendSearchResultItem("Get earlier log entries", (esri) => { 
                        this.getEarlierLogEntries(esri, newLsrs, logsFor, searchKind, searchText); 
                    });
                    this.results.addAt(newEsri, idx);
                    this.results.addAt(ri, idx + 1);
                    //this.scrollToCommand = { targetResultItem: ri, scrollTo: "bottom", behavior: "instant" };
                }
                else {
                    this.results.removeAt(idx);
                    const newEsri = new ExtendSearchResultItem("No earlier log entries", null);
                    this.results.addAt(newEsri, idx);
                    //this.scrollToCommand = { targetResultItem: newEsri, scrollTo: "top", behavior: "smooth" };
                }
            }
        }
        finally {
            this.updatingElements = false;
            esri.isLoading = false;
        }
    }

    private async getLaterLogEntries(esri: ExtendSearchResultItem, lsrs: LogSearchResult[],
        logsFor: CharacterName, searchKind: LogSearchKind, searchText: string) {

        esri.isLoading = true;
        this.updatingElements = true;
        try {
            const maxTimestamp = lsrs.map(lsr => lsr.timestamp).reduce((prev, curr) => Math.max(prev, curr)) + 1;
            const newLsrs = await this.performSearchAsync(logsFor, searchKind, searchText, DateAnchor.After, new Date(maxTimestamp), 200, CancellationToken.NONE);

            const idx = this.results.indexOf(esri);
            if (idx != -1) {
                this.scrollAnchorTo = ScrollAnchorTo.TOP;
                if (newLsrs.length > 0) {
                    const ri = this.convertLogSearchResultsToResultItem(this.searchKind, newLsrs);

                    this.results.removeAt(idx);
                    const newEsri = new ExtendSearchResultItem("Get later log entries", (esri) => { 
                        this.getLaterLogEntries(esri, newLsrs, logsFor, searchKind, searchText); 
                    });
                    this.results.addAt(ri, idx);
                    this.results.addAt(newEsri, idx + 1);
                    //this.scrollToCommand = { targetResultItem: ri, scrollTo: "top", behavior: "instant" };
                }
                else {
                    this.results.removeAt(idx);
                    const newEsri = new ExtendSearchResultItem("No later log entries (click to search again)", (esri) => { 
                        this.getLaterLogEntries(esri, lsrs, logsFor, searchKind, searchText); 
                    });
                    this.results.addAt(newEsri, idx);
                    //this.scrollToCommand = { targetResultItem: newEsri, scrollTo: "bottom", behavior: "smooth" };
                }
            }
        }
        finally {
            this.updatingElements = false;
            esri.isLoading = false;
        }
    }

    private async validateSearchTextAsync(logsFor: CharacterName, searchKind: LogSearchKind, searchText: string, cancellationToken: CancellationToken): Promise<boolean> {
        const res = await HostInterop.logSearch.validateSearchTextAsync(logsFor, searchKind, searchText, cancellationToken);
        return res;
    }

    private async performSearchAsync(logsFor: CharacterName, searchKind: LogSearchKind, searchText: string, 
        dateAnchor: DateAnchor, date: Date, maxEntries: number, cancellationToken: CancellationToken): Promise<LogSearchResult[]> {

        const res = await HostInterop.logSearch.performSearchAsync(logsFor, searchKind, searchText, dateAnchor, date, maxEntries, cancellationToken);
        return res;
    }

    private convertLogSearchResultsToResultItem(kind: LogSearchKind, lsrs: LogSearchResult[]): LogSearchResultItem {
        const itemViewModels: ChannelMessageViewModelOrderedDictionary = new ChannelMessageViewModelOrderedDictionary();
        for (let lsr of lsrs) {
            let mvm: ChannelMessageViewModel | null = null;
            if (kind == LogSearchKind.Channels) {
                const lcm = HostInterop.convertFromApiChannelLoggedMessage(lsr);
                mvm = ChannelViewModel.convertFromLoggedMessage(null, this.activeLoginViewModel, this.appViewModel, lcm);
            }
            else {
                const lcm = HostInterop.convertFromApiPMConvoLoggedMessage(lsr);
                mvm = ChannelViewModel.convertFromLoggedMessage(null, this.activeLoginViewModel, this.appViewModel, lcm);
            }
            if (mvm != null) {
                itemViewModels.add(mvm);
            }
        }
        return new LoggedMessagesSearchResultItem(itemViewModels);
    }

    private _multiArgumentSetCount = 0;
    enterMultiArgumentSet() {
        this._multiArgumentSetCount++;
    }
    exitMultiArgumentSet() {
        this._multiArgumentSetCount = Math.max(0, this._multiArgumentSetCount - 1);
        if (this._multiArgumentSetCount == 0) {
            this.runTopLevelSearch();
        }
    }

    setSearch(logsFor: CharacterName, dateAnchor: DateAnchor, date: Date, target: ChannelName | CharacterName) {
        this.enterMultiArgumentSet();
        try {
            this.logsFor = logsFor;
            this.dateAnchor = dateAnchor;
            this.date = date;
            this.searchKind = target instanceof ChannelName ? LogSearchKind.Channels : LogSearchKind.PrivateMessages;
            this.searchText = target.value;
        }
        finally {
            this.exitMultiArgumentSet();
        }
    }
}

export interface ScrollToCommand {
    targetResultItem: LogSearchResultItem;
    scrollTo: "top" | "bottom";
    behavior: "smooth" | "instant";
}

export interface LogSearchResultItem {
}

export class PromptForParametersSearchResultItem extends ObservableBase implements LogSearchResultItem {
    constructor(public readonly text: string) {
        super();
    }
}

export class PleaseWaitSearchResultItem extends ObservableBase implements LogSearchResultItem {
    constructor(public readonly title: string) {
        super();
    }
}

export class ExtendSearchResultItem extends ObservableBase implements LogSearchResultItem {
    constructor(public readonly text: string, private readonly onClick: ((esri: ExtendSearchResultItem) => void) | null) {
        super();
    }

    @observableProperty
    isLoading: boolean = false;

    @observableProperty
    get canClick() { return this.onClick != null; }

    click() { if (this.onClick) { this.onClick(this); } }
}

export class LoggedMessagesSearchResultItem extends ObservableBase implements LogSearchResultItem {
    constructor(xmessages: ChannelMessageViewModelOrderedDictionary) {
        super();
        this.messages = xmessages;
    }

    @observableProperty
    readonly messages: ChannelMessageViewModelOrderedDictionary;
}