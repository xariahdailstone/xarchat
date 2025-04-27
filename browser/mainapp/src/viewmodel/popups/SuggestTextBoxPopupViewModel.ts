import { SuggestTextBox } from "../../components/SuggestTextBox";
import { observableProperty } from "../../util/ObservableBase";
import { AppViewModel } from "../AppViewModel";
import { SuggestionItem } from "../SuggestTextBoxViewModel";
import { ContextPopupViewModel } from "./PopupViewModel";

export class SuggestTextBoxPopupViewModel extends ContextPopupViewModel {
    constructor(
        parent: AppViewModel, 
        contextElement: HTMLElement,
        private readonly suggestTextBox: SuggestTextBox,
        public readonly items: SuggestionItem[]) {

        super(parent, contextElement);
    }

    @observableProperty
    selectedIndex: number = -1;

    selectItem(item: string, assignFocus?: boolean) {
        // TODO:
        this.suggestTextBox.selectItem(item, assignFocus ?? true);
    }

    selectCurrentItem(assignFocus: boolean) {
        if (this.selectedIndex > -1) {
            const curItem = this.items[this.selectedIndex];
            if (typeof curItem == "string") {
                const item = this.suggestTextBox.selectItem(curItem, assignFocus);
            }
        }
    }

    moveSelectionDown() {
        let candidateSelIndex = this.selectedIndex;
        while (candidateSelIndex < this.items.length) {
            candidateSelIndex++;
            if (typeof this.items[candidateSelIndex] == "string") {
                this.selectedIndex = candidateSelIndex;
                return;
            }
        }
    }

    moveSelectionUp() {
        let candidateSelIndex = this.selectedIndex;
        while (candidateSelIndex > -1) {
            candidateSelIndex--;
            if (candidateSelIndex == -1 || typeof this.items[candidateSelIndex] == "string") {
                this.selectedIndex = candidateSelIndex;
                return;
            }
        }
    }
}