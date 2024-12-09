import { AppViewModel } from "../AppViewModel";
import { PopupViewModel } from "./PopupViewModel";

export class LinkHintPopupViewModel extends PopupViewModel {
    constructor(
        parent: AppViewModel,
        public readonly hintText: string) {
        
        super(parent);
    }
}