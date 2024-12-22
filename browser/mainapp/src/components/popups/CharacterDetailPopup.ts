import { CharacterStatus } from "../../shared/CharacterSet";
import { OnlineStatusConvert } from "../../shared/OnlineStatus";
import { ChatBBCodeParser } from "../../util/bbcode/BBCode";
import { IDisposable, asDisposable } from "../../util/Disposable";
import { URLUtils } from "../../util/URLUtils";
import { WhenChangeManager } from "../../util/WhenChange";
import { AlsoInChannelLineItem, CharacterDetailPopupViewModel } from "../../viewmodel/popups/CharacterDetailPopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { StatusDotLightweight } from "../StatusDot";
import { PopupBase, PopupFrame, popupViewFor } from "./PopupFrame";
import { ContextPopupBase } from "./ContextPopupBase";
import { CharacterGenderConvert } from "../../shared/CharacterGender";
import { CollectionViewLightweight } from "../CollectionViewLightweight";
import { DialogButtonStyle } from "../../viewmodel/dialogs/DialogViewModel";
import { ChatChannelViewModel } from "../../viewmodel/ChatChannelViewModel";
import { HTMLUtils } from "../../util/HTMLUtils";

@componentArea("popups")
@componentElement("x-characterdetailpopup")
@popupViewFor(CharacterDetailPopupViewModel)
export class CharacterDetailPopup extends ContextPopupBase<CharacterDetailPopupViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <img class="character-icon" id="elCharacterIcon" />
            <div class="character-name" id="elCharacterName"></div>
            <div class="character-onlinestatus" id="elCharacterOnlineStatus">
                <div class="statusdotcontainer" id="elStatusDotContainer"></div>
                <div class="onlinestatustext" id="elStatusText"></div>
            </div>

            <div class="character-settings" id="elConfigIconContainer">
                <x-iconimage id="elConfigIcon" src="assets/ui/config-button.svg"></x-iconimage>
            </div>

            <div class="character-statusmessage" id="elCharacterStatusMessage"></div>

            <div class="character-alsoinchannels" id="elCharacterAlsoInChannels">
                <div class="character-alsoinchannels-title">Mutual Channels:</div>
                <x-chardetailalsoinchannels modelpath="alsoInChannels">
                    <div class="character-alsoinchannels-list"></div>
                </x-chardetailalsoinchannels>
            </div>

            <div class="character-buttonbar">
                <button class="theme-button char-detail-button character-button-pm" id="elPrivateMessage">Private Message</button>
                <button class="theme-button char-detail-button character-button-flist" id="elFList">Profile</button>
                <button class="theme-button char-detail-button character-button-ignore" id="elIgnore">Ignore</button>
                <button class="theme-button theme-button-warning char-detail-button character-button-report" id="elReport">Report</button>
            </div>

            <div class="channelop-buttonbar">
                <div class="channelop-buttonbar-title" id="elChannelOpButtonbarTitle">Channel Moderator Options</div>
                <button class="theme-button char-detail-button character-button-chankick" id="elChanKick">Kick</button>
                <button class="theme-button char-detail-button character-button-chantimeout" id="elChanTimeout">Timeout</button>
                <button class="theme-button theme-button-warning char-detail-button character-button-chanban" id="elChanBan">Ban</button>
            </div>

            <div class="channelowner-buttonbar">
                <div class="channelowner-buttonbar-title" id="elChannelOpButtonbarTitle">Channel Owner Options</div>
                <button class="theme-button char-detail-button character-button-chanmod" id="elChanMakeMod">Make Mod</button>
                <button class="theme-button char-detail-button character-button-chandemod" id="elChanDeMod">Remove Mod</button>
                <button class="theme-button char-detail-button character-button-chanmakeowner" id="elChanMakeOwner">Give Ownership</button>
            </div>
        `);

        const elCharacterIcon = this.$("elCharacterIcon") as HTMLImageElement;
        const elCharacterName = this.$("elCharacterName") as HTMLDivElement;
        const elConfigIconContainer = this.$("elConfigIconContainer") as HTMLDivElement;
        const elCharacterOnlineStatus = this.$("elCharacterOnlineStatus") as HTMLDivElement;
        const elCharacterStatusMessage = this.$("elCharacterStatusMessage") as HTMLDivElement;
        const elCharacterAlsoInChannels = this.$("elCharacterAlsoInChannels") as HTMLDivElement;
        const elStatusDotContainer = this.$("elStatusDotContainer") as HTMLDivElement;
        const elStatusText = this.$("elStatusText") as HTMLDivElement;
        let statusDot: StatusDotLightweight | null = null;

        const elChanKick = this.$("elChanKick") as HTMLButtonElement;
        const elChanTimeout = this.$("elChanTimeout") as HTMLButtonElement;
        const elChanBan = this.$("elChanBan") as HTMLButtonElement;
        const elChanMakeMod = this.$("elChanMakeMod") as HTMLButtonElement;
        const elChanDeMod = this.$("elChanDeMod") as HTMLButtonElement;
        const elChanMakeOwner = this.$("elChanMakeOwner") as HTMLButtonElement;

        const elPrivateMessage = this.$("elPrivateMessage") as HTMLButtonElement;
        const elFList = this.$("elFList") as HTMLButtonElement;
        const elIgnore = this.$("elIgnore") as HTMLButtonElement;

        this.clickable = true;

        const wcm = new WhenChangeManager();
        const wcmDesc = new WhenChangeManager();
        const updateDisplay = () => {
            const vm = this.viewModel;
            const character = vm?.char;
            const charSet = vm?.session?.characterSet;
            const isConnected = this.isComponentConnected;
            const reportContext = vm?.session?.selectedChannel;
            wcm.assign({ vm, character, charSet, isConnected, reportContext }, () => {
                if (vm && character && charSet && isConnected) {
                    const updateInner = (cs: CharacterStatus) => {
                        elCharacterIcon.src = URLUtils.getAvatarImageUrl(character);
                        elCharacterName.innerText = character.value;
                        elCharacterName.classList.forEach(v => { if (v.startsWith("gender-")) { elCharacterName.classList.remove(v); }});
                        elCharacterName.classList.add(`gender-${CharacterGenderConvert.toString(cs.gender).toLowerCase()}`);
                        statusDot!.status = cs.status;
                        elStatusText.innerText = OnlineStatusConvert.toString(cs.status);
                        elIgnore.innerText = cs.ignored ? "Unignore" : "Ignore";

                        this.elMain.classList.toggle("is-chanop", (vm.channelViewModel?.isEffectiveOp(vm.session.characterName)) ?? false);
                        this.elMain.classList.toggle("is-chanowner", (vm.channelViewModel?.isEffectiveOwner(vm.session.characterName)) ?? false);
                        this.elMain.classList.toggle("is-serverop", (vm.session.isServerOp(vm.session.characterName)) ?? false);

                        wcmDesc.assign({ bbcode: cs.statusMessage }, () => {
                            const parseResult = ChatBBCodeParser.parse(cs.statusMessage, {
                                sink: vm!.session!.bbcodeSink
                            });
                            elCharacterStatusMessage.appendChild(parseResult.element);
                            return asDisposable(() => {
                                parseResult.element.remove();
                                parseResult.dispose();
                            });
                        });
                    };
                    const statusListener = charSet.addStatusListenerDebug(
                        [ "CharacterDetailPopup.updateDisplay", character ],
                        character, updateInner);
                    updateInner(charSet.getCharacterStatus(character));
                    return asDisposable(
                        statusListener, 
                        () => { wcmDesc.cleanup(); }
                    );
                }
            });
        };

        this.watch(".", updateDisplay);
        this.watch("char", updateDisplay);
        this.watch("session", updateDisplay);
        this.watch("session.selectedChannel", updateDisplay);
        this.watch("alsoInChannels.length", len => {
            len = len ?? 0;
            elCharacterAlsoInChannels.classList.toggle("shown", (len > 0));
        });

        elConfigIconContainer.addEventListener("click", () => {
            if (this.viewModel) {
                this.viewModel.showSettings();
                this.viewModel.dismissed();
            }
        })
        elPrivateMessage.addEventListener("click", () => {
            const vm = this.viewModel;
            if (!vm) return;

            vm.session.activatePMConvo(vm.char);
            vm.dismissed();
        });
        elFList.addEventListener("click", () => {
            const vm = this.viewModel;
            if (!vm) return;

            vm.session.bbcodeSink.userClick(vm.char, {
                rightClick: false,
                channelContext: vm.channelViewModel,
                targetElement: elFList
            });
            vm.dismissed();
        });
        elIgnore.addEventListener("click", () => {
            const vm = this.viewModel;
            if (!vm) return;

            vm.toggleIgnore();
        });

        this.whenConnected(() => {
            statusDot = new StatusDotLightweight();
            elStatusDotContainer.appendChild(statusDot.element);
            updateDisplay();
            return asDisposable(() => {
                statusDot?.element.remove();
                statusDot?.dispose();
                statusDot = null;
            });
        });

        elChanKick.addEventListener("click", async () => {
            if (this.viewModel != null) {
                const confirmed = await this.viewModel.appViewModel.promptAsync({
                    title: "Are you sure?",
                    message: `Are you sure you want to kick ${this.viewModel.char.value}?`,
                    buttons: [
                        {
                            shortcutKeyCode: 27,  // ESC
                            style: DialogButtonStyle.CANCEL,
                            resultValue: false,
                            title: "Cancel"
                        },
                        {
                            shortcutKeyCode: 13,  // Enter
                            style: DialogButtonStyle.DEFAULT,
                            resultValue: true,
                            title: "Kick"
                        }
                    ]
                });
                if (confirmed) {
                    (this.viewModel.channelViewModel as ChatChannelViewModel).kickAsync(this.viewModel.char);
                }
            }
        });
        elChanTimeout.addEventListener("click", () => {
            // TODO:
        });
        elChanBan.addEventListener("click", async () => {
            if (this.viewModel != null) {
                const confirmed = await this.viewModel.appViewModel.promptAsync({
                    title: "Are you sure?",
                    message: `Are you sure you want to ban ${this.viewModel.char.value}?`,
                    buttons: [
                        {
                            shortcutKeyCode: 27,  // ESC
                            style: DialogButtonStyle.CANCEL,
                            resultValue: false,
                            title: "Cancel"
                        },
                        {
                            shortcutKeyCode: 13,  // Enter
                            style: DialogButtonStyle.DEFAULT,
                            resultValue: true,
                            title: "Ban"
                        }
                    ]
                });
                if (confirmed) {
                    (this.viewModel.channelViewModel as ChatChannelViewModel).banAsync(this.viewModel.char);
                }
            }
        });
        elChanMakeMod.addEventListener("click", async () => {
            if (this.viewModel != null) {
                const confirmed = await this.viewModel.appViewModel.promptAsync({
                    title: "Are you sure?",
                    message: `Are you sure you want to make ${this.viewModel.char.value} a moderator of ${this.viewModel.channelViewModel!.title}?`,
                    buttons: [
                        {
                            shortcutKeyCode: 27,  // ESC
                            style: DialogButtonStyle.CANCEL,
                            resultValue: false,
                            title: "Cancel"
                        },
                        {
                            shortcutKeyCode: 13,  // Enter
                            style: DialogButtonStyle.DEFAULT,
                            resultValue: true,
                            title: "Grant Moderator Powers"
                        }
                    ]
                });
                if (confirmed) {
                    // TODO:
                }
            }
        });
        elChanDeMod.addEventListener("click", async () => {
            if (this.viewModel != null) {
                const confirmed = await this.viewModel.appViewModel.promptAsync({
                    title: "Are you sure?",
                    message: `Are you sure you want to remove ${this.viewModel.char.value} from the moderators of ${this.viewModel.channelViewModel!.title}?`,
                    buttons: [
                        {
                            shortcutKeyCode: 27,  // ESC
                            style: DialogButtonStyle.CANCEL,
                            resultValue: false,
                            title: "Cancel"
                        },
                        {
                            shortcutKeyCode: 13,  // Enter
                            style: DialogButtonStyle.DEFAULT,
                            resultValue: true,
                            title: "Remove Moderator Powers"
                        }
                    ]
                });
                if (confirmed) {
                    // TODO:
                }
            }
        });
        elChanMakeOwner.addEventListener("click", async () => {
            if (this.viewModel != null) {
                const confirmed = await this.viewModel.appViewModel.promptAsync({
                    title: "Are you sure?",
                    message: `Are you sure you want to make ${this.viewModel.char.value} the new owner of ${this.viewModel.channelViewModel!.title}?`,
                    buttons: [
                        {
                            shortcutKeyCode: 27,  // ESC
                            style: DialogButtonStyle.CANCEL,
                            resultValue: false,
                            title: "Cancel"
                        },
                        {
                            shortcutKeyCode: 13,  // Enter
                            style: DialogButtonStyle.DEFAULT,
                            resultValue: true,
                            title: "Give Ownership"
                        }
                    ]
                });
                if (confirmed) {
                    // TODO:
                }
            }
        });
    }
}

@componentElement("x-chardetailalsoinchannels")
class CharacterDetailAlsoInChannels extends CollectionViewLightweight<AlsoInChannelLineItem> {
    constructor() {
        super();
    }

    createUserElement(vm: AlsoInChannelLineItem): HTMLElement | [HTMLElement, IDisposable] {
        const el = document.createElement("div");
        el.classList.add("character-alsoinchannels-list-item");
        el.appendChild(document.createTextNode(vm.title));
        return el;
    }

    destroyUserElement(vm: AlsoInChannelLineItem, el: HTMLElement): void | Promise<any> {
    }
}