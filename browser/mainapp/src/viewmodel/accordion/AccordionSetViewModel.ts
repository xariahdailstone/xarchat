import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { Collection } from "../../util/ObservableCollection";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { ChannelViewModel } from "../ChannelViewModel";

export class AccordionSetViewModel extends ObservableBase {
    constructor(
        public readonly activeLoginViewModel: ActiveLoginViewModel) {

        super();
    }

    @observableProperty
    relativeHeight: number = 1;

    @observableProperty
    order: number = 0;

    @observableProperty
    title: string = "";

    @observableProperty
    items: Collection<AccordionEntryViewModel> = new Collection();
}

export class AccordionEntryViewModel extends ObservableBase {
    
    @observableProperty
    relativeHeight: number = 1;

    @observableProperty
    order: number = 0;

    @observableProperty
    title: string = "";

    @observableProperty
    canDelete: boolean = false;

    @observableProperty
    items: Collection<AccordionCollapseGroupViewModel> = new Collection();
}

export class AccordionCollapseGroupViewModel extends ObservableBase {
    constructor(
        public readonly activeLoginViewModel: ActiveLoginViewModel) {

        super();
    }

    @observableProperty
    order: number = 0;

    @observableProperty
    collapsed: boolean = false;

    @observableProperty
    title: string = "Untitled";

    @observableProperty
    items: Collection<ChannelViewModel> = new Collection();
}