import { InfotagGroupListItem, InfotagListItem, KinkGroupListItem, KinkListItem, ListItemsListItem, MappingList } from "../../fchat/api/FListApi";

export interface RichMappingDef {
    readonly kinks: RichMappingList<RichMappingListKinkItem>;
    readonly kink_groups: RichMappingList<RichMappingListKinkGroupItem>
    readonly infotags: RichMappingList<RichMappingListInfotagItem>;
    readonly infotag_groups: RichMappingList<RichMappingListInfotagGroupItem>;
    readonly listitems: RichMappingList<RichMappingListListItem>;
}
export interface RichMappingList<T extends RichMappingListItem> {
    getById(id: number): T | null;
    getByName(name: string): T | null;
}
export interface RichMappingListItem {
    readonly id: number;
    readonly name: string;
}

export interface RichMappingListKinkItem extends RichMappingListItem {
    readonly description: string;
    readonly group: RichMappingListKinkGroupItem;
}
export interface RichMappingListKinkGroupItem extends RichMappingListItem {
    items(): Iterable<RichMappingListKinkItem>;
}
export interface RichMappingListInfotagItem extends RichMappingListItem {
    readonly type: "text" | "list";
    readonly list: RichMappingListList;
    readonly group: RichMappingListInfotagGroupItem;
}
export interface RichMappingListInfotagGroupItem extends RichMappingListItem {
    items(): Iterable<RichMappingListInfotagItem>;
}
export interface RichMappingListListItem extends RichMappingListItem {
    readonly value: string;
    readonly list: RichMappingListList;
}

export interface RichMappingListList {
    readonly name: string;
    items(): Iterable<RichMappingListListItem>;
}


export class RichMappingDefImpl implements RichMappingDef {
    private static SYM_RML = Symbol();

    static create(mappingList: MappingList) {
        let ml = (mappingList as any)[this.SYM_RML];
        if (ml == null) {
            ml = new RichMappingDefImpl(mappingList);
            (mappingList as any)[this.SYM_RML] = ml;
        }
        return ml;
    }

    private constructor(mappingList: MappingList) {
        const owner = this;

        const kg = new Map<number, RichMappingListKinkGroupItem>();
        const kgi = new Map<number, RichMappingListKinkItem[]>();

        this.kink_groups = new RichMappingListImpl<KinkGroupListItem, RichMappingListKinkGroupItem>(mappingList.kink_groups, kgli => {
            const result: RichMappingListKinkGroupItem = {
                id: +kgli.id,
                name: kgli.name,
                *items() {
                    for (var item of kgi.get(this.id)!) {
                        yield item;
                    }
                }
            };
            kg.set(result.id, result);
            return result;
        });

        this.kinks = new RichMappingListImpl<KinkListItem, RichMappingListKinkItem>(mappingList.kinks, kli => {
            const group = kg.get(+kli.group_id)!;
            const result: RichMappingListKinkItem = {
                id: +kli.id,
                name: kli.name,
                description: kli.description,
                group: group
            };
            kgi.set(group.id, [ ...(kgi.get(group.id) ?? []), result ]);
            return result;
        });


        const lists = new Map<string, RichMappingListList>();
        const listitems = new Map<string, RichMappingListListItem[]>();
        this.listitems = new RichMappingListImpl<ListItemsListItem, RichMappingListListItem>(mappingList.listitems, lili => {
            if (!lists.has(lili.name)) {
                const l: RichMappingListList = {
                    name: lili.name,
                    items() {
                        return listitems.get(this.name)!;
                    },
                };
                lists.set(lili.name, l);
            }

            const result: RichMappingListListItem = {
                id: +lili.id,
                name: lili.name,
                value: lili.value,
                list: lists.get(lili.name)!
            };
            listitems.set(lili.name, [ ...(listitems.get(lili.name) ?? []), result ]);
            return result;
        });


        const it = new Map<number, RichMappingListInfotagGroupItem>();
        const iti = new Map<number, RichMappingListInfotagItem[]>();

        this.infotag_groups = new RichMappingListImpl<InfotagGroupListItem, RichMappingListInfotagGroupItem>(mappingList.infotag_groups, igli => {
            const result: RichMappingListInfotagGroupItem = {
                id: +igli.id,
                name: igli.name,
                *items() {
                    for (var item of iti.get(this.id)!) {
                        yield item;
                    }
                }
            };
            it.set(result.id, result);
            return result;
        });

        this.infotags = new RichMappingListImpl<InfotagListItem, RichMappingListInfotagItem>(mappingList.infotags, ili => {
            const group = it.get(+ili.group_id)!;
            const result: RichMappingListInfotagItem = {
                id: +ili.id,
                name: ili.name,
                type: ili.type,
                list: lists.get(ili.name)!,
                group: group
            };
            iti.set(group.id, [ ...(iti.get(group.id) ?? []), result ]);
            return result;
        });
    }

    readonly kinks: RichMappingList<RichMappingListKinkItem>;
    readonly kink_groups: RichMappingList<RichMappingListKinkGroupItem>
    readonly infotags: RichMappingList<RichMappingListInfotagItem>;
    readonly infotag_groups: RichMappingList<RichMappingListInfotagGroupItem>;
    readonly listitems: RichMappingList<RichMappingListListItem>;
}

class RichMappingListImpl<TInner, TOuter extends RichMappingListItem> implements RichMappingList<TOuter> {
    constructor(inner: TInner[], mapper: (item: TInner) => TOuter) {
        for (let item of inner) {
            const citem = mapper(item);
            this._itemsById.set(citem.id, citem);
            this._itemsByName.set(citem.name, citem);
        }
    }

    private readonly _itemsById: Map<number, TOuter> = new Map();
    private readonly _itemsByName: Map<string, TOuter> = new Map();

    getById(id: number): TOuter | null {
        return this._itemsById.get(id) ?? null;
    }

    getByName(name: string): TOuter | null {
        return this._itemsByName.get(name) ?? null;
    }
}