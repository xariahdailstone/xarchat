import { ProfileInfo, KinkList, ProfileFieldsInfoList, MappingList, KinkListGroupListItem } from "../../../fchat/api/FListApi";
import { StringComparer } from "../../../util/Comparer";
import { CompatibilityCalculator } from "../../../util/CompatibilityCalculator";
import { IterableUtils } from "../../../util/IterableUtils";
import { ObservableBase, observableProperty } from "../../../util/ObservableBase";
import { Collection } from "../../../util/ObservableCollection";
import { Profile } from "../../../util/profile/Profile";
import { RichInfoTagDefListImpl } from "../../../util/profile/RichInfoTagDefList";
import { RichKinkList } from "../../../util/profile/RichKinkList";
import { RichMappingDefImpl } from "../../../util/profile/RichMappingDef";
import { StringUtils } from "../../../util/StringUtils";
import { CharacterProfileDetailKinkItemViewModel } from "./CharacterProfileDetailKinkItemViewModel";


export class CharacterProfileDetailKinkSetViewModel extends ObservableBase {
    constructor(
        profileInfo: ProfileInfo, myProfileInfo: ProfileInfo, kinkList: KinkList, profileFieldsInfoList: ProfileFieldsInfoList, mappingList: MappingList
    ) {
        super();

        const kinkSet = new Map<number, KinkListGroupListItem>();
        for (let klkey of Object.getOwnPropertyNames(kinkList)) {
            const klgroup = kinkList[klkey];
            for (let klitem of klgroup.items) {
                const kinkId = klitem.kink_id;
                kinkSet.set(kinkId, klitem);
            }
        }

        const klists: Map<string, CharacterProfileDetailKinkItemViewModel[]> = new Map();
        klists.set("fave", []);
        klists.set("yes", []);
        klists.set("maybe", []);
        klists.set("no", []);

        const rkl = RichKinkList.create(kinkList);
        const rirl = RichInfoTagDefListImpl.create(profileFieldsInfoList);
        const rmd = RichMappingDefImpl.create(mappingList);

        const profile = new Profile(profileInfo, rkl, rirl, rmd);
        const myProfile = new Profile(myProfileInfo, rkl, rirl, rmd);

        const seenNestedKinks = new Set<string>();
        if (!(profileInfo.custom_kinks instanceof Array)) {
            for (let ckkey of Object.getOwnPropertyNames(profileInfo.custom_kinks)) {
                const ck = profileInfo.custom_kinks[ckkey];
                klists.get(ck.choice)?.push(new CharacterProfileDetailKinkItemViewModel(
                    ck.name,
                    ck.description ?? "",
                    true,
                    null,
                    (!ck.children || ck.children.length == 0) ? undefined : IterableUtils.asQueryable(ck.children).
                        select(n => {
                            const ksi = kinkSet.get(n);
                            const kitem = new CharacterProfileDetailKinkItemViewModel(
                                ksi?.name ?? n.toString(),
                                StringUtils.unescapeHTMLFull(ksi?.description ?? ksi?.name ?? n.toString()),
                                false,
                                myProfile.kinks.getByName(CompatibilityCalculator.getCounterKinkName(ksi?.name ?? "", rkl))?.prefType ?? null
                            );
                            return kitem;
                        }).
                        orderBy(vm => vm.name, StringComparer.Ordinal)
                ));
                if (!(!ck.children || ck.children.length == 0)) {
                    for (let tc of ck.children) {
                        const ksi = kinkSet.get(tc);
                        const nestedKinkName = ksi?.name ?? tc.toString();
                        seenNestedKinks.add(nestedKinkName);
                    }
                }
            }
        }
        if (!(profileInfo.kinks instanceof Array)) {
            for (let pkkey of Object.getOwnPropertyNames(profileInfo.kinks)) {
                const pk = profileInfo.kinks[pkkey];
                const ksi = kinkSet.get(+pkkey);
                const kinkName = ksi?.name ?? pkkey;
                if (!seenNestedKinks.has(kinkName)) {
                    klists.get(pk)?.push(new CharacterProfileDetailKinkItemViewModel(
                        kinkName,
                        StringUtils.unescapeHTMLFull(ksi?.description ?? pkkey),
                        false,
                        myProfile.kinks.getByName(CompatibilityCalculator.getCounterKinkName(ksi?.name ?? "", rkl))?.prefType ?? null
                    ));
                }
            }
        }

        // insert custom kinks
        for (let klist of klists.values()) {
            if (profileInfo.customs_first) {
                klist.sort((a, b) => {
                    if (a.isCustomKink && !b.isCustomKink) return -1;
                    if (!a.isCustomKink && b.isCustomKink) return 1;

                    return (a.name < b.name) ? -1 : ((a.name == b.name) ? 0 : 1);
                });
            }
            else {
                klist.sort((a, b) => (a.name < b.name) ? -1 : ((a.name == b.name) ? 0 : 1));
            }
        }

        // TODO: insert subkinks
        this.favorites.push(...klists.get("fave")!);
        this.yes.push(...klists.get("yes")!);
        this.maybe.push(...klists.get("maybe")!);
        this.no.push(...klists.get("no")!);
    }

    @observableProperty
    favorites: Collection<CharacterProfileDetailKinkItemViewModel> = new Collection();

    @observableProperty
    yes: Collection<CharacterProfileDetailKinkItemViewModel> = new Collection();

    @observableProperty
    maybe: Collection<CharacterProfileDetailKinkItemViewModel> = new Collection();

    @observableProperty
    no: Collection<CharacterProfileDetailKinkItemViewModel> = new Collection();
}
