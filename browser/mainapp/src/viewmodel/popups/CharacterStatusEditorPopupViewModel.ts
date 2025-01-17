import { CharacterName } from "../../shared/CharacterName";
import { OnlineStatus } from "../../shared/OnlineStatus";
import { observableProperty } from "../../util/ObservableBase";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { CharacterStatusEditDialogViewModel } from "../dialogs/CharacterStatusEditDialogViewModel";
import { ContextPopupViewModel, PopupViewModel } from "./PopupViewModel";

export class CharacterStatusEditorPopupViewModel extends ContextPopupViewModel {
    constructor(
        public readonly activeLoginViewModel: ActiveLoginViewModel, 
        contextElement: HTMLElement) {

        super(activeLoginViewModel.appViewModel, contextElement);

        this.characterName = activeLoginViewModel.characterName;
    }

    @observableProperty
    characterName: CharacterName;

    get currentCharacterStatus() {
        return this.activeLoginViewModel.characterSet.getCharacterStatus(this.activeLoginViewModel.characterName);
    }

    dismissed(): void {
        super.dismissed();
    }

    async setOnlineStatusAsync(newOnlineStatus: OnlineStatus): Promise<void> {
        const cs = this.activeLoginViewModel.characterSet.getCharacterStatus(this.activeLoginViewModel.characterName);
        if (cs.status != newOnlineStatus) {
            await this.activeLoginViewModel.chatConnection.setStatusAsync(newOnlineStatus, cs.statusMessage);
        }
    }

    async showStatusMessageEditorAsync(): Promise<void> {
        const cs = this.activeLoginViewModel.characterSet.getCharacterStatus(this.activeLoginViewModel.characterName);
        const evm = new CharacterStatusEditDialogViewModel(this.parent, this.activeLoginViewModel, cs.statusMessage, cs.status);
        const res = await this.activeLoginViewModel.appViewModel.showDialogAsync(evm);
        if (res) {
            if (res.onlineStatus != cs.status || res.statusMessage != cs.statusMessage) {
                this.activeLoginViewModel.chatConnection.setStatusAsync(res.onlineStatus, res.statusMessage);
            }
        }
    }
}