import { CharacterName } from "../../shared/CharacterName";
import { OnlineStatus, OnlineStatusConvert } from "../../shared/OnlineStatus";
import { asDisposable } from "../../util/Disposable";
import { HTMLUtils } from "../../util/HTMLUtils";
import { URLUtils } from "../../util/URLUtils";
import { CharacterStatusEditorPopupViewModel } from "../../viewmodel/popups/CharacterStatusEditorPopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { StatusDotLightweight } from "../StatusDot";
import { ContextPopupBase } from "./ContextPopupBase";
import { popupViewFor } from "./PopupFrame";

@componentArea("popups")
@componentElement("x-characterstatuseditorpopup")
@popupViewFor(CharacterStatusEditorPopupViewModel)
export class CharacterStatusEditorPopup extends ContextPopupBase<CharacterStatusEditorPopupViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <img class="avatar-image" id="elAvatarImage" />
            <div class="status-dot-container" id="elStatusDotContainer"></div>

            <div class="character-name" id="elCharacterName"></div>
            <div class="online-status-container">
                <div class="online-status-label">Online Status:</div>
                <select class="online-status-select" id="elOnlineStatusSelect">
                    <option>Online</option>
                    <option>Looking</option>
                    <option>Busy</option>
                    <option>Away</option>
                    <option>DND</option>
                </select>
            </div>
            <textarea class="status-message" id="elStatusMessage" maxlength="255"></textarea>
            <div class="status-message-size"><span id="elStatusMessageCharsUsed">0</span> / 255</div>
        `);

        const elAvatarImage = this.$("elAvatarImage") as HTMLImageElement;
        const elOnlineStatusSelect = this.$("elOnlineStatusSelect") as HTMLSelectElement;
        const elStatusDotContainer = this.$("elStatusDotContainer") as HTMLDivElement;
        const elCharacterName = this.$("elCharacterName") as HTMLDivElement;
        const elStatusMessage = this.$("elStatusMessage") as HTMLTextAreaElement;
        const elStatusMessageCharsUsed = this.$("elStatusMessageCharsUsed") as HTMLSpanElement;

        this.watch("characterName", (v: CharacterName | null) => {
            if (v) {
                elAvatarImage.src = URLUtils.getAvatarImageUrl(v);
                elCharacterName.innerText = v.value;
            }
            else {
                elAvatarImage.src = URLUtils.getEmptyImageUrl();
                elCharacterName.innerText = "";
            }
        });
        this.watch("selectedStatusMessage", (v: string | null) => {
            v = v ?? "";
            if (v != elStatusMessage.value) {
                elStatusMessage.value = v;
                elStatusMessageCharsUsed.innerText = elStatusMessage.value.length.toString();
            }
        });

        this.whenConnectedWithViewModel((vm) => {
            const statusDot = new StatusDotLightweight();
            statusDot.characterSet = vm.activeLoginViewModel.characterSet;
            statusDot.character = vm.characterName;
            elStatusDotContainer.appendChild(statusDot.element);

            elOnlineStatusSelect.value = OnlineStatusConvert.toString(vm.selectedStatus);

            return asDisposable(() => {
                statusDot.element.remove();
                statusDot.dispose();
            });
        });

        const pushTextbox = () => {
            if (this.viewModel != null) {
                this.viewModel.selectedStatusMessage = elStatusMessage.value;
            }
            elStatusMessageCharsUsed.innerText = elStatusMessage.value.length.toString();
        }
        elStatusMessage.addEventListener("input", pushTextbox);
        elStatusMessage.addEventListener("change", pushTextbox);

        elOnlineStatusSelect.addEventListener("change", () => {
            if (this.viewModel != null) {
                this.viewModel.selectedStatus = OnlineStatusConvert.toOnlineStatus(elOnlineStatusSelect.value)!;
            }
        })
    }  
}