import { CancellationToken } from "../CancellationTokenSource";

export interface HostInteropLogImport {
    getAvailableImportersAsync(cancellationToken: CancellationToken): Promise<string[]>;

    executeImporterFlowAsync(
        importerName: string,
        cancellationToken: CancellationToken,
        stepReceivedFunc: (stepName: string, stepBody: any) => Promise<any>): Promise<void>;
}
