import { CancellationToken } from "../../util/CancellationTokenSource";
import { HostInterop } from "../../util/hostinterop/HostInterop";
import { AppViewModel } from "../AppViewModel";
import { DialogButtonStyle, DialogButtonViewModel, DialogViewModel } from "./DialogViewModel";

export class LogFileMaintenanceDialogViewModel extends DialogViewModel<boolean> {
    constructor(parent: AppViewModel) {
        super(parent);

        this.title = "Log File Maintenance";
        this.closeBoxResult = false;
        this.buttons.add(new DialogButtonViewModel({
            title: "Close",
            style: DialogButtonStyle.CANCEL,
            onClick: () => { this.close(false); }
        }));
    }

    get isVacuuming() { return HostInterop.logFileMaintenance.isVacuuming; }

    async vacuumAsync(cancellationToken: CancellationToken): Promise<number> {
        const res = await HostInterop.logFileMaintenance.vacuumDatabaseAsync(cancellationToken);
        return res;
    }

    get logFileSize() { return HostInterop.logFileMaintenance.logFileSize; }
}