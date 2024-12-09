import { CharacterGender, CharacterGenderConvert } from "../../../shared/CharacterGender";
import { Profile } from "../../profile/Profile";

export class GenderProfileAnalyzer {
    getGender(profile: Profile): CharacterGender {
        const g = CharacterGenderConvert.toCharacterGender(profile.infotags.getByName("Gender")?.valueString ?? "None") ?? CharacterGender.NONE;
        return g;
    }
}


