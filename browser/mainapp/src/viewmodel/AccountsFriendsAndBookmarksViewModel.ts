import { FListAuthenticatedApi, FriendsList } from "../fchat/api/FListApi";
import { CharacterName } from "../shared/CharacterName";
import { CharacterSet, CharacterStatus } from "../shared/CharacterSet";
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

        this._setupWatchedChars();
    }

    readonly weakRef: WeakRef<SpecificAccountFriendsAndBookmarksViewModel>;

    readonly serverOps: CharacterNameSet = new CharacterNameSetImpl();

    readonly friends: CharacterNameSet = new CharacterNameSetImpl();
    readonly bookmarks: CharacterNameSet = new CharacterNameSetImpl();
    readonly interests: CharacterNameSet = new CharacterNameSetImpl();
    readonly ignored: CharacterNameSet = new CharacterNameSetImpl();

    // combination of friends + bookmarks + interests
    readonly watchedChars: CharacterNameSet = new CharacterNameSetImpl();

    private _setupWatchedChars() {
        const setupSetMonitor = (set: CharacterNameSet) => {
            set.addCollectionObserver((entries) => {
                for (let entry of entries) {
                    switch (entry.changeType) {
                        case StdObservableCollectionChangeType.ITEM_ADDED:
                            this._handleWatchAdd(entry.item.value);
                            break;
                        case StdObservableCollectionChangeType.ITEM_REMOVED:
                            this._handleWatchRemove(entry.item.value);
                            break;
                        case StdObservableCollectionChangeType.CLEARED:
                            break;
                    }
                }
            });
        }

        setupSetMonitor(this.friends);
        setupSetMonitor(this.bookmarks);
        setupSetMonitor(this.interests);
    }

    private _handleWatchAdd(char: CharacterName) {
        if (!this.watchedChars.has(char)) {
            this.watchedChars.add(char);
        }
    }

    private _handleWatchRemove(char: CharacterName) {
        const actuallyHas = this.friends.has(char)
            || this.bookmarks.has(char)
            || this.interests.has(char);

        if (!actuallyHas && this.watchedChars.has(char)) {
            this.watchedChars.delete(char);
        }
    }

    private readonly _friendsList: ObservableValue<LoadingOrValueOrError<FriendsList> | null> = new ObservableValue(null);
    
    get friendsList(): LoadingOrValueOrError<FriendsList> | null { return this._friendsList.value; }
    set friendsList(value: LoadingOrValueOrError<FriendsList> | null) {
        if (value != this._friendsList.value) {
            this._friendsList.value = value;
            if (value?.isValue) {
                this._processNewFriendsList(value!.value!)
            }
        }
    }

    private _processNewFriendsList(fl: FriendsList) {
        const curFriendsSet = new Set<CharacterName>();
        for (let flentry of fl.friendlist) {
            const char = CharacterName.create(flentry.dest);
            this.friends.add(char);
            this.watchedChars.add(char);
            curFriendsSet.add(char);
        }
        for (let char of this.friends.values()) {
            if (!curFriendsSet.has(char)) {
                this.friends.delete(char);
            }
        }

        const curBookmarksSet = new Set<CharacterName>();
        for (let blentry of fl.bookmarklist) {
            const char = CharacterName.create(blentry);
            this.bookmarks.add(char);
            this.watchedChars.add(char);
            curBookmarksSet.add(char);
        }
        for (let char of this.bookmarks.values()) {
            if (!curBookmarksSet.has(char)) {
                this.bookmarks.delete(char);
            }
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

        this._setupSetHandlers();
        this._setupStatusChangeHandler();
    }

    private _onDisposes: ConvertibleToDisposable[] = [];
    onDispose(d: ConvertibleToDisposable) {
        this._onDisposes.push(d);
    }

    private _doCategorizeCharStatus(cs: CharacterStatus, cns: CharacterNameSet, onlineCns: CharacterNameSet, lookingCns: CharacterNameSet) {
        const char = cs.characterName;
        if (cns.has(char)) {
            switch (cs.status) {
                case OnlineStatus.ONLINE:
                case OnlineStatus.AWAY:
                case OnlineStatus.BUSY:
                case OnlineStatus.CROWN:
                case OnlineStatus.DND:
                case OnlineStatus.IDLE:
                    onlineCns.add(char);
                    lookingCns.delete(char);
                    break;

                case OnlineStatus.LOOKING:
                    onlineCns.add(char);
                    lookingCns.add(char);
                    break;

                case OnlineStatus.OFFLINE:
                    onlineCns.delete(char);
                    lookingCns.delete(char);                        
                    break;
            }            
        }
        else {
            onlineCns.delete(char);
            lookingCns.delete(char);
        }
    }

    private _setupSetHandlers() {
        const doSetHandler = (cns: CharacterNameSet, onlineCns: CharacterNameSet, lookingCns: CharacterNameSet) => {
            const handleAdd = (char: CharacterName) => {
                const cs = this.session.characterSet.rawGetCharacterStatus(char);
                this._doCategorizeCharStatus(cs, cns, onlineCns, lookingCns);
            };

            const handleRemove = (char: CharacterName) => {
                onlineCns.delete(char);
                lookingCns.delete(char);
            };

            const slistener = cns.addCollectionObserver((entries) => {
                for (let entry of entries) {
                    switch (entry.changeType) {
                        case StdObservableCollectionChangeType.ITEM_ADDED:
                            handleAdd(entry.item.value);
                            break;
                        case StdObservableCollectionChangeType.ITEM_REMOVED:
                            handleRemove(entry.item.value);
                            break;
                        case StdObservableCollectionChangeType.CLEARED:
                            break;
                    }
                }
            });

            return slistener;
        };

        this.onDispose(doSetHandler(this.friends, this.onlineFriends, this.lookingFriends));
        this.onDispose(doSetHandler(this.bookmarks, this.onlineBookmarks, this.lookingBookmarks));
        this.onDispose(doSetHandler(this.interests, this.onlineInterests, this.lookingInterests));
        this.onDispose(doSetHandler(this.watchedChars, this.onlineWatchedChars, this.lookingWatchedChars));
    }

    private _setupStatusChangeHandler() {
        const subset = this.session.characterSet.createAllSubset();
        this.onDispose(subset.addStatusUpdateListener(cs => {
            this._doCategorizeCharStatus(cs, this.friends, this.onlineFriends, this.lookingFriends);
            this._doCategorizeCharStatus(cs, this.bookmarks, this.onlineBookmarks, this.lookingBookmarks);
            this._doCategorizeCharStatus(cs, this.interests, this.onlineInterests, this.lookingInterests);
            this._doCategorizeCharStatus(cs, this.watchedChars, this.onlineWatchedChars, this.lookingWatchedChars);
        }));
        this.onDispose(subset);
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

    setIgnoreList(chars: CharacterName[]) {
        const curIgnoreChars = new Set(chars);
        for (let char of chars) {
            this.ignored.add(char);
        }
        for (let ichar of this.ignored.values()) {
            if (!curIgnoreChars.has(ichar)) {
                this.ignored.delete(ichar);
            }
        }
    }
    addIgnore(char: CharacterName) {
        this.ignored.add(char);
    }
    removeIgnore(char: CharacterName) {
        this.ignored.delete(char);
    }
}