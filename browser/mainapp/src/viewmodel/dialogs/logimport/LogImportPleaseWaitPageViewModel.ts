import { CancellationToken } from "../../../util/CancellationTokenSource";
import { ObservableBase } from "../../../util/ObservableBase";
import { Collection } from "../../../util/ObservableCollection";
import { DialogButtonViewModel } from "../DialogViewModel";
import { LogImportPageViewModel } from "./LogImportPageViewModel";
import { LogImportViewModel } from "./LogImportViewModel";


export class LogImportPleaseWaitPageViewModel extends ObservableBase implements LogImportPageViewModel {
    constructor(
        public readonly logImportViewModel: LogImportViewModel) {

        super();
    }

    readonly buttons: Collection<DialogButtonViewModel> = new Collection<DialogButtonViewModel>();
    readonly canClose: boolean = true;

    async waitForResponseAsync(cancellationToken: CancellationToken): Promise<any> {
        return null;
    }
}
