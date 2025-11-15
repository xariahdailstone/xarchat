import { CancellationToken } from "../CancellationTokenSource";

export interface HostInteropLogFileMaintenance {
    
    vacuumDatabaseAsync(cancellationToken: CancellationToken): Promise<number>;

    refreshLogFileSizeAsync(cancellationToken: CancellationToken): Promise<void>;

    readonly isVacuuming: boolean;

    readonly logFileSize: number;
}

