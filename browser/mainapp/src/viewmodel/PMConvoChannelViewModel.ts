import { CharacterName } from "../shared/CharacterName.js";
import { AddMessageOptions, ChannelMessageType, ChannelMessageViewModel, ChannelViewModel, MultiSelectChannelFilterOptionItem, MultiSelectChannelFilterOptions, PendingMessageSendViewModel, PendingMessageType, SingleSelectChannelFilterOptions } from "./ChannelViewModel.js";
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
import { IterableUtils } from "../util/IterableUtils.js";
import { ChannelFiltersViewModel } from "./ChannelFiltersViewModel.js";
import { ObservableExpression } from "../util/ObservableExpression.js";
import { CatchUtils } from "../util/CatchUtils.js";


export class PMConvoChannelViewModelSortKey { 
    constructor(
        public readonly zlastInteraction: number,
        public readonly zname: CharacterName) {
    }

    static compare(a: PMConvoChannelViewModelSortKey, b: PMConvoChannelViewModelSortKey): number {
        // inverse
        if (a.zlastInteraction > b.zlastInteraction) return -1;
        if (a.zlastInteraction < b.zlastInteraction) return 1;

        if (a.zname.value < b.zname.value) return -1;
        if (a.zname.value > b.zname.value) return 1;

        return 0;
    }
}

export class PMConvoChannelViewModel extends ChannelViewModel {
    constructor(parent: ActiveLoginViewModel, character: CharacterName) {
        super(parent, character.value);

        this.character = character;
        this.showConfigButton = true;
        this.canClose = true;
        this.canPin = false;

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

        this.channelFilters = new ChannelFiltersViewModel(this);
        this.channelFilters.addCategory("chattext", "Chat (Text)", "Normal chat messages.");
        this.channelFilters.addCategory("chatemote", "Chat (Emote)", "Chat emote messages.");
        this.channelFilters.addCategory("roll", "Dice Rolls", "Dice Rolls");
        this.channelFilters.addCategory("system", "System Messages", "System Messages");
        const setupDefaultFilters = () => {
            const nfAll = this.channelFilters!.addNamedFilter("All", [ "chattext", "chatemote", "roll", "system" ]);
            this.channelFilters!.selectedFilter = nfAll;
        };

        const filteredSCC = IterableUtils.asQueryable(parent.savedChatState.pmConvos.filter(x => x.character.equals(character))).firstOrNull();
        if (!filteredSCC) {
            this._scc = new SavedChatStatePMConvo(null, { character: character.value, lastInteraction: this.lastInteractionAt });
            //parent.savedChatState.pmConvos.push(this._scc);
            setupDefaultFilters();
        }
        else {
            this._scc = filteredSCC;
            this.lastInteractionAt = this._scc.lastInteraction;
            this.channelFilters.loadFromSCC(this._scc.namedFilters, () => setupDefaultFilters());
        }

        const ee = new ObservableExpression(() => this.channelFilters!.sccData,
            (v) => { this._scc!.namedFilters = v ?? null; },
            (err) => { });

        this._characterStatusListener = this.activeLoginViewModel.characterSet.addStatusListener(character, (cs) => {
            this.contrapartyTypingStatusUpdated(cs.typingStatus);
        });

        
        // if (filteredSCC && filteredSCC.filters) {
        //     this.showFilterClasses = filteredSCC.filters;
        // }
        this.updateFilterOptions();
    }

    override dispose(): void {
        this._characterStatusListener.dispose();
    }

    private updateFilterOptions() {
        const filterSelectOptions: MultiSelectChannelFilterOptionItem[] = [];
        filterSelectOptions.push(
            new MultiSelectChannelFilterOptionItem("chattext", "Chat (Text)"),
            new MultiSelectChannelFilterOptionItem("chatemote", "Chat (Emote)"),
            new MultiSelectChannelFilterOptionItem("roll", "Dice Rolls"),
            new MultiSelectChannelFilterOptionItem("system", "System Messages")
        );
        for (let i of filterSelectOptions) {
            if (this.showFilterClasses) {
                i.isSelected = this.showFilterClasses.indexOf(i.value) != -1;
            }
            else {
                i.isSelected = true;
            }
        }
        const fo = new MultiSelectChannelFilterOptions(this, (selectedValues) => {
            for (let i of filterSelectOptions) {
                i.isSelected = (selectedValues.indexOf(i.value) != -1);
            }
            this.showFilterClasses = selectedValues;
        });
        fo.items.push(...filterSelectOptions);
        
        this.filterOptions = fo;
    }

    private readonly _characterStatusListener: IDisposable;

    private _scc: SavedChatStatePMConvo;
    get savedChatStatePMConvo() { return this._scc; }

    override get showFilterClasses() { return super.showFilterClasses; }
    override set showFilterClasses(value: string[]) {
        super.showFilterClasses = value;
        // if (this._scc) {
        //     this._scc.filters = value;
        // }
    }

    @observableProperty
    readonly character: CharacterName;

    get collectiveName(): string { return `pm:${this.character.value}`; }

    override async showSettingsDialogAsync() { 
        await this.parent.appViewModel.showSettingsDialogAsync(this.parent, this.character);
    }

    get description(): string { return this.parent.characterSet.getCharacterStatus(this.character).statusMessage; }

    @observableProperty
    get characterSet(): CharacterSet { return this.parent.characterSet; }

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
        if (!(this.activeLoginViewModel.pmConversations.contains(this) || this.activeLoginViewModel.selectedTab == this)) {
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
                    if (!(this.activeLoginViewModel.pmConversations.contains(this) || this.activeLoginViewModel.selectedTab == this)) {
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
            try {
                await this.parent.chatConnection.checkPrivateMessageSendAsync(this.character, msgContent);
            }
            catch (e) { 
                this.addSystemMessage(new Date(), `Cannot send: ${CatchUtils.getMessage(e)}`, true);
                return;
            }
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
                    activeLoginViewModel: this.activeLoginViewModel,
                    channel: this
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
            this._sortKey = new PMConvoChannelViewModelSortKey(this.lastInteractionAt, this.character);
        }
        return this._sortKey;
    }

    rekey() {
        this._sortKey = new PMConvoChannelViewModelSortKey(this.lastInteractionAt, this.character);
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
