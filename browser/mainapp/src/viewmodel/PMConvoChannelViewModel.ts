import { CharacterName } from "../shared/CharacterName.js";
import { AddMessageOptions, ChannelMessageType, ChannelMessageViewModel, ChannelViewModel, PendingMessageSendViewModel, PendingMessageType } from "./ChannelViewModel.js";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel.js";
import { CharacterSet } from "../shared/CharacterSet.js";
import { observableProperty } from "../util/ObservableBase.js";
import { HostInterop, LogMessageType, LogPMConvoMessage } from "../util/HostInterop.js";
import { CharacterDetailPopupViewModel } from "./popups/CharacterDetailPopupViewModel.js";
import { SendQueue } from "../util/SendQueue.js";
import { TaskUtils } from "../util/TaskUtils.js";
import { AppNotifyEventType } from "./AppViewModel.js";
import { CharacterGender } from "../shared/CharacterGender.js";
import { OnlineStatus } from "../shared/OnlineStatus.js";
import { TypingStatus } from "../shared/TypingStatus.js";
import { SavedChatStatePMConvo } from "../settings/AppSettings.js";
import { DateAnchor } from "../util/HostInteropLogSearch.js";
import { IDisposable } from "../util/Disposable.js";


export type PMConvoChannelViewModelSortKey = { zlastInteraction: number, zname: CharacterName }

export class PMConvoChannelViewModel extends ChannelViewModel {
    constructor(parent: ActiveLoginViewModel, character: CharacterName) {
        super(parent, character.value);

        this.character = character;

        this.prefixMessages.add(
            ChannelMessageViewModel.createLogNavMessage(this, "Click here to see earlier messages in the Log Viewer", () => {
                let minMsg: ChannelMessageViewModel | null = null;
                for (let m of this.mainMessages.iterateValues()) {
                    minMsg = m.value;
                    break;
                }
                if (minMsg) {
                    parent.openLogViewer(
                        parent.characterName,
                        DateAnchor.Before,
                        minMsg.timestamp,
                        this.character
                    );
                }
            }));

        const filteredSCC = parent.savedChatState.pmConvos.filter(x => x.character.equals(character));
        if (filteredSCC.length == 0) {
            this._scc = new SavedChatStatePMConvo({ character: character.value, lastInteraction: this.lastInteractionAt });
            //parent.savedChatState.pmConvos.push(this._scc);
        }
        else {
            this._scc = filteredSCC[0];
            this.lastInteractionAt = this._scc.lastInteraction;
        }

        this._characterStatusListener = this.activeLoginViewModel.characterSet.addStatusListener(character, (cs) => {
            this.contrapartyTypingStatusUpdated(cs.typingStatus);
        });
    }

    private readonly _characterStatusListener: IDisposable;

    private _scc: SavedChatStatePMConvo;
    get savedChatStatePMConvo() { return this._scc; }

    @observableProperty
    readonly character: CharacterName;

    get collectiveName(): string { return `pm:${this.character.value}`; }

    get description(): string { return this.parent.characterSet.getCharacterStatus(this.character).statusMessage; }

    @observableProperty
    get characterSet(): CharacterSet { return this.parent.characterSet; }

    @observableProperty
    override readonly canPin: boolean = false;

    @observableProperty
    override readonly canClose: boolean = true;

    @observableProperty
    get iconUrl() {
        return `https://static.f-list.net/images/avatar/${this.character.canonicalValue}.png`;
    }

    override async performRollAsync(rollSpecification: string): Promise<void> {
        await this.activeLoginViewModel.chatConnection.privateMessagePerformRollAsync(this.character, rollSpecification);
    }

    private _typingStatus: TypingStatus = TypingStatus.NONE;
    get myTypingStatus() { return this._typingStatus; }
    set myTypingStatus(value: TypingStatus) {
        if (value !== this._typingStatus) {
            this._typingStatus = value;
            this.activeLoginViewModel.chatConnection.setTypingStatusAsync(this.character, value);
        }
    }

    private readonly TYPING_IDLE_TIMEOUT_MS = 5000;

    private _typingStatusIdleTimeoutHandle: number | null = null;
    protected override onTextBoxContentUpdated() {
        if (!(this.activeLoginViewModel.pmConversations.has(this.sortKey) || this.activeLoginViewModel.selectedTab == this)) {
            this.myTypingStatus = TypingStatus.NONE;
        }
        else {
            if (this.textBoxContent == "") {
                this.myTypingStatus = TypingStatus.NONE;
            }
            else {
                this.myTypingStatus = TypingStatus.TYPING;
                if (this._typingStatusIdleTimeoutHandle) {
                    window.clearTimeout(this._typingStatusIdleTimeoutHandle);
                }
                this._typingStatusIdleTimeoutHandle = window.setTimeout(() => {
                    if (!(this.activeLoginViewModel.pmConversations.has(this.sortKey) || this.activeLoginViewModel.selectedTab == this)) {
                        this.myTypingStatus = TypingStatus.NONE;
                    }
                    else {
                        if (this.textBoxContent == "") {
                            this.myTypingStatus = TypingStatus.NONE;
                        }
                        else {
                            this.myTypingStatus = TypingStatus.IDLE;
                        }
                    }
                }, this.TYPING_IDLE_TIMEOUT_MS);
            }
        }
    }

    private _lastContrapartyTypingStatus: TypingStatus = TypingStatus.NONE;
    private contrapartyTypingStatusUpdated(status: TypingStatus) {
        if (status !== this._lastContrapartyTypingStatus) {
            this._lastContrapartyTypingStatus = status;

            const hasExistingStatusIndicator = (this.suffixMessages.length > 0);
            let addStatusIndicator = false;

            switch (status) {
                case TypingStatus.TYPING:
                case TypingStatus.IDLE:
                    addStatusIndicator = true;
                    break;
                case TypingStatus.NONE:
                default:
                    addStatusIndicator = hasExistingStatusIndicator && this.activeLoginViewModel.selectedTab == this;
                    break;
            }

            if (this.suffixMessages.length > 0) {
                this.suffixMessages.clear();
            }
            if (addStatusIndicator) {
                const ind = ChannelMessageViewModel.createTypingStatusMessage(this, this.character, status);
                this.suffixMessages.add(ind);
            }
        }
    }
    private maybeRemoveTypingStatusIndicator() {
        if (this._lastContrapartyTypingStatus == TypingStatus.NONE && this.suffixMessages.length > 0) {
            this.suffixMessages.clear();
        }
    }

    override onIsTabActiveChanged() {
        super.onIsTabActiveChanged();
        this.maybeRemoveTypingStatusIndicator();
    }

    @observableProperty
    canSendTextboxAsChat: boolean = true;

    private readonly _sendQueue: SendQueue = new SendQueue();

    async sendTextboxInternalAsync(): Promise<void> {
        if (this.textBoxContent && this.textBoxContent != "") {
            const msgContent = this.textBoxContent;
            this.textBoxContent = "";

            this.pendingSendsCount++;
            this._sendQueue.executeAsync({
                maxRetries: 3,
                onAttemptAsync: async () => {
                    await this.parent.chatConnection.privateMessageSendAsync(this.character, msgContent);
                },
                onSuccessAsync: async () => {
                    this.addChatMessage({
                        isAd: false,
                        message: msgContent,
                        speakingCharacter: this.activeLoginViewModel.characterName,
                        seen: false
                    });
                    this.pendingSendsCount--;
                },
                onFailBeforeRetryAsync: async () => {
                    await TaskUtils.delay(1000);
                },
                onFailTerminalAsync: async () => {
                    this.addSystemMessage(new Date(), `Failed to send: ${msgContent}`, true);
                    this.pendingSendsCount--;
                }
            });
        }
    }

    addMessage(message: ChannelMessageViewModel, options?: AddMessageOptions) {
        super.addMessage(message, options);

        let logMessageType: LogMessageType | null = null;
        
        switch (message.type) {
            case ChannelMessageType.CHAT:
                logMessageType = LogMessageType.CHAT;
                break;
            case ChannelMessageType.ROLL:
                logMessageType = LogMessageType.ROLL;
                break;
        }
        if (logMessageType != null && !(options?.fromReplay ?? false)) {
            HostInterop.logPMConvoMessage(this.activeLoginViewModel.characterName, this.character, 
                message.characterStatus.characterName, message.characterStatus.gender, message.characterStatus.status,
                logMessageType, message.text);
        }

        if (!this.parent.ignoredChars.has(message.characterStatus.characterName)) {
            if (message.type == ChannelMessageType.CHAT ||
                message.type == ChannelMessageType.ROLL) {

                this.lastInteractionAt = Math.max(this.lastInteractionAt, message.timestamp.getTime());
            }
        }
        if (message.type == ChannelMessageType.CHAT ||
            message.type == ChannelMessageType.ROLL) {

            if (message.characterStatus.characterName == this.character) {
                this._lastContrapartyTypingStatus = TypingStatus.NONE;
                this.maybeRemoveTypingStatusIndicator();
            }
        }
    }

    protected pingIfNecessary(message: ChannelMessageViewModel) {
        if (!this.isTabActive && message.characterStatus.characterName != this.parent.characterName) {
            if (message.type == ChannelMessageType.CHAT ||
                message.type == ChannelMessageType.ROLL) {

                this.hasPing = true;
                this.activeLoginViewModel.appViewModel.soundNotification({ 
                    eventType: AppNotifyEventType.PRIVATE_MESSAGE_RECEIVED,
                    myCharacter: this.activeLoginViewModel.characterName,
                    activeLoginViewModel: this.activeLoginViewModel,
                    happenedWithInterlocutor: this.character
                });
            }
        }
    }

    protected increaseUnseenCountIfNecessary(): void {
    }

    private _lastInteractionAt: number = 0;
    @observableProperty
    get lastInteractionAt() { return this._lastInteractionAt; }
    set lastInteractionAt(value) {
        if (value != this._lastInteractionAt) {
            this._lastInteractionAt = value;
            this.activeLoginViewModel.updatePMConvoOrdering(this);
            this.onLastInteractionAtChanged();
        }
    }

    protected onLastInteractionAtChanged() {
        this._scc.lastInteraction = this.lastInteractionAt;
    }

    private _sortKey: (PMConvoChannelViewModelSortKey | null) = null;
    get sortKey() {
        if (!this._sortKey) {
            this._sortKey = { zlastInteraction: this.lastInteractionAt, zname: this.character };
        }
        return this._sortKey;
    }

    rekey() {
        this._sortKey = { zlastInteraction: this.lastInteractionAt, zname: this.character };
    }
    needRekey() {
        return this.sortKey.zlastInteraction != this.lastInteractionAt ||
            this.sortKey.zname != this.character;
    }

    override close(): void {
        if (this.canClose) {
            if (this._characterStatusListener) {
                this._characterStatusListener.dispose();
            }

            this.hiddenForClose = true;
            this.myTypingStatus = TypingStatus.NONE;
            this.activeLoginViewModel.closePmConvo(this.character);
            //this.activeLoginViewModel.savedChatState.pmConvos.removeWhere(x => x.character.equals(this.character));
        }
    }

    showCharacterContextPopup(targetEl: HTMLElement) {
        const popupVm = new CharacterDetailPopupViewModel(this.appViewModel, this.parent, this.character, null, targetEl);
        this.appViewModel.popups.push(popupVm);
    }
}
