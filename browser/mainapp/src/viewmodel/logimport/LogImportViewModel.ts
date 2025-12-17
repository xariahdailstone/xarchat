import { CancellationToken, CancellationTokenSource } from "../../util/CancellationTokenSource";
import { IDisposable, maybeDispose } from "../../util/Disposable";
import { HostInterop } from "../../util/hostinterop/HostInterop";
import { CalculatedObservable, Observable } from "../../util/Observable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { AppViewModel } from "../AppViewModel";

export class LogImportViewModel extends ObservableBase implements IDisposable {
    constructor(
        private readonly appViewModel: AppViewModel) {

        super();
        this.currentPage = new LogImportPleaseWaitPageViewModel(this);

        this.runImportWorkflowAsync(this._disposedCTS.token);
    }

    private _disposedCTS: CancellationTokenSource = new CancellationTokenSource();
    private _isDisposed: boolean = false;
    get isDisposed(): boolean { return this._isDisposed; }

    dispose(): void {
        this._disposedCTS.cancel();
        this.currentPage = null!;
    }

    [Symbol.dispose](): void { this.dispose(); }

    private _currentPage: LogImportPageViewModel = null!;
    @observableProperty
    get currentPage(): LogImportPageViewModel { return this._currentPage; }
    set currentPage(value: LogImportPageViewModel) {
        if (value == null || !this._disposedCTS.isCancellationRequested) {
            if (value != this._currentPage) {
                const oldPage = this._currentPage;
                maybeDispose(oldPage);
            }
        }
        else {
            maybeDispose(value);
        }
    }

    private async runImportWorkflowAsync(cancellationToken: CancellationToken) {
        try {
            const selectedImporter = await this.selectImporterAsync(cancellationToken);

            this.currentPage = new LogImportPleaseWaitPageViewModel(this);

            await HostInterop.logImport.executeImporterFlowAsync(
                selectedImporter,
                cancellationToken,
                async (stepName: string, stepBody: any) => {

                    switch (stepName) {
                        case "ChatLogImportWorkflowShowMessageStep":
                            this.currentPage = this.createShowMessageViewModel(stepBody);
                            break;
                        default:
                            throw new Error(`unknown step type: ${stepName}`);
                    }

                    const resp = await this.currentPage.waitForResponseAsync(cancellationToken);
                    this.currentPage = new LogImportPleaseWaitPageViewModel(this);
                    return resp;
                });
        }
        catch (e) {
            this.currentPage = this.createShowMessageViewModel({
                title: "Import Process Failed",
                body: "The import process failed with an unexpected error.",
                buttons: []
            });
        }
    }

    private async selectImporterAsync(cancellationToken: CancellationToken): Promise<string> {
        const importerSelectVM = await LogImportSelectImportPageViewModel.createAsync(this, cancellationToken);
        this.currentPage = importerSelectVM;
        const result = await importerSelectVM.waitForResponseAsync(cancellationToken);
        return result;
    }

    private createShowMessageViewModel(args: ChatLogImportWorkflowShowMessageStepArgs): LogImportShowMessagePageViewModel {
        return new LogImportShowMessagePageViewModel(this, args);
    }
}

export interface LogImportPageViewModel {
    readonly logImportViewModel: LogImportViewModel;

    waitForResponseAsync(cancellationToken: CancellationToken): Promise<any>;
}

export class LogImportPleaseWaitPageViewModel extends ObservableBase implements LogImportPageViewModel {
    constructor(
        public readonly logImportViewModel: LogImportViewModel) {

        super();
    }

    async waitForResponseAsync(cancellationToken: CancellationToken): Promise<any> {
        return null;
    }
}

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

    @observableProperty
    selectedImporter: string | null = null;

    async waitForResponseAsync(cancellationToken: CancellationToken): Promise<string> {
        const selectedImporter = await Observable.waitForChangeAsync(() => this.selectedImporter, null, cancellationToken);
        return selectedImporter!;
    }
}

export class LogImportShowMessagePageViewModel extends ObservableBase implements LogImportPageViewModel {
    constructor(
        public readonly logImportViewModel: LogImportViewModel,
        public readonly data: ChatLogImportWorkflowShowMessageStepArgs) {

        super();
    }

    @observableProperty
    result: string | null = null;

    async waitForResponseAsync(cancellationToken: CancellationToken): Promise<string> {
        const selectedImporter = await Observable.waitForChangeAsync(() => this.result, null, cancellationToken);
        return selectedImporter!;
    }    
}


interface ChatLogImportWorkflowShowMessageStepArgs {
    readonly title: string;
    readonly body: string;
    readonly buttons: ChatLogImportWorkflowShowMessageButton[];
}
interface ChatLogImportWorkflowShowMessageButton {
    readonly title: string;
    readonly result: string;
}