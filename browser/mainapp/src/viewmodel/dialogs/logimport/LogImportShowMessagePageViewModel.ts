import { CancellationToken } from "../../../util/CancellationTokenSource";
import { Observable } from "../../../util/Observable";
import { ObservableBase, observableProperty } from "../../../util/ObservableBase";
import { LogImportPageViewModel } from "./LogImportPageViewModel";
import { LogImportViewModel } from "./LogImportViewModel";
import { ChatLogImportWorkflowShowMessageStepArgs } from "./ChatLogImportWorkflowShowMessageStepArgs";
import { Collection } from "../../../util/ObservableCollection";
import { DialogButtonViewModel } from "../DialogViewModel";
import { PromiseSource } from "../../../util/PromiseSource";


export class LogImportShowMessagePageViewModel extends ObservableBase implements LogImportPageViewModel {
    constructor(
        public readonly logImportViewModel: LogImportViewModel,
        public readonly data: ChatLogImportWorkflowShowMessageStepArgs) {

        super();

        for (let dbtn of data.buttons) {
            this.buttons.push(new DialogButtonViewModel({
                title: dbtn.title,
                onClick: () => {
                    this.resultPS.tryResolve(dbtn.result);
                }
            }));
        }
    }

    readonly buttons: Collection<DialogButtonViewModel> = new Collection<DialogButtonViewModel>();
    readonly canClose: boolean = true;

    readonly resultPS = new PromiseSource<string>();

    async waitForResponseAsync(cancellationToken: CancellationToken): Promise<string> {
        const result = await this.resultPS.promise;
        return result;
    }
}
