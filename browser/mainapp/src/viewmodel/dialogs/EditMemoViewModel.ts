import { CancellationToken } from "../../util/CancellationTokenSource";
import { KeyCodes } from "../../util/KeyCodes";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { CharacterProfileDialogViewModel } from "./character-profile/CharacterProfileDialogViewModel";
import { DialogButtonStyle, DialogButtonViewModel, DialogViewModel } from "./DialogViewModel";

export class EditMemoViewModel extends DialogViewModel<boolean> {
    constructor(
        public readonly characterProfileDialogViewModel: CharacterProfileDialogViewModel,
        memoText: string) {

        super(characterProfileDialogViewModel.parent);

        this.title = "Edit Memo";
        this.memoText = memoText;

        this.closeBoxResult = false;

        const btnCancel = this.buttons.add(new DialogButtonViewModel({
            title: "Cancel",
            style: DialogButtonStyle.CANCEL,
            shortcutKeyCode: KeyCodes.ESCAPE,
            onClick: () => {
                this.close(false);
            }
        }));
        const btnSave = this.buttons.add(new DialogButtonViewModel({
            title: "Save Changes",
            style: DialogButtonStyle.DEFAULT,
            shortcutKeyCode: KeyCodes.RETURN,
            onClick: async () => {
                this.saving = true;
                btnCancel.enabled = false;
                btnSave.enabled = false;
                try {
                    await this.characterProfileDialogViewModel.activeLoginViewModel.authenticatedApi.saveMemoAsync(
                        characterProfileDialogViewModel.profileDetails!.character,
                        this.memoText,
                        CancellationToken.NONE
                    );
                    this.close(true);    
                }
                finally {
                    btnCancel.enabled = true;
                    btnSave.enabled = true;
                    this.saving = false;
                }
            }
        }));
    }

    @observableProperty
    memoText: string;

    @observableProperty
    saving: boolean = false;
}