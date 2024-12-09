import { HostInterop } from "./HostInterop";
import { IDisposable } from "./Disposable";

export type UpdateCheckerClientCallback = (state: UpdateCheckerState) => void;

export enum UpdateCheckerState {
    Unknown = "Unknown",
    CheckingForUpdates = "CheckingForUpdates",
    NoUpdatesAvailable = "NoUpdatesAvailable",
    DownloadingUpdate = "DownloadingUpdate",
    DownloadingUpdateMustUpdate = "DownloadingUpdateMustUpdate",
    UpdateReady = "UpdateReady",
    UpdateReadyMustUpdate = "UpdateReadyMustUpdate",
    UpdateAvailable = "UpdateAvailable",
    UpdateAvailableRequired = "UpdateAvailableRequired",
}

export class UpdateCheckerClient implements IDisposable {
    static async createAsync(callback: UpdateCheckerClientCallback): Promise<UpdateCheckerClient> {
        const obj = new UpdateCheckerClient(callback);
        const hostReg = await HostInterop.registerUpdateCheckerRegistrationAsync(
            (state: UpdateCheckerState) => { obj.setState(state); });
        obj.setHostObject(hostReg);
        return obj;
    }

    private _disposed = false;
    private _hostObject: IDisposable | null = null;

    private _state: UpdateCheckerState = UpdateCheckerState.Unknown;

    private constructor(
        private readonly callback: UpdateCheckerClientCallback) {

    }

    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            if (this._hostObject != null) {
                this._hostObject.dispose();
            }
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    private setHostObject(obj: IDisposable) {
        this._hostObject = obj;
    }

    get state() { return this._state; }

    private setState(value: UpdateCheckerState) {
        if (value != this._state) {
            this._state = value;
            try {
                this.callback(value);
            }
            catch { }
        }
    }
}