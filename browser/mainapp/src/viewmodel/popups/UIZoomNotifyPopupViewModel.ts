import { ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { AppViewModel } from "../AppViewModel";
import { PopupViewModel } from "./PopupViewModel";

export class UIZoomNotifyPopupViewModel extends PopupViewModel {
    constructor(parent: AppViewModel) {
        super(parent);
    }

    private _hideTimeout: number | null = null;
    private _message: ObservableValue<string> = new ObservableValue("").withName("UIZoomNotifyPopupViewModel._message");

    get message(): string { return this._message.value; }
    set message(value: string) {
        if (value != this._message.value) {
            this._message.value = value;
            this.resetCloseTimer();
        }
    }

    private resetCloseTimer() {
        if (this._hideTimeout != null) {
            window.clearTimeout(this._hideTimeout);
        }
        this._hideTimeout = window.setTimeout(() => {
            this.dismissed();
        }, 2000);
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