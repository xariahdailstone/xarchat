import { CharacterName } from "../../shared/CharacterName";
import { OnlineStatus } from "../../shared/OnlineStatus";
import { observableProperty } from "../../util/ObservableBase";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { ContextPopupViewModel, PopupViewModel } from "./PopupViewModel";

export class CharacterStatusEditorPopupViewModel extends ContextPopupViewModel {
    constructor(
        public readonly activeLoginViewModel: ActiveLoginViewModel, 
        contextElement: HTMLElement) {

        super(activeLoginViewModel.appViewModel, contextElement);

        this.characterName = activeLoginViewModel.characterName;

        const cs = activeLoginViewModel.characterSet.getCharacterStatus(activeLoginViewModel.characterName);
        this.selectedStatus = cs.status;
        this.selectedStatusMessage = cs.statusMessage;
    }

    @observableProperty
    characterName: CharacterName;

    @observableProperty
    selectedStatus: OnlineStatus = OnlineStatus.ONLINE;

    @observableProperty
    selectedStatusMessage: string = "";

    dismissed(): void {
        const cs = this.activeLoginViewModel.characterSet.getCharacterStatus(this.activeLoginViewModel.characterName);
        if (this.selectedStatus != cs.status || this.selectedStatusMessage != cs.statusMessage) {
            this.activeLoginViewModel.chatConnection.setStatusAsync(this.selectedStatus, this.selectedStatusMessage);
        }
        super.dismissed();
    }
}