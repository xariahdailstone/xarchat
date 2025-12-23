import { CharacterName } from "../shared/CharacterName";
import { CancellationToken, CancellationTokenSource } from "../util/CancellationTokenSource";
import { IDisposable } from "../util/Disposable";
import { KeyCodes } from "../util/KeyCodes";
import { ObservableBase, observableProperty } from "../util/ObservableBase";
import { Scheduler } from "../util/Scheduler";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";
import { DialogButtonStyle } from "./dialogs/DialogViewModel";
import { LoadingOrValueOrError } from "./LoadingOrValueOrError";

export type FriendRequestEntry = { id: number, myCharacterName: CharacterName, interlocutorCharacterName: CharacterName };

export type FriendRequestSet = Map<CharacterName, FriendRequestEntry[]>;

export class FriendsAndBookmarksViewModel extends ObservableBase {
    constructor(
        public readonly session: ActiveLoginViewModel) {
        
        super();
    }

    isTabActive: boolean = false;

    get bookmarks(): LoadingOrValueOrError<CharacterName[]> {
        if (this.session.friendsList.isError) {
            return LoadingOrValueOrError.error(this.session.friendsList.error!);
        }
        else if (this.session.friendsList.isLoading) {
            return LoadingOrValueOrError.loading();
        }
        else {
            const v = this.session.friendsList.value!;
            return LoadingOrValueOrError.value(v.bookmarklist.map(CharacterName.create));
        }
    }

    @observableProperty
    selectedBookmark: CharacterName | null = null;

    isValidSelectedBookmark() {
        if (!this.bookmarks.isValue) { return false; }
        if (this.selectedBookmark == null) { return false; }
        const bl = this.bookmarks.value!;
        return (bl.indexOf(this.selectedBookmark) != -1);
    }

    @observableProperty
    removingBookmark: boolean = false;

    async removeSelectedBookmark() {
        if (this.isValidSelectedBookmark()) {
            this.removingBookmark = true;
            try {
                try {
                    await this.session.authenticatedApi.removeBookmarkAsync(this.selectedBookmark!, CancellationToken.NONE);
                }
                finally {
                    this.removingBookmark = false;
                }
            }
            catch (e) {
                await this.session.appViewModel.alertAsync(
                    "An unexpected error occurred while removing the bookmark.",
                    "Bookmark Remove Failed"
                );
            }
        }
    }

    get friends(): LoadingOrValueOrError<Map<CharacterName, CharacterName[]>> {
        if (this.session.friendsList.isError) {
            return LoadingOrValueOrError.error(this.session.friendsList.error!);
        }
        else if (this.session.friendsList.isLoading) {
            return LoadingOrValueOrError.loading();
        }
        else {
            const v = this.session.friendsList.value!;
            const res = new Map<CharacterName, CharacterName[]>();
            for (let tpair of v.friendlist) {
                const myCharName = CharacterName.create(tpair.source);
                const interlocutorCharName = CharacterName.create(tpair.dest);
                const arr = (res.get(myCharName) ?? []);
                arr.push(interlocutorCharName);
                res.set(myCharName, arr);
            }
            return LoadingOrValueOrError.value(res);
        }        
    }

    @observableProperty
    selectedFriend: { myCharacterName: CharacterName, interlocutorCharacterName: CharacterName } | null = null;

    isValidSelectedFriend(): boolean {
        if (!this.friends.isValue) { return false; }
        if (this.selectedFriend == null) { return false; }
        const fv = this.friends.value!;
        const l = fv.get(this.selectedFriend.myCharacterName) ?? [];
        return l.indexOf(this.selectedFriend.interlocutorCharacterName) != -1;
    }

    @observableProperty
    removingFriend: boolean = false;

    async removeSelectedFriend() {
        if (this.isValidSelectedFriend()) {
            const myCharName = this.selectedFriend!.myCharacterName;
            const theirCharName = this.selectedFriend!.interlocutorCharacterName;
            const confirmResult = await this.session.appViewModel.promptAsync<boolean>({
                title: "Remove Friend",
                message: `Are you sure you want to end your friendship between <b>${myCharName.value}</b> and <b>${theirCharName.value}</b>?`,
                messageAsHtml: true,
                closeBoxResult: false,
                buttons: [
                    {
                        title: "Yes, Remove Friend",
                        resultValue: true,
                        style: DialogButtonStyle.NORMAL,
                        shortcutKeyCode: KeyCodes.KEY_Y
                    },
                    {
                        title: "No, Cancel",
                        resultValue: false,
                        style: DialogButtonStyle.CANCEL,
                        shortcutKeyCode: KeyCodes.KEY_N
                    }
                ]
            });
            if (!confirmResult) { return; }

            try {
                this.removingFriend = true;
                try {
                    await this.session.authenticatedApi.removeFriendAsync(myCharName, theirCharName, CancellationToken.NONE);
                }
                finally {
                    this.removingFriend = false;
                }
            }
            catch (e) {
                await this.session.appViewModel.alertAsync(
                    "An unexpected error occurred while removing the friendship.",
                    "Friend Remove Failed"
                );
            }
        }
    }

    get incomingRequests(): LoadingOrValueOrError<FriendRequestSet> {
        if (this.session.friendsList.isError) {
            return LoadingOrValueOrError.error(this.session.friendsList.error!);
        }
        else if (this.session.friendsList.isLoading) {
            return LoadingOrValueOrError.loading();
        }
        else {
            const v = this.session.friendsList.value!;
            const res = new Map<CharacterName, FriendRequestEntry[]>();
            for (let tf of v.requestlist) {
                const myChar = CharacterName.create(tf.dest);
                const interlocutorChar = CharacterName.create(tf.source);
                const farray = res.get(myChar) ?? [];
                farray.push({ id: tf.id, myCharacterName: myChar, interlocutorCharacterName: interlocutorChar });
                res.set(myChar, farray);
            }
            for (let farray of res.values()) {
                farray.sort((a, b) => CharacterName.compare(a.interlocutorCharacterName, b.interlocutorCharacterName));
            }
            return LoadingOrValueOrError.value(res);
        } 
    }

    async acceptIncomingRequest(entry: FriendRequestEntry) {
        await this.session.authenticatedApi.acceptIncomingFriendRequestAsync(entry.id, CancellationToken.NONE);
        await this.session.sessionFriendsAndBookmarks.forceGetFriendsList();
    }

    async rejectIncomingRequest(entry: FriendRequestEntry) {
        await this.session.authenticatedApi.rejectIncomingFriendRequestAsync(entry.id, CancellationToken.NONE);
        await this.session.sessionFriendsAndBookmarks.forceGetFriendsList();
    }

    get outgoingRequests(): LoadingOrValueOrError<FriendRequestSet> {
        if (this.session.friendsList.isError) {
            return LoadingOrValueOrError.error(this.session.friendsList.error!);
        }
        else if (this.session.friendsList.isLoading) {
            return LoadingOrValueOrError.loading();
        }
        else {
            const v = this.session.friendsList.value!;
            const res = new Map<CharacterName, FriendRequestEntry[]>();
            for (let tf of v.requestpending) {
                const myChar = CharacterName.create(tf.source);
                const interlocutorChar = CharacterName.create(tf.dest);
                const farray = res.get(myChar) ?? [];
                farray.push({ id: tf.id, myCharacterName: myChar, interlocutorCharacterName: interlocutorChar });
                res.set(myChar, farray);
            }
            for (let farray of res.values()) {
                farray.sort((a, b) => CharacterName.compare(a.interlocutorCharacterName, b.interlocutorCharacterName));
            }
            return LoadingOrValueOrError.value(res);
        } 
    }
}