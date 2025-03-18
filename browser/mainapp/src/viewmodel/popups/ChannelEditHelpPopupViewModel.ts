import { AppViewModel } from "../AppViewModel";
import { ContextPopupViewModel } from "./PopupViewModel";

export class ChannelEditHelpPopupViewModel extends ContextPopupViewModel {
    constructor(
        parent: AppViewModel, 
        contextElement: HTMLElement, 
        private readonly onDismissed: () => void) {

        super(parent, contextElement);
    }

    dismissed(): void {
        super.dismissed();
        this.onDismissed();
    }
}