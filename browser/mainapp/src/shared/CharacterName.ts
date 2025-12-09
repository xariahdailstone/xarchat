import { StringUtils } from "../util/StringUtils";

const cachedNames = new Map<string, WeakRef<CharacterName>>();

const freg = new FinalizationRegistry<string>((heldValue) => {
    cachedNames.delete(heldValue);
});

export enum CanonicalType {
    NonCanonical,
    CanonicalUpgradeOnly,
    FullyCanonical
}

export class CharacterName {
    static isValidCharacterName(characterNameString: string): boolean {
        if (characterNameString == null || characterNameString.length == 0 || characterNameString.length > 38) {
            return false;
        }
        if (characterNameString.match(/[^A-Za-z0-9_ \-]/)) {
            return false;
        }
        return true;
    }

    static createCanonical(characterNameString: string): CharacterName {
        return CharacterName.create(characterNameString, CanonicalType.FullyCanonical);
    }

    static createCanonicalUpgradeOnly(characterNameString: string): CharacterName {
        return CharacterName.create(characterNameString, CanonicalType.CanonicalUpgradeOnly);
    }

    static create(characterNameString: string, canonicalType: CanonicalType = CanonicalType.NonCanonical): CharacterName {
        characterNameString = StringUtils.discardUnseen(characterNameString);
        const canonical = characterNameString.toLowerCase();
        
        const cachedRef = cachedNames.get(canonical);
        const ref = cachedRef ? cachedRef.deref() : undefined;
        if (ref) {
            switch (canonicalType) {
                case CanonicalType.FullyCanonical:
                    ref.setCanonically(characterNameString);
                    break;
                case CanonicalType.CanonicalUpgradeOnly:
                    ref.maybeUpgrade(characterNameString);
                    break;
                case CanonicalType.NonCanonical:
                    break;
            }
            return ref;
        }

        const newValue = new CharacterName(canonical, characterNameString);
        cachedNames.set(canonical, new WeakRef(newValue));
        return newValue;
    }

    static equals(a: (CharacterName | null | undefined | string), b: (CharacterName | null | undefined | string)): boolean {
        if (typeof a == "string") { a = CharacterName.create(a); }
        if (typeof b == "string") { b = CharacterName.create(b); }
        if (a == null && b == null) { return true; }
        if (a == null || b == null) { return false; }
        return a.equals(b);
    }

    static compare(a: (CharacterName | null | undefined), b: (CharacterName | null | undefined)): number {
        if (a == null && b == null) { return 0; }
        if (a == null) { return 0; }
        if (b == null) { return 1; }
        
        if (a._sortValue < b._sortValue) { return -1; }
        if (a._sortValue == b._sortValue) { 
            if (a._canonicalValue < b._canonicalValue) { return -1; }
            if (a._canonicalValue > b._canonicalValue) { return 1; }
            return 0; 
        }
        return 1;
    }

    static readonly SYSTEM = CharacterName.create("System");

    private constructor(
        canonical: string,
        value: string) {

        this._canonicalValue = canonical;
        this._sortValue = canonical.replaceAll(' ', '');
        this._displayValue = StringUtils.discardUnseen(value);
        this._isUpgraded = value != value.toLowerCase();

        freg.register(this, canonical);
    }

    private _canonicalValue: string;
    private _displayValue: string;
    private _sortValue: string;
    private _isUpgraded: boolean;

    get canonicalValue() { return this._canonicalValue; }

    get value() { return this._displayValue; }

    private setCanonically(name: string) {
        if (this._displayValue != name) {
            this._displayValue = StringUtils.discardUnseen(name);
        }
        this._isUpgraded = true;
    }

    private maybeUpgrade(name: string) {
        if (!this._isUpgraded) {
            const nameLower = name.toLowerCase();
            if (name != nameLower) {
                this._displayValue = StringUtils.discardUnseen(name);
                this._isUpgraded = true;
            }
        }
    }

    equals(other: (CharacterName | null | undefined)): boolean {
        if (this === other) { return true; }
        if (other == null) { return false; }
        return (this._canonicalValue == other._canonicalValue);
    }

    toString() {
        return this.value;
    }
}

(window as any).CharacterName = CharacterName;