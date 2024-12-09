import { StringUtils } from "../util/StringUtils";

const cachedNames = new Map<string, WeakRef<ChannelName>>();

const freg = new FinalizationRegistry<string>((heldValue) => {
    cachedNames.delete(heldValue);
});

export class ChannelName {
    static create(channelNameString: string): ChannelName {
        const canonical = channelNameString.toLowerCase();
        
        const cachedRef = cachedNames.get(canonical);
        const ref = cachedRef ? cachedRef.deref() : undefined;
        if (ref) {
            ref.maybeUpgrade(channelNameString);
            return ref;
        }

        const newValue = new ChannelName(canonical, channelNameString);
        cachedNames.set(canonical, new WeakRef(newValue));
        return newValue;
    }

    static equals(a: ChannelName, b: ChannelName): boolean {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.equals(b);
    }

    private constructor(
        canonical: string,
        value: string) {

        this._canonicalValue = canonical;
        this._displayValue = StringUtils.discardUnseen(value);

        freg.register(this, canonical);
    }

    private _canonicalValue: string;
    private _displayValue: string;

    get canonicalValue() { return this._canonicalValue; }

    get value() { return this._displayValue; }

    private maybeUpgrade(name: string) {
        const nameLower = name.toLowerCase();
        if (name !== nameLower) {
            this._displayValue = StringUtils.discardUnseen(name);
        }
    }

    equals(other: ChannelName): boolean {
        if (other == null) return false;
        return this.canonicalValue == other.canonicalValue;
    }

    toString() {
        return this.value;
    }
}

