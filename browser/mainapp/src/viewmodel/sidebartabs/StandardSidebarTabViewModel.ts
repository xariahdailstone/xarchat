import { ObservableBase } from "../../util/ObservableBase";
import { SidebarTabViewModel } from "./SidebarTabContainerViewModel";


export abstract class StandardSidebarTabViewModel extends ObservableBase implements SidebarTabViewModel {
    abstract tabId: string;
    canHideTabStripWhenAlone: boolean = false;

    private _isDisposed = false;
    get isDisposed() { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = false;
        }
    }
    [Symbol.dispose](): void {
        this.dispose();
    }
}
