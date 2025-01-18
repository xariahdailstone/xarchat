import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { AppViewModel } from "../AppViewModel";
import { ChannelViewModel } from "../ChannelViewModel";
import { PopupViewModel } from "./PopupViewModel";

export class ChannelDescriptionPopupViewModel extends PopupViewModel {
    constructor(public readonly channelViewModel: ChannelViewModel) {
        super(channelViewModel.appViewModel);
    }

    get activeLoginViewModel(): ActiveLoginViewModel { return this.channelViewModel.activeLoginViewModel; }

    @observableProperty
    popFromElement: (HTMLElement | null) = null;

    @observableProperty
    description: string = "";
}

