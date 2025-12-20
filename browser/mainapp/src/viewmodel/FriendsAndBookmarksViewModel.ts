import { CharacterName } from "../shared/CharacterName";
import { CancellationToken, CancellationTokenSource } from "../util/CancellationTokenSource";
import { IDisposable } from "../util/Disposable";
import { ObservableBase, observableProperty } from "../util/ObservableBase";
import { Scheduler } from "../util/Scheduler";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";
import { LoadingOrValueOrError } from "./LoadingOrValueOrError";

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

    get incomingRequests(): LoadingOrValueOrError<Map<CharacterName, CharacterName[]>> {
        if (this.session.friendsList.isError) {
            return LoadingOrValueOrError.error(this.session.friendsList.error!);
        }
        else if (this.session.friendsList.isLoading) {
            return LoadingOrValueOrError.loading();
        }
        else {
            const v = this.session.friendsList.value!;
            const res = new Map<CharacterName, CharacterName[]>();
            for (let tf of v.requestlist) {
                const myChar = CharacterName.create(tf.dest);
                const interlocutorChar = CharacterName.create(tf.source);
                const farray = res.get(myChar) ?? [];
                farray.push(interlocutorChar);
                res.set(myChar, farray);
            }
            for (let farray of res.values()) {
                farray.sort(CharacterName.compare);
            }
            return LoadingOrValueOrError.value(res);
        } 
    }

    @observableProperty
    selectedIncomingRequest: { myCharacterName: CharacterName, interlocutorCharacterName: CharacterName } | null = null;

    get outgoingRequests(): LoadingOrValueOrError<Map<CharacterName, CharacterName[]>> {
        if (this.session.friendsList.isError) {
            return LoadingOrValueOrError.error(this.session.friendsList.error!);
        }
        else if (this.session.friendsList.isLoading) {
            return LoadingOrValueOrError.loading();
        }
        else {
            const v = this.session.friendsList.value!;
            const res = new Map<CharacterName, CharacterName[]>();
            for (let tf of v.requestpending) {
                const myChar = CharacterName.create(tf.source);
                const interlocutorChar = CharacterName.create(tf.dest);
                const farray = res.get(myChar) ?? [];
                farray.push(interlocutorChar);
                res.set(myChar, farray);
            }
            for (let farray of res.values()) {
                farray.sort(CharacterName.compare);
            }
            return LoadingOrValueOrError.value(res);
        } 
    }

    @observableProperty
    selectedOutgoingRequest: { myCharacterName: CharacterName, interlocutorCharacterName: CharacterName } | null = null;
}