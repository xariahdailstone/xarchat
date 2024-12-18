import { ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { AppViewModel } from "../AppViewModel";
import { ContextPopupViewModel, PopupViewModel } from "./PopupViewModel";

export class ColorHSSelectPopupViewModel extends ContextPopupViewModel {
    constructor(parent: AppViewModel, contextElement: HTMLElement) {
        super(parent, contextElement);
    }

    private _hueSat: ObservableValue<[number, number]> = new ObservableValue<[number, number]>([0, 0]);

    get hue(): number { return this._hueSat.value[0]; }

    get saturation(): number { return this._hueSat.value[1]; }

    setHueSaturation(hue: number, saturation: number) {
        this._hueSat.value = [hue, saturation];
        if (this.onChange) {
            this.onChange(hue, saturation);
        }
    }

    onChange: ((hue: number, saturation: number) => void) | null = null;
}