import { CancellationToken } from "../../CancellationTokenSource";
import { ObservableValue } from "../../Observable";
import { HostInteropLogFileMaintenance } from "../HostInteropLogFileMaintenance";
import { XarHost2InteropSession } from "./XarHost2InteropSession";

export class XarHost2InteropLogFileMaintenance extends XarHost2InteropSession implements HostInteropLogFileMaintenance {
    constructor() {
        super();
    }

    override readonly prefix: string = "logfilemaintenance.";

    async vacuumDatabaseAsync(cancellationToken: CancellationToken): Promise<number> {
        if (this._isVacuuming.value) { return -1; }

        this._isVacuuming.value = true;
        try {
            let dbSize: number | null = null;

            await this.sendAndReceiveAsync("vacuumDatabase", {}, cancellationToken, (rcmd, data) => {
                if (rcmd == "vacuumDatabaseComplete") {
                    dbSize = +(data.dbSize);
                }
                else if (rcmd == "vacuumDatabaseFailed") {
                    dbSize = +(data.dbSize);
                }
            });

            this._logFileSize.value = dbSize ?? -1;
            return dbSize ?? -1;
        }
        finally {
            this._isVacuuming.value = false;
        }
    }

    private _lastLogFileSizeRefreshAt: number = 0;
    private _isRefreshingLogFileSize: boolean = false;
    async refreshLogFileSizeAsync(cancellationToken: CancellationToken): Promise<void> {
        if (this._isRefreshingLogFileSize) { return; }

        const now = new Date().getTime();
        if (now - this._lastLogFileSizeRefreshAt <= 2000) {
            return;
        }
        this._lastLogFileSizeRefreshAt = now;

        this._isRefreshingLogFileSize = true;
        try {
            await this.sendAndReceiveAsync("getLogFileSize", {}, cancellationToken, (rcmd, data) => {
                this.logger.logInfo("getLogFileSize msg", rcmd, data);
                if (rcmd == "gotLogFileSize") {
                    const size = +(data.dbSize);
                    this.logger.logInfo("gotLogFileSize", size);
                    this._logFileSize.value = size;
                }
            });
        }
        finally {
            this._isRefreshingLogFileSize = false;
        }
    }

    private _isVacuuming: ObservableValue<boolean> = new ObservableValue(false);
    get isVacuuming() { return this._isVacuuming.value; }

    private _logFileSize: ObservableValue<number> = new ObservableValue(-1);
    get logFileSize() { return this._logFileSize.value; }
}
