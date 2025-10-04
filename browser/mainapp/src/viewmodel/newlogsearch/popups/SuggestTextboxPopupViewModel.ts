import { observableProperty } from "../../../util/ObservableBase";
import { Collection } from "../../../util/ObservableCollection";
import { AppViewModel } from "../../AppViewModel";
import { ContextPopupViewModel } from "../../popups/PopupViewModel";
import { SuggestTextboxDropdownState, SuggestTextboxItemViewModel, SuggestTextboxViewModel } from "../SuggestTextboxViewModel";

export class SuggestTextboxPopupViewModel extends ContextPopupViewModel {
    constructor(
        private readonly parentViewModel: SuggestTextboxViewModel, 
        element: HTMLElement) {

        super(parentViewModel.appViewModel, element)
    }

    get suggestionsState(): SuggestTextboxDropdownState { return this.parentViewModel.suggestionsState; }

    get suggestions(): Collection<SuggestTextboxItemViewModel> { return this.parentViewModel.suggestions; }

    @observableProperty
    selectedItem: SuggestTextboxItemViewModel | null = null;

    select(item: SuggestTextboxItemViewModel) {
        // TODO:
    }

    dismissed(): void {
        super.dismissed();
    }
}