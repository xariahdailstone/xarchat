import { CancellationToken } from "../../../util/CancellationTokenSource";
import { HostInterop } from "../../../util/hostinterop/HostInterop";
import { Observable } from "../../../util/Observable";
import { ObservableBase, observableProperty } from "../../../util/ObservableBase";
import { Collection } from "../../../util/ObservableCollection";
import { PromiseSource } from "../../../util/PromiseSource";
import { DialogButtonViewModel } from "../DialogViewModel";
import { LogImportPageViewModel } from "./LogImportPageViewModel";
import { LogImportViewModel } from "./LogImportViewModel";


export class LogImportSelectImportPageViewModel extends ObservableBase implements LogImportPageViewModel {
    static async createAsync(
        logImportViewModel: LogImportViewModel,
        cancellationToken: CancellationToken): Promise<LogImportSelectImportPageViewModel> {

        const availableImporters = await HostInterop.logImport.getAvailableImportersAsync(cancellationToken);
        const result = new LogImportSelectImportPageViewModel(logImportViewModel, availableImporters);
        return result;
    }

    constructor(
        public readonly logImportViewModel: LogImportViewModel,
        public readonly availableImporters: string[]) {

        super();
    }

    readonly buttons: Collection<DialogButtonViewModel> = new Collection<DialogButtonViewModel>();
    readonly canClose: boolean = true;

    @observableProperty
    selectedImporter: string | null = null;

    async waitForResponseAsync(cancellationToken: CancellationToken): Promise<string> {
        const selectedImporter = await Observable.waitForChangeAsync(() => this.selectedImporter, null, cancellationToken);
        return selectedImporter!;
    }
}
