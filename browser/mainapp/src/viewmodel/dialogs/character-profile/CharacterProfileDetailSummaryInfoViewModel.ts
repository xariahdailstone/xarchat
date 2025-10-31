import { ProfileInfo, ProfileFieldsInfoList, MappingList, ProfileFieldsSectionListItem } from "../../../fchat/api/FListApi";
import { ObservableBase, observableProperty } from "../../../util/ObservableBase";
import { StringUtils } from "../../../util/StringUtils";
import { AppViewModel } from "../../AppViewModel";

export class CharacterProfileDetailSummaryInfoViewModel extends ObservableBase {
    constructor(
        appViewModel: AppViewModel,
        private readonly profileInfo: ProfileInfo,
        private readonly profileFieldsInfoList: ProfileFieldsInfoList,
        private readonly mappingList: MappingList
    ) {
        super();
        this.age = this.getFromInfoTag("Age");
        this.gender = this.getFromInfoTag("Gender");
        this.orientation = this.getFromInfoTag("Orientation");
        this.languagePreference = this.getFromInfoTag("Language Preference");
        this.species = this.getFromInfoTag("Species");
        this.furryPreference = this.getFromInfoTag("Furry preference");
        this.domSubRole = this.getFromInfoTag("Dom/Sub Role");
        this.desiredRpLength = this.getFromInfoTag("Desired RP length");

        const createdAt = new Date(profileInfo.created_at * 1000);
        const updatedAt = new Date(profileInfo.updated_at * 1000);
        this.created = StringUtils.dateToString(appViewModel.locale, createdAt, { dateStyle: 'medium', timeStyle: 'short' });
        this.lastUpdated = StringUtils.dateToString(appViewModel.locale, updatedAt, { dateStyle: 'medium', timeStyle: 'short' });
        this.views = StringUtils.numberToString(profileInfo.views, {});
        this.timezone = profileInfo.timezone ?
            (profileInfo.timezone == 0 ? "GMT"
                : profileInfo.timezone > 0 ? `GMT +${profileInfo.timezone}`
                : `GMT -${Math.abs(profileInfo.timezone)}`)
            : null;

        this.memo = profileInfo.memo?.memo;
    }

    private getFromInfoTag(fieldName: string) {
        const profileInfo = this.profileInfo;
        const profileFieldsInfoList = this.profileFieldsInfoList;

        let def: ProfileFieldsSectionListItem | null = null;
        for (let groupId of Object.getOwnPropertyNames(profileFieldsInfoList!)) {
            for (let infoTagDef of profileFieldsInfoList![groupId]!.items) {
                if (infoTagDef.name == fieldName) {
                    def = infoTagDef;
                    break;
                }
            }
            if (def) {
                break;
            }
        }
        if (!def) {
            return null;
        };

        let profileValue: string | null = null;
        if (def.type == "text") {
            const infotags = profileInfo?.infotags;
            profileValue = (infotags && !(infotags instanceof Array)) ? (infotags[def.id.toString()] ?? null) : null;
        }
        else if (def.type == "list") {
            const infotags = profileInfo?.infotags;
            const profileIdxStr = (infotags && !(infotags instanceof Array)) ? (infotags[def.id.toString()] ?? null) : null;

            const lx = this.mappingList.listitems.filter(li => li.id == profileIdxStr);
            if (lx.length > 0) {
                profileValue = lx[0].value;
            }
            else {
                profileValue = profileIdxStr;
            }
        }
        if (profileValue == null) {
            return null;
        };
        return profileValue;
    }

    @observableProperty
    age: string | null = null;

    @observableProperty
    gender: string | null = null;

    @observableProperty
    orientation: string | null = null;

    @observableProperty
    languagePreference: string | null = null;

    @observableProperty
    species: string | null = null;

    @observableProperty
    furryPreference: string | null = null;

    @observableProperty
    domSubRole: string | null = null;

    @observableProperty
    desiredRpLength: string | null = null;

    @observableProperty
    created: string | null = null;

    @observableProperty
    lastUpdated: string | null = null;

    @observableProperty
    views: string | null = null;

    @observableProperty
    timezone: string | null;

    @observableProperty
    memo: string | null = null;
}
