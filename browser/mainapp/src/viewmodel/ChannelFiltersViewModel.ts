import { RawSavedChatStateNamedFilterEntry, RawSavedChatStateNamedFilterMap, SavedChatStateJoinedChannelMap } from "../settings/AppSettings";
import { IterableUtils } from "../util/IterableUtils";
import { ObservableValue } from "../util/Observable";
import { ObservableBase, observableProperty } from "../util/ObservableBase";
import { Collection } from "../util/ObservableCollection";
import { ObservableExpression } from "../util/ObservableExpression";
import { ChannelViewModel } from "./ChannelViewModel";

export class ChannelFiltersViewModel extends ObservableBase {
    constructor(public readonly channelViewModel: ChannelViewModel) {
        super();

        this._fcExpr = new ObservableExpression(
            () => IterableUtils.asQueryable(this.selectedFilter?.selectedCategories ?? []).select(x => x.code).toArray(),
            (v) => { this.channelViewModel.showFilterClasses = v ?? []; },
            (err) => { }
        );
        this._updateExpr = new ObservableExpression(
            () => {
                const res: RawSavedChatStateNamedFilterMap = [];
                for (let y of this.namedFilters) {
                    const isSelected = this.selectedFilter == y;
                    const item: RawSavedChatStateNamedFilterEntry = {
                        isSelected: isSelected,
                        filterClasses: IterableUtils.asQueryable(y.selectedCategories).select(x => x.code).toArray(),
                        name: y.name
                    };
                    res.push(item);
                }
                return res;
            },
            (v) => { this.sccData = v ?? null; },
            (err) => { }
        )
    }

    private readonly _fcExpr: ObservableExpression<string[]>;
    private readonly _updateExpr: ObservableExpression<RawSavedChatStateNamedFilterMap>;

    @observableProperty
    readonly availableCategories: Collection<ChannelFiltersCategoryViewModel> = new Collection();

    @observableProperty
    readonly namedFilters: Collection<ChannelNamedFilterViewModel> = new Collection();

    @observableProperty
    selectedFilter: ChannelNamedFilterViewModel | null = null;

    @observableProperty
    sccData: RawSavedChatStateNamedFilterMap | null = null;

    addCategory(code: string, title: string, description: string) {
        const f = new ChannelFiltersCategoryViewModel(code, title, description);
        this.availableCategories.add(f);
        return f;
    }
    addNamedFilter(name: string, selectedCategories: string[]) {
        const nf = new ChannelNamedFilterViewModel(this);
        nf.name = name;
        for (let sc of selectedCategories) {
            for (let cc of this.availableCategories) {
                if (cc.code == sc) {
                    nf.selectedCategories.add(cc);
                    break;
                }
            }
        }
        this.namedFilters.add(nf);
        return nf;
    }

    loadFromSCC(scc: RawSavedChatStateNamedFilterMap | null, populateDefault: () => any) {
        let selectedNf: ChannelNamedFilterViewModel | null = null;
        if (scc) {
            for (let e of scc) {
                const nf = this.addNamedFilter(e.name, e.filterClasses);
                if (e.isSelected) {
                    selectedNf = nf;
                }
            }
            if (selectedNf) {
                this.selectedFilter = selectedNf;
            }
            else {
                this.selectedFilter = this.namedFilters[0] ?? null;
            }
        }
        else {
            populateDefault();
        }
    }

    moveUp() {
        if (this.selectedFilter) {
            const sf = this.selectedFilter;
            const selIdx = this.namedFilters.indexOf(sf);
            if (selIdx > 0) {
                this.namedFilters.removeAt(selIdx);
                this.namedFilters.addAt(sf, selIdx - 1);
            }
            this.selectedFilter = sf;
        }
    }
    moveDown() {
        if (this.selectedFilter) {
            const sf = this.selectedFilter;
            const selIdx = this.namedFilters.indexOf(sf);
            if (selIdx < (this.namedFilters.length - 1)) {
                this.namedFilters.removeAt(selIdx);
                this.namedFilters.addAt(sf, selIdx + 1);
            }
            this.selectedFilter = sf;
        }
    }
    addTab() {
        const nf = new ChannelNamedFilterViewModel(this);
        nf.name = "New Filter";
        for (let sc of this.availableCategories) {
            nf.selectedCategories.add(sc);
        }
        this.namedFilters.add(nf);
        this.selectedFilter = nf;
        return nf;
    }
    deleteTab() {
        if (this.selectedFilter && this.namedFilters.length > 1) {
            const sf = this.selectedFilter;
            const selIdx = this.namedFilters.indexOf(sf);
            this.namedFilters.removeAt(selIdx);
            if (this.namedFilters.length > selIdx) {
                this.selectedFilter = this.namedFilters[selIdx]!;
            }
            else if (this.namedFilters.length > 0) {
                this.selectedFilter = this.namedFilters[this.namedFilters.length - 1]!;
            }
            else {
                this.selectedFilter = null;
            }
        }
    }
}

export class ChannelFiltersCategoryViewModel extends ObservableBase {
    constructor(
        public readonly code: string,
        public readonly title: string,
        public readonly description: string) {
        
        super();
    }
}

export class ChannelNamedFilterViewModel extends ObservableBase {
    constructor(public readonly filtersSet: ChannelFiltersViewModel) {
        super();
    }

    @observableProperty
    name: string = "Untitled";

    @observableProperty
    readonly selectedCategories: Collection<ChannelFiltersCategoryViewModel> = new Collection();

    toggleCategory(c: ChannelFiltersCategoryViewModel, shouldHave: boolean) {
        if (shouldHave) {
            if (!this.selectedCategories.contains(c)) {
                this.selectedCategories.add(c);
            }
        }
        else {
            if (this.selectedCategories.contains(c)) {
                this.selectedCategories.remove(c);
            }
        }
    }
}