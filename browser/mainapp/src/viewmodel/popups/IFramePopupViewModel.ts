import { IDisposable } from "../../util/Disposable";
import { ObservableValue } from "../../util/Observable";
import { observableProperty } from "../../util/ObservableBase";
import { AppViewModel } from "../AppViewModel";
import { ContextPopupViewModel } from "./PopupViewModel";

export class IFramePopupViewModel extends ContextPopupViewModel implements IDisposable {
    constructor(
        appViewModel: AppViewModel,
        element: HTMLElement) {

        super(appViewModel, element);
    }

    private _disposed: boolean = false;
    get isDisposed() { return this._disposed; }
    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            this.dismissed();
        }
    }
    [Symbol.dispose]() { this.dispose(); }

    @observableProperty
    iframeElement: HTMLIFrameElement | null = null;

    private readonly _iframeSize: ObservableValue<[number, number]> = new ObservableValue([1000, 1000]);
    get iframeSize(): [number, number] { return this._iframeSize.value; }
    set iframeSize(value) { this._iframeSize.value = value; }

    @observableProperty
    visible: boolean = false;
}