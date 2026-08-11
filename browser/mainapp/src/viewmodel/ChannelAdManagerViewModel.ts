import { CharacterName } from "../shared/CharacterName";
import { CharacterStatus } from "../shared/CharacterSet";
import { OnlineStatus } from "../shared/OnlineStatus";
import { ReadOnlyStdObservableCollection } from "../util/collections/ReadOnlyStdObservableCollection";
import { StdObservableSortedView } from "../util/collections/StdObservableSortedView";
import { StdObservableFilteredView } from "../util/collections/StdObservableView";
import { DateComparer, StringComparer } from "../util/Comparer";
import { asDisposable, EmptyDisposable, IDisposable, maybeDispose } from "../util/Disposable";
import { Observable, ObservableValue } from "../util/Observable";
import { ObservableBase } from "../util/ObservableBase";
import { Collection, ObservableCollection, ReadOnlyObservableCollection } from "../util/ObservableCollection";
import { Scheduler } from "../util/Scheduler";
import { TimeSpanUtils } from "../util/TimeSpanUtils";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";
import { AppViewModel } from "./AppViewModel";
import { ChannelMessageType, ChannelMessageViewModel, ChannelViewModel } from "./ChannelViewModel";
import { ChatChannelViewModel } from "./ChatChannelViewModel";

const AD_EXPIRATION_MS: number = TimeSpanUtils.fromMinutes(15);

export interface IAdManagerViewModel {
    readonly appViewModel: AppViewModel;
    readonly activeLoginViewModel: ActiveLoginViewModel;

    sortField: AdManagerSortField;
    sortDirection: AdManagerSortDirection;
    searchText: string;
    showFilter: AdManagerShowFilter;
    readonly activeAds: ReadOnlyStdObservableCollection<ChannelMessageViewModel>;

    readonly adCount: number;

    resetFilters(): void;
    setSort(field: AdManagerSortField, direction: AdManagerSortDirection): void;
}

export enum AdManagerSortField {
    CHARACTER_NAME,
    POSTED_AT
}

export enum AdManagerSortDirection {
    ASCENDING,
    DESCENDING
}

export enum AdManagerShowFilter {
    ALL = "all",
    ALLBUTUNINTERESTED = "allbutuninterested",
    UNINTERESTEDONLY = "uninterestedonly"
}

export class ChannelAdManagerViewModel extends ObservableBase implements IDisposable, IAdManagerViewModel {
    constructor(
        public readonly channel: ChatChannelViewModel) {
        
        super();
        this._updateView();
    }

    private readonly _trackedAds: Set<TrackedAdInfo> = new Set();
    private readonly _trackedAdsByPoster: Map<CharacterName, TrackedAdInfo> = new Map();
    private readonly _posterWatchDisposables: Map<CharacterName, IDisposable> = new Map();
    private readonly _trackedCharacterLastStatus: Map<CharacterName, Omit<CharacterStatus, "equals">> = new Map();

    private _isDisposed: boolean = false;
    get isDisposed(): boolean { return this._isDisposed; }

    [Symbol.dispose](): void { this.dispose(); }
    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            maybeDispose(this._filteredActiveAds);
            maybeDispose(this._sortedActiveAds);
            this._exposedActiveAds.value = this._rawActiveAds;
            for (let tai of [...this._trackedAds.values()]) {
                tai.dispose();
            }
            
            for (let pwd of [...this._posterWatchDisposables.values()]) {
                maybeDispose(pwd);
            }
            this._posterWatchDisposables.clear();
        }
    }

    get appViewModel(): AppViewModel { return this.channel.appViewModel; }
    get activeLoginViewModel(): ActiveLoginViewModel { return this.channel.activeLoginViewModel; }

    private readonly _sortField: ObservableValue<AdManagerSortField> = new ObservableValue(AdManagerSortField.CHARACTER_NAME);
    get sortField() { return this._sortField.value; }
    set sortField(value: AdManagerSortField) { 
        if (value != this._sortField.value) {
            this._sortField.value = value; 
            this._updateView();
        }
    }

    private readonly _sortDirection: ObservableValue<AdManagerSortDirection> = new ObservableValue(AdManagerSortDirection.ASCENDING);
    get sortDirection() { return this._sortDirection.value; }
    set sortDirection(value: AdManagerSortDirection) { 
        if (value != this._sortDirection.value) {
            this._sortDirection.value = value; 
            this._updateView();
        }
    }

    private readonly _showFilter: ObservableValue<AdManagerShowFilter> = new ObservableValue(AdManagerShowFilter.ALLBUTUNINTERESTED);
    get showFilter() { return this._showFilter.value; }
    set showFilter(value: AdManagerShowFilter) { 
        if (value != this._showFilter.value) {
            this._showFilter.value = value; 
            this._updateView();
        }
    }

    private readonly _searchText: ObservableValue<string> = new ObservableValue("");
    get searchText() { return this._searchText.value; }
    set searchText(value: string) {
        if (value != this._searchText.value) {
            this._searchText.value = value;
            this._updateView();
        }
    }

    resetFilters(): void {
        this._sortDirection.value = AdManagerSortDirection.ASCENDING;
        this._sortField.value = AdManagerSortField.CHARACTER_NAME;
        this._searchText.value = "";
        this._showFilter.value = AdManagerShowFilter.ALLBUTUNINTERESTED;
        this._updateView();
    }

    setSort(field: AdManagerSortField, direction: AdManagerSortDirection): void {
        if (field != this._sortField.value || direction != this._sortDirection.value) {
            this._sortField.value = field;
            this._sortDirection.value = direction;
            this._updateView();
        }
    }

    private readonly _rawActiveAds: Collection<ChannelMessageViewModel> = new Collection();
    private _filteredActiveAds: (ReadOnlyStdObservableCollection<ChannelMessageViewModel> & IDisposable) | null = null;
    private _sortedActiveAds: (ReadOnlyStdObservableCollection<ChannelMessageViewModel> & IDisposable) | null = null;

    private _exposedActiveAds: ObservableValue<ReadOnlyStdObservableCollection<ChannelMessageViewModel>> = new ObservableValue(this._rawActiveAds);
    get activeAds() { return this._exposedActiveAds.value; }

    get adCount(): number { return this._rawActiveAds.length; }

    private _updateView() {
        if (this._isDisposed) { return; }

        const searchText = this._searchText.value.toLowerCase();
        const sortField = this._sortField.value;
        const sortDirection = this._sortDirection.value;

        using cleanupOldFilteredActiveAds = (this._filteredActiveAds ?? EmptyDisposable);
        using cleanupOldSortedActiveAds = (this._sortedActiveAds ?? EmptyDisposable);
        
        this._filteredActiveAds = searchText.trim() != ""
            ? new StdObservableFilteredView(this._rawActiveAds, 
                cmvm => cmvm.text.toLowerCase().indexOf(searchText) != -1 || cmvm.characterStatus.characterName.canonicalValue.indexOf(searchText) != -1)
            : new StdObservableFilteredView(this._rawActiveAds, cmvm => true);

        const sortInverter = sortDirection == AdManagerSortDirection.ASCENDING
            ? (x: number) => x
            : (x: number) => -x;
        switch (sortField) {
            default:
            case AdManagerSortField.CHARACTER_NAME:
                {
                    this._sortedActiveAds = new StdObservableSortedView(this._filteredActiveAds,
                        (cmvm) => cmvm.characterStatus.characterName.canonicalValue,
                        (a, b) => sortInverter(StringComparer.Ordinal.compare(a, b))
                    );
                }
                break;
            case AdManagerSortField.POSTED_AT:
                {
                    this._sortedActiveAds = new StdObservableSortedView(this._filteredActiveAds,
                        (cmvm) => cmvm.timestamp,
                        (a, b) => sortInverter(DateComparer.instance.compare(a, b))
                    );
                }
                break;
        }

        this._exposedActiveAds.value = this._sortedActiveAds;
    }

    handleAdMessage(message: ChannelMessageViewModel) {
        if (message.type != ChannelMessageType.AD) { return; }

        const postingCharacter = message.characterStatus.characterName;
        // Does this poster already have a tracked ad?
        if (this._trackedAdsByPoster.has(postingCharacter)) {
            this._removeTrackedAd(this._trackedAdsByPoster.get(postingCharacter)!);
        }

        const newtai = new TrackedAdInfo(this, message);
        this._trackedAds.add(newtai);
        this._trackedAdsByPoster.set(postingCharacter, newtai);
        const watchDisposable = this.activeLoginViewModel.characterSet.addStatusListener(postingCharacter, (cs) => {
            this.handleCharacterStatusChange(cs);
        });
        this._posterWatchDisposables.set(postingCharacter, watchDisposable);
        this._trackedCharacterLastStatus.set(postingCharacter, message.characterStatus);
        this._rawActiveAds.add(message);
        newtai.expireIn(AD_EXPIRATION_MS);
    }

    handleCharacterStatusChange(characterStatus: CharacterStatus) {
        let shouldRemoveAd = false;
        const lastStatus = this._trackedCharacterLastStatus.get(characterStatus.characterName);
        if (lastStatus) {
            const prevOnlineStatus = lastStatus.status;
            const curOnlineStatus = characterStatus.status;

            // A character's existing ad is considered stale if....

            // The character went offline, busy, or DND
            if (curOnlineStatus == OnlineStatus.OFFLINE
                || curOnlineStatus == OnlineStatus.BUSY
                || curOnlineStatus == OnlineStatus.DND) {
                shouldRemoveAd = true;
            }
            // If the character was looking, but now is *not* looking
            else if (prevOnlineStatus == OnlineStatus.LOOKING &&
                curOnlineStatus != OnlineStatus.LOOKING &&
                curOnlineStatus != OnlineStatus.CROWN) {
                shouldRemoveAd = true;
            }
        }

        if (shouldRemoveAd) {
            const tai = this._trackedAdsByPoster.get(characterStatus.characterName);
            if (tai) {
                this._removeTrackedAd(tai);
            }
        }
    }

    _removeTrackedAd(tai: TrackedAdInfo) {
        const charName = tai.message.characterStatus.characterName;
        this._trackedAds.delete(tai);
        this._trackedAdsByPoster.delete(charName);

        const pwd = this._posterWatchDisposables.get(charName);
        maybeDispose(pwd);
        this._posterWatchDisposables.delete(charName);

        this._trackedCharacterLastStatus.delete(charName);
        this._rawActiveAds.remove(tai.message);
        tai.dispose();
    }
}

class TrackedAdInfo implements IDisposable {
    constructor(
        private readonly owner: ChannelAdManagerViewModel,
        public readonly message: ChannelMessageViewModel) {
    }

    private _isDisposed: boolean = false;
    get isDisposed() { return this._isDisposed; }

    private _expireHandle: IDisposable | null = null;

    [Symbol.dispose](): void { this.dispose(); }
    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;

            maybeDispose(this._expireHandle);
            this.owner._removeTrackedAd(this);
        }
    }
    
    expireIn(ms: number) {
        maybeDispose(this._expireHandle);
        this._expireHandle = null;
        if (!this._isDisposed) {
            this._expireHandle = Scheduler.scheduleCallback(ms, () => {
                this.dispose();
            });
        }
    }
}