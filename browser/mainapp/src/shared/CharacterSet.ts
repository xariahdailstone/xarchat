import { CallbackSet, NamedCallbackSet } from "../util/CallbackSet.js";
import { SnapshottableMap } from "../util/collections/SnapshottableMap.js";
import { SnapshottableSet } from "../util/collections/SnapshottableSet.js";
import { asDisposable, IDisposable, ObjectDisposedError } from "../util/Disposable.js";
import { Observable, ObservableValue } from "../util/Observable.js";
import { observableProperty } from "../util/ObservableBase.js";
import { DictionaryChangeType } from "../util/ObservableKeyedLinkedList.js";
import { CharacterNameSet } from "../viewmodel/CharacterNameSet.js";
import { CharacterGender } from "./CharacterGender.js";
import { CharacterName } from "./CharacterName.js";
import { NicknameSet } from "./NicknameSet.js";
import { OnlineStatus } from "./OnlineStatus.js";
import { TypingStatus } from "./TypingStatus.js";

export class CharacterSet {

    static emptyStatus(
        name: CharacterName, 
        ignoreSet?: CharacterNameSet,
        friendsSet?: CharacterNameSet,
        bookmarkSet?: CharacterNameSet,
        interestsSet?: CharacterNameSet,
        nicknameSet?: NicknameSet,
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
            interestsSet ? interestsSet.has(name) : false,
            nicknameSet ? nicknameSet.get(name) : null);
    }

    constructor(ignoreSet: CharacterNameSet, friendSet: CharacterNameSet, bookmarkSet: CharacterNameSet, interestsSet: CharacterNameSet, nicknameSet: NicknameSet) {
        this._ignoreSet = ignoreSet;
        this._friendSet = friendSet;
        this._bookmarkSet = bookmarkSet;
        this._interestsSet = interestsSet;
        this._nicknameSet = nicknameSet;

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
        nicknameSet.addEventListener("propertychange", (pce) => {
            this.setCharacterStatus(CharacterName.create(pce.propertyName), { nickname: pce.propertyValue as (string | null) });
        });
    }

    private readonly _ignoreSet: CharacterNameSet;
    private readonly _friendSet: CharacterNameSet;
    private readonly _bookmarkSet: CharacterNameSet;
    private readonly _interestsSet: CharacterNameSet;
    private readonly _nicknameSet: NicknameSet;

    private readonly _statuses: SnapshottableMap<CharacterName, CharacterStatusImpl> = new SnapshottableMap();
    private readonly _statusListeners2: NamedCallbackSet<CharacterName, CharacterStatusChangeHandler> = new NamedCallbackSet("CharacterSet");

    private readonly _lingeringGenders: LingeringGenderSet = new LingeringGenderSet();

    private readonly _size: ObservableValue<number> = new ObservableValue<number>(0);
    get size(): number { return this._size.value; }

    forEachMatchingCharacter(startsWith: string, callback: (characterName: CharacterName) => void) {
        startsWith = startsWith.toLowerCase();
        this._statuses.forEachEntrySnapshotted(x => {
            const cname = x[0];
            const cstatus = x[1];
            if (cname.canonicalValue.startsWith(startsWith)) {
                callback(cname);
            }
        });
    }

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
            (status.isInterest != null) ? status.isInterest : existingStatus.isInterest,
            (status.nickname !== undefined) ? status.nickname : existingStatus.nickname
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
        const result = this.getCharacterStatusInternal(characterName);
        Observable.publishNamedRead(`cs-${characterName.canonicalValue}`, result);
        return result;
    }

    private getCharacterStatusInternal(characterName: CharacterName): CharacterStatusWithLastChangedInfo {
        const result = this._statuses.get(characterName);
        if (result) {
            return result;
        }
        else {
            const lingeringGender = this._lingeringGenders.tryGet(characterName);
            const fresult = CharacterSet.emptyStatus(characterName, this._ignoreSet, this._friendSet, this._bookmarkSet, this._interestsSet, this._nicknameSet, lingeringGender);
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

        this._activeSubSets.forEachValueSnapshotted(subsetRef => {
            const subset = subsetRef.deref();
            if (subset) {
                if (subset.watchedChars.has(newStatus.characterName)) {
                    subset.characterStatusUpdated(newStatus);
                }
            }
            else {
                this._activeSubSets.delete(subsetRef);
            }
        });
    }

    private _activeSubSets: SnapshottableSet<WeakRef<CharacterSubSetImpl>> = new SnapshottableSet();
    createSubSet(chars: Iterable<CharacterName>): CharacterSubSet {
        const cses: CharacterStatus[] = [];
        for (let c of chars) {
            const cs = this.getCharacterStatusInternal(c);
            cses.push(cs);
        }
        const subset = new CharacterSubSetImpl(this, cses);
        subset.weakRef = new WeakRef(subset);
        this._activeSubSets.add(subset.weakRef);
        return subset;
    }
    dropSubSet(subset: CharacterSubSetImpl) {
        const wr = subset.weakRef;
        if (wr) {
            subset.weakRef = null;
            this._activeSubSets.delete(wr);
            subset.dispose();
        }
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

    readonly nickname: string | null;

    equals(cs: CharacterStatus | null): boolean;
}
export type CharacterStatusNoEquals = Omit<CharacterStatus, "equals">;

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
        public readonly isInterest: boolean,
        public readonly nickname: string | null)
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




export interface CharacterSubSet extends IDisposable {
    readonly watchedChars: ReadonlySet<CharacterName>;
    readonly version: number;
    readonly length: number;
    addChar(characterName: CharacterName): CharacterStatus;
    removeChar(characterName: CharacterName): void;
    addStatusUpdateListener(callback: (cs: CharacterStatus) => any): IDisposable;

    iterateStatuses(): Iterable<CharacterStatus>;
}

class CharacterSubSetImpl implements IDisposable {

    constructor(characterSet: CharacterSet, initialChars: CharacterStatus[]) {
        this._characterSet = characterSet;
        this._watchedChars = new Set(initialChars.map(cs => cs.characterName));
        for (let cs of initialChars.values()) {
            this._charStatuses.set(cs.characterName, cs);
        }
    }

    weakRef: WeakRef<CharacterSubSetImpl> | null = null;

    private _characterSet: CharacterSet | null;

    private _isDisposed = false;
    get isDisposed(): boolean { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            if (this._characterSet) {
                this._characterSet.dropSubSet(this);
            }
            this._characterSet = null;
            this._statusUpdateListeners.clear();
            this._watchedChars.clear();
            this._charStatuses.clear();
        }
    }

    [Symbol.dispose](): void {
        this.dispose();
    }

    private readonly _watchedChars;
    private readonly _charStatuses: Map<CharacterName, CharacterStatus> = new Map();

    get watchedChars(): ReadonlySet<CharacterName> { return this._watchedChars; }

    private _statusUpdateListeners: CallbackSet<(cs: CharacterStatus) => any> = new CallbackSet("statusUpdateListener");
    addStatusUpdateListener(callback: (cs: CharacterStatus) => any): IDisposable {
        if (this._isDisposed) {
            throw new ObjectDisposedError(this);
        }

        return this._statusUpdateListeners.add(callback);
    }

    characterStatusUpdated(cs: CharacterStatus) {
        if (!this._isDisposed) {
            this._charStatuses.set(cs.characterName, cs);
            this._statusUpdateListeners.invoke(cs);
            this._version.value = this._version.value + 1;
        }
    }

    addChar(characterName: CharacterName): CharacterStatus {
        if (this._isDisposed) {
            throw new ObjectDisposedError(this);
        }

        if (!this._watchedChars.has(characterName)) {
            this._watchedChars.add(characterName);
            const cs = this._characterSet!.getCharacterStatus(characterName);
            this._charStatuses.set(characterName, cs);
            this._version.value = this._version.value + 1;
            return cs;
        }
        else {
            return this._charStatuses.get(characterName)!;
        }
    }

    removeChar(characterName: CharacterName): void {
        this._watchedChars.delete(characterName);
        this._charStatuses.delete(characterName);
        this._version.value = this._version.value + 1;
    }

    private _version: ObservableValue<number> = new ObservableValue(0);
    get version(): number { return this._version.value; }

    get length(): number { return this._watchedChars.size; }

    *iterateStatuses(): Iterable<CharacterStatus> {
        for (let kvp of this._charStatuses.entries()) {
            yield kvp[1];
        }
    }
}