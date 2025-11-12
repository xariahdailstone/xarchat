import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { AppViewModel } from "../AppViewModel";
import { DialogViewModel } from "./DialogViewModel";

export class DataSharingSettingsViewModel extends DialogViewModel<boolean> {
    constructor(private readonly appViewModel: AppViewModel) {
        super(appViewModel);

        this.originalEiconDataSharing = (appViewModel.getConfigSettingById("dataSharing.eicons") as (boolean | null | undefined)) ?? null;
        this.eiconDataSharing = this.originalEiconDataSharing ?? false;
    }

    @observableProperty
    showingOnLogin: boolean = false;

    @observableProperty
    originalEiconDataSharing: (boolean | null) = null;

    @observableProperty
    eiconDataSharing: boolean = false;

    override close(result: boolean) {
        super.close(result);

        if (result == true) {
            this.appViewModel.setConfigSettingById("dataSharing.eicons", this.eiconDataSharing ?? false);
        }
    }
}