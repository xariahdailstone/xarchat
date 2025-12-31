import { CancellationToken } from "../../../util/CancellationTokenSource";
import { Collection } from "../../../util/ObservableCollection";
import { DialogButtonViewModel } from "../DialogViewModel";
import { LogImportViewModel } from "./LogImportViewModel";


export interface LogImportPageViewModel {
    readonly logImportViewModel: LogImportViewModel;

    readonly buttons: Collection<DialogButtonViewModel>;
    readonly canClose: boolean;

    waitForResponseAsync(cancellationToken: CancellationToken): Promise<any>;
}
