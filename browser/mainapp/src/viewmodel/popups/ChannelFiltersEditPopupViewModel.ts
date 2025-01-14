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
    }

    @observableProperty
    filtersViewModel: ChannelFiltersViewModel;
}