import { IDisposable } from "./Disposable";
import { HostInterop } from "./HostInterop";

export type IdleDetectionCallback = (userState: IdleDetectionUserState, screenState: IdleDetectionScreenState) => void;
export type IdleDetectionUserState = "active" | "idle";
export type IdleDetectionScreenState = "unlocked" | "locked";

export class IdleDetection implements IDisposable {
    static async createAsync(idleAfterSec: number, callback: IdleDetectionCallback): Promise<IdleDetection> {
        const obj = new IdleDetection(callback);
        const hostReg = await HostInterop.registerIdleDetectionAsync(idleAfterSec * 1000,
            (userState: IdleDetectionUserState, screenState: IdleDetectionScreenState) => { obj.setStates(userState, screenState); });
        obj.setHostObject(hostReg);
        return obj;
    }

    private constructor(
        private readonly callback: IdleDetectionCallback) {
    }

    private _userState: IdleDetectionUserState = "active";
    private _screenState: IdleDetectionScreenState = "unlocked";
    private _hostObject: IDisposable | null = null;

    get userState() { return this._userState; }
    get screenState() { return this._screenState; }

    dispose() {
        if (this._hostObject) {
            this._hostObject.dispose();
            this._hostObject = null;
        }
    }

    [Symbol.dispose]() { this.dispose(); }

    private setHostObject(obj: IDisposable) {
        this._hostObject = obj;
    }

    private setStates(userState: IdleDetectionUserState, screenState: IdleDetectionScreenState) {
        var hasChange = false;
        if (userState != this._userState) {
            hasChange = true;
            this._userState = userState;
        }
        if (screenState != this._screenState) {
            hasChange = true;
            this._screenState = screenState;
        }

        if (hasChange) {
            try { this.callback(userState, screenState); }
            catch { }
        }
    }
}