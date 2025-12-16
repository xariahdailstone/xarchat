import { CancellationToken } from "../../util/CancellationTokenSource";
import { LogChannelMessage, LogPMConvoMessage } from "../../util/hostinterop/HostInterop";
import { ExplicitDate } from "../../util/hostinterop/HostInteropLogSearch";

export type MessageLoadFunc = (date: ExplicitDate, cancellationToken: CancellationToken) => Promise<{ title: string; messages: (LogChannelMessage[] | LogPMConvoMessage[]); }>;
