import { ProfileInfo, ProfileFieldsInfoList, MappingList } from "../../../fchat/api/FListApi";
import { ObservableBase, observableProperty } from "../../../util/ObservableBase";
import { Collection } from "../../../util/ObservableCollection";
import { StringUtils } from "../../../util/StringUtils";
import { CharacterProfileDetailSectionFieldInfoViewModel } from "./CharacterProfileDetailSectionFieldInfoViewModel";


export class CharacterProfileDetailSectionInfoViewModel extends ObservableBase {
    constructor(
        private readonly profileInfo: ProfileInfo,
        private readonly profileFieldsInfoList: ProfileFieldsInfoList,
        private readonly mappingList: MappingList,
        detailSection: string
    ) {
        super();

        const groupRows: Collection<CharacterProfileDetailSectionFieldInfoViewModel> = new Collection();

        this.sectionTitle = detailSection;
        this.fields = groupRows;

        if (!(profileInfo.infotags instanceof Array)) {
            const infoTagGroup = this.getInfoTagGroupByName(profileFieldsInfoList, detailSection);
            if (infoTagGroup) {
                const infoTagGroupName = infoTagGroup.group;
                for (let infoTagDef of infoTagGroup.items) {
                    const infoTagDefIdStr = infoTagDef.id.toString();
                    const profileValue = profileInfo.infotags[infoTagDefIdStr];
                    if (!StringUtils.isNullOrWhiteSpace(profileValue)) {
                        let profileValueDisplay: string;
                        switch (infoTagDef.type) {
                            case "text":
                                profileValueDisplay = profileValue;
                                break;
                            case "list":
                                const lx = mappingList.listitems.filter(li => li.id == profileValue);
                                if (lx.length > 0) {
                                    profileValueDisplay = lx[0].value;
                                }
                                else {
                                    profileValueDisplay = profileValue;
                                }
                                break;
                        }
                        const fld = new CharacterProfileDetailSectionFieldInfoViewModel(infoTagDef.name, profileValueDisplay);
                        groupRows.push(fld);
                    }
                }
            }
        }
    }

    private getInfoTagGroupByName(profileFieldsInfoList: ProfileFieldsInfoList, groupName: string) {
        for (let infoTagGroupId of Object.getOwnPropertyNames(profileFieldsInfoList)) {
            const infoTagGroup = profileFieldsInfoList[infoTagGroupId];
            const infoTagGroupName = infoTagGroup.group;
            if (infoTagGroupName == groupName) {
                return infoTagGroup;
            }
        }
        return null;
    }

    @observableProperty
    sectionTitle: string;

    @observableProperty
    fields: Collection<CharacterProfileDetailSectionFieldInfoViewModel>;
}
