import { ConfigSchemaItemDefinitionItem } from "../../configuration/ConfigSchemaItem";
import { ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { AppViewModel, DataCollectionOptInPair } from "../AppViewModel";
import { DialogButtonStyle, DialogButtonViewModel, DialogViewModel } from "./DialogViewModel";

export class DataCollectionOptInDialogViewModel extends DialogViewModel<boolean> {
    constructor(parent: AppViewModel,
        items: DataCollectionOptInPair[]) {

        super(parent);

        this.reviewItems = items.map(x => new DataCollectionOptInLineItemViewModel(parent, x));

        this.title = "Review New Settings";
        this.closeBoxResult = undefined;
        this.buttons.add(new DialogButtonViewModel({
            title: "Review Later",
            style: DialogButtonStyle.CANCEL,
            onClick: () => {
                this.close(false);
            }
        }));

        this.buttons.add(new DialogButtonViewModel({
            title: "Done",
            style: DialogButtonStyle.NORMAL,
            onClick: () => {
                this.close(true);
            }
        }));
    }

    readonly reviewItems: DataCollectionOptInLineItemViewModel[];

    enableAll() {
        for (let i of this.reviewItems) {
            i.enabled = true;
        }
    }

    disableAll() {
        for (let i of this.reviewItems) {
            i.enabled = false;
        }
    }
}


export class DataCollectionOptInLineItemViewModel extends ObservableBase {
    constructor(
        private readonly appViewModel: AppViewModel,
        optInPair: DataCollectionOptInPair) {

        super();

        this.title = optInPair.actualSettingItem.title;
        this.description = optInPair.actualSettingItem.description;
        this.moreInfo = optInPair.actualSettingItem.moreInfo;
    }

    readonly title: string;
    readonly description: string | undefined;
    readonly moreInfo: string | undefined;

    private readonly _enabled: ObservableValue<boolean> = new ObservableValue(false);
    
    get enabled() { return this._enabled.value; }
    set enabled(value: boolean) { this._enabled.value = value; }
}