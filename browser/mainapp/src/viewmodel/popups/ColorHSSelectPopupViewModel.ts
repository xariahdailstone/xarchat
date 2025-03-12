import { ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { AppViewModel } from "../AppViewModel";
import { ContextPopupViewModel, PopupViewModel } from "./PopupViewModel";

export class ColorHSSelectPopupViewModel extends ContextPopupViewModel {
    constructor(parent: AppViewModel, contextElement: HTMLElement, public readonly includeBrightnessFactor: boolean) {
        super(parent, contextElement);
    }

    private _hueSat: ObservableValue<[number, number, number]> = new ObservableValue<[number, number, number]>([0, 0, 1]);

    get hue(): number { return this._hueSat.value[0]; }

    get saturation(): number { return this._hueSat.value[1]; }

    get brightnessFactor(): number { return this._hueSat.value[2]; }
    get minBrightnessFactor(): number { return 0.25; }
    get defaultBrightnessFactor(): number { return 1; }
    get maxBrightnessFactor(): number { return 2; }

    setHueSaturation(hue: number, saturation: number, brightnessFactor?: number) {
        this._hueSat.value = [hue, saturation, brightnessFactor ?? this.defaultBrightnessFactor];
        if (this.onChange) {
            this.onChange(hue, saturation, brightnessFactor ?? this.defaultBrightnessFactor);
        }
    }

    onChange: ((hue: number, saturation: number, brightnessFactor: number) => void) | null = null;
}