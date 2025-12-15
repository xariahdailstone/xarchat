import { CharacterName } from "../../shared/CharacterName";
import { CancellationToken, CancellationTokenSource } from "../../util/CancellationTokenSource";
import { KeyValuePair } from "../../util/collections/KeyValuePair";
import { DateUtils } from "../../util/DateUtils";
import { IDisposable, maybeDispose } from "../../util/Disposable";
import { HostInterop, LogChannelMessage, LogPMConvoMessage } from "../../util/hostinterop/HostInterop";
import { ExplicitDate } from "../../util/hostinterop/HostInteropLogSearch";
import { ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { PromiseSource } from "../../util/PromiseSource";
import { StringUtils } from "../../util/StringUtils";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { ChannelMessageViewModel, ChannelViewModel, TransientChannelStreamViewModel } from "../ChannelViewModel";
import { SuggestTextBoxViewModel } from "../SuggestTextBoxViewModel";

export class LogSearch3ViewModel extends ObservableBase implements IDisposable {
    constructor(
        public readonly session: ActiveLoginViewModel) {

        super();

        this._channelTitleSuggest = this._setupChannelTitleSuggest();

        const suggests = this._setupCharacterNameSuggests();
        this._myCharacterNameSuggest = suggests.myCharacterNameSuggest;
        this._interlocutorCharacterNameSuggest = suggests.interlocutorCharacterNameSuggest;
    }

    private _isDisposed: boolean = false;
    get isDisposed() { return this._isDisposed; }
    dispose() {
        maybeDispose(this.results);
    }
    [Symbol.dispose]() { this.dispose(); }    

    private _setupChannelTitleSuggest() {
        let currentHints: string[] = [];
        const result = new SuggestTextBoxViewModel(this.session.appViewModel,
            async (txt: string, cancellationToken: CancellationToken) => {
                this.channelTitleValid = false;
                this._updateCanSearch();
                const hints: string[] = await HostInterop.logSearch.getHintsForChannelTitle(txt, cancellationToken);
                if (this._containsCaseInsensitive(txt, hints)) {
                    this.channelTitleValid = true;
                    this._updateCanSearch();
                }
                currentHints = hints;
                return hints;
            }
        );
        result.onValueChangedFunc = (v: string) => {
            const isValid = this._containsCaseInsensitive(v, currentHints);
            if (isValid != this.channelTitleValid) {
                this.channelTitleValid = isValid;
                this._updateCanSearch();
            }
        };
        return result;
    }

    private _setupCharacterNameSuggests(): { myCharacterNameSuggest: SuggestTextBoxViewModel, interlocutorCharacterNameSuggest: SuggestTextBoxViewModel } {
        let currentMyCharHints: string[] = [];
        let currentInterlocutorHints: string[] = [];

        const recheckPairing = async () => {
            const myCharName = myCharSuggest.value;
            const interlocutorCharName = interlocutorCharSuggest.value;
            const xx: string[] = !StringUtils.isNullOrWhiteSpace(myCharName) && !StringUtils.isNullOrWhiteSpace(interlocutorCharName)
                ? await HostInterop.logSearch.getHintsForInterlocutorCharacterName(myCharName, interlocutorCharName, true, CancellationToken.NONE)
                : [];

            if (myCharSuggest.value == myCharName && interlocutorCharSuggest.value == interlocutorCharName) {
                if (this._containsCaseInsensitive(interlocutorCharName, xx)) {
                    this.myCharacterNameValid = true;
                    this.interlocutorCharacterNameValid = true;
                    this._updateCanSearch();
                }
            }
        };

        const myCharSuggest = new SuggestTextBoxViewModel(this.session.appViewModel,
            async (txt: string, cancellationToken: CancellationToken) => {
                this.myCharacterNameValid = false;
                this._updateCanSearch();
                const hints: string[] = await HostInterop.logSearch.getHintsForMyCharacterName(txt, cancellationToken);
                if (this._containsCaseInsensitive(txt, hints)) {
                    this.myCharacterNameValid = true;
                    this._updateCanSearch();
                }
                currentMyCharHints = hints;
                return hints;
            }
        );
        myCharSuggest.onValueChangedFunc = (v: string) => {
            this.myCharacterNameValid = this._containsCaseInsensitive(v, currentMyCharHints);
            recheckPairing();
        };

        const interlocutorCharSuggest = new SuggestTextBoxViewModel(this.session.appViewModel,
            async (txt: string, cancellationToken: CancellationToken) => {
                this.interlocutorCharacterNameValid = false;
                this._updateCanSearch();
                this.logger.logInfo("showing suggestions for interlocutor", myCharSuggest.value, txt);
                const hints: string[] = await HostInterop.logSearch.getHintsForInterlocutorCharacterName(
                    myCharSuggest.value, txt, false, cancellationToken);
                if (this._containsCaseInsensitive(txt, hints)) {
                    this.interlocutorCharacterNameValid = true;
                    this._updateCanSearch();
                }
                currentInterlocutorHints = hints;
                return hints;
            }
        );
        interlocutorCharSuggest.onValueChangedFunc = (v: string) => {
            recheckPairing();
        };

        return { myCharacterNameSuggest: myCharSuggest, interlocutorCharacterNameSuggest: interlocutorCharSuggest };
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

    private readonly _channelTitleSuggest: SuggestTextBoxViewModel;
    get channelTitleSuggest() { return this._channelTitleSuggest; }

    private readonly _myCharacterNameSuggest: SuggestTextBoxViewModel;
    get myCharacterNameSuggest() { return this._myCharacterNameSuggest; }

    private readonly _interlocutorCharacterNameSuggest: SuggestTextBoxViewModel;
    get interlocutorCharacterNameSuggest() { return this._interlocutorCharacterNameSuggest; }

    @observableProperty
    channelTitleValid: boolean = false;

    @observableProperty
    myCharacterNameValid: boolean = false;

    @observableProperty
    interlocutorCharacterNameValid: boolean = false;

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
                        const channelTitle = this.channelTitleSuggest.value;
                        const x: ExplicitDate[] = await HostInterop.logSearch.searchChannelMessageDatesAsync(channelTitle, myCTS.token);
                        maybeDispose(this.results);
                        this.results = new LogSearchResultsViewModel(
                            this, this.session, x,
                            async (date, cancellationToken) => {
                                const searchResults = await HostInterop.logSearch.getChannelMessagesAsync(channelTitle, 
                                    date,
                                    this.addDay(date), cancellationToken);
                                const messages: LogChannelMessage[] = [];
                                for (let lm of searchResults) {
                                    const lcm = HostInterop.convertFromApiChannelLoggedMessage(lm);
                                    messages.push(lcm);
                                }
                                return { title: channelTitle, messages: messages };
                            }
                        );
                    }
                    break;
                case LogSearchType.PRIVATE_MESSAGE:
                    {
                        const myCharacterName = this.myCharacterNameSuggest.value
                        const interlocutorCharacterName = this.interlocutorCharacterNameSuggest.value;
                        const x: ExplicitDate[] = await HostInterop.logSearch.searchPMConversationDatesAsync(myCharacterName, interlocutorCharacterName, myCTS.token);
                        maybeDispose(this.results);
                        this.results = new LogSearchResultsViewModel(
                            this, this.session, x,
                            async (date, cancellationToken) => {
                                const searchResults = await HostInterop.logSearch.getPMConversationMessagesAsync(
                                    myCharacterName, interlocutorCharacterName, 
                                    date,
                                    this.addDay(date), cancellationToken);
                                const messages: LogPMConvoMessage[] = [];
                                // const csvm = new TransientChannelStreamViewModel(this.session, CharacterName.create(interlocutorCharacterName).value);
                                // csvm.lazyLoadImages = true;
                                for (let lm of searchResults) {
                                    const lcm = HostInterop.convertFromApiPMConvoLoggedMessage(lm);
                                    messages.push(lcm);
                                    // const mvm = ChannelViewModel.convertFromLoggedMessage(csvm, this.session, this.session.appViewModel, lcm);
                                    // if (mvm) {
                                    //     csvm.messages.push(new KeyValuePair(mvm, mvm));
                                    // }
                                }
                                return { title: CharacterName.create(interlocutorCharacterName).value, messages: messages };
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

type MessageLoadFunc = (date: ExplicitDate, cancellationToken: CancellationToken) => Promise<{ title: string, messages: (LogChannelMessage[] | LogPMConvoMessage[]) }>;

export class LogSearchResultsViewModel extends ObservableBase implements IDisposable {
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

    private _isDisposed: boolean = false;
    get isDisposed() { return this._isDisposed; }
    dispose() {
        maybeDispose(this.messageSet);
    }
    [Symbol.dispose]() { this.dispose(); }    

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
    messageSet: (LogSearchResultsMessageGroupSetViewModel | null) = null;

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
        maybeDispose(this.messageSet);
        this.messageSet = null;
        try {
            if (d) {
                const res = await this.performMessageLoadAsync(d, myCTS.token);
                const setvm = new LogSearchResultsMessageGroupSetViewModel(this, res.title, res.messages);
                maybeDispose(this.messageSet);
                this.messageSet = setvm;
            }
        }
        finally {
            this.loadingMessages--;
        }
    }
}

const MAX_MESSAGES_PER_SET = 500;

export class LogSearchResultsMessageGroupSetViewModel extends ObservableBase implements IDisposable {
    constructor(
        public readonly results: LogSearchResultsViewModel,
        channelTitle: string,
        messages: (LogChannelMessage[] | LogPMConvoMessage[])) {

        super();

        let curStart = "";
        let curChannel: TransientChannelStreamViewModel = new TransientChannelStreamViewModel(results.session, channelTitle);
        curChannel.lazyLoadImages = true;
        const completeArray = () => {
            const lastMsg = curChannel.messages[curChannel.messages.length - 1]!.value;
            const curEnd = lastMsg.timestamp.getHours().toString() + ":" + StringUtils.leftPad(lastMsg.timestamp.getMinutes().toString(), "0", 2);
            this.groups.push(new LogSearchResultsMessageGroupViewModel(
                `${curStart}-${curEnd}`, this, curChannel));
            
            curStart = "";
            curChannel = new TransientChannelStreamViewModel(results.logSearch.session, channelTitle);
            curChannel.lazyLoadImages = true;
        };

        for (let msg of messages) {
            if (curChannel.messages.length == 0) {
                curStart = msg.timestamp.getHours().toString() + ":" + StringUtils.leftPad(msg.timestamp.getMinutes().toString(), "0", 2);
            }
            if ((msg as any).myCharacterName) {
                // LogPMConvoMessage
                const lpcm = msg as LogPMConvoMessage;
                const mvm = ChannelViewModel.convertFromLoggedMessage(curChannel, results.session, results.session.appViewModel, lpcm)!;
                curChannel.messages.add(new KeyValuePair(mvm, mvm));
            }
            else {
                // LogChannelMessage
                const lcm = msg as LogChannelMessage;
                const mvm = ChannelViewModel.convertFromLoggedMessage(curChannel, results.session, results.session.appViewModel, lcm)!;
                curChannel.messages.add(new KeyValuePair(mvm, mvm));
            }
            if (curChannel.messages.length >= MAX_MESSAGES_PER_SET) {
                completeArray();
            }
        }
        if (curChannel.messages.length > 0) {
            completeArray();
        }

        this.selectedGroup = this.groups[this.groups.length - 1];
    }

    private _isDisposed: boolean = false;
    get isDisposed() { return this._isDisposed; }
    dispose() {
        for (let g of this.groups) {
            g.dispose();
        }
    }
    [Symbol.dispose]() { this.dispose(); }    

    readonly groups: LogSearchResultsMessageGroupViewModel[] = [];

    @observableProperty
    selectedGroup: (LogSearchResultsMessageGroupViewModel | null) = null;
}

export class LogSearchResultsMessageGroupViewModel extends ObservableBase implements IDisposable {
    constructor(
        public readonly timeRangeString: string,
        public readonly groupSet: LogSearchResultsMessageGroupSetViewModel,
        public readonly channel: TransientChannelStreamViewModel) {

        super();
    }

    private _isDisposed: boolean = false;
    get isDisposed() { return this._isDisposed; }
    dispose() {
        this.channel.dispose();
    }
    [Symbol.dispose]() { this.dispose(); }
}