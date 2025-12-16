import { ChannelName } from "../../shared/ChannelName";
import { CharacterName } from "../../shared/CharacterName";
import { CancellationToken, CancellationTokenSource } from "../../util/CancellationTokenSource";
import { DateUtils } from "../../util/DateUtils";
import { IDisposable, maybeDispose } from "../../util/Disposable";
import { HostInterop, LogChannelMessage, LogPMConvoMessage } from "../../util/hostinterop/HostInterop";
import { ExplicitDate } from "../../util/hostinterop/HostInteropLogSearch";
import { ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { PromiseSource } from "../../util/PromiseSource";
import { StringUtils } from "../../util/StringUtils";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { ChannelMessageViewModel } from "../ChannelViewModel";
import { SuggestTextBoxViewModel } from "../SuggestTextBoxViewModel";
import { LogSearchResultsViewModel } from "./LogSearchResultsViewModel";
import { LogSearchStatus } from "./LogSearchStatus";
import { LogSearchType } from "./LogSearchType";

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

    async search(forceCanSearch?: boolean) {
        const canSearch = forceCanSearch || this.canSearch;
        if (!canSearch || this.status != LogSearchStatus.IDLE) { return; }

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

    async openChannelSearch(channelTitle: string) {
        this.logSearchType = LogSearchType.CHANNEL;
        this.channelTitleSuggest.value = channelTitle;
        await this.search(true);
        await this.navigateToLastAsync();
        // TODO: navigate to last year, last date, last set
    }

    async openPMConvoSearch(myCharacterName: CharacterName, interlocutorCharacterName: CharacterName) {
        this.logSearchType = LogSearchType.PRIVATE_MESSAGE;
        this.myCharacterNameSuggest.value = myCharacterName.value;
        this.interlocutorCharacterNameSuggest.value = interlocutorCharacterName.value;
        await this.search(true);
        await this.navigateToLastAsync();
        // TODO: navigate to last year, last date, last set
    }

    private async navigateToLastAsync() {
        if (!this.results) { return; }
        await this.results.navigateToLastAsync();
    }
}