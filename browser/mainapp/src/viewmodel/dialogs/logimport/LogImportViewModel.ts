import { CancellationToken, CancellationTokenSource } from "../../../util/CancellationTokenSource";
import { IDisposable, maybeDispose } from "../../../util/Disposable";
import { HostInterop } from "../../../util/hostinterop/HostInterop";
import { CalculatedObservable, Observable } from "../../../util/Observable";
import { ObservableBase, observableProperty } from "../../../util/ObservableBase";
import { Collection } from "../../../util/ObservableCollection";
import { AppViewModel } from "../../AppViewModel";
import { DialogButtonViewModel, DialogViewModel } from "../DialogViewModel";
import { ChatLogImportWorkflowShowMessageStepArgs } from "./ChatLogImportWorkflowShowMessageStepArgs";
import { LogImportPageViewModel } from "./LogImportPageViewModel";
import { LogImportPleaseWaitPageViewModel } from "./LogImportPleaseWaitPageViewModel";
import { LogImportSelectImportPageViewModel } from "./LogImportSelectImportPageViewModel";
import { LogImportShowMessagePageViewModel } from "./LogImportShowMessagePageViewModel";

export class LogImportViewModel extends DialogViewModel<number> implements IDisposable {
    constructor(
        private readonly appViewModel: AppViewModel) {

        super(appViewModel);

        this.title = "Log Import";

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

    get closeBoxResult() {
        return Observable.calculate("LogImportViewModel.closeBoxResult", () => {
            return (this.currentPage?.canClose ?? true) ? -1 : undefined;
        });
    }

    private _currentPage: LogImportPageViewModel = null!;
    @observableProperty
    get currentPage(): LogImportPageViewModel { return this._currentPage; }
    set currentPage(value: LogImportPageViewModel) {
        if (value == null || !this._disposedCTS.isCancellationRequested) {
            if (value != this._currentPage) {
                const oldPage = this._currentPage;
                maybeDispose(oldPage);
                this.buttons = value?.buttons ?? new Collection<DialogButtonViewModel>();
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

