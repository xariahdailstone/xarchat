import { TypingStatus } from "../shared/TypingStatus.js";
import { BBCodeUtils } from "../util/BBCodeUtils.js";
import { asDisposable } from "../util/Disposable.js";
import { EL } from "../util/EL.js";
import { FocusMagnet } from "../util/FocusMagnet.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { KeyCodes } from "../util/KeyCodes.js";
import { TextEditShortcutsHelper } from "../util/TextEditShortcutsHelper.js";
import { WhenChangeManager } from "../util/WhenChange.js";
import { ChatConnectionState } from "../viewmodel/ActiveLoginViewModel.js";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel.js";
import { ChatChannelMessageMode, ChatChannelPresenceState, ChatChannelViewModel } from "../viewmodel/ChatChannelViewModel.js";
import { ConsoleChannelViewModel } from "../viewmodel/ConsoleChannelViewModel.js";
import { PMConvoChannelViewModel } from "../viewmodel/PMConvoChannelViewModel.js";
import { EIconSearchDialogViewModel } from "../viewmodel/dialogs/EIconSearchDialogViewModel.js";
import { ChannelEditHelpPopupViewModel } from "../viewmodel/popups/ChannelEditHelpPopupViewModel.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";

@componentElement("x-channeltextbox")
export class ChannelTextBox extends ComponentBase<ChannelViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div id="elControls">
                <div id="elTextboxContainer" class="textbox-container no-toolbar">
                    <div class="textbox-toolbar">
                        <div class="textbox-toolbar-expandedcontainer">
                            <div class="textbox-toolbar-button" data-buttoncommand="bold" title="Bold (Ctrl+B)">
                                <x-iconimage src="assets/ui/textbox-toolbar/bold.svg"></x-iconimage>
                            </div>
                            <div class="textbox-toolbar-button" data-buttoncommand="italic" title="Italic (Ctrl+I)">
                                <x-iconimage src="assets/ui/textbox-toolbar/italic.svg"></x-iconimage>
                            </div>
                            <div class="textbox-toolbar-button" data-buttoncommand="underline" title="Underline (Ctrl+U)">
                                <x-iconimage src="assets/ui/textbox-toolbar/underline.svg"></x-iconimage>
                            </div>
                            <div class="textbox-toolbar-button" data-buttoncommand="strikethrough" title="Strikethrough (Ctrl+S)">
                                <x-iconimage src="assets/ui/textbox-toolbar/strikethrough.svg"></x-iconimage>
                            </div>
                            <div class="textbox-toolbar-separator"></div>
                            <div class="textbox-toolbar-button" data-buttoncommand="subscript" title="Subscript (Ctrl+Down or Ctrl+H)">
                                <x-iconimage src="assets/ui/textbox-toolbar/subscript.svg"></x-iconimage>
                            </div>
                            <div class="textbox-toolbar-button" data-buttoncommand="superscript" title="Superscript (Ctrl+Up or Ctrl+Y)">
                                <x-iconimage src="assets/ui/textbox-toolbar/superscript.svg"></x-iconimage>
                            </div>
                            <div class="textbox-toolbar-separator"></div>
                            <div class="textbox-toolbar-button" data-buttoncommand="spoiler" title="Spoiler (Ctrl+K)">
                                <x-iconimage src="assets/ui/textbox-toolbar/spoiler.svg"></x-iconimage>
                            </div>
                            <div class="textbox-toolbar-separator"></div>
                            <div class="textbox-toolbar-button" data-buttoncommand="user" title="User Link (Ctrl+R)">
                                <x-iconimage src="assets/ui/textbox-toolbar/user.svg"></x-iconimage>
                            </div>
                            <div class="textbox-toolbar-button" data-buttoncommand="icon" title="User Icon (Ctrl+O)">
                                <x-iconimage src="assets/ui/textbox-toolbar/icon.svg"></x-iconimage>
                            </div>
                            <div class="textbox-toolbar-separator"></div>
                            <div class="textbox-toolbar-button" data-buttoncommand="eicon" title="EIcon (Ctrl+E)">
                                <x-iconimage src="assets/ui/textbox-toolbar/eicon.svg"></x-iconimage>
                            </div>
                            <div class="textbox-toolbar-separator"></div>
                            <div class="textbox-toolbar-button" data-buttoncommand="noparse" title="No Parse (Ctrl+N)">
                                <x-iconimage src="assets/ui/textbox-toolbar/noparse.svg"></x-iconimage>
                            </div>
                        </div>
                        <div class="textbox-toolbar-toggle" title="Show Editing Help">
                            <x-iconimage src="assets/ui/help-icon.svg" id="elShowEditHelp"></x-iconimage>
                        </div>
                    </div>
                    <textarea id="elTextbox" data-focusmagnet-strength="1"></textarea>
                </div>
                <div class="textbox-statusbar" id="elStatusBar">0 words :: 0/30,000 characters used</div>
                <div class="buttons-container">
                    <button id="elSendChat">Send Chat</button>
                    <button id="elSendAd">Send Ad</button>
                </div>
            </div>
        `);

        const elTextbox = this.$("elTextbox")! as HTMLTextAreaElement;
        const elSendChat = this.$("elSendChat")! as HTMLButtonElement;
        const elSendAd = this.$("elSendAd")! as HTMLButtonElement;
        const elStatusBar = this.$("elStatusBar") as HTMLDivElement;

        const elTextboxContainer = this.$("elTextboxContainer") as HTMLDivElement;
        const elShowEditHelp = this.$("elShowEditHelp") as HTMLButtonElement;

        const disableReasonWCM = new WhenChangeManager();
        const updateDisableStates = () => {
            const vm = this.viewModel;
            const isConnectedToChat = (vm?.activeLoginViewModel?.connectionState ?? ChatConnectionState.DISCONNECTED_NORMALLY) == ChatConnectionState.CONNECTED;
            const actuallyInChannel = isConnectedToChat && (vm ? (vm instanceof ChatChannelViewModel ? vm.actuallyInChannel : true) : false);
            const canSendTextbox = actuallyInChannel && vm && vm.canSendTextbox;
            const canSendTextboxAsChat = (actuallyInChannel && vm && (vm instanceof ChatChannelViewModel) && vm.canSendTextboxAsChat) ||
                ((vm instanceof PMConvoChannelViewModel || vm instanceof ConsoleChannelViewModel) && canSendTextbox);
            const canSendTextboxAsAd = actuallyInChannel && vm && (vm instanceof ChatChannelViewModel) && vm.canSendTextboxAsAd;

            elTextbox.disabled = !canSendTextbox;
            elSendChat.disabled = !canSendTextbox || !canSendTextboxAsChat;
            elSendAd.disabled = !canSendTextbox || !canSendTextboxAsAd;
            disableReasonWCM.assign({ isConnectedToChat, actuallyInChannel }, () => {
                if (isConnectedToChat && !actuallyInChannel) {
                    let msg = `You are no longer in this channel.`;

                    if (vm instanceof ChatChannelViewModel) {
                        switch (vm.presenceState) {
                            case ChatChannelPresenceState.JOINING_CHANNEL:
                                msg = "Attempting to rejoin channel...";
                                break;
                            case ChatChannelPresenceState.NOT_IN_CHANNEL:
                                msg = "You are no longer in this channel.";
                                break;
                            case ChatChannelPresenceState.PENDING_RECONNECT:
                                msg = "This channel will automatically reconnect when chat is reconnected."
                                break;
                        }
                    }
                    
                    const noticeEl = EL("div", { class: "disabled-reason-message" }, [ msg ]);
                    this.elMain.appendChild(noticeEl);
                    return asDisposable(() => {
                        noticeEl.remove();
                    });
                }
            });
        };

        this.watchViewModel(vm => {
            if (vm instanceof PMConvoChannelViewModel) {
                elSendChat.innerText = "Send PM";
            }
            else if (vm instanceof ConsoleChannelViewModel) {
                elSendChat.innerText = "Send Command";
            }
            else {
                elSendChat.innerText = "Send Chat";
            }
        });

        this.watchExpr(vm => vm.activeLoginViewModel.connectionState, (v: (ChatConnectionState | null)) => {
            updateDisableStates();
        });
        this.watchExprTyped(ChatChannelViewModel, vm => vm.actuallyInChannel, (v) => {
            updateDisableStates();
        });
        this.watchExpr(vm => vm.canSendTextbox, (v) => {
            updateDisableStates();
        });
        this.watchExprTyped(ChatChannelViewModel, vm => vm.canSendTextboxAsChat, (v) => {
            updateDisableStates();
        });
        this.watchExprTyped(ChatChannelViewModel, vm => vm.canSendTextboxAsAd, (v) => {
            updateDisableStates();
        });
        this.watchExpr(vm => vm.textBoxContent, (v) => {
            if (v != elTextbox.value) {
                elTextbox.value = v ?? "";
            }
        });
        this.watchExpr(vm => [ vm, vm.textBoxContent, vm.getConfigSettingById("showChatTextboxStatusBar"), vm instanceof ChatChannelViewModel ? vm.messageMode : null ], (v) => {
            if (v) {
                const vm = v[0];
                const txt = v[1];
                const statusBarShown = !!v[2];
                const messageMode = v[3];
                if (statusBarShown) {
                    const charCount = txt.length;
                    const wordCount = txt.split(/\s+/).filter(x => x != "").length;

                    const wordCountStr = `${wordCount.toLocaleString()} word${wordCount == 1 ? '' : 's'}`;
                    const charCountPlural = `character${charCount == 1 ? '' : 's'}`;
                    if (vm instanceof ChatChannelViewModel) {
                        const chatMax = vm.activeLoginViewModel.serverVariables['chat_max'];
                        const lfrpMax = vm.activeLoginViewModel.serverVariables['lfrp_max'];
                        switch (messageMode) {
                            case ChatChannelMessageMode.CHAT_ONLY:
                                elStatusBar.innerText = `${wordCountStr} :: ${charCount.toLocaleString()} ${charCountPlural} used (max ${chatMax.toLocaleString()} chat)`;
                                break;
                            case ChatChannelMessageMode.ADS_ONLY:
                                elStatusBar.innerText = `${wordCountStr} :: ${charCount.toLocaleString()} ${charCountPlural} used (max ${lfrpMax.toLocaleString()} ad)`;
                                break;
                            default:
                            case ChatChannelMessageMode.BOTH:
                                elStatusBar.innerText = `${wordCountStr} :: ${charCount.toLocaleString()} ${charCountPlural} ` +
                                    `(max ${chatMax.toLocaleString()} chat, ` +
                                    `${lfrpMax.toLocaleString()} ad)`;
                        }
                    }
                    else if (vm instanceof PMConvoChannelViewModel) {
                        const privMax = vm.activeLoginViewModel.serverVariables['priv_max'];
                        elStatusBar.innerText = `${wordCountStr} :: ${charCount.toLocaleString()} ${charCountPlural} used (max ${privMax.toLocaleString()} pm)`;
                    }
                    else {
                        elStatusBar.innerText = wordCountStr;
                    }
                }
                else {
                    elStatusBar.innerText = "";
                }
            }
        });
        
        this.watchExpr(vm => vm instanceof ChatChannelViewModel ? vm.messageMode : null, (v) => {
            if (v === null || v === undefined) {
                elSendChat.classList.remove("hidden");
                elSendAd.classList.add("hidden");
                this.elMain.setAttribute("data-messagemode", "chat");
            }
            else {
                let showChatButton = false;
                let showAdButton = false;
                switch (v) {
                    case ChatChannelMessageMode.ADS_ONLY:
                        showAdButton = true;
                        this.elMain.setAttribute("data-messagemode", "ads");
                        break;
                    case ChatChannelMessageMode.CHAT_ONLY:
                        showChatButton = true;
                        this.elMain.setAttribute("data-messagemode", "chat");
                        break;
                    case ChatChannelMessageMode.BOTH:
                        showAdButton = true;
                        showChatButton = true;
                        this.elMain.setAttribute("data-messagemode", "both");
                        break;
                    default:
                        break;
                }
                elSendAd.classList.toggle("hidden", !showAdButton);
                elSendChat.classList.toggle("hidden", !showChatButton);
            }
        });

        this.watchExpr(vm => vm instanceof ChatChannelViewModel ? vm.adSendWaitRemainingSec : null, remainSec => {
            if (remainSec == null) {
                elSendAd.innerText = "Send Ad";
            }
            else {
                elSendAd.innerText = `Wait ${remainSec}s...`
            }
            updateDisableStates();
        });

        let helpPopupVM: ChannelEditHelpPopupViewModel | null = null;
        const pushTextbox = () => {
            if (this.viewModel != null) {
                this.viewModel.textBoxContent = elTextbox.value;
            }
            if (helpPopupVM != null) {
                helpPopupVM.dismissed();
                helpPopupVM = null;
            }
        }
        elTextbox.addEventListener("input", pushTextbox);
        elTextbox.addEventListener("change", pushTextbox);
        BBCodeUtils.addEditingShortcuts(elTextbox, {
            appViewModelGetter: () => { return this.viewModel?.appViewModel ?? null; },
            channelViewModelGetter: () => { return this.viewModel ?? null; },
            onKeyDownHandler: (ev, handleShortcuts) => {
                if (ev.keyCode == 13 && !ev.shiftKey) {
                    ev.preventDefault();
                    const mm = (this.viewModel instanceof ChatChannelViewModel) ? (this.viewModel?.messageMode ?? null) : ChatChannelMessageMode.CHAT_ONLY;
                    switch (mm) {
                        case ChatChannelMessageMode.ADS_ONLY:
                            this.sendAd();
                            break;
                        case ChatChannelMessageMode.CHAT_ONLY:
                        case ChatChannelMessageMode.BOTH:
                            this.sendChat();
                            break;
                    }
                }
                else if (ev.ctrlKey && ev.keyCode == KeyCodes.KEY_T && this.viewModel) {
                    const avm = this.viewModel.activeLoginViewModel.appViewModel;
                    avm.setConfigSettingById("showChatTextboxToolbar", !avm.getConfigSettingById("showChatTextboxToolbar"));
                    ev.preventDefault();
                }
                else if (ev.ctrlKey && ev.keyCode == KeyCodes.KEY_W && this.viewModel) {
                    const avm = this.viewModel.activeLoginViewModel.appViewModel;
                    avm.setConfigSettingById("showChatTextboxStatusBar", !avm.getConfigSettingById("showChatTextboxStatusBar"));
                    ev.preventDefault();
                }
                else if (ev.keyCode == KeyCodes.F1 && this.viewModel) {
                    if (helpPopupVM != null) {
                        helpPopupVM.dismissed();
                        helpPopupVM = null;
                    }
                    else {
                        helpPopupVM = new ChannelEditHelpPopupViewModel(this.viewModel.appViewModel, elShowEditHelp, () => { helpPopupVM = null; });
                        this.viewModel.appViewModel.popups.push(helpPopupVM);
                    }
                }
                else if (handleShortcuts(ev)) {
                    ev.preventDefault();
                }
            },
            onTextChanged: (value) => { this.viewModel!.textBoxContent = value; }
        });

        elSendChat.addEventListener("click", () => this.sendChat());
        elSendAd.addEventListener("click", () => this.sendAd());

        elSendAd.addEventListener("contextmenu", (e) => {
            if (this.viewModel && this.viewModel instanceof ChatChannelViewModel) {
                this.viewModel.showSendAdContextMenu(elSendAd);

                e.preventDefault();
                return false;
            }
        });

        this.watchExpr(vm => vm.appViewModel.getConfigSettingById("showChatTextboxToolbar"), tbs => {
            elTextboxContainer.classList.toggle("no-toolbar", !tbs);
            elTextboxContainer.classList.toggle("toolbar-shown", !!tbs);
        });
        this.watchExpr(vm => vm.appViewModel.getConfigSettingById("showChatTextboxStatusBar"), tbs => {
            this.elMain.classList.toggle("no-statusbar", !tbs);
            this.elMain.classList.toggle("statusbar-shown", !!tbs);
        });
        elShowEditHelp.addEventListener("click", () => {
            if (this.viewModel) {
                helpPopupVM = new ChannelEditHelpPopupViewModel(this.viewModel.appViewModel, elShowEditHelp, () => { helpPopupVM = null; });
                this.viewModel.appViewModel.popups.push(helpPopupVM);
            }
            elTextbox.focus();
        });

        this.elMain.querySelectorAll(".textbox-toolbar-button").forEach(btn => {
            btn.addEventListener("click", () => {
                const cmd = btn.getAttribute("data-buttoncommand");
                if (cmd) {
                    this.tryHandleButtonCommand(cmd);
                }
                elTextbox.focus();
            });
        });
    }

    focusTextBox() {
        window.requestAnimationFrame(() => {
            this.logger.logDebug("focusTextBox");
            const elTextbox = this.$("elTextbox")! as HTMLTextAreaElement;
            if (FocusMagnet.instance.ultimateFocus != elTextbox) {
                elTextbox.focus();
            }
        });
    }

    private tryHandleButtonCommand(cmd: string) {
        const elTextbox = this.$("elTextbox")! as HTMLTextAreaElement;

        const tesh = new TextEditShortcutsHelper();
        tesh.value = elTextbox.value;
        tesh.selectionAt = Math.min(elTextbox.selectionStart, elTextbox.selectionEnd)
        tesh.selectionLength = Math.abs(elTextbox.selectionEnd - elTextbox.selectionStart);

        let loadBack = false;

        switch (cmd) {
            case "bold":
                tesh.bold();
                loadBack = true;
                break;
            case "eicon":
                tesh.eicon();
                loadBack = true;
                break;
            case "italic":
                tesh.italic();
                loadBack = true;
                break;
            case "underline":
                tesh.underline();
                loadBack = true;
                break;
            case "superscript":
                tesh.superscript();
                loadBack = true;
                break;
            case "subscript":
                tesh.subscript();
                loadBack = true;
                break;
            case "spoiler":
                tesh.spoiler();
                loadBack = true;
                break;
            case "noparse":
                tesh.noparse();
                loadBack = true;
                break;
            case "icon":
                tesh.icon();
                loadBack = true;
                break;
            case "user":
                tesh.user();
                loadBack = true;
                break;
            case "strikethrough":
                tesh.strikethrough();
                loadBack = true;
                break;
        }

        if (loadBack) {
            elTextbox.value = tesh.value;
            elTextbox.setSelectionRange(tesh.selectionAt, tesh.selectionAt + tesh.selectionLength);
            return true;
        }
    }

    get viewModel(): (ChannelViewModel | null) { return super.viewModel; }

    private async sendChat() {
        const vm = this.viewModel;
        if (vm) {
            const elTextbox = this.$("elTextbox")! as HTMLTextAreaElement;

            try {
                await vm.sendTextboxAsync();
            }
            finally {
                elTextbox.focus();
            }
        }
    }

    private async sendAd() {
        const vm = this.viewModel;
        if (vm && vm instanceof ChatChannelViewModel) {
            const elTextbox = this.$("elTextbox")! as HTMLTextAreaElement;

            try {
                await vm.sendTextboxAsAdAsync();
            }
            finally {
                elTextbox.focus();
            }
        }
    }
}