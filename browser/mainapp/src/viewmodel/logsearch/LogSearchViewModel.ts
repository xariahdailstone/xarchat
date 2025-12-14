import { CharacterName } from "../../shared/CharacterName";
import { CancellationToken, CancellationTokenSource } from "../../util/CancellationTokenSource";
import { KeyValuePair } from "../../util/collections/KeyValuePair";
import { DateUtils } from "../../util/DateUtils";
import { HostInterop } from "../../util/hostinterop/HostInterop";
import { ExplicitDate } from "../../util/hostinterop/HostInteropLogSearch";
import { ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { PromiseSource } from "../../util/PromiseSource";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { ChannelViewModel, TransientChannelStreamViewModel } from "../ChannelViewModel";

export class LogSearch3ViewModel extends ObservableBase {
    constructor(
        public readonly session: ActiveLoginViewModel) {

        super();
    }

    @observableProperty
    status: LogSearchStatus = LogSearchStatus.IDLE;

    @observableProperty
    results: (LogSearchResultsViewModel | null) = null;

    private readonly _logSearchType: ObservableValue<(LogSearchType | null)> = new ObservableValue(null);

    get logSearchType(): (LogSearchType | null) { return this._logSearchType.value; }
    set logSearchType(value: (LogSearchType | null)) {
        if (value != this._logSearchType.value) {
            this.logger.logInfo("changing logSearchType", this._logSearchType.value, value);
            this._logSearchType.value = value;
            this._updateCanSearch();
        }
    }

    private readonly _channelTitle: ObservableValue<string> = new ObservableValue("");

    get channelTitle(): string { return this._channelTitle.value; }
    set channelTitle(value: string) {
        if (value != this._channelTitle.value) {
            this._channelTitle.value = value;
            this._channelTitleChanged(value);
        }
    }

    @observableProperty
    channelTitleValid: boolean = false;

    @observableProperty
    channelTitleSuggestionsPromise: Promise<string[]> | null = null;

    private readonly _myCharacterName: ObservableValue<string> = new ObservableValue("");
    private readonly _interlocutorCharacterName: ObservableValue<string> = new ObservableValue("");

    get myCharacterName(): string { return this._myCharacterName.value; }
    set myCharacterName(value: string) {
        if (value != this._myCharacterName.value) {
            this._myCharacterName.value = value;
            this._characterNamesChanged();
        }
    }

    @observableProperty
    myCharacterNameValid: boolean = false;

    @observableProperty
    myCharacterNameSuggestionsPromise: Promise<string[]> | null = null;

    get interlocutorCharacterName(): string { return this._interlocutorCharacterName.value; }
    set interlocutorCharacterName(value: string) {
        if (value != this._interlocutorCharacterName.value) {
            this._interlocutorCharacterName.value = value;
            this._characterNamesChanged();
        }
    }

    @observableProperty
    interlocutorCharacterNameValid: boolean = false;

    @observableProperty
    interlocutorCharacterNameSuggestionsPromise: Promise<string[]> | null = null;

    @observableProperty
    canSearch: boolean = false;

    private _searchCTS: CancellationTokenSource = new CancellationTokenSource();

    private addDay(d: ExplicitDate): ExplicitDate {
        const tomorrowDate = DateUtils.addDays(new Date(d.y, d.m - 1, d.d), 1.5);
        return { y: tomorrowDate.getFullYear(), m: tomorrowDate.getMonth() + 1, d: tomorrowDate.getDate() };
    }

    async search() {
        if (!this.canSearch || this.status != LogSearchStatus.IDLE) { return; }

        this.status = LogSearchStatus.SEARCHING;
        this.results = null;
        try {
            const myCTS = new CancellationTokenSource();
            this._searchCTS = myCTS;

            switch (this.logSearchType) {
                case LogSearchType.CHANNEL:
                    {
                        const channelTitle = this.channelTitle;
                        const x: ExplicitDate[] = await HostInterop.logSearch.searchChannelMessageDatesAsync(channelTitle, myCTS.token);
                        this.results = new LogSearchResultsViewModel(
                            this, this.session, x,
                            async (date, cancellationToken) => {
                                const searchResults = await HostInterop.logSearch.getChannelMessagesAsync(channelTitle, 
                                    date,
                                    this.addDay(date), cancellationToken);
                                const csvm = new TransientChannelStreamViewModel(this.session, channelTitle);
                                for (let lm of searchResults) {
                                    const lcm = HostInterop.convertFromApiChannelLoggedMessage(lm);
                                    const mvm = ChannelViewModel.convertFromLoggedMessage(csvm, this.session, this.session.appViewModel, lcm);
                                    if (mvm) {
                                        csvm.messages.push(new KeyValuePair(mvm, mvm));
                                    }
                                }
                                return csvm;
                            }
                        );
                    }
                    break;
                case LogSearchType.PRIVATE_MESSAGE:
                    {
                        const myCharacterName = this.myCharacterName;
                        const interlocutorCharacterName = this.interlocutorCharacterName;
                        const x: ExplicitDate[] = await HostInterop.logSearch.searchPMConversationDatesAsync(myCharacterName, interlocutorCharacterName, myCTS.token);
                        this.results = new LogSearchResultsViewModel(
                            this, this.session, x,
                            async (date, cancellationToken) => {
                                const searchResults = await HostInterop.logSearch.getPMConversationMessagesAsync(
                                    myCharacterName, interlocutorCharacterName, 
                                    date,
                                    this.addDay(date), cancellationToken);
                                const csvm = new TransientChannelStreamViewModel(this.session, CharacterName.create(interlocutorCharacterName).value);
                                for (let lm of searchResults) {
                                    const lcm = HostInterop.convertFromApiPMConvoLoggedMessage(lm);
                                    const mvm = ChannelViewModel.convertFromLoggedMessage(csvm, this.session, this.session.appViewModel, lcm);
                                    if (mvm) {
                                        csvm.messages.push(new KeyValuePair(mvm, mvm));
                                    }
                                }
                                return csvm;
                            }
                        );
                    }
                    break;
            }
        }
        catch (e) {
            // TODO: surface exception
        }
        finally {
            this.status = LogSearchStatus.IDLE;
        }
    }

    cancelSearch() {
        if (this.status == LogSearchStatus.SEARCHING) {
            this._searchCTS.cancel();
        }
    }

    private _containsCaseInsensitive(needle: string, haystack: string[]): boolean {
        const needleLower = needle.toLowerCase();
        for (let x of haystack) {
            if (x.toLowerCase() == needleLower) {
                return true;
            }
        }
        return false;
    }

    private _channelTitleSuggestCTS: CancellationTokenSource = new CancellationTokenSource();

    private async _channelTitleChanged(value: string) {
        const myCTS = new CancellationTokenSource();
        const myPS = new PromiseSource<string[]>();
        this._channelTitleSuggestCTS.cancel();
        this._channelTitleSuggestCTS = myCTS;

        this.channelTitleValid = false;
        this.channelTitleSuggestionsPromise = myPS.promise;
        this._updateCanSearch();
        try {
            const hints: string[] = await HostInterop.logSearch.getHintsForChannelTitle(value, myCTS.token);
            if (this._channelTitleSuggestCTS == myCTS) {
                myPS.tryResolve(hints);
                if (this._containsCaseInsensitive(value, hints)) {
                    this.channelTitleValid = true;
                    this._updateCanSearch();
                }
            }
            else {
                myPS.tryResolve([]);
            }
        }
        catch (e) {
            myPS.reject(e);
        }
    }

    private _characterNamesSuggestCTS: CancellationTokenSource = new CancellationTokenSource();

    private async _characterNamesChanged() {
        const myCTS = new CancellationTokenSource();
        const myPS = new PromiseSource<string[]>();
        const interlocutorPS = new PromiseSource<string[]>();
        this._characterNamesSuggestCTS.cancel();
        this._characterNamesSuggestCTS = myCTS;

        this.myCharacterNameValid = false;
        this.myCharacterNameSuggestionsPromise = myPS.promise;
        this.interlocutorCharacterNameSuggestionsPromise = interlocutorPS.promise;
        this._updateCanSearch();
        try {
            const myHintsPromise: Promise<string[]> = HostInterop.logSearch.getHintsForMyCharacterName(this.myCharacterName, myCTS.token);
            const interlocutorHintsPromise: Promise<string[]> =  HostInterop.logSearch.getHintsForInterlocutorCharacterName(this.myCharacterName, this.interlocutorCharacterName, myCTS.token);

            const myHints = await myHintsPromise;
            const interlocutorHints = await interlocutorHintsPromise;

            if (this._characterNamesSuggestCTS == myCTS) {
                myPS.tryResolve(myHints);
                interlocutorPS.tryResolve(interlocutorHints);

                if (this._containsCaseInsensitive(this.myCharacterName, myHints)) {
                    this.myCharacterNameValid = true;
                }
                if (this._containsCaseInsensitive(this.interlocutorCharacterName, interlocutorHints)) {
                    this.interlocutorCharacterNameValid = true;
                }

                this._updateCanSearch();
            }
            else {
                myPS.tryResolve([]);
                interlocutorPS.tryReject([]);
            }
        }
        catch (e) {
            myPS.reject(e);
            interlocutorPS.reject(e);
        }
    }

    private _updateCanSearch() {
        if (this.logSearchType == LogSearchType.CHANNEL) {
            this.canSearch = this.channelTitleValid;
        }
        else if (this.logSearchType == LogSearchType.PRIVATE_MESSAGE) {
            this.canSearch = this.myCharacterNameValid && this.interlocutorCharacterNameValid;
        }
        else {
            this.canSearch = false;
        }
    }
}

export enum LogSearchType {
    CHANNEL = "channel",
    PRIVATE_MESSAGE = "pmconvo"
}

export enum LogSearchStatus {
    IDLE,
    SEARCHING
}

type MessageLoadFunc = (date: ExplicitDate, cancellationToken: CancellationToken) => Promise<TransientChannelStreamViewModel>;

export class LogSearchResultsViewModel extends ObservableBase {
    constructor(
        public readonly logSearch: LogSearch3ViewModel,
        public readonly session: ActiveLoginViewModel,
        public readonly dates: ExplicitDate[],
        private readonly performMessageLoadAsync: MessageLoadFunc) {

        super();

        this.selectedYear = dates[dates.length - 1].y;

        const hasYears: number[] = [];
        let lastSeenYear = 0;
        for (let d of dates) {
            const dFullYear = d.y;
            if (dFullYear != lastSeenYear) {
                lastSeenYear = dFullYear;
                hasYears.push(dFullYear);
            }

            this._hasDates.add(new Date(Date.UTC(d.y, d.m - 1, d.d, 0, 0, 0, 0)).getTime());
        }
        this.hasYears = hasYears;
    }

    @observableProperty
    hasYears: number[];

    @observableProperty
    selectedYear: number;

    private _selectedDate: ObservableValue<(ExplicitDate | null)> = new ObservableValue(null);

    get selectedDate(): (ExplicitDate | null) { return this._selectedDate.value; }
    set selectedDate(value: (ExplicitDate | null)) {
        if (value != this._selectedDate.value) {
            this._selectedDate.value = value;
            this.logger.logInfo("selectedDate set", value);
            this._performMessageLoad(value);
        }
    }

    @observableProperty
    loadingMessages: number = 0;

    @observableProperty
    messages: (TransientChannelStreamViewModel | null) = null;

    private _hasDates: Set<number> = new Set();

    hasDate(year: number, month: number, day: number): boolean {
        const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        return this._hasDates.has(d.getTime());
    }

    private _performMessageLoadCTS: CancellationTokenSource = new CancellationTokenSource();
    private async _performMessageLoad(d: (ExplicitDate | null)) {
        const myCTS = new CancellationTokenSource();
        this._performMessageLoadCTS.cancel();
        this._performMessageLoadCTS = myCTS;

        this.loadingMessages++;
        this.messages = null;
        try {
            if (d) {
                const res = await this.performMessageLoadAsync(d, myCTS.token);
                this.messages = res;
            }
        }
        finally {
            this.loadingMessages--;
        }
    }
}