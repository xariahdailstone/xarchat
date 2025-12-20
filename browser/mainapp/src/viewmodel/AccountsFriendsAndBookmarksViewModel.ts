import { FListAuthenticatedApi, FriendsList } from "../fchat/api/FListApi";
import { CharacterName } from "../shared/CharacterName";
import { CharacterSet } from "../shared/CharacterSet";
import { OnlineStatus } from "../shared/OnlineStatus";
import { CancellationToken } from "../util/CancellationTokenSource";
import { StdObservableCollectionChangeType } from "../util/collections/ReadOnlyStdObservableCollection";
import { asDisposable, ConvertibleToDisposable, IDisposable } from "../util/Disposable";
import { ObservableValue } from "../util/Observable";
import { ObservableBase, observableProperty } from "../util/ObservableBase";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";
import { AppViewModel } from "./AppViewModel";
import { CharacterNameSet, CharacterNameSetImpl } from "./CharacterNameSet";
import { LoadingOrValueOrError } from "./LoadingOrValueOrError";

interface RefData {
    readonly accountName: string;
    readonly weakRef: WeakRef<SpecificAccountFriendsAndBookmarksViewModel>
}

export class AccountsFriendsAndBookmarksViewModel extends ObservableBase {
    constructor(
        public readonly appViewModel: AppViewModel) {

        super();

        this._freg = new FinalizationRegistry<RefData>(
            heldValue => {
                const wref = this._accsByAccountName.get(heldValue.accountName);
                if (wref == heldValue.weakRef) {
                    this._accsByAccountName.delete(heldValue.accountName);
                }
            }
        );
    }

    private readonly _freg: FinalizationRegistry<RefData>;
    private readonly _accsByAccountName: Map<string, WeakRef<SpecificAccountFriendsAndBookmarksViewModel>> = new Map();

    getOrCreate(accountName: string) {
        const wref = this._accsByAccountName.get(accountName);
        let v = wref?.deref();
        if (!v) {
            v = new SpecificAccountFriendsAndBookmarksViewModel(this, accountName);
            this._freg.register(v, { accountName: accountName, weakRef: v.weakRef });
            this._accsByAccountName.set(accountName, v.weakRef);
        }
        return v;
    }
}

export class SpecificAccountFriendsAndBookmarksViewModel extends ObservableBase {
    constructor(
        private readonly owner: AccountsFriendsAndBookmarksViewModel,
        public readonly accountName: string) {

        super();
        this.weakRef = new WeakRef<SpecificAccountFriendsAndBookmarksViewModel>(this);
    }

    readonly weakRef: WeakRef<SpecificAccountFriendsAndBookmarksViewModel>;

    readonly serverOps: CharacterNameSet = new CharacterNameSetImpl();

    readonly friends: CharacterNameSet = new CharacterNameSetImpl();
    readonly bookmarks: CharacterNameSet = new CharacterNameSetImpl();
    readonly interests: CharacterNameSet = new CharacterNameSetImpl();
    readonly ignored: CharacterNameSet = new CharacterNameSetImpl();

    // combination of friends + bookmarks + interests
    readonly watchedChars: CharacterNameSet = new CharacterNameSetImpl();

    private readonly _friendsList: ObservableValue<LoadingOrValueOrError<FriendsList> | null> = new ObservableValue(null);
    
    get friendsList(): LoadingOrValueOrError<FriendsList> | null { return this._friendsList.value; }
    set friendsList(value: LoadingOrValueOrError<FriendsList> | null) {
        if (value != this._friendsList.value) {
            this._friendsList.value = value;
        }
    }

    async reloadFriendsList(authApi: FListAuthenticatedApi) {
        if (!(this.friendsList?.isLoading ?? false)) {
            this.friendsList = LoadingOrValueOrError.loading();
            try {
                const fl = await authApi.getFriendsListAsync(CancellationToken.NONE);
                this.friendsList = LoadingOrValueOrError.value(fl);
            }
            catch (e) {
                this.friendsList = LoadingOrValueOrError.error("Failed to load friends list.");
            }
        }
    }

    createForSession(session: ActiveLoginViewModel): SessionFriendsAndBookmarksViewModel {
        return new SessionFriendsAndBookmarksViewModel(this, session);
    }
}

export class SessionFriendsAndBookmarksViewModel extends ObservableBase implements IDisposable {
    constructor(
        private readonly source: SpecificAccountFriendsAndBookmarksViewModel,
        private readonly session: ActiveLoginViewModel) {

        super();

        this.serverOps = source.serverOps;
        this.friends = source.friends;
        this.bookmarks = source.bookmarks;
        this.interests = source.interests;
        this.watchedChars = source.watchedChars;
        this.ignored = source.ignored;

        const subset = session.characterSet.createAllSubset();
        this.onDispose(subset.addStatusUpdateListener(cs => {
            if (cs.status == OnlineStatus.OFFLINE) {
                this._handleCharacterOffline(cs.characterName);
            }
            else if (cs.status == OnlineStatus.LOOKING) {
                this._handleCharacterLooking(cs.characterName);
            }
            else {
                this._handleCharacterOnline(cs.characterName);
            }
        }));
        this.onDispose(subset);
    }

    private _onDisposes: ConvertibleToDisposable[] = [];
    onDispose(d: ConvertibleToDisposable) {
        this._onDisposes.push(d);
    }

    private _isDisposed: boolean = false;
    get isDisposed(): boolean { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            asDisposable(...this._onDisposes).dispose();
        }
    }
    [Symbol.dispose](): void { this.dispose(); }

    readonly serverOps: CharacterNameSet;

    readonly friends: CharacterNameSet;
    readonly bookmarks: CharacterNameSet;
    readonly interests: CharacterNameSet;
    readonly watchedChars: CharacterNameSet;
    readonly ignored: CharacterNameSet;

    readonly onlineFriends: CharacterNameSet = new CharacterNameSetImpl();
    readonly onlineBookmarks: CharacterNameSet = new CharacterNameSetImpl();
    readonly onlineInterests: CharacterNameSet = new CharacterNameSetImpl();
    readonly onlineWatchedChars: CharacterNameSet = new CharacterNameSetImpl();

    readonly lookingFriends: CharacterNameSet = new CharacterNameSetImpl();
    readonly lookingBookmarks: CharacterNameSet = new CharacterNameSetImpl();
    readonly lookingInterests: CharacterNameSet = new CharacterNameSetImpl();
    readonly lookingWatchedChars: CharacterNameSet = new CharacterNameSetImpl();

    get friendsList() {
        if (this.source.friendsList == null) {
            this.source.reloadFriendsList(this.session.authenticatedApi);
        }
        return this.source.friendsList!;
    }
    forceGetFriendsList() {
        if (this.source.friendsList == null || !this.source.friendsList.isLoading) {
            this.source.reloadFriendsList(this.session.authenticatedApi);
        }
        return this.source.friendsList!;
    }
    expireFriendsList() {
        this.source.friendsList = null;
    }

    private _handleCharacterOnline(char: CharacterName) {
        if (this.friends.has(char)) {
            this.onlineFriends.add(char);
            this.onlineWatchedChars.add(char);
        }
        if (this.bookmarks.has(char)) {
            this.onlineBookmarks.add(char);
            this.onlineWatchedChars.add(char);
        }
        if (this.interests.has(char)) {
            this.onlineInterests.add(char);
            this.onlineWatchedChars.add(char);
        }

        this.lookingFriends.delete(char);
        this.lookingBookmarks.delete(char);
        this.lookingInterests.delete(char);
        this.lookingWatchedChars.delete(char);
    }

    private _handleCharacterLooking(char: CharacterName) {
        if (this.friends.has(char)) {
            this.onlineFriends.add(char);
            this.onlineWatchedChars.add(char);
            
            this.lookingFriends.add(char);
            this.lookingWatchedChars.add(char);
        }
        if (this.bookmarks.has(char)) {
            this.onlineBookmarks.add(char);
            this.onlineWatchedChars.add(char);

            this.lookingBookmarks.add(char);
            this.lookingWatchedChars.add(char);
        }
        if (this.interests.has(char)) {
            this.onlineInterests.add(char);
            this.onlineWatchedChars.add(char);

            this.lookingInterests.add(char);
            this.lookingWatchedChars.add(char);
        }
    }

    private _handleCharacterOffline(char: CharacterName) {
        this.onlineFriends.delete(char);
        this.onlineBookmarks.delete(char);
        this.onlineInterests.delete(char);
        this.onlineWatchedChars.delete(char);

        this.lookingFriends.delete(char);
        this.lookingBookmarks.delete(char);
        this.lookingInterests.delete(char);
        this.lookingWatchedChars.delete(char);
    }
}