import { ChannelName } from "../shared/ChannelName.js";
import { AddMessageOptions, ChannelMessageType, ChannelMessageViewModel, ChannelMessageViewModelOrderedDictionary, ChannelViewModel, PendingMessageSendViewModel, PendingMessageType } from "./ChannelViewModel.js";
import { ActiveLoginViewModel, CharactersEventListener, ChatConnectionState } from "./ActiveLoginViewModel.js";
import { Collection, CollectionChangeType, ObservableCollection, ReadOnlyObservableCollection } from "../util/ObservableCollection.js";
import { CharacterName } from "../shared/CharacterName.js";
import { ObservableBase, observableProperty } from "../util/ObservableBase.js";
import { OnlineStatus } from "../shared/OnlineStatus.js";
import { ObservableKeyExtractedOrderedDictionary, ObservableOrderedDictionary, ObservableOrderedDictionaryImpl } from "../util/ObservableKeyedLinkedList.js";
import { IDisposable, asDisposable } from "../util/Disposable.js";
import { HostInterop, LogMessageType } from "../util/HostInterop.js";
import { SavedChatStateJoinedChannel } from "../settings/AppSettings.js";
import { SendQueue } from "../util/SendQueue.js";
import { TaskUtils } from "../util/TaskUtils.js";
import { AppNotifyEventType } from "./AppViewModel.js";
import { DateAnchor, LogSearchKind } from "../util/HostInteropLogSearch.js";
import { SnapshottableMap } from "../util/collections/SnapshottableMap.js";
import { SnapshottableSet } from "../util/collections/SnapshottableSet.js";

export class ChatChannelUserViewModel extends ObservableBase implements IDisposable {
    constructor(
        public readonly parent: ChatChannelViewModel, 
        public readonly character: CharacterName) {
            
        super();

        this._statusListener = this.characterSet.addStatusListenerDebug(
            [ "ChatChannelUserViewModel", this ],
            character, (cs) => {
                this.parent.updateUserInLists(character);
            });
    }

    private readonly _statusListener: IDisposable;

    dispose() {
        this._statusListener.dispose();
    }

    [Symbol.dispose]() { this.dispose(); }

    get characterSet() { return this.parent.parent.characterSet; }
}

export type ChatChannelViewModelSortKey = { zsortOrder: number, ztitle: string, zpinned: boolean };
export class ChatChannelViewModel extends ChannelViewModel {
    constructor(parent: ActiveLoginViewModel, name: ChannelName, title: string) {
        super(parent, title);

        this.name = name;
        this.title = title;

        this.mainMessages = this._bothMessages;

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
                        this.name
                    );
                }
            }));

        const isAlreadyInSCC = parent.savedChatState.joinedChannels.filter(x => x.name == name).length > 0;
        if (!isAlreadyInSCC) {
            parent.savedChatState.joinedChannels.push(new SavedChatStateJoinedChannel({ name: name.value, title: title ?? name.value }));
        }
    }

    private _name: ChannelName = ChannelName.create("");
    @observableProperty
    get name(): ChannelName { return this._name ?? ChannelName.create(""); }
    set name(value) {
        if (value !== this._name) {
            this._name = value;
            this.parent.updateChannelPinState(this);
        }
    }

    @observableProperty
    get title() { return this._title; }
    set title(value) {
        if (value !== this._title) {
            this._title = value;
            this.parent.updateChannelPinState(this);
        }
    }

    get collectiveName(): string { return `ch:${this.name.value}`; }

    @observableProperty
    presenceState: ChatChannelPresenceState = ChatChannelPresenceState.NOT_IN_CHANNEL;

    @observableProperty
    get actuallyInChannel() { return (this.presenceState == ChatChannelPresenceState.IN_CHANNEL); }

    @observableProperty
    description: string = "";

    @observableProperty
    descriptionIsNew: boolean = false;

    @observableProperty
    override readonly canClose: boolean = true;

    @observableProperty
    override readonly canPin: boolean = true;

    private _sortKey!: ChatChannelViewModelSortKey;
    get sortKey() {
        if (!this._sortKey) {
            this._sortKey = { zsortOrder: 1000000, ztitle: "", zpinned: false };
        }
        return this._sortKey;
    }
    rekey() {
        this._sortKey = { zsortOrder: this.sortOrder ?? 1000000, ztitle: this.title ?? "", zpinned: this.isPinned ?? false };
    }
    needRekey() {
        const sk = this.sortKey;
        return (sk.zsortOrder != this.sortOrder ||
            sk.ztitle != this.title ||
            sk.zpinned != this.isPinned);
    }

    private _sortOrder: number = 1000000;
    get sortOrder(): number { return this._sortOrder; }
    set sortOrder(value) {
        if (value !== this._sortOrder) {
            this._sortOrder = value;
            this.parent.updateChannelPinState(this);
        }
    }

    @observableProperty
    get isPinned() { return super.isPinned; }
    set isPinned(value) {
        if (value !== super.isPinned) {
            super.isPinned = value;
            if (value) {
                if (!this.activeLoginViewModel.savedChatState.pinnedChannels.contains(this.name)) {
                    this.activeLoginViewModel.savedChatState.pinnedChannels.push(this.name);
                }
            }
            else {
                this.activeLoginViewModel.savedChatState.pinnedChannels.remove(this.name);
            }
            this.parent.updateChannelPinState(this);
        }
    }

    private _chatMessages: ChannelMessageViewModelOrderedDictionary = new ChannelMessageViewModelOrderedDictionary();
    private _adMessages: ChannelMessageViewModelOrderedDictionary = new ChannelMessageViewModelOrderedDictionary();
    private _bothMessages: ChannelMessageViewModelOrderedDictionary = new ChannelMessageViewModelOrderedDictionary();

    @observableProperty
    messageMode: ChatChannelMessageMode = ChatChannelMessageMode.BOTH;

    private _usersModerators: ObservableKeyExtractedOrderedDictionary<CharacterName, ChatChannelUserViewModel> = new ObservableOrderedDictionaryImpl<CharacterName, ChatChannelUserViewModel>(x => x.character, CharacterName.compare);
    private _usersWatched: ObservableKeyExtractedOrderedDictionary<CharacterName, ChatChannelUserViewModel> = new ObservableOrderedDictionaryImpl<CharacterName, ChatChannelUserViewModel>(x => x.character, CharacterName.compare);
    private _usersLooking: ObservableKeyExtractedOrderedDictionary<CharacterName, ChatChannelUserViewModel> = new ObservableOrderedDictionaryImpl<CharacterName, ChatChannelUserViewModel>(x => x.character, CharacterName.compare);
    private _usersOther: ObservableKeyExtractedOrderedDictionary<CharacterName, ChatChannelUserViewModel> = new ObservableOrderedDictionaryImpl<CharacterName, ChatChannelUserViewModel>(x => x.character, CharacterName.compare);

    @observableProperty
    get usersModerators(): ObservableKeyExtractedOrderedDictionary<CharacterName, ChatChannelUserViewModel> { return this._usersModerators; }

    @observableProperty
    get usersWatched(): ObservableKeyExtractedOrderedDictionary<CharacterName, ChatChannelUserViewModel> { return this._usersWatched; }

    @observableProperty
    get usersLooking(): ObservableKeyExtractedOrderedDictionary<CharacterName, ChatChannelUserViewModel> { return this._usersLooking; }

    @observableProperty
    get usersOther(): ObservableKeyExtractedOrderedDictionary<CharacterName, ChatChannelUserViewModel> { return this._usersOther; }

    private readonly _allUsers: SnapshottableMap<CharacterName, ChatChannelUserViewModel> = new SnapshottableMap();
    private _channelOwner: CharacterName | null = null;
    private _channelOps: Set<CharacterName> = new Set();

    @observableProperty
    get channelOwner() { return this._channelOwner; }
    set channelOwner(value: (CharacterName | null)) {
        this.setOwner(value);
    }

    get channelOps() { return this._channelOps; }

    addUser(character: CharacterName) {
        const uvm = new ChatChannelUserViewModel(this, character);

        this._allUsers.set(character, uvm);
        this.updateUserInLists(character);
    }
    removeUser(character: CharacterName) {
        const uvm = this._allUsers.get(character);
        if (uvm) {
            this._allUsers.delete(character);
            this.updateUserInLists(character);
            uvm.dispose();
        }
    }
    removeAllUsers() {
        this._allUsers.forEachValueSnapshotted(user => {
            this.removeUser(user.character);
        });
    }

    setOwner(character: CharacterName | null) {
        if (!CharacterName.equals(character, this._channelOwner)) {
            const oldOwner = this._channelOwner;
            this._channelOwner = character;
            this.updateUserInLists(oldOwner);
            this.updateUserInLists(this._channelOwner);
        }
    }
    addChannelOps(characters: CharacterName[]) {
        for (let n of characters) {
            this._channelOps.add(n);
            this.updateUserInLists(n);
        }
        this.notifyChannelOpsListeners(characters);
    }
    removeChannelOp(character: CharacterName) {
        if (this._channelOps.has(character)) {
            this._channelOps.delete(character);
            this.updateUserInLists(character);
            this.notifyChannelOpsListeners([character]);
        }
    }

    private readonly _channelOpsListeners: SnapshottableSet<CharactersEventListener> = new SnapshottableSet();
    addChannelOpsListener(callback: CharactersEventListener): IDisposable {
        this._channelOpsListeners.add(callback);
        let disposed = false;
        return asDisposable(() => {
            if (!disposed) {
                disposed = true;
                this._channelOpsListeners.delete(callback);
            }
        });
    }
    private notifyChannelOpsListeners(characters: CharacterName[]) {
        this._channelOpsListeners.forEachValueSnapshotted(w => {
            try { w(characters); }
            catch { }
        });
    }

    isCharacterInChannel(character: CharacterName): boolean {
        const result = this._allUsers.has(character);
        return result;
    }

    updateUserInLists(character: CharacterName | null) {
        if (!character) return;

        let uvm = this._allUsers.get(character);
        let isInChannel = uvm != null;
        let isModerator = isInChannel && (CharacterName.equals(this._channelOwner, character) ||
            this._channelOps.has(character) ||
            this.parent.serverOps.has(character));
        let isWatched = isInChannel && !isModerator && (this.parent.watchedChars.has(character));
        let isLooking = isInChannel && !isModerator && !isWatched && (this.parent.characterSet.getCharacterStatus(character).status == OnlineStatus.LOOKING);
        let isOther = isInChannel && !isModerator && !isWatched && !isLooking;

        const alreadyModerator = this._usersModerators.has(character);
        const alreadyWatched = this._usersWatched.has(character);
        const alreadyLooking = this._usersLooking.has(character);
        const alreadyOther = this._usersOther.has(character);

        if (isModerator) {
            if (!alreadyModerator) {
                this._usersModerators.add(uvm!);
            }
        }
        else {
            if (alreadyModerator) {
                this._usersModerators.delete(character);
            }
        }

        if (isWatched) {
            if (!alreadyWatched) {
                this._usersWatched.add(uvm!);
            }
        }
        else {
            if (alreadyWatched) {
                this._usersWatched.delete(character);
            }
        }

        if (isLooking) {
            if (!alreadyLooking) {
                this._usersLooking.add(uvm!);
            }
        }
        else {
            if (alreadyLooking) {
                this._usersLooking.delete(character);
            }
        }

        if (isOther) {
            if (!alreadyOther) {
                this._usersOther.add(uvm!);
            }
        }
        else {
            if (alreadyOther) {
                this._usersOther.delete(character);
            }
        }
    }

    private _filterMode: ChatChannelMessageMode = ChatChannelMessageMode.BOTH;

    @observableProperty
    get filterMode(): ChatChannelMessageMode { return this._filterMode; }
    set filterMode(value: ChatChannelMessageMode) {
        if (value !== this._filterMode) {
            this.scrolledTo = null;
            this._filterMode = value;
            switch (value) {
                case ChatChannelMessageMode.ADS_ONLY:
                    this.mainMessages = this._adMessages;
                    break;
                case ChatChannelMessageMode.CHAT_ONLY:
                    this.mainMessages = this._chatMessages;
                    break;
                case ChatChannelMessageMode.BOTH:
                    this.mainMessages = this._bothMessages;
                    break;
            }
        }
    }


    @observableProperty
    get filterMode2(): "chat" | "ads" | "both" {
        switch (this.filterMode) {
            case ChatChannelMessageMode.ADS_ONLY:
                return "ads";
            case ChatChannelMessageMode.CHAT_ONLY:
                return "chat";
            default:
                return "both";
        }
    }
    set filterMode2(value: "chat" | "ads" | "both") {
        switch (value) {
            case "ads":
                this.filterMode = ChatChannelMessageMode.ADS_ONLY;
                break;
            case "chat":
                this.filterMode = ChatChannelMessageMode.CHAT_ONLY;
                break;
            default:
                this.filterMode = ChatChannelMessageMode.BOTH;
                break;
        }
    }

    override addMessage(message: ChannelMessageViewModel, options?: AddMessageOptions): void {
        let addToChat = true;
        let addToAds = true;
        let logMessageType: LogMessageType | null = null;
        
        switch (message.type) {
            case ChannelMessageType.CHAT:
                logMessageType = LogMessageType.CHAT;
                break;
            case ChannelMessageType.AD:
                logMessageType = LogMessageType.AD;
                break;
            case ChannelMessageType.ROLL:
                logMessageType = LogMessageType.ROLL;
                break;
            case ChannelMessageType.SPIN:
                logMessageType = LogMessageType.SPIN;
        }
        switch (message.type) {
            case ChannelMessageType.ROLL:
            case ChannelMessageType.CHAT:
            case ChannelMessageType.SPIN:
                addToAds = false;
                break;
            case ChannelMessageType.AD:
                addToChat = false;
                break;
            default:
        }

        if (logMessageType != null && !(options?.fromReplay ?? false)) {
            HostInterop.logChannelMessage(this.activeLoginViewModel.characterName, this.name, this.title, 
                message.characterStatus.characterName, message.characterStatus.gender, message.characterStatus.status,
                logMessageType, message.text);
        }

        if (this.parent.ignoredChars.has(message.characterStatus.characterName)) { return; }

        if (addToAds || addToChat) {
            this._bothMessages.add(message);
            //this._bothMessages.push(message);
            while (this._bothMessages.size >= this.messageLimit) {
                //this._bothMessages.shift();
                this._bothMessages.delete(this._bothMessages.minKey()!);
            }
        }
        if (addToAds) {
            this._adMessages.add(message);
            //this._adMessages.push(message);
            while (this._adMessages.size >= this.messageLimit) {
                //this._adMessages.shift();
                this._adMessages.delete(this._adMessages.minKey()!);
            }
            if (this.filterMode == ChatChannelMessageMode.ADS_ONLY || this.filterMode == ChatChannelMessageMode.BOTH) {
                if (!(options?.seen ?? false)) {
                    if (message.type == ChannelMessageType.CHAT ||
                        message.type == ChannelMessageType.AD ||
                        message.type == ChannelMessageType.ROLL ||
                        message.type == ChannelMessageType.SPIN) {

                        this.pingIfNecessary(message);
                        if (!(options?.bypassUnseenCount ?? false)) {
                            this.increaseUnseenCountIfNecessary();
                        }
                    }
                }
                if (this.scrolledTo != null) {
                    this.newMessagesBelowNotify = true;
                }
            }
        }
        if (addToChat) {
            this._chatMessages.add(message);
            //this._chatMessages.push(message);
            while (this._chatMessages.size >= this.messageLimit) {
                //this._chatMessages.shift();
                this._chatMessages.delete(this._chatMessages.minKey()!);
            }
            if (this.filterMode == ChatChannelMessageMode.CHAT_ONLY || this.filterMode == ChatChannelMessageMode.BOTH) {
                if (!(options?.seen ?? false)) {
                    if (message.type == ChannelMessageType.CHAT ||
                        message.type == ChannelMessageType.AD ||
                        message.type == ChannelMessageType.ROLL ||
                        message.type == ChannelMessageType.SPIN) {

                        this.pingIfNecessary(message);
                        if (!(options?.bypassUnseenCount ?? false)) {
                            this.increaseUnseenCountIfNecessary();
                        }
                    }
                }
                if (this.scrolledTo != null) {
                    this.newMessagesBelowNotify = true;
                }
            }
        }
    }

    clearMessages() {
        this.mainMessages.clear();
        this._chatMessages.clear();
        this._adMessages.clear();
    }

    @observableProperty
    get iconUrl() {
        //return `https://static.f-list.net/images/avatar/${this.name.canonicalValue}.png`;
        return `assets/ui/chatchannel-icon.svg`;
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
                    await this.parent.chatConnection.channelSendMessageAsync(this.name, msgContent);
                },
                onSuccessAsync: async () => {
                    this.addChatMessage({
                        speakingCharacter: this.parent.characterName,
                        message: msgContent,
                        isAd: false,
                        seen: true,
                        asOf: new Date()
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

    override async performRollAsync(rollSpecification: string): Promise<void> {
        await this.activeLoginViewModel.chatConnection.channelPerformRollAsync(this.name, rollSpecification);
    }

    override async performBottleSpinAsync(): Promise<void> {
        await this.activeLoginViewModel.chatConnection.channelPerformBottleSpinAsync(this.name);
    }

    protected pingIfNecessary(message: ChannelMessageViewModel) {
        super.pingIfNecessary(message);
        if (message.containsPing && !this.isTabActive && message.characterStatus.characterName != this.parent.characterName) {
            this.activeLoginViewModel.appViewModel.soundNotification({
                eventType: AppNotifyEventType.HIGHLIGHT_MESSAGE_RECEIVED,
                myCharacter: this.activeLoginViewModel.characterName,
                happenedInChannel: this.name
            });
        }
    }

    @observableProperty
    canSendTextboxAsAd: boolean = true;

    async sendTextboxAsAdAsync(): Promise<void> {
        if (this.textBoxContent && this.textBoxContent != "") {
            const msgContent = this.textBoxContent;
            this.textBoxContent = "";

            this.pendingSendsCount++;
            this._sendQueue.executeAsync({
                maxRetries: 3,
                onAttemptAsync: async () => {
                    await this.parent.chatConnection.channelAdMessageAsync(this.name, msgContent);
                },
                onSuccessAsync: async () => {
                    this.addAdMessage({
                        speakingCharacter: this.parent.characterName,
                        message: msgContent,
                        isAd: true,
                        seen: true,
                        asOf: new Date()
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

    sessionConnectionStateChanged() {
        const connState = this.parent.connectionState;
        if (connState != ChatConnectionState.CONNECTED) {
            if (this.presenceState == ChatChannelPresenceState.IN_CHANNEL ||
                this.presenceState == ChatChannelPresenceState.JOINING_CHANNEL) {

                this.presenceState = ChatChannelPresenceState.PENDING_RECONNECT;
            }
        }
    }

    override async close() {
        if (this.canClose) {
            this.hiddenForClose = true;
            if (this.presenceState == ChatChannelPresenceState.IN_CHANNEL) {
                await this.activeLoginViewModel.chatConnection.leaveChannelAsync(this.name);
            }
            else {
                this.activeLoginViewModel.closeChannel(this.name);
            }
            this.activeLoginViewModel.savedChatState.joinedChannels.removeWhere(jc => jc.name == this.name);
            this.activeLoginViewModel.savedChatState.pinnedChannels.remove(this.name);
        }
    }

    isEffectiveOp(name: CharacterName) {
        return (this.channelOps.has(name) || this.isEffectiveOwner(name));
    }

    isEffectiveOwner(name: CharacterName) {
        return (CharacterName.equals(this.channelOwner, name) || this.activeLoginViewModel.isServerOp(name));
    }

    async kickAsync(name: CharacterName) {
        if (this.isEffectiveOp(this.activeLoginViewModel.characterName)) {
            await this.activeLoginViewModel.chatConnection.kickFromChannelAsync(this.name, name);
        }
    }

    async banAsync(name: CharacterName) {
        if (this.isEffectiveOp(this.activeLoginViewModel.characterName)) {
            await this.activeLoginViewModel.chatConnection.banFromChannelAsync(this.name, name);
        }
    }
}

export enum ChatChannelPresenceState {
    JOINING_CHANNEL,
    IN_CHANNEL,
    NOT_IN_CHANNEL,
    PENDING_RECONNECT
}

export enum ChatChannelMessageMode {
    CHAT_ONLY,
    ADS_ONLY,
    BOTH
}

export class ChatChannelMessageModeConvert {
    static toMode(value: string | null | undefined): ChatChannelMessageMode | null {
        switch (value) {
            case "chat":
                return ChatChannelMessageMode.CHAT_ONLY;
            case "ads":
                return ChatChannelMessageMode.ADS_ONLY;
            case "both":
                return ChatChannelMessageMode.BOTH;
            default:
                return null;
        }
    }
}