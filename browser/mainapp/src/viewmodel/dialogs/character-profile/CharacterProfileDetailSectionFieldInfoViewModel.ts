import { ObservableBase, observableProperty } from "../../../util/ObservableBase";


export class CharacterProfileDetailSectionFieldInfoViewModel extends ObservableBase {
    constructor(label: string, value: string) {
        super();
        this.label = label;
        this.value = value;
    }

    @observableProperty
    label: string;

    @observableProperty
    value: string;
}
