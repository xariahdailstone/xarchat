import { KinkList } from "../../fchat/api/FListApi";

export class RichKinkList {
    private static SYM_RKL = Symbol();

    static create(kl: KinkList) {
        let existingKL = (kl as any)[this.SYM_RKL];
        if (!existingKL) {
            existingKL = new RichKinkList(kl);
            (kl as any)[this.SYM_RKL] = existingKL;
        }
        return existingKL;
    }

    private constructor(kl: KinkList) {
        for (let gk of Object.getOwnPropertyNames(kl)) {
            const klg = kl[gk];
            const richGroup = new RichKinkListGroupImpl(this, +gk, klg.group);
            this._groups.set(+gk, richGroup);
            for (let k of klg.items) {
                const item = new RichKinkListItemImpl(this, richGroup, k.kink_id, k.name, k.description);
                richGroup.add(item);
                this._kinks.set(k.kink_id, item);
            }
        }
    }

    private readonly _groups: Map<number, RichKinkListGroup> = new Map();
    private readonly _kinks: Map<number, RichKinkListItem> = new Map();

    getGroupById(groupId: number) { return this._groups.get(groupId) ?? null; }
    getGroupByName(groupName: string) {
        for (let g of this._groups.values()) {
            if (g.name == groupName) { return g; }
        }
        return null;
    }

    getKinkById(kinkId: number) { return this._kinks.get(kinkId) ?? null; }
    getKinkByName(kinkName: string) {
        for (let k of this._kinks.values()) {
            if (k.name == kinkName) { return k; }
        }
        return null;
    }

    get groups() { return this._groups.values(); }

    get kinks() { return this._kinks.values(); }
}

export interface RichKinkListGroup {
    readonly id: number;
    readonly name: string;

    readonly kinks: Iterable<RichKinkListItem>;
}

class RichKinkListGroupImpl implements RichKinkListGroup {
    constructor(
        private readonly richKinkList: RichKinkList, 
        public readonly id: number, 
        public readonly name: string) {
    }

    private _kinks: RichKinkListItemImpl[] = [];

    add(item: RichKinkListItemImpl) {
        this._kinks.push(item);
    }

    get kinks() { return this._kinks; }
}

export interface RichKinkListItem {
    readonly kinkGroup: RichKinkListGroup;
    readonly id: number;
    readonly name: string;
    readonly description: string;
}

class RichKinkListItemImpl implements RichKinkListItem {
    constructor(
        private readonly richKinkList: RichKinkList, 
        public readonly kinkGroup: RichKinkListGroup,
        public readonly id: number, 
        public readonly name: string,
        public readonly description: string) {
    }
}