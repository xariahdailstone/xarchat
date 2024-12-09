import { InfoTags, ProfileFieldsInfoList, ProfileFieldsSectionListItemType } from "../../fchat/api/FListApi";

export interface RichInfoTagDefList {
    getGroupById(id: number): RichInfoTagDefGroup | null;
    getGroupByName(name: string): RichInfoTagDefGroup | null;

    getFieldById(id: number): RichInfoTagDefField | null;
    getFieldByName(name: string): RichInfoTagDefField | null;
}
export interface RichInfoTagDefGroup {
    readonly group_id: number;
    readonly name: string;

    fields(): Iterable<RichInfoTagDefField>;
}
export interface RichInfoTagDefField {
    readonly infotag_id: number;
    readonly name: string;
    readonly type: ProfileFieldsSectionListItemType;
    readonly list?: string[];

    readonly group: RichInfoTagDefGroup;
}

export class RichInfoTagDefListImpl implements RichInfoTagDefList {
    static SYM_RITL = Symbol();

    static create(infoTags: ProfileFieldsInfoList): RichInfoTagDefList {
        let existingKL = (infoTags as any)[this.SYM_RITL];
        if (!existingKL) {
            existingKL = new RichInfoTagDefListImpl(infoTags);
            (infoTags as any)[this.SYM_RITL] = existingKL;
        }
        return existingKL;
    }

    private readonly _groupsById: Map<number, RichInfoTagDefGroupImpl> = new Map();
    private readonly _infoTagsById: Map<number, RichInfoTagDefFieldImpl> = new Map();

    private constructor(
        private readonly infoTags: ProfileFieldsInfoList) {

        for (let gid of Object.getOwnPropertyNames(infoTags)) {
            const gobj = infoTags[gid];
            const grp = new RichInfoTagDefGroupImpl(this, +gid, gobj.group);
            for (let item of gobj.items) {
                const itobj = new RichInfoTagDefFieldImpl(this, grp, item.id, item.name, item.type, item.list);
                grp.add(itobj);
                this._infoTagsById.set(item.id, itobj);
            }
            this._groupsById.set(+gid, grp);
        }
    }

    getGroupById(id: number): RichInfoTagDefGroup | null {
        const result = this._groupsById.get(id) ?? null;
        return result;
    }

    getGroupByName(name: string): RichInfoTagDefGroup | null {
        for (let g of this._groupsById.values()) {
            if (g.name == name) {
                return g;
            }
        }
        return null;
    }

    getFieldById(id: number): RichInfoTagDefField | null {
        const result = this._infoTagsById.get(id) ?? null;
        return result;
    }

    getFieldByName(name: string): RichInfoTagDefField | null {
        for (let f of this._infoTagsById.values()) {
            if (f.name == name) {
                return f;
            }
        }
        return null;
    }
}

class RichInfoTagDefGroupImpl implements RichInfoTagDefGroup {
    constructor(
        private readonly owner: RichInfoTagDefListImpl,
        public readonly group_id: number,
        public readonly name: string) {
    }

    private readonly _items: RichInfoTagDefFieldImpl[] = [];

    add(item: RichInfoTagDefFieldImpl) {
        this._items.push(item);
    }

    fields(): Iterable<RichInfoTagDefField> {
        return this._items;
    }
}

class RichInfoTagDefFieldImpl implements RichInfoTagDefField {
    constructor(
        private readonly owner: RichInfoTagDefListImpl,
        public readonly group: RichInfoTagDefGroupImpl,
        public readonly infotag_id: number,
        public readonly name: string,
        public readonly type: ProfileFieldsSectionListItemType,
        public readonly list?: string[]) {
    }
}