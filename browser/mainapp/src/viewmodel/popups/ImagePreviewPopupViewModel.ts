import { observableProperty } from "../../util/ObservableBase";
import { ContextPopupViewModel, PopupViewModel } from "./PopupViewModel";


export class ImagePreviewPopupViewModel extends ContextPopupViewModel {

    private _imageUrl: string | null = null;
    @observableProperty
    get imageUrl(): string | null { return this._imageUrl; }
    set imageUrl(value: (string | null)) {
        if (value != this._imageUrl) {
            this._imageUrl = value;

            if (value) {
                const imgEl = document.createElement("img");
                imgEl.addEventListener("load", () => {
                    if (this._imageUrl == value) {
                        this.imageElement = imgEl;
                    }
                });
                imgEl.src = value;
            }
            else {
                this.imageElement = null;
            }
        }
    }

    private _imageElement: HTMLImageElement | null = null;
    @observableProperty
    get imageElement(): HTMLImageElement | null { return this._imageElement; }
    set imageElement(value) {
        if (value != this._imageElement) {
            this._imageElement = value;
            if (value) {
                this.parent.popups.push(this);
            }
            else {
                this.parent.popups.remove(this);
            }
        }
    }

    dismissed(): void {
        this.imageUrl = null;
        super.dismissed();
    }
}
