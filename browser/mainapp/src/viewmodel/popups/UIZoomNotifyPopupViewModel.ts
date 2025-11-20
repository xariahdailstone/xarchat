import { IDisposable } from "../../util/Disposable";
import { ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { Scheduler } from "../../util/Scheduler";
import { AppViewModel } from "../AppViewModel";
import { PopupViewModel } from "./PopupViewModel";

export class UIZoomNotifyPopupViewModel extends PopupViewModel {
    constructor(parent: AppViewModel) {
        super(parent);
    }

    private _hideTimeout: IDisposable | null = null;
    private _message: ObservableValue<string> = new ObservableValue("");

    get message(): string { return this._message.value; }
    set message(value: string) {
        if (value != this._message.value) {
            this._message.value = value;
            this.resetCloseTimer();
        }
    }

    private resetCloseTimer() {
        if (this._hideTimeout != null) {
            this._hideTimeout.dispose();
            this._hideTimeout = null;
        }
        this._hideTimeout = Scheduler.scheduleNamedCallback("UIZoomNotifyPopupViewModel.resetCloseTimer", 2000, () => {
            this.dismissed();
        });
    }

    show() {
        this.parent.popups.push(this);
        this.resetCloseTimer();
    }

    dismissed(): void {
        super.dismissed();
        this.parent.zoomNotifyPopup = null;
    }
}