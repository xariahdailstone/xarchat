
export class CharacterGender {
    public static get NONE() { return CharacterGender.create("none"); }
    public static get MALE() { return CharacterGender.create("male"); }
    public static get MALEHERM() { return CharacterGender.create("male-herm"); }
    public static get FEMALE() { return CharacterGender.create("female"); }
    public static get HERM() { return CharacterGender.create("herm"); }
    public static get CUNTBOY() { return CharacterGender.create("cunt-boy"); }
    public static get TRANSGENDER() { return CharacterGender.create("transgender"); }
    public static get SHEMALE() { return CharacterGender.create("shemale"); }
    public static get MALETRANS() { return CharacterGender.create("male-trans"); }
    public static get FEMALETRANS() { return CharacterGender.create("female-trans"); }
    public static get INTERSEX() { return CharacterGender.create("intersex"); }
    public static get NONBINARY() { return CharacterGender.create("nonbinary"); }

    static _gendersByCode: Map<string, CharacterGender> = new Map();
    static _gendersByApiValue: Map<number, CharacterGender> = new Map();

    static create(codeValue: string | number, displayValue?: string, cssClass?: string, apiNumericValue?: number): CharacterGender {
        if (typeof codeValue == "string") {
            const existing = this._gendersByCode.get(codeValue.toLowerCase());
            if (existing) { return existing; }

            const res = new CharacterGender(codeValue, displayValue, cssClass, apiNumericValue);
            this._gendersByCode.set(codeValue.toLowerCase(), res);
            if (res.hasRealApiNumericValue) {
                this._gendersByApiValue.set(res.apiNumericValue, res);
            }
            return res;
        }
        else {
            const existing = this._gendersByApiValue.get(codeValue);
            if (existing) { return existing; }

            return CharacterGender.NONE;
        }
    }

    static isExisting(codeValue: string) {
        return this._gendersByCode.has(codeValue.toLowerCase());
    }

    static *enumerateExisting(): Iterable<CharacterGender> {
        for (let v of this._gendersByCode.values()) {
            yield v;
        }
    }

    private constructor(
        codeValue: string, displayValue?: string, cssClass?: string, apiNumericValue?: number) {
        
        this.codeValue = codeValue;
        this.displayValue = displayValue ?? this.codeValue;
        this.cssClass = cssClass ?? this.codeValue;
        this.apiNumericValue = apiNumericValue ?? 0;
        this.hasRealApiNumericValue = (apiNumericValue != null);
    }

    readonly codeValue: string;
    readonly displayValue: string;
    readonly cssClass: string;
    readonly apiNumericValue: number;
    readonly hasRealApiNumericValue: boolean;

    toJson() {
        return this.apiNumericValue;
    }
}

enum CharacterGenderApiValues {
    NONE = 0,
    MALE = 1,
    MALEHERM = 2,
    FEMALE = 3,
    HERM = 4,
    CUNTBOY = 5,
    TRANSGENDER = 6,
    SHEMALE = 7,
    MALETRANS = 8,
    FEMALETRANS = 9,
    INTERSEX = 10,
    NONBINARY = 11,
}

CharacterGender.create("none", "None", "none", CharacterGenderApiValues.NONE);
CharacterGender.create("male", "Male", "male", CharacterGenderApiValues.MALE);
CharacterGender.create("male-herm", "Male Herm", "male-herm", CharacterGenderApiValues.MALEHERM);
CharacterGender.create("female", "Female", "female", CharacterGenderApiValues.FEMALE);
CharacterGender.create("herm", "Herm", "herm", CharacterGenderApiValues.HERM);
CharacterGender.create("cunt-boy", "Cunt Boy", "cunt-boy", CharacterGenderApiValues.CUNTBOY);
CharacterGender.create("transgender", "Transgender", "transgender", CharacterGenderApiValues.TRANSGENDER);
CharacterGender.create("shemale", "Shemale", "shemale", CharacterGenderApiValues.SHEMALE);
CharacterGender.create("male-trans", "Male (Trans)", "male-trans", CharacterGenderApiValues.MALETRANS);
CharacterGender.create("female-trans", "Female (Trans)", "female-trans", CharacterGenderApiValues.FEMALETRANS);
CharacterGender.create("intersex", "Intersex", "intersex", CharacterGenderApiValues.INTERSEX);
CharacterGender.create("nonbinary", "Non-Binary", "nonbinary", CharacterGenderApiValues.NONBINARY);

export class CharacterGenderConvert {
    // static getRandom(): CharacterGender {
    //     return Math.floor(Math.random() * 8);
    // }

    static isValid(value: (string | null | undefined)): boolean {
        if (value == null) { return false; }
        return CharacterGender.isExisting(value);
    }

    static toCharacterGender(value: (string | null | undefined)): (CharacterGender | null) {
        if (CharacterGenderConvert.isValid(value)) {
            return CharacterGender.create(value!);
        }
        else {
            return null;
        }
    }

    static toString(status: CharacterGender): string;
    static toString(status: (CharacterGender | null | undefined)): (string | null);
    static toString(status: (CharacterGender | null | undefined)): (string | null) {
        if (status) {
            return status.codeValue;
        }
        else {
            return null;
        }
    }
}