import { ObservableValue } from "../../util/Observable";
import { observableProperty } from "../../util/ObservableBase";
import { AppViewModel } from "../AppViewModel";
import { ContextPopupViewModel } from "./PopupViewModel";

export class IFramePopupViewModel extends ContextPopupViewModel {
    constructor(
        appViewModel: AppViewModel,
        element: HTMLElement) {

        super(appViewModel, element);
    }

    @observableProperty
    iframeElement: HTMLIFrameElement | null = null;

    private readonly _iframeSize: ObservableValue<[number, number]> = new ObservableValue<[number, number]>([1000, 1000]).withName("IFramePopupViewModel._iframeSize");
    get iframeSize(): [number, number] { return this._iframeSize.value; }
    set iframeSize(value) { this._iframeSize.value = value; }

    @observableProperty
    visible: boolean = false;
}