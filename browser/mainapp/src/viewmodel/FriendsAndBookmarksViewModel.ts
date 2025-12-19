import { CharacterName } from "../shared/CharacterName";
import { CancellationToken, CancellationTokenSource } from "../util/CancellationTokenSource";
import { IDisposable } from "../util/Disposable";
import { ObservableBase, observableProperty } from "../util/ObservableBase";
import { Scheduler } from "../util/Scheduler";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";

export class LoadingOrValueOrError<T> {
    private static readonly _loading: LoadingOrValueOrError<any> = new LoadingOrValueOrError(true, false, null, false, null);
    static loading() {
        return this._loading;
    } 
    static error(message: string) {
        return new LoadingOrValueOrError(false, true, message, false, null);
    }
    static value<T>(value: T) {
        return new LoadingOrValueOrError(false, false, null, true, value);
    }

    private constructor(
        public readonly isLoading: boolean, 
        public readonly isError: boolean, 
        public readonly error: string | null,
        public readonly isValue: boolean,
        public readonly value: T | null) {
    }
}

export class FriendsAndBookmarksViewModel extends ObservableBase {
    constructor(
        public readonly session: ActiveLoginViewModel) {
        
        super();
    }

    private _isTabActive: boolean = false;
    get isTabActive() { return this._isTabActive; }
    set isTabActive(value: boolean) {
        if (value != this._isTabActive) {
            this._isTabActive = value;
            this.onTabActiveChanged();
        }
    }

    private _needDataReload = true;
    private _currentReloadCTS: CancellationTokenSource | null = null;
    private _markNeedReloadTimer: IDisposable | null = null;

    private onTabActiveChanged() {
        this._markNeedReloadTimer?.dispose();
        this._markNeedReloadTimer = null;

        if (this.isTabActive && this._needDataReload && this._currentReloadCTS == null) {
            const cts = new CancellationTokenSource();
            this._currentReloadCTS = cts;
            this._loadDataAsync(cts.token);
        }
        else if (!this.isTabActive) {
            this._markNeedReloadTimer = Scheduler.scheduleNamedCallback("friendsAndBookmarksViewModel.clear", 30000, () => {
                this._needDataReload = true;
                this._currentReloadCTS?.cancel();
                this._currentReloadCTS = null;
                this.bookmarks = LoadingOrValueOrError.loading();
                this.friends = LoadingOrValueOrError.loading();
                this.incomingRequests = LoadingOrValueOrError.loading();
                this.outgoingRequests = LoadingOrValueOrError.loading();
            });
        }
    }

    private async _loadDataAsync(cancellationToken: CancellationToken) {
        this.friends = LoadingOrValueOrError.loading();
        this.bookmarks = LoadingOrValueOrError.loading();
        this.incomingRequests = LoadingOrValueOrError.loading();
        this.outgoingRequests = LoadingOrValueOrError.loading();

        const fl = await this.session.authenticatedApi.getFriendsListAsync(cancellationToken);

        // TODO: update friends/bookmarks on the session with this latest data

        const currentFriends = new Map<CharacterName, CharacterName[]>();
        for (let tf of fl.friendlist) {
            const myChar = CharacterName.create(tf.source);
            const interlocutorChar = CharacterName.create(tf.dest);
            const farray = currentFriends.get(myChar) ?? [];
            farray.push(interlocutorChar);
            currentFriends.set(myChar, farray);
        }
        for (let farray of currentFriends.values()) {
            farray.sort(CharacterName.compare);
        }

        const incomingRequests = new Map<CharacterName, CharacterName[]>();
        for (let tf of fl.requestlist) {
            const myChar = CharacterName.create(tf.dest);
            const interlocutorChar = CharacterName.create(tf.source);
            const farray = incomingRequests.get(myChar) ?? [];
            farray.push(interlocutorChar);
            incomingRequests.set(myChar, farray);
        }
        for (let farray of incomingRequests.values()) {
            farray.sort(CharacterName.compare);
        }

        const outgoingRequests = new Map<CharacterName, CharacterName[]>();
        for (let tf of fl.requestpending) {
            const myChar = CharacterName.create(tf.source);
            const interlocutorChar = CharacterName.create(tf.dest);
            const farray = outgoingRequests.get(myChar) ?? [];
            farray.push(interlocutorChar);
            outgoingRequests.set(myChar, farray);
        }
        for (let farray of outgoingRequests.values()) {
            farray.sort(CharacterName.compare);
        }

        this.bookmarks = LoadingOrValueOrError.value(fl.bookmarklist.map(x => CharacterName.create(x)).sort(CharacterName.compare));
        this.friends = LoadingOrValueOrError.value(currentFriends);
        this.incomingRequests = LoadingOrValueOrError.value(incomingRequests);
        this.outgoingRequests = LoadingOrValueOrError.value(outgoingRequests);
    }

    @observableProperty
    bookmarks: LoadingOrValueOrError<CharacterName[]> = LoadingOrValueOrError.loading();

    @observableProperty
    selectedBookmark: CharacterName | null = null;

    @observableProperty
    friends: LoadingOrValueOrError<Map<CharacterName, CharacterName[]>> = LoadingOrValueOrError.loading();

    @observableProperty
    selectedFriend: { myCharacterName: CharacterName, interlocutorCharacterName: CharacterName } | null = null;

    @observableProperty
    incomingRequests: LoadingOrValueOrError<Map<CharacterName, CharacterName[]>> = LoadingOrValueOrError.loading();

    @observableProperty
    selectedIncomingRequest: { myCharacterName: CharacterName, interlocutorCharacterName: CharacterName } | null = null;

    @observableProperty
    outgoingRequests: LoadingOrValueOrError<Map<CharacterName, CharacterName[]>> = LoadingOrValueOrError.loading();

    @observableProperty
    selectedOutgoingRequest: { myCharacterName: CharacterName, interlocutorCharacterName: CharacterName } | null = null;
}