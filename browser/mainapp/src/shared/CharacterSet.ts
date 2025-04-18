import { NamedCallbackSet } from "../util/CallbackSet.js";
import { SnapshottableMap } from "../util/collections/SnapshottableMap.js";
import { SnapshottableSet } from "../util/collections/SnapshottableSet.js";
import { asDisposable, IDisposable } from "../util/Disposable.js";
import { Observable, ObservableValue } from "../util/Observable.js";
import { observableProperty } from "../util/ObservableBase.js";
import { DictionaryChangeType } from "../util/ObservableKeyedLinkedList.js";
import { CharacterNameSet } from "../viewmodel/CharacterNameSet.js";
import { CharacterGender } from "./CharacterGender.js";
import { CharacterName } from "./CharacterName.js";
import { OnlineStatus } from "./OnlineStatus.js";
import { TypingStatus } from "./TypingStatus.js";

export class CharacterSet {

    static emptyStatus(
        name: CharacterName, 
        ignoreSet?: CharacterNameSet,
        friendsSet?: CharacterNameSet,
        bookmarkSet?: CharacterNameSet,
        interestsSet?: CharacterNameSet,
        lingeringGender?: (LingeringCharacterGender | null)) {

        return new CharacterStatusImpl(
            name, 
            OnlineStatus.OFFLINE,
            lingeringGender != null ? lingeringGender.wentOfflineAt : null,
            "", 
            null,
            TypingStatus.NONE, 
            lingeringGender != null ? lingeringGender.gender : CharacterGender.NONE, 
            ignoreSet ? ignoreSet.has(name) : false,
            friendsSet ? friendsSet.has(name) : false,
            bookmarkSet ? bookmarkSet.has(name) : false,
            interestsSet ? interestsSet.has(name) : false);
    }

    constructor(ignoreSet: CharacterNameSet, friendSet: CharacterNameSet, bookmarkSet: CharacterNameSet, interestsSet: CharacterNameSet) {
        this._ignoreSet = ignoreSet;
        this._friendSet = friendSet;
        this._bookmarkSet = bookmarkSet;
        this._interestsSet = interestsSet;

        ignoreSet.addEventListener("dictionarychange", (dce) => {
            switch (dce.type) {
                case DictionaryChangeType.ITEM_ADDED:
                    this.setCharacterStatus(dce.item, { ignored: true });
                    break;
                case DictionaryChangeType.ITEM_REMOVED:
                    this.setCharacterStatus(dce.item, { ignored: false });
                    break;
            }
        });
        friendSet.addEventListener("dictionarychange", (dce) => {
            switch (dce.type) {
                case DictionaryChangeType.ITEM_ADDED:
                    this.setCharacterStatus(dce.item, { isFriend: true });
                    break;
                case DictionaryChangeType.ITEM_REMOVED:
                    this.setCharacterStatus(dce.item, { isFriend: false });
                    break;
            }
        });
        bookmarkSet.addEventListener("dictionarychange", (dce) => {
            switch (dce.type) {
                case DictionaryChangeType.ITEM_ADDED:
                    this.setCharacterStatus(dce.item, { isBookmark: true });
                    break;
                case DictionaryChangeType.ITEM_REMOVED:
                    this.setCharacterStatus(dce.item, { isBookmark: false });
                    break;
            }
        });
        interestsSet.addEventListener("dictionarychange", (dce) => {
            switch (dce.type) {
                case DictionaryChangeType.ITEM_ADDED:
                    this.setCharacterStatus(dce.item, { isInterest: true });
                    break;
                case DictionaryChangeType.ITEM_REMOVED:
                    this.setCharacterStatus(dce.item, { isInterest: false });
                    break;
            }
        });
    }

    private readonly _ignoreSet: CharacterNameSet;
    private readonly _friendSet: CharacterNameSet;
    private readonly _bookmarkSet: CharacterNameSet;
    private readonly _interestsSet: CharacterNameSet;

    private readonly _statuses: SnapshottableMap<CharacterName, CharacterStatusImpl> = new SnapshottableMap();
    private readonly _statusListeners2: NamedCallbackSet<CharacterName, CharacterStatusChangeHandler> = new NamedCallbackSet("CharacterSet");

    private readonly _lingeringGenders: LingeringGenderSet = new LingeringGenderSet();

    private readonly _size: ObservableValue<number> = new ObservableValue<number>(0);
    get size(): number { return this._size.value; }

    setCharacterStatus(characterName: CharacterName, status: Partial<CharacterStatus>, asOf?: StatusLastChangeInfo): CharacterStatus {
        const existingStatus = this.getCharacterStatus(characterName);

        if (asOf === undefined) { 
            asOf = new Date();
        }

        const newStatus = new CharacterStatusImpl(
            characterName,
            (status.status != null) ? status.status : existingStatus.status,
            (status.status != null && status.status != existingStatus.status && asOf != null) ? (asOf ?? null) : existingStatus.statusLastChanged,
            (status.statusMessage != null) ? status.statusMessage : existingStatus.statusMessage,
            (status.statusMessage != null && status.statusMessage != existingStatus.statusMessage && asOf != null) ? (asOf ?? null) : existingStatus.statusMessageLastChanged,
            (status.typingStatus != null) ? status.typingStatus : existingStatus.typingStatus,
            (status.gender != null) ? status.gender : existingStatus.gender,
            (status.ignored != null) ? status.ignored : existingStatus.ignored,
            (status.isFriend != null) ? status.isFriend : existingStatus.isFriend,
            (status.isBookmark != null) ? status.isBookmark : existingStatus.isBookmark,
            (status.isInterest != null) ? status.isInterest : existingStatus.isInterest
        );

        const statusUpdated =
            newStatus.status != existingStatus.status ||
            newStatus.statusMessage != existingStatus.statusMessage ||
            newStatus.typingStatus != existingStatus.typingStatus ||
            newStatus.gender != existingStatus.gender ||
            newStatus.ignored != existingStatus.ignored;

        if (newStatus.status != OnlineStatus.OFFLINE) {
            this._statuses.set(characterName, newStatus);
        }
        else {
            this._lingeringGenders.set(characterName, existingStatus.gender);
            this._statuses.delete(characterName);
        }
        if (statusUpdated) {
            Observable.publishNamedUpdate(`cs-${characterName.canonicalValue}`, newStatus);
            this.characterStatusUpdated(newStatus, existingStatus);
        }
        this._size.value = this._statuses.size;
        return newStatus;
    }

    getCharacterStatus(characterName: CharacterName): CharacterStatusWithLastChangedInfo {
        const result = this._statuses.get(characterName);
        if (result) {
            Observable.publishNamedRead(`cs-${characterName.canonicalValue}`, result);
            return result;
        }
        else {
            const lingeringGender = this._lingeringGenders.tryGet(characterName);
            const fresult = CharacterSet.emptyStatus(characterName, this._ignoreSet, this._friendSet, this._bookmarkSet, this._interestsSet, lingeringGender);
            Observable.publishNamedRead(`cs-${characterName.canonicalValue}`, fresult);
            return fresult;
        }
    }

    clear() {
        this._statuses.forEachKeySnapshotted(charName => {
            this.setCharacterStatus(charName, { characterName: charName, status: OnlineStatus.OFFLINE });
        });
    }

    addStatusListener(characterName: CharacterName, handler: CharacterStatusChangeHandler): IDisposable {
        return this.addStatusListenerDebug("unknown", characterName, handler);
    }

    addStatusListenerDebug(reason: any, characterName: CharacterName, handler: CharacterStatusChangeHandler): IDisposable {
        return this._statusListeners2.add(characterName, handler);
    }

    private characterStatusUpdated(newStatus: CharacterStatusWithLastChangedInfo, previousStatus: CharacterStatus) {
        const characterName = newStatus.characterName;
        this._statusListeners2.invoke(characterName, newStatus, previousStatus);
    }
}

interface LingeringCharacterGender {
    readonly characterName: CharacterName;
    readonly gender: CharacterGender;
    readonly wentOfflineAt: Date;
    readonly expiresAt: number;
}

export interface CharacterStatus {
    readonly characterName: CharacterName;
    readonly status: OnlineStatus;
    readonly statusMessage: string;
    readonly typingStatus: TypingStatus;
    readonly gender: CharacterGender;

    readonly ignored: boolean;
    readonly isFriend: boolean;
    readonly isBookmark: boolean;
    readonly isInterest: boolean;

    equals(cs: CharacterStatus | null): boolean;
}

export type StatusLastChangeInfo = null | Date | "login";

export interface CharacterStatusWithLastChangedInfo extends CharacterStatus {
    readonly statusLastChanged: StatusLastChangeInfo;
    readonly statusMessageLastChanged: StatusLastChangeInfo;
}

class CharacterStatusImpl implements CharacterStatusWithLastChangedInfo {
    constructor(
        public readonly characterName: CharacterName,
        public readonly status: OnlineStatus,
        public readonly statusLastChanged: StatusLastChangeInfo,
        public readonly statusMessage: string,
        public readonly statusMessageLastChanged: StatusLastChangeInfo,
        public readonly typingStatus: TypingStatus,
        public readonly gender: CharacterGender,
        public readonly ignored: boolean,
        public readonly isFriend: boolean,
        public readonly isBookmark: boolean,
        public readonly isInterest: boolean)
    {
    }

    equals(cs: CharacterStatus | null) {
        if (cs == null) return false;

        return cs.characterName == this.characterName &&
            cs.status == this.status &&
            cs.statusMessage == this.statusMessage &&
            cs.typingStatus == this.typingStatus &&
            cs.gender == this.gender &&
            cs.ignored == this.ignored &&
            cs.isFriend == this.isFriend &&
            cs.isBookmark == this.isBookmark &&
            cs.isInterest == this.isInterest;
    }
}

export type CharacterStatusChangeHandler = (newStatus: CharacterStatusWithLastChangedInfo, previousStatus: CharacterStatus) => void;

class LingeringGenderSet {
    private static readonly RETAIN_FOR_MS = 1000 * 60 * 5;

    constructor() {
    }

    private readonly _lingeringGenders: SnapshottableMap<CharacterName, LingeringCharacterGender> = new SnapshottableMap();
    private _nextExpireAt: number | null = null;
    private _nextExpireTimeoutHandle: number | null = null;

    tryGet(name: CharacterName): LingeringCharacterGender | null {
        const res = this._lingeringGenders.get(name);
        return res ?? null;
    }

    set(name: CharacterName, gender: CharacterGender) {
        const myExpiresAt = (new Date()).getTime() + LingeringGenderSet.RETAIN_FOR_MS;
        this._lingeringGenders.set(name, {
            characterName: name,
            expiresAt: myExpiresAt,
            wentOfflineAt: new Date(),
            gender: gender
        });
        this.setNextExpireAt(myExpiresAt);
    }

    private setNextExpireAt(value: number) {
        if (this._nextExpireAt == null || this._nextExpireAt > value) {
            this._nextExpireAt = value;
        }
        this.rescheduleNextExpire();
    }

    private rescheduleNextExpire() {
        if (this._nextExpireTimeoutHandle) {
            window.clearTimeout(this._nextExpireTimeoutHandle);
        }
        if (this._nextExpireAt != null) {
            const tickIn = Math.max(1, this._nextExpireAt - (new Date()).getTime());
            this._nextExpireTimeoutHandle = window.setTimeout(
                () => { this.runExpiration() },
                tickIn);
        }
    }

    private runExpiration() {
        const now = (new Date()).getTime();
        let newNextExpireAt: (number | null) = null;

        this._lingeringGenders.forEachValueSnapshotted(x => {
            if (x.expiresAt <= now) {
                this._lingeringGenders.delete(x.characterName);
            }
            else {
                newNextExpireAt = (newNextExpireAt == null) ? x.expiresAt : Math.min(newNextExpireAt, x.expiresAt);
            }
        });

        this._nextExpireAt = null;
        if (newNextExpireAt != null) {
            this.setNextExpireAt(newNextExpireAt);
        }
    }

    delete(name: CharacterName) {
        this._lingeringGenders.delete(name);
    }
}