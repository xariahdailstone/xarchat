import { CharacterGender } from "../../../shared/CharacterGender";
import { Profile } from "../../profile/Profile";
import { RichMappingListListItem } from "../../profile/RichMappingDef";
import { GenderProfileAnalyzer } from "./GenderAnalyzer";

const OID_STRAIGHT = 4;
const OID_GAY = 5;
const OID_BISEXUAL = 6;
const OID_ASEXUAL = 58;
const OID_UNSURE = 59;
const OID_BIMALEPREF = 89;
const OID_BIFEMALEPREF = 90;
const OID_PANSEXUAL = 127;
const OID_BICURIOUS = 128;

// export class GenderPreferenceProfileAnalyzer {
//     getOrientation(profile: Profile): AnalyzedOrientation {
//         const result: GenderPreferences = {};
//         result[CharacterGender.NONE] = 0;
//         result[CharacterGender.MALE] = 0;
//         result[CharacterGender.FEMALE] = 0;
//         result[CharacterGender.SHEMALE] = 0;
//         result[CharacterGender.HERM] = 0;
//         result[CharacterGender.CUNTBOY] = 0;
//         result[CharacterGender.TRANSGENDER] = 0;
//         result[CharacterGender.MALEHERM] = 0;

//         const declaredOrientation = profile.infotags.getByName("Orientation")?.value as RichMappingListListItem | null;
//         const gender = new GenderProfileAnalyzer().getGender(profile);


//         return result;
//     }
// }

// export interface GenderPreferences {
//     [id: number]: number;
// }