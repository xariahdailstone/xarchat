import { CharacterBadge, CustomKinkInfo, ImageInfo, InfoTags, InlineInfo, KinkList, KinkPrefType, MappingList, MemoInfo, ProfileDisplaySettings, ProfileFieldsInfoList, ProfileInfo } from "../fchat/api/FListApi";
import { Profile } from "./profile/Profile";
import { RichInfoTagDefListImpl } from "./profile/RichInfoTagDefList";
import { RichKinkList } from "./profile/RichKinkList";
import { RichMappingDefImpl } from "./profile/RichMappingDef";

const SFX_GIVING = " (Giving)";
const SFX_RECEIVING = " (Receiving)";
const SFX_PRED = " (Being Predator)";
const SFX_PREY = " (Being Prey)";

export class CompatibilityCalculator {

    static getCounterKinkName(kinkName: string, kinkList: RichKinkList): string {
        const tryMatchBySuffix = (a: string, b: string) => {
            if (kinkName.endsWith(a)) {
                const bareName = kinkName.substring(0, kinkName.length - a.length);
                const maybeCounterKinkName = bareName + b;
                if (kinkList.getKinkByName(maybeCounterKinkName)) {
                    return maybeCounterKinkName
                }
            }    
            return null;
        }

        if (tryMatchBySuffix(SFX_GIVING, SFX_RECEIVING)) {
            return tryMatchBySuffix(SFX_GIVING, SFX_RECEIVING)!;
        }
        if (tryMatchBySuffix(SFX_RECEIVING, SFX_GIVING)) {
            return tryMatchBySuffix(SFX_RECEIVING, SFX_GIVING)!;
        }
        if (tryMatchBySuffix(SFX_PRED, SFX_PREY)) {
            return tryMatchBySuffix(SFX_PRED, SFX_PREY)!;
        }
        if (tryMatchBySuffix(SFX_PREY, SFX_PRED)) {
            return tryMatchBySuffix(SFX_PREY, SFX_PRED)!;
        }
        
        return kinkName;
    }

    static calculate(myPI: ProfileInfo, counterpartyPI: ProfileInfo, kinkList: KinkList, infotags: ProfileFieldsInfoList, mappingList: MappingList): number | null {
        const rkl = RichKinkList.create(kinkList);
        const rirl = RichInfoTagDefListImpl.create(infotags);
        const rmd = RichMappingDefImpl.create(mappingList);

        const myProfile = new Profile(myPI, rkl, rirl, rmd);
        const counterpartyProfile = new Profile(counterpartyPI, rkl, rirl, rmd);

        let compatAccum = 0;
        let totalAccum = 0;
        for (let cpk of counterpartyProfile.kinks.values()) {
            // TODO: handle custom comparator
            if (false) {
            }
            else {
                const mk = myProfile.kinks.getByName(this.getCounterKinkName(cpk.def.name, rkl));
                //const mk = myProfile.kinks.getById(cpk.kink_id);
                if (mk) {
                    let compat: number = 0;
                    let weight: number = 0;
                    const comparePair = [cpk.prefType, mk.prefType].join(".");
                    switch (comparePair) {
                        case "fave.fave":
                            compat = 1;
                            weight = 3;
                            break;

                        case "fave.yes":
                        case "yes.fave":
                            compat = 1;
                            weight = 2;
                            break;

                        case "fave.maybe":
                        case "maybe.fave":
                            compat = 0.5;
                            weight = 0.2;
                            break;

                        case "fave.no":
                        case "no.fave":
                            compat = 0;
                            weight = 0.5;
                            break;

                        case "yes.yes":
                            compat = 1;
                            weight = 1.5;

                        case "yes.maybe":
                        case "maybe.yes":
                            compat = 0.5;
                            weight = 0.2;

                        case "yes.no":
                        case "no.yes":
                            compat = 0;
                            weight = 0.4;
                            break;
                        
                        case "maybe.maybe":
                            compat = 0.8;
                            weight = 0.1;
                            break;

                        case "maybe.no":
                        case "no.maybe":
                            compat = 0;
                            weight = 0.1;
                            break;

                        case "no.no":
                            compat = 1;
                            weight = 0;
                            break;
                    }

                    compatAccum += (compat * weight);
                    totalAccum += (1 * weight);
                }
            }
        }

        const totalCompatibility = (totalAccum > 0) ? (compatAccum / totalAccum) : null;
        return totalCompatibility;
    }
}
