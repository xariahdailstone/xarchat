import { CancellationToken } from "../../CancellationTokenSource";
import { IHostInterop } from "../IHostInterop";


export interface IXarHost2HostInterop extends IHostInterop {
    // closeSqlConnection(connId: string): void;
    // sendSqlCommandAsync(cmd: any, cancellationToken: CancellationToken): Promise<any>;
    writeAndReadToXCHostSocketAsync(data: any, cancellationToken?: CancellationToken): Promise<any>;
}
