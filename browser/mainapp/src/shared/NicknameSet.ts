import { h } from "../snabbdom/h";
import { CallbackSet } from "../util/CallbackSet";
import { SnapshottableMap } from "../util/collections/SnapshottableMap";
import { asDisposable, DisposableOwnerField, IDisposable, ObjectDisposedError } from "../util/Disposable";
import { ObjectUniqueId } from "../util/ObjectUniqueId";
import { Observable, PropertyChangeEvent, PropertyChangeEventListener, ValueSubscription } from "../util/Observable";
import { setupValueSubscription } from "../util/ObservableBase";
import { ObservableExpression } from "../util/ObservableExpression";
import { StringUtils } from "../util/StringUtils";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel";
import { AppViewModel } from "../viewmodel/AppViewModel";
import { CharacterName } from "./CharacterName";

export interface NicknameSource {
    get(character: CharacterName): (string | null);
}

export class NicknameSet implements Observable, IDisposable, NicknameSource {
    constructor(
        private readonly session: ActiveLoginViewModel) {

        this._cnObservableExpression = new ObservableExpression(
            () => session.characterName,
            (cn) => { this.updateMyCharacterName(cn ?? null); },
            (err) => { this.updateMyCharacterName(null); }
        );
    }

    private _cnObservableExpression: ObservableExpression<CharacterName>;

    private _isDisposed: boolean = false;
    get isDisposed(): boolean { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            this._cnObservableExpression.dispose();
            this._cnObservableExpression = null!;
            this.updateMyCharacterName(null);
        }
    }
    [Symbol.dispose](): void {
        this.dispose();
    }

    private readonly MCNDisposableOwnerField: DisposableOwnerField = new DisposableOwnerField();

    private updateMyCharacterName(characterName: CharacterName | null) {
        if (characterName != null && this._isDisposed) {
            throw new ObjectDisposedError(this);
        }

        if (characterName != null) {
            this.MCNDisposableOwnerField.value = null;
            
            const configBlock = this.session.appViewModel.configBlock;

            const pfx = `character.${characterName.canonicalValue}.pm.`;
            const sfx = ".nickname";
            const handleKVP = (key: string, value: unknown) => {
                if (key.startsWith(pfx) && key.endsWith(sfx)) {
                    let charNameStr = key.substr(pfx.length);
                    charNameStr = charNameStr.substring(0, charNameStr.length - sfx.length);
                    if (typeof value == "string" && !StringUtils.isNullOrWhiteSpace(value)) {
                        this._nicknameMap.set(CharacterName.create(charNameStr), value);
                        this.raisePropertyChangeEvent(charNameStr, value);
                    }
                    else {
                        this._nicknameMap.delete(CharacterName.create(charNameStr));
                        this.raisePropertyChangeEvent(charNameStr, null);
                    }
                }
            };

            const allObserver = configBlock.observeAll((key, value) => {
                handleKVP(key, value);
            });
            configBlock.forEach(kvp => {
                handleKVP(kvp.key, kvp.value);
            });

            this.MCNDisposableOwnerField.value = asDisposable(() => {
                allObserver.dispose();
                this._nicknameMap.forEachEntrySnapshotted(kvp => {
                    const charName = kvp[0];
                    this._nicknameMap.delete(kvp[0]);
                    this.raisePropertyChangeEvent(charName.canonicalValue, null);
                });
            });
        }
        else {
            this.MCNDisposableOwnerField.value = null;
        }
    }

    private _propChangeCallbackSet: CallbackSet<PropertyChangeEventListener> = new CallbackSet("NicknameSetPropChange");
    addEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): IDisposable {
        return this._propChangeCallbackSet.add(handler);
    }
    removeEventListener(eventName: "propertychange", handler: PropertyChangeEventListener): void {
        this._propChangeCallbackSet.delete(handler);
    }
    raisePropertyChangeEvent(propertyName: string, propValue: unknown): void {
        this._propChangeCallbackSet.invoke(new PropertyChangeEvent(propertyName, propValue));

        const charName = CharacterName.create(propertyName);
        for (let ss of this._activeSubsets.values()) {
            if (ss.chars.has(charName)) {

            }
        }
    }
    addValueSubscription(propertyPath: string, handler: (value: any) => any): ValueSubscription {
        return setupValueSubscription(this, propertyPath, handler);
    }

    private _nicknameMap: SnapshottableMap<CharacterName, string> = new SnapshottableMap();

    get(character: CharacterName): (string | null) {
        const res = this.rawGet(character);
        Observable.publishRead(this, character.canonicalValue, res);
        return res;
    }

    rawGet(character: CharacterName): (string | null) {
        const res = this._nicknameMap.get(character) ?? null;
        return res;
    }

    private _activeSubsets: Set<NicknameSubSet> = new Set();

    createSubSet(): (NicknameSource & IDisposable) {
        const newSS = new NicknameSubSet(this);
        this._activeSubsets.add(newSS);
        return newSS;
    }

    dropSubSet(ss: NicknameSubSet) {
        this._activeSubsets.delete(ss);
    }
}

class NicknameSubSet implements IDisposable, NicknameSource {
    constructor(
        private readonly nicknameSet: NicknameSet) {

        Observable.publishNamedRead(`NicknameSubSet#${ObjectUniqueId.get(this)}`, null);
    }

    raiseChange() {
        Observable.publishNamedUpdate(`NicknameSubSet#${ObjectUniqueId.get(this)}`, 1);
    }

    readonly chars: Set<CharacterName> = new Set();

    private _isDisposed = false;
    get isDisposed() { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            this.nicknameSet.dropSubSet(this);
        }
    }

    [Symbol.dispose](): void {
        return this.dispose();
    }

    get(character: CharacterName): (string | null) {
        this.chars.add(character);
        return this.nicknameSet.rawGet(character);
    }
}