import { CharacterName } from "../../shared/CharacterName";
import { OnlineStatus, OnlineStatusConvert } from "../../shared/OnlineStatus";
import { BBCodeParser, ChatBBCodeParser } from "../../util/bbcode/BBCode";
import { asDisposable } from "../../util/Disposable";
import { HTMLUtils } from "../../util/HTMLUtils";
import { URLUtils } from "../../util/URLUtils";
import { CharacterStatusEditDialogViewModel } from "../../viewmodel/dialogs/CharacterStatusEditDialogViewModel";
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

        this.clickable = true;

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

            <div class="current-status-message-container">
                <div class="current-status-message" id="elCurrentStatusMessage"></div>
                <button class="current-status-edit-button theme-button" id="btnEditStatus">Edit Status</button>
            </div>
        `);

        const elAvatarImage = this.$("elAvatarImage") as HTMLImageElement;
        const elOnlineStatusSelect = this.$("elOnlineStatusSelect") as HTMLSelectElement;
        const elStatusDotContainer = this.$("elStatusDotContainer") as HTMLDivElement;
        const elCharacterName = this.$("elCharacterName") as HTMLDivElement;
        const elCurrentStatusMessage = this.$("elCurrentStatusMessage") as HTMLDivElement;
        const btnEditStatus = this.$("btnEditStatus") as HTMLButtonElement;

        this.watchExpr(vm => vm.characterName, cname => {
            if (cname) {
                elAvatarImage.src = URLUtils.getAvatarImageUrl(cname);
                elCharacterName.innerText = cname.value;
            }
            else {
                elAvatarImage.src = URLUtils.getEmptyImageUrl();
                elCharacterName.innerText = "";
            }
        });
        this.watchExpr(vm => vm.currentCharacterStatus.status, onlineStatus => {
            if (onlineStatus) {
                elOnlineStatusSelect.value = OnlineStatusConvert.toString(onlineStatus);    
            }
        });
        this.watchExpr(vm => vm.currentCharacterStatus.statusMessage, statusMessage => {
            if (statusMessage && this.viewModel) {
                if (statusMessage != "") {
                    const bbcodeParseResult = ChatBBCodeParser.parse(statusMessage, {
                        addUrlDomains: true, 
                        appViewModel: this.viewModel.activeLoginViewModel.appViewModel, 
                        activeLoginViewModel: this.viewModel.activeLoginViewModel,
                        imagePreviewPopups: true,
                        sink: this.viewModel.activeLoginViewModel.bbcodeSink 
                    });

                    elCurrentStatusMessage.appendChild(bbcodeParseResult.element);
                    elCurrentStatusMessage.classList.toggle("has-status", true);

                    return asDisposable(() => {
                        HTMLUtils.clearChildren(elCurrentStatusMessage);
                        bbcodeParseResult.dispose();
                    });
                }
                else {
                    HTMLUtils.clearChildren(elCurrentStatusMessage);
                    elCurrentStatusMessage.classList.toggle("has-status", false);
                }
            }
        });

        this.whenConnectedWithViewModel((vm) => {
            const statusDot = new StatusDotLightweight();
            statusDot.characterSet = vm.activeLoginViewModel.characterSet;
            statusDot.character = vm.characterName;
            elStatusDotContainer.appendChild(statusDot.element);

            //elOnlineStatusSelect.value = OnlineStatusConvert.toString(vm.selectedStatus);

            return asDisposable(() => {
                statusDot.element.remove();
                statusDot.dispose();
            });
        });

        elOnlineStatusSelect.addEventListener("change", () => {
            if (this.viewModel != null) {
                this.viewModel.setOnlineStatusAsync(OnlineStatusConvert.toOnlineStatus(elOnlineStatusSelect.value)!);
            }
        });
        btnEditStatus.addEventListener("click", () => {
            if (this.viewModel != null) {
                this.viewModel.showStatusMessageEditorAsync();
            }
        });
    }  
}