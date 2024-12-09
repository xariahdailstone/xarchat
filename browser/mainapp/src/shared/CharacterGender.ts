export enum CharacterGender {
    NONE,
    MALE,
    MALEHERM,
    FEMALE,
    HERM,
    CUNTBOY,
    TRANSGENDER,
    SHEMALE
}

export class CharacterGenderConvert {
    static getRandom(): CharacterGender {
        return Math.floor(Math.random() * 8);
    }

    static isValid(value: (string | null | undefined)): boolean {
        switch (value?.toLowerCase()) {
            case "male":
            case "male-herm":
            case "female":
            case "herm":
            case "cunt-boy":
            case "transgender":
            case "shemale":
            case "none":
                return true;
            default:
                return false;
        }
    }

    static toCharacterGender(value: (string | null | undefined)): (CharacterGender | null) {
        switch (value?.toLowerCase()) {
            case "male":
                return CharacterGender.MALE;
            case "male-herm":
                return CharacterGender.MALEHERM;
            case "female":
                return CharacterGender.FEMALE;
            case "herm":
                return CharacterGender.HERM;
            case "cunt-boy":
                return CharacterGender.CUNTBOY;
            case "transgender":
                return CharacterGender.TRANSGENDER;
            case "shemale":
                return CharacterGender.SHEMALE;
            case "none":
                return CharacterGender.NONE;
            default:
                return null;
        }
    }

    static toString(status: CharacterGender): string;
    static toString(status: (CharacterGender | null | undefined)): (string | null);
    static toString(status: (CharacterGender | null | undefined)): (string | null) {
        switch (status) {
            case CharacterGender.MALE:
                return "male";
            case CharacterGender.MALEHERM:
                return "male-herm";
            case CharacterGender.FEMALE:
                return "female";
            case CharacterGender.HERM:
                return "herm";
            case CharacterGender.CUNTBOY:
                return "cunt-boy";
            case CharacterGender.TRANSGENDER:
                return "transgender";
            case CharacterGender.SHEMALE:
                return "shemale";
            case CharacterGender.NONE:
                return "none";
            default:
                return null;
        }
    }
}