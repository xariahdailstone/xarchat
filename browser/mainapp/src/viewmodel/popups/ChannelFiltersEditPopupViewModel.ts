import { observableProperty } from "../../util/ObservableBase";
import { AppViewModel } from "../AppViewModel";
import { ChannelFiltersViewModel } from "../ChannelFiltersViewModel";
import { ContextPopupViewModel, PopupViewModel } from "./PopupViewModel";

export class ChannelFiltersEditPopupViewModel extends ContextPopupViewModel {
    constructor(
        parent: AppViewModel, 
        contextElement: HTMLElement,
        filtersViewModel: ChannelFiltersViewModel) {

        super(parent, contextElement);
        this.filtersViewModel = filtersViewModel;
        filtersViewModel.unseenMessagesFilter; // ensure a controlsUnseenDot is chosen when there isn't one
    }

    @observableProperty
    filtersViewModel: ChannelFiltersViewModel;

    override dismissed(): void {
        super.dismissed();
        this.filtersViewModel.channelViewModel.ensureSelectableFilterSelected();
    }
}