import { observableProperty } from "../../../util/ObservableBase";
import { AppViewModel } from "../../AppViewModel";
import { LogImportViewModel } from "../../logimport/LogImportViewModel";
import { DialogViewModel } from "../DialogViewModel";

export class LogImportDisplayViewModel extends DialogViewModel<number> {
    constructor(parent: AppViewModel) {
        super(parent);

        // TODO:
        this.title = "Log Import";
        this.closeBoxResult = -1;
        this.logImportViewModel = new LogImportViewModel(parent);
    }

    @observableProperty
    logImportViewModel: LogImportViewModel;

    onClosed(): void {
        this.logImportViewModel.dispose();
    }
}