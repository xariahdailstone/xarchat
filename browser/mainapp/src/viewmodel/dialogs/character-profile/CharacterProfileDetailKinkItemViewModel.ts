import { KinkPrefType } from "../../../fchat/api/FListApi";
import { ObservableBase, observableProperty } from "../../../util/ObservableBase";
import { Collection } from "../../../util/ObservableCollection";


export class CharacterProfileDetailKinkItemViewModel extends ObservableBase {
    constructor(name: string, tooltip: string, isCustomKink: boolean, myKinkRating: KinkPrefType | null, subkinks?: Iterable<CharacterProfileDetailKinkItemViewModel>) {
        super();

        this.name = name;
        this.tooltip = tooltip;
        this.isCustomKink = isCustomKink;
        this.myKinkRating = myKinkRating;
        if (subkinks) {
            this.subkinks = new Collection<CharacterProfileDetailKinkItemViewModel>();
            for (let sk of subkinks) {
                this.subkinks.push(sk);
            }
        }
    }

    @observableProperty
    name: string;

    @observableProperty
    tooltip: string | null = null;

    @observableProperty
    isCustomKink: boolean = false;

    @observableProperty
    myKinkRating: KinkPrefType | null;

    @observableProperty
    subkinks: (Collection<CharacterProfileDetailKinkItemViewModel> | null) = null;
}
