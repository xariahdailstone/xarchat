import { ObservableBase, observableProperty } from "../util/ObservableBase";
import { Collection } from "../util/ObservableCollection";

export class ChannelFiltersViewModel extends ObservableBase {

    @observableProperty
    readonly categories: Collection<ChannelFiltersCategoryViewModel> = new Collection();

    @observableProperty
    readonly namedFilters: Collection<ChannelNamedFilterViewModel> = new Collection();

    @observableProperty
    selectedFilter: ChannelNamedFilterViewModel | null = null;
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

}