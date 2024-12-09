import { InfoTags, KinkPrefType, ProfileFieldsSectionListItemType, ProfileInfo } from "../../fchat/api/FListApi";
import { RichInfoTagDefField, RichInfoTagDefList } from "./RichInfoTagDefList";
import { RichKinkList, RichKinkListItem } from "./RichKinkList";
import { RichMappingDef, RichMappingListListItem } from "./RichMappingDef";

export class Profile implements Omit<ProfileInfo, "kinks" | "infotags"> {
    constructor(
        private readonly pi: ProfileInfo,
        private readonly richKinkList: RichKinkList,
        private readonly richInfoTagDefList: RichInfoTagDefList,
        private readonly richMappingDef: RichMappingDef)
    {
        this.kinks = new ProfileKinkSet(this, pi.kinks, richKinkList);
        this.infotags = new ProfileInfoTagSet(this, pi.infotags, richInfoTagDefList, richMappingDef);
    }

    get badges() { return this.pi.badges; }
    get character_list() { return this.pi.character_list; }
    get created_at() { return this.pi.created_at; }
    get custom_kinks() { return this.pi.custom_kinks; }
    get custom_title() { return this.pi.custom_title; }
    get customs_first() { return this.pi.customs_first; }
    get description() { return this.pi.description; }
    get id() { return this.pi.id; }
    get images() { return this.pi.images; }
    get inlines() { return this.pi.inlines; }
    get is_self() { return this.pi.is_self; }
    get memo() { return this.pi.memo; }
    get name() { return this.pi.name; }
    get settings() { return this.pi.settings; }
    get updated_at() { return this.pi.updated_at; }
    get views() { return this.pi.views; }

    readonly kinks: ProfileKinkSet;
    readonly infotags: ProfileInfoTagSet;
}

export class ProfileKinkSet {
    constructor(
        public readonly profile: Profile,
        private readonly pi: { [id: string]: KinkPrefType } | void[],
        private readonly rkl: RichKinkList) {
    }

    getById(id: number) {
        if (this.pi instanceof Array) { return null; }

        const idStr = id.toString();
        const tki = this.pi[idStr];
        if (tki) {
            const ki = this.rkl.getKinkById(id)!;
            const result: ProfileKinkEntry = {
                def: ki,
                prefType: tki
            };
            return result;
        }
        else {
            return null;
        }
    }

    getByName(name: string) {
        if (this.pi instanceof Array) { return null; }

        for (let k of this.values()) {
            if (k.def.name == name) {
                return k;
            }
        }
        return null;
    }

    *values() {
        if (this.pi instanceof Array) { return null; }

        for (let k of Object.getOwnPropertyNames(this.pi)) {
            const ki = this.rkl.getKinkById(+k)!;
            const result: ProfileKinkEntry = {
                def: ki,
                prefType: this.pi[k]
            };
            yield result;
        }
    }
}

export interface ProfileKinkEntry {
    def: RichKinkListItem;
    prefType: KinkPrefType;
}

export class ProfileInfoTagSet {
    constructor(
        public readonly profile: Profile,
        private readonly its: InfoTags | void[],
        private readonly richInfoTagDefList: RichInfoTagDefList,
        private readonly richMappingDef: RichMappingDef) {

        this.buildValues();
    }

    private readonly _entriesById: Map<number, ProfileInfoTagEntry> = new Map();
    private readonly _entriesByName: Map<string, ProfileInfoTagEntry> = new Map();

    getById(id: number) {
        return this._entriesById.get(id) ?? null;
    }

    getByName(name: string) {
        return this._entriesByName.get(name) ?? null;
    }

    values() {
        return this._entriesById.values();
    }

    private buildValues() {
        if (this.its instanceof Array) { return; }

        for (let k of Object.getOwnPropertyNames(this.its)) {
            const def = this.richInfoTagDefList.getFieldById(+k)!;
            if (def.type == "text") {
                const result: ProfileInfoTagEntry = {
                    def: def,
                    value: this.its[k],
                    valueString: this.its[k]
                };
                this._entriesById.set(+k, result);
                this._entriesByName.set(def.name, result);
            }
            else if (def.type == "list") {
                const li = this.richMappingDef.listitems.getById(+this.its[k])!;
                const result: ProfileInfoTagEntry = {
                    def: def,
                    value: li,
                    valueString: li.value
                };
                this._entriesById.set(+k, result);
                this._entriesByName.set(def.name, result);
            }
        }
    }
}

export interface ProfileInfoTagEntry {
    def: RichInfoTagDefField;
    value: string | RichMappingListListItem;
    valueString: string;
}