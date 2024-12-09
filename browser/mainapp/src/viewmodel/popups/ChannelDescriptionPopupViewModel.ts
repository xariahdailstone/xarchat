import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { AppViewModel } from "../AppViewModel";
import { PopupViewModel } from "./PopupViewModel";

export class ChannelDescriptionPopupViewModel extends PopupViewModel {
    constructor(parent: AppViewModel) {
        super(parent);
    }

    @observableProperty
    popFromElement: (HTMLElement | null) = null;

    @observableProperty
    description: string = "";
}

