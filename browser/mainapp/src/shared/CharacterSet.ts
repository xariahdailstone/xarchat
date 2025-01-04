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

    static emptyStatus(name: CharacterName, ignoreSet?: CharacterNameSet, lingeringGender?: (CharacterGender | null)) {
        return new CharacterStatusImpl(name, OnlineStatus.OFFLINE, "", TypingStatus.NONE, lingeringGender != null ? lingeringGender : CharacterGender.NONE, 
            ignoreSet ? ignoreSet.has(name) : false);
    }

    constructor(ignoreSet: CharacterNameSet) {
        this._ignoreSet = ignoreSet;

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
    }

    private readonly _ignoreSet: CharacterNameSet;
    private readonly _statuses: SnapshottableMap<CharacterName, CharacterStatusImpl> = new SnapshottableMap();
    private readonly _statusListeners: Map<CharacterName, SnapshottableSet<CharacterStatusChangeHandler>> = new Map();

    private readonly _lingeringGenders: LingeringGenderSet = new LingeringGenderSet();

    private readonly _size: ObservableValue<number> = new ObservableValue<number>(0);
    get size(): number { return this._size.value; }

    setCharacterStatus(characterName: CharacterName, status: Partial<CharacterStatus>): CharacterStatus {
        const existingStatus = this.getCharacterStatus(characterName);

        const newStatus = new CharacterStatusImpl(
            characterName,
            (status.status != null) ? status.status : existingStatus.status,
            (status.statusMessage != null) ? status.statusMessage : existingStatus.statusMessage,
            (status.typingStatus != null) ? status.typingStatus : existingStatus.typingStatus,
            (status.gender != null) ? status.gender : existingStatus.gender,
            (status.ignored != null) ? status.ignored : existingStatus.ignored
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

    getCharacterStatus(characterName: CharacterName): CharacterStatus {
        const result = this._statuses.get(characterName);
        if (result) {
            Observable.publishNamedRead(`cs-${characterName.canonicalValue}`, result);
            return result;
        }
        else {
            const lingeringGender = this._lingeringGenders.tryGet(characterName);
            const fresult = CharacterSet.emptyStatus(characterName, this._ignoreSet, lingeringGender);
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
        let set = this._statusListeners.get(characterName);
        if (!set) {
            set = new SnapshottableSet<CharacterStatusChangeHandler>();
            this._statusListeners.set(characterName, set);
        }
        set.add(handler);

        return asDisposable(() => {
            let set = this._statusListeners.get(characterName);
            if (set) {
                set.delete(handler);
                if (set.size == 0) {
                    this._statusListeners.delete(characterName);
                }
            }
            });
    }

    private characterStatusUpdated(newStatus: CharacterStatus, previousStatus: CharacterStatus) {
        const characterName = newStatus.characterName;
        const listeners = this._statusListeners.get(characterName);
        if (listeners) {
            //const status = this.getCharacterStatus(characterName);
            listeners.forEachValueSnapshotted(handler => {
                try {
                    if (handler) {
                        handler(newStatus, previousStatus);
                    }
                    else {
                        listeners.delete(handler);
                        if (listeners.size == 0) {
                            this._statusListeners.delete(characterName);
                        }
                    }
                }
                catch { }
            });
        }
    }
}

interface LingeringCharacterGender {
    readonly characterName: CharacterName;
    readonly gender: CharacterGender;
    readonly expiresAt: number;
}

export interface CharacterStatus {
    readonly characterName: CharacterName;
    readonly status: OnlineStatus;
    readonly statusMessage: string;
    readonly typingStatus: TypingStatus;
    readonly gender: CharacterGender;
    readonly ignored: boolean;

    equals(cs: CharacterStatus | null): boolean;
}

class CharacterStatusImpl implements CharacterStatus {
    constructor(
        public readonly characterName: CharacterName,
        public readonly status: OnlineStatus,
        public readonly statusMessage: string,
        public readonly typingStatus: TypingStatus,
        public readonly gender: CharacterGender,
        public readonly ignored: boolean)
    {
    }

    equals(cs: CharacterStatus | null) {
        if (cs == null) return false;

        return cs.characterName == this.characterName &&
            cs.status == this.status &&
            cs.statusMessage == this.statusMessage &&
            cs.typingStatus == this.typingStatus &&
            cs.gender == this.gender &&
            cs.ignored == this.ignored;
    }
}

export type CharacterStatusChangeHandler = (newStatus: CharacterStatus, previousStatus: CharacterStatus) => void;

class LingeringGenderSet {
    private static readonly RETAIN_FOR_MS = 1000 * 5;

    constructor() {
    }

    private readonly _lingeringGenders: SnapshottableMap<CharacterName, LingeringCharacterGender> = new SnapshottableMap();
    private _nextExpireAt: number | null = null;
    private _nextExpireTimeoutHandle: number | null = null;

    tryGet(name: CharacterName): CharacterGender | null {
        const res = this._lingeringGenders.get(name);
        return res ? res.gender : null;
    }

    set(name: CharacterName, gender: CharacterGender) {
        const myExpiresAt = (new Date()).getTime() + LingeringGenderSet.RETAIN_FOR_MS;
        this._lingeringGenders.set(name, {
            characterName: name,
            expiresAt: myExpiresAt,
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