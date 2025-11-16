import { CancellationToken } from "../../util/CancellationTokenSource";
import { HostInterop } from "../../util/hostinterop/HostInterop";
import { KeyCodes } from "../../util/KeyCodes";
import { AppViewModel } from "../AppViewModel";
import { DialogButtonStyle, DialogButtonViewModel, DialogViewModel } from "./DialogViewModel";

export class LogFileMaintenanceDialogViewModel extends DialogViewModel<boolean> {
    constructor(parent: AppViewModel) {
        super(parent);

        this.title = "Log File Maintenance";
        this.closeBoxResult = false;
        this.btnClose = this.buttons.add(new DialogButtonViewModel({
            title: "Close",
            style: DialogButtonStyle.CANCEL,
            onClick: () => { this.close(false); }
        }));
    }

    private readonly btnClose: DialogButtonViewModel;

    get isVacuuming() { return HostInterop.logFileMaintenance.isVacuuming; }

    get isClearing() { return HostInterop.logFileMaintenance.isClearing; }

    async vacuumAsync(cancellationToken: CancellationToken): Promise<number> {
        const res = await HostInterop.logFileMaintenance.vacuumDatabaseAsync(cancellationToken);
        return res;
    }

    get logFileSize() { return HostInterop.logFileMaintenance.logFileSize; }

    async clearDatabaseAsync(cancellationToken: CancellationToken): Promise<void> {
        const confirmed = await this.parent.promptAsync(
            {
                message: "Are you <b>sure<b> you want to clear your log file?  <b>This will delete all of your logs, and this operation can not be undone.</b>",
                messageAsHtml: true,
                title: "Clear Log File?",
                buttons: [
                    { title: "No, Cancel", shortcutKeyCode: KeyCodes.KEY_N, resultValue: false, style: DialogButtonStyle.BACKOFF },
                    { title: "Yes, Clear Log File", shortcutKeyCode: KeyCodes.KEY_Y, resultValue: true, style: DialogButtonStyle.NORMAL }
                ]
            }
        );
        if (confirmed) {
            try {
                this.btnClose.enabled = false;
                this.closeBoxResult = undefined;
                try {
                    await HostInterop.logFileMaintenance.clearDatabaseAsync(CancellationToken.NONE);
                }
                finally {
                    this.btnClose.enabled = true;
                    this.closeBoxResult = false;
                }
            }
            catch (e) {
                await this.parent.alertAsync(
                    "The log database failed to clear.  Chat logging may be inoperable until you restart XarChat.",
                    "Log Clear Failed"
                );
            }
        }
    }
}