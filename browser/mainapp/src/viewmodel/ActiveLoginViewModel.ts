import { ChannelMetadata, ChatConnection } from "../fchat/ChatConnection.js";
import { FListAuthenticatedApi, FriendsList, ProfileInfo } from "../fchat/api/FListApi.js";
import { ChannelName } from "../shared/ChannelName.js";
import { CharacterName } from "../shared/CharacterName.js";
import { CharacterSet } from "../shared/CharacterSet.js";
import { BBCodeClickContext, BBCodeParseSink } from "../util/bbcode/BBCode.js";
import { IDisposable } from "../util/Disposable.js";
import { HostInterop } from "../util/HostInterop.js";
import { Observable, ObservableValue, PropertyChangeEvent } from "../util/Observable.js";
import { ObservableBase, observableProperty, observablePropertyExt } from "../util/ObservableBase.js";
import { Collection, CollectionChangeEvent, CollectionChangeType, ObservableCollection } from "../util/ObservableCollection.js";
import { DictionaryChangeType, ObservableKeyExtractedOrderedDictionary, ObservableOrderedDictionaryImpl, ObservableOrderedSet } from "../util/ObservableKeyedLinkedList.js";
import { AppNotifyEventType, AppViewModel } from "./AppViewModel.js";
import { ChannelMessageViewModel, ChannelViewModel } from "./ChannelViewModel.js";
import { CharacterNameSet, OnlineWatchedCharsCharacterNameSet } from "./CharacterNameSet.js";
import { ChatChannelPresenceState, ChatChannelViewModel, ChatChannelViewModelSortKey } from "./ChatChannelViewModel.js";
import { ConsoleChannelViewModel } from "./ConsoleChannelViewModel.js";
import { PMConvoChannelViewModel, PMConvoChannelViewModelSortKey } from "./PMConvoChannelViewModel.js";
import { CharacterProfileDialogViewModel } from "./dialogs/character-profile/CharacterProfileDialogViewModel.js";
import { CharacterDetailPopupViewModel } from "./popups/CharacterDetailPopupViewModel.js";
import { KeyValuePair } from "../util/collections/KeyValuePair.js";
import { CancellationToken, CancellationTokenSource } from "../util/CancellationTokenSource.js";
import { TaskUtils } from "../util/TaskUtils.js";
import { AddChannelsViewModel } from "./AddChannelsViewModel.js";
import { StdObservableCollectionChangeType } from "../util/collections/ReadOnlyStdObservableCollection.js";
import { LoginUtils } from "../util/LoginUtils.js";
import { OperationCancelledError } from "../util/PromiseSource.js";
import { IterableUtils } from "../util/IterableUtils.js";
import { AppSettings, SavedChatState, SavedChatStateJoinedChannel } from "../settings/AppSettings.js";
import { CharacterStatusEditorPopupViewModel } from "./popups/CharacterStatusEditorPopupViewModel.js";
import { OnlineStatus } from "../shared/OnlineStatus.js";
import { Logger, Logging } from "../util/Logger.js";
import { CatchUtils } from "../util/CatchUtils.js";
import { ContextMenuPopupItemViewModel, ContextMenuPopupViewModel } from "./popups/ContextMenuPopupViewModel.js";
import { MiscTabViewModel } from "./MiscTabViewModel.js";
import { LogSearchViewModel } from "./LogSearchViewModel.js";
import { DateAnchor } from "../util/HostInteropLogSearch.js";
import { URLUtils } from "../util/URLUtils.js";
import { SlashCommandViewModel } from "./SlashCommandViewModel.js";
import { IdleDetection } from "../util/IdleDetection.js";

declare const XCHost: any;

let nextViewModelId = 1;

export class ActiveLoginViewModel extends ObservableBase {
    constructor(
        public readonly parent: AppViewModel,
        public readonly authenticatedApi: FListAuthenticatedApi,
        public readonly savedChatState: SavedChatState) {

        super();

        this._viewModelId = nextViewModelId++;
        this._logger = Logging.createLogger("ActiveLoginViewModel");
        this._logger.enterScope(`id#${this._viewModelId}`);

        this.console = new ConsoleChannelViewModel(this);
        this.miscTabs.push(new MiscTabViewModel(this, "Console", this.console));
        this._logSearchViewModel = new LogSearchViewModel(this, this.appViewModel, savedChatState.characterName);
        this.miscTabs.push(new MiscTabViewModel(this, "Log Viewer", this._logSearchViewModel));

        //this.serverOps.addEventListener("collectionchange", (ev) => { this.notifyChannelsOfCharacterChange(this.serverOps, ev); });
        //this.watchedChars.addEventListener("collectionchange", (ev) => { this.notifyChannelsOfCharacterChange(this.watchedChars, ev); });

        this.serverOps.addEventListener("dictionarychange", (dce) => {
            const chars = [ dce.item ];
            this.notifyChannelsOfCharacterChange(chars);
        });
        this.watchedChars.addEventListener("dictionarychange", (dce) => {
            const chars = [ dce.item ];
            this.notifyChannelsOfCharacterChange(chars);
        });
        this.ignoredChars.addEventListener("dictionarychange", (dce) => {
            const chars = [ dce.item ];
            this.notifyChannelsOfCharacterChange(chars);
        });

        this.characterSet = new CharacterSet(this.ignoredChars);
        this.onlineWatchedChars = new OnlineWatchedCharsCharacterNameSet(this);

        const openChannelPingMentionChange = (ev: PropertyChangeEvent) => {
            if (ev.propertyName == "hasPing" || ev.propertyName == "unseenMessageCount") {
                this.refreshPingMentionCount();
            }
        };
        this.openChannels.addCollectionObserver(changes => {
            for (let change of changes) {
                switch (change.changeType) {
                    case StdObservableCollectionChangeType.ITEM_ADDED:
                        this.openChannelsByChannelName.set(change.item.name, change.item);
                        change.item.addEventListener("propertychange", openChannelPingMentionChange);
                        this.refreshPingMentionCount();
                        break;
                    case StdObservableCollectionChangeType.ITEM_REMOVED:
                        change.item.removeEventListener("propertychange", openChannelPingMentionChange);
                        this._pinnedChannels.delete(change.item.sortKey);
                        this._unpinnedChannels.delete(change.item.sortKey);
                        this.openChannelsByChannelName.delete(change.item.name);
                        this.refreshPingMentionCount();
                        break;
                    case StdObservableCollectionChangeType.CLEARED:
                        console.warn("unhandled clear");
                        break;
                }
            }
        });
        this.pmConversations.addCollectionObserver(changes => {
            for (let change of changes) {
                switch (change.changeType) {
                    case StdObservableCollectionChangeType.ITEM_ADDED:
                        change.item.value.addEventListener("propertychange", openChannelPingMentionChange);
                        this.refreshPingMentionCount();
                        if (change.item.value instanceof PMConvoChannelViewModel) {
                            if (!this.savedChatState.pmConvos.contains(change.item.value.savedChatStatePMConvo)) {
                                this.savedChatState.pmConvos.push(change.item.value.savedChatStatePMConvo);
                            }
                        }
                        break;
                    case StdObservableCollectionChangeType.ITEM_REMOVED:
                        change.item.value.removeEventListener("propertychange", openChannelPingMentionChange);
                        this.refreshPingMentionCount();
                        if (change.item.value instanceof PMConvoChannelViewModel) {
                            this.savedChatState.pmConvos.removeWhere(x => x.character.equals(change.item.value.character));
                        }
                        break;
                    case StdObservableCollectionChangeType.CLEARED:
                        console.warn("unhandled clear");
                        break;
                }
            }
        });

        this.bbcodeSink = new ActiveLoginViewModelBBCodeSink(this, this._logger);

        this.getMyFriendsListInfo(CancellationToken.NONE);
    }

    private readonly _viewModelId: number;
    private readonly _logger: Logger;

    private readonly _logSearchViewModel: LogSearchViewModel;

    get appViewModel() { return this.parent; }

    private readonly _miscTabs = new Collection<MiscTabViewModel>();
    get miscTabs(): ObservableCollection<MiscTabViewModel> { return this._miscTabs; }

    chatConnection!: ChatConnection;

    private _connectionState: ChatConnectionState = ChatConnectionState.CONNECTING;
    @observableProperty
    get connectionState(): ChatConnectionState { return this._connectionState; }
    set connectionState(value: ChatConnectionState) {
        if (value != this._connectionState) {
            const previousConnectionState = this._connectionState;
            this._connectionState = value;
            if (value != ChatConnectionState.CONNECTED) {
                HostInterop.endCharacterSession(this.characterName);
            }
            for (let ch of this._unpinnedChannels.values()) {
                ch.sessionConnectionStateChanged();
            }
            for (let ch of this._pinnedChannels.values()) {
                ch.sessionConnectionStateChanged();
            }

            if (value == ChatConnectionState.CONNECTED && previousConnectionState != ChatConnectionState.CONNECTED) {
                this.appViewModel.soundNotification({ 
                    eventType: AppNotifyEventType.CONNECTED, 
                    activeLoginViewModel: this
                });
            }
            else if (value != ChatConnectionState.CONNECTED && previousConnectionState == ChatConnectionState.CONNECTED) {
                this.appViewModel.soundNotification({ 
                    eventType: AppNotifyEventType.DISCONNECTED, 
                    activeLoginViewModel: this
                });
            }
        }
    }

    isServerOp(name: CharacterName) {
        return this.serverOps.has(name);
    }

    @observableProperty
    autoReconnectInSec: (number | null) = null;

    private _autoReconnectCTS: (CancellationTokenSource | null) = null;
    beginAutoReconnectCountdown() {
        if (this.getConfigSettingById("autoReconnect")) {
            if (!this.isInAppViewLogins()) {
                this._logger.logInfo("not in appviewmodel active logins, not reconnecting");
                return;
            }

            if (this._autoReconnectCTS == null) {
                this._autoReconnectCTS = new CancellationTokenSource();
                this._logger.logInfo("starting autoreconnect countdown...");
                this.runAutoReconnectCountdown(this._autoReconnectCTS.token);
            }
            else {
                this._logger.logInfo("not starting autoreconnect countdown, already running.");
            }
        }
    }

    private isInAppViewLogins() {
        if (this.appViewModel != null) {
            return this.appViewModel.logins.contains(this);
        }
        else {
            return false;
        }
    }

    private async runAutoReconnectCountdown(cancellationToken: CancellationToken) {
        try {
            if (!this.isInAppViewLogins()) {
                return;
            }

            let nextReconnectInterval = 10;

            while (true) {
                this.autoReconnectInSec = nextReconnectInterval;
                this._logger.logInfo("waiting for autoreconnect delay", this.autoReconnectInSec);
                while (this.autoReconnectInSec > -1) {
                    await TaskUtils.delay(1000, cancellationToken);
                    this.autoReconnectInSec--;
                }
                cancellationToken.throwIfCancellationRequested();
                if (!this.isInAppViewLogins()) {
                    throw new Error("cancelled, not in appviewmodel active logins");
                }
    
                try {
                    this._logger.logInfo("attempting reconnect...");
                    await LoginUtils.reconnectAsync(this, cancellationToken);
                    this._logger.logInfo("reconnect success.");
                    break;
                }
                catch (e)
                {
                    if (e instanceof OperationCancelledError) {
                        this._logger.logInfo("reconnect cancelled");
                        throw e;
                    }

                    this._logger.logInfo("reconnect failed", CatchUtils.getMessage(e));
                    nextReconnectInterval = Math.min(60, nextReconnectInterval * 2);
                }
            }
        }
        catch (e) {
            this._logger.logWarn("ending autoreconnect countdown due to exception", CatchUtils.getMessage(e));
        }
        this._autoReconnectCTS?.dispose();
        this._autoReconnectCTS = null;
        this.autoReconnectInSec = null;
    }

    private _characterName: CharacterName = CharacterName.create("");
    @observableProperty
    get characterName(): CharacterName { return this._characterName; }
    set characterName(value) {
        if (value != this._characterName) {
            if (this._characterName.value != "") {
                this._logger.leaveScope();
            }
            this._characterName = value;
            if (this._characterName.value != "") {
                this._logger.enterScope(`char=${this._characterName.value}`);
                this._logger.logInfo("identified", this._characterName.value);
            }
        }
    }

    readonly serverOps: CharacterNameSet = new CharacterNameSet();

    // watchedChars = superset of friends + bookmarks + interests
    readonly watchedChars: CharacterNameSet = new CharacterNameSet();

    readonly friends: CharacterNameSet = new CharacterNameSet();

    readonly bookmarks: CharacterNameSet = new CharacterNameSet();

    readonly interests: CharacterNameSet = new CharacterNameSet();

    @observableProperty
    readonly onlineWatchedChars: CharacterNameSet;

    @observableProperty
    showOnlineWatchedOnly: boolean = true;

    readonly ignoredChars: CharacterNameSet = new CharacterNameSet();

    @observableProperty
    readonly openChannels: Collection<ChatChannelViewModel> = new Collection();

    readonly openChannelsByChannelName: Map<ChannelName, ChatChannelViewModel> = new Map();

    readonly console: ConsoleChannelViewModel;

    get pingWords() { return this.savedChatState.pingWords; };

    @observableProperty
    hasUnseenMessages: boolean = false;

    @observableProperty
    hasPings: boolean = false;

    private refreshPingMentionCount() {
        let newUnseen = false;
        let newPings = false;
        for (let ch of IterableUtils.combine<ChannelViewModel>(this.openChannels, this.pmConversations.values())) {
            newPings = newPings || ch.hasPing;
            newUnseen = newUnseen || (ch.unseenMessageCount > 0);
            if (newPings && newUnseen) {
                break;
            }
        }
        this.hasUnseenMessages = newUnseen;
        this.hasPings = newPings;
    }

    private readonly _pinnedChannels = new SortedChannelSet();
    private readonly _unpinnedChannels = new SortedChannelSet();
    private readonly _pmConversations = new SortedPMConvoSet();

    @observableProperty
    readonly pinnedChannels: ObservableKeyExtractedOrderedDictionary<ChatChannelViewModelSortKey, ChatChannelViewModel> = this._pinnedChannels;

    @observableProperty
    readonly unpinnedChannels: ObservableKeyExtractedOrderedDictionary<ChatChannelViewModelSortKey, ChatChannelViewModel> = this._unpinnedChannels;

    @observableProperty
    readonly pmConversations: ObservableKeyExtractedOrderedDictionary<PMConvoChannelViewModelSortKey, PMConvoChannelViewModel> = this._pmConversations;

    updateChannelPinState(ch: ChatChannelViewModel) {
        const origSk = ch.sortKey;
        if (ch.needRekey()) {
            if (origSk.zpinned) {
                this._pinnedChannels.delete(ch.sortKey);
            }
            else {
                this._unpinnedChannels.delete(ch.sortKey);
            }
            ch.rekey();
            if (ch.isPinned) {
                this._pinnedChannels.add(ch);
            }
            else {
                this._unpinnedChannels.add(ch);
            }
        }
    }

    updatePMConvoOrdering(ch: PMConvoChannelViewModel) {
        const origSk = ch.sortKey;
        if (ch.needRekey()) {
            this._pmConversations.delete(ch.sortKey);
            ch.rekey();
            this._pmConversations.add(ch);
        }
    }

    @observableProperty
    get channelsCollapsed(): boolean { return this.savedChatState.unpinnedChannelSectionCollapsed; }
    set channelsCollapsed(value) { this.savedChatState.unpinnedChannelSectionCollapsed = value; }

    @observableProperty
    get pinnedChannelsCollapsed(): boolean { return this.savedChatState.pinnedChannelSectionCollapsed; }
    set pinnedChannelsCollapsed(value) { this.savedChatState.pinnedChannelSectionCollapsed = value; }

    @observableProperty
    get pmConvosCollapsed(): boolean { return this.savedChatState.pmConvosSectionCollapsed; }
    set pmConvosCollapsed(value) { this.savedChatState.pmConvosSectionCollapsed = value; }

    bbcodeSink: BBCodeParseSink;

    private notifyChannelsOfCharacterChange(c: Iterable<CharacterName>) {
        for (let ccvm of this.openChannels) {
            for (let char of c) {
                ccvm.updateUserInLists(char);
            }
        }
    }

    getOrCreateChannel(channel: ChannelName, title?: string): ChatChannelViewModel {
        const x = this.openChannels.filter(x => ChannelName.equals(x.name, channel));
        if (x.length == 0) {
            const newCh = new ChatChannelViewModel(this, channel, title ? title : channel.value);
            newCh.presenceState = ChatChannelPresenceState.IN_CHANNEL;
            this.openChannels.push(newCh);
            //if (!this.chatConnection.extendedFeaturesEnabled) {
                this.populateChannelFromLogs(newCh, channel);
            //}
            this.updateChannelPinState(newCh);
            return newCh;
        }
        else {
            const result = x[0];
            result.presenceState = ChatChannelPresenceState.IN_CHANNEL;
            return result;
        }
    }

    getChannel(channel: ChannelName): ChatChannelViewModel | null {
        const x = this.openChannels.filter(x => ChannelName.equals(x.name, channel));
        if (x.length == 0) {
            return null;
        }
        else {
            return x[0];
        }
    }

    closeChannel(channel: ChannelName) {
        const chan = this.getChannel(channel);
        if (chan) {
            this.openChannels.remove(chan);
            this.removeFromSelectedChannelHistory(chan, true);
            this.chatConnectionConnected?.closeChannelTab(channel);
        }
    }

    getOrCreatePmConvo(convoCharacter: CharacterName, transient: boolean = false): (PMConvoChannelViewModel | null) {
        const x = this._pmConversations.getByCharacter(convoCharacter);
        if (!x) {
            if (this.ignoredChars.has(convoCharacter)) { return null; }

            let newConvo: PMConvoChannelViewModel;
            if (this.selectedTab instanceof PMConvoChannelViewModel && this.selectedTab.character == convoCharacter) {
                newConvo = this.selectedTab;
            }
            else {
                newConvo = new PMConvoChannelViewModel(this, convoCharacter);
                this.populatePmConvoFromLogs(newConvo, convoCharacter);
            }

            if (!transient) {
                this._pmConversations.add(newConvo);
            }

            this.chatConnectionConnected?.openPrivateMessageTab(convoCharacter);
            return newConvo;
        }
        else {
            return x;
        }
    }

    private async populatePmConvoFromLogs(convovm: PMConvoChannelViewModel, interlocutor: CharacterName): Promise<void> {
        const messages = await HostInterop.getRecentLoggedPMConvoMessagesAsync(this.characterName, interlocutor, 200);  // TODO: come from config
        if (!convovm.populatedFromReplay) {
            convovm.restoreFromLoggedMessages(messages);
        }
    }

    private async populateChannelFromLogs(chanvm: ChatChannelViewModel, channelName: ChannelName) {
        const messages = await HostInterop.getRecentLoggedChannelMessagesAsync(channelName, 200);  // TODO: come from config
        if (!chanvm.populatedFromReplay) {
            chanvm.restoreFromLoggedMessages(messages);
        }
    }

    getPmConvo(convoCharacter: CharacterName): PMConvoChannelViewModel | null {
        const x = this._pmConversations.getByCharacter(convoCharacter);
        if (!x) {
            return null;
        }
        else {
            return x;
        }
    }

    closePmConvo(convoCharacter: CharacterName) {
        const convo = this.getPmConvo(convoCharacter);
        if (convo) {
            this._pmConversations.deleteByValue(convo);
            this.removeFromSelectedChannelHistory(convo, true);
            this.chatConnectionConnected?.closePrivateMessageTab(convoCharacter);
        }
    }

    //@observableProperty
    //readonly openPmConvos: Collection<PMConvoChannelViewModel> = new Collection();

    @observableProperty
    leftListSelectedPane: LeftListSelectedPane = LeftListSelectedPane.CHATS;

    private _selectedChannelHistory: ChannelViewModel[] = [];
    private pushToSelectedChannelHistory(chan: ChannelViewModel) {
        this.removeFromSelectedChannelHistory(chan, false);
        this._selectedChannelHistory.push(chan);
    }
    private removeFromSelectedChannelHistory(chan: ChannelViewModel, changeSelection: boolean) {
        this._selectedChannelHistory = this._selectedChannelHistory.filter(x => x != chan);
        if (changeSelection && this.selectedTab == chan) {
            if (this._selectedChannelHistory.length > 0) {
                this.selectedTab = this._selectedChannelHistory[this._selectedChannelHistory.length - 1]!;
            }
            else {
                this.selectedTab = null;
            }
        }
    }

    private _selectedTab: (SelectableTab | null) = null;
    @observableProperty
    get selectedTab() { return this._selectedTab; }
    set selectedTab(value) {
        if (value == null) {
            value = this.console;
        }
        if (value !== this._selectedTab) {
            if (this._selectedTab){
                if (this._selectedTab instanceof ChannelViewModel) {
                    this._selectedTab.isTabActive = false;
                }
            }
            this._selectedTab = value;
            if (this._selectedTab && this._selectedTab instanceof ChannelViewModel) {
                this._selectedTab.isTabActive = this.appViewModel.isWindowActive;
                this.pushToSelectedChannelHistory(this._selectedTab);
                this.savedChatState.selectedChannel = this._selectedTab.collectiveName;
                if (this._selectedTab instanceof ChatChannelViewModel) {
                    this.chatConnectionConnected?.markChannelSeen(this._selectedTab.name);
                }
                else if (this._selectedTab instanceof PMConvoChannelViewModel) {
                    this.chatConnectionConnected?.markPMConvoSeen(this._selectedTab.character);
                }
                else if (this._selectedTab instanceof ConsoleChannelViewModel) {
                    this.chatConnectionConnected?.markConsoleSeen();
                }
            }
        }
    }

    @observableProperty
    get selectedChannel() { 
        const st = this._selectedTab
        if (st instanceof ChannelViewModel) {
            return st;
        }
        else {
            return null;
        }
    }
    set selectedChannel(value) {
        this.selectedTab = value;
    }

    private _isActiveSession: ObservableValue<boolean> = new ObservableValue<boolean>(false);
    get isActiveSession() { return this._isActiveSession.value; }
    set isActiveSession(value: boolean) { 
        if (value != this._isActiveSession.value) {
            this._isActiveSession.value = value; 
            this.appWindowActiveChanged();
        }
    }

    private _isSelectedSession: boolean = false;
    @observableProperty
    get isSelectedSession() { return this._isSelectedSession; }
    set isSelectedSession(value) {
        if (value !== this._isSelectedSession) {
            this._isSelectedSession = value;
            this.appWindowActiveChanged();
        }
    }

    appWindowActiveChanged() {
        if (this.selectedChannel) {
            this.selectedChannel.isTabActive = this.isSelectedSession && this.appViewModel.isWindowActive;
        }
    }

    @observableProperty
    readonly characterSet: CharacterSet;

    private _cachedMyProfileInfo: ProfileInfo | null = null;
    private _cachedMyProfileInfoExpires: Date = new Date();
    async getMyProfileInfo(cancellationToken: CancellationToken): Promise<ProfileInfo> {
        if (this._cachedMyProfileInfo == null || this._cachedMyProfileInfoExpires < new Date()) {
            this._cachedMyProfileInfo = await this.authenticatedApi.getCharacterProfileAsync(this.characterName, cancellationToken);
            this._cachedMyProfileInfoExpires = new Date(new Date().getTime() + (1000 * 60 * 5));
        }
        return this._cachedMyProfileInfo;
    }

    private _cachedMyFriendsListInfo: FriendsList | null = null;
    private _cachedMyFriendsListInfoExpires: Date = new Date();
    async getMyFriendsListInfo(cancellationToken: CancellationToken): Promise<FriendsList> {
        if (this._cachedMyFriendsListInfo == null || this._cachedMyFriendsListInfoExpires < new Date()) {
            this._cachedMyFriendsListInfo = await this.authenticatedApi.getFriendsListAsync(cancellationToken);
            this.syncFriendsListData(this._cachedMyFriendsListInfo);
            this._cachedMyFriendsListInfoExpires = new Date(new Date().getTime() + (1000 * 60 * 60));
        }
        return this._cachedMyFriendsListInfo;
    }
    expireMyFriendsListInfo() {
        this._cachedMyFriendsListInfo = null;
        this._cachedMyFriendsListInfoExpires = new Date();
    }

    private syncFriendsListData(friendsList: FriendsList) {
        // Sync friends
        const flFriends = new Set<CharacterName>();
        for (let flf of friendsList.friendlist) {
            const destChar = CharacterName.create(flf.dest);
            const srcChar = CharacterName.create(flf.source);

            const targetChar = this.characterName.equals(destChar) ? srcChar : destChar;
            if (!this.friends.has(targetChar)) {
                this.friends.add(targetChar);
            }
            flFriends.add(destChar);
            flFriends.add(srcChar);
        }

        for (let c of [...this.friends.values()]) {
            if (!flFriends.has(c)) {
                this.friends.delete(c);
            }
        }

        // Sync bookmarks
        const flBookmarks = new Set<CharacterName>();
        for (let flb of friendsList.bookmarklist) {
            const targetChar = CharacterName.create(flb);
            if (!this.bookmarks.has(targetChar)) {
                this.bookmarks.add(targetChar);
            }
            flBookmarks.add(targetChar);
        }
        for (let c of [...this.bookmarks.values()]) {
            if (!flBookmarks.has(c)) {
                this.bookmarks.delete(c);
            }
        }
    }

    showAddChannels() {
        const ac = new AddChannelsViewModel(this);
        this.selectedTab = ac;
    }

    activatePMConvo(char: CharacterName) {
        const convo = this.getOrCreatePmConvo(char);
        if (convo) {
            convo.lastInteractionAt = new Date().getTime();
            this.selectedChannel = convo;
        }
    }

    cachedPublicChannelListExpiresAt: Date | null = null;
    cachedPublicChannelList: ChannelMetadata[] | null = null;
    cachedPrivateChannelListExpiresAt: Date | null = null;
    cachedPrivateChannelList: ChannelMetadata[] | null = null;

    showCharacterStatusPopup(el: HTMLElement) {
        const popup = new CharacterStatusEditorPopupViewModel(this, el);
        this.appViewModel.popups.push(popup);
    }

    getSlashCommands(): SlashCommandViewModel[] {
        return [
            new SlashCommandViewModel(
                ["help", "?"],
                "Show Command Help",
                "Shows a help message describing all the commands available.",
                [],
                async (context, args) => {
                    const vms = context.getSlashCommands();
                    const textBuilder = ["The following commands are available here:"];
                    for (let tvm of vms) {
                        textBuilder.push(`[b]/${tvm.command[0]}[/b] - [i]${tvm.title}[/i]: ${tvm.description}`);
                    }
                    return textBuilder.join("\n");
                }
            ),
            new SlashCommandViewModel(
                ["priv"],
                "Open Private Message Tab",
                "Opens a private message tab for the specified character.",
                ["character"],
                async (context, args) => {
                    const targetCharName = args[0] as CharacterName;
                    const convoVm = this.getOrCreatePmConvo(targetCharName);
                    if (convoVm) {
                        this.activatePMConvo(targetCharName);
                    }
                    return "";
                }
            )
        ];
    }

    private async processSlashCommandAsync(scvm: SlashCommandViewModel, commandArgs: string, commandContext: ChannelViewModel): Promise<string> {
        const callArgs: unknown[] = [];
        try {
            for (let targ of scvm.argTypes) {
                let targvalue: unknown;
                [commandArgs, targvalue] = scvm.grabArgumentValue(targ, commandArgs);
                callArgs.push(targvalue);
            }
            if (commandArgs.trim() != "") {
                throw new Error("Unexpected argument supplied");
            }
        }
        catch (e) {
            const errMsg = (e instanceof Error) ? e.message : (e?.toString() ?? "");
            throw new Error(`Unable to process command: ${errMsg}`);
        }
        const result = await scvm.onInvoke(commandContext, callArgs);
        return result ?? "";
    }

    async processCommandAsync(command: string, commandContext: ChannelViewModel): Promise<string> {
        const spacePos = command.indexOf(' ');
        const commandStr = (spacePos != -1 ? command.substring(0, spacePos) : command).toLowerCase().trim();
        const commandArgs = spacePos != -1 ? command.substring(spacePos + 1) : "";

        for (let scvm of commandContext.getSlashCommands()) {
            for (let cmdTrigger of scvm.command) {
                if (cmdTrigger == commandStr) {
                    return await this.processSlashCommandAsync(scvm, commandArgs, commandContext);
                }
            }
        }

        throw new Error(`Unknown command: ${commandStr}`);

        // const commandStr = command.split(' ')[0];
        // switch (commandStr.toLowerCase()) {
        //     case "help":
        //     case "?":
        //         {
        //             const vms = commandContext.getSlashCommands();
        //             const textBuilder = ["The following commands are available here:"];
        //             for (let tvm of vms) {
        //                 textBuilder.push(`[b]/${tvm.command[0]}[/b] - [i]${tvm.title}[/i]: ${tvm.description}`);
        //             }
        //             return textBuilder.join("\n");
        //         }
        //     case "priv":
        //         const targetCharName = CharacterName.create(command.substring(5));
        //         const convoVm = this.getOrCreatePmConvo(targetCharName);
        //         if (convoVm) {
        //             this.activatePMConvo(targetCharName);
        //         }
        //         return "";
        //     default:
        //         throw new Error(`Unknown command: ${command}`);
        // }
    }

    idleStateChanged() {
        const autoIdleSetting = !!this.getFirstConfigEntryHierarchical(["autoIdle"]);
        const autoAwaySetting = !!this.getFirstConfigEntryHierarchical(["autoAway"]);

        if (autoIdleSetting || autoAwaySetting) {
            const userState = autoIdleSetting ? this.parent.userState : "active";
            const screenState = autoAwaySetting ? this.parent.screenState : "unlocked";
            this.chatConnectionConnected?.setIdleStatusAsync(userState, screenState);
        }
    }

    get chatConnectionConnected(): (ChatConnection | null) {
        if (this.connectionState == ChatConnectionState.CONNECTED ||
            this.connectionState == ChatConnectionState.CONNECTING) {
            return this.chatConnection;
        }
        else {
            return null;
        }
    }

    private removeFromAutoLogins() {
        for (let x of [...this.appViewModel.appSettings.savedLogins]) {
            if (x.characterName == this.characterName) {
                this.appViewModel.appSettings.savedLogins.delete(x.account, x.characterName);
            }
        }
    }

    showMainContextMenu(contextElement: HTMLElement) {
        const ctxVm = new ContextMenuPopupViewModel<() => void>(this.appViewModel, contextElement);

        this.appViewModel.getMainContextMenuItems(ctxVm, this);

        if (this.chatConnection.extendedFeaturesEnabled) {
            ctxVm.addMenuItem("Disconnect", () => {
                this.removeFromAutoLogins();
                this.chatConnection.disconnect();
            });
            ctxVm.addMenuItem("Log Out", () => {
                this.removeFromAutoLogins();
                this.chatConnection.logOut();
            });
        }
        else {
            ctxVm.addMenuItem("Log Out", () => { 
                this.removeFromAutoLogins();
                this.chatConnection.disconnect();
            });
        }

        ctxVm.onValueSelected = (func) => {
            ctxVm.dismissed();
            func();
        } 

        this.appViewModel.popups.push(ctxVm);
    }

    openLogViewer(logsFor: CharacterName, dateAnchor: DateAnchor, date: Date, target: ChannelName | CharacterName) {
        this._logSearchViewModel.setSearch(logsFor, dateAnchor, date, target);
        this.selectedTab = this._logSearchViewModel;
    }

    getConfigSettingById(configSettingId: string, channel?: ChannelViewModel | null) {
        return this.appViewModel.getConfigSettingById(configSettingId, this, channel);
    }

    getConfigEntryHierarchical(key: string, channel?: ChannelViewModel | null) {
        return this.appViewModel.getConfigEntryHierarchical(key, this, channel);
    }

    getFirstConfigEntryHierarchical(keys: string[], channel?: ChannelViewModel | null): (unknown | null) {
        return this.appViewModel.getFirstConfigEntryHierarchical(keys, this, channel);
    }
}

export type SelectedChannel = ChannelViewModel | AddChannelsViewModel | LogSearchViewModel;

export type SelectableTab = SelectedChannel;

export type CharactersEventListener = (characters: CharacterName[]) => void;


class SortedChannelSet extends ObservableOrderedDictionaryImpl<ChatChannelViewModelSortKey, ChatChannelViewModel> {

    static compare(a: ChatChannelViewModelSortKey, b: ChatChannelViewModelSortKey): number {
        if (a.zsortOrder < b.zsortOrder) return -1;
        if (a.zsortOrder > b.zsortOrder) return 1;

        if (a.ztitle < b.ztitle) return -1;
        if (a.ztitle > b.ztitle) return 1;

        return 0;
    }

    constructor() {
        super(x => x.sortKey, SortedChannelSet.compare);
    }
}

class SortedPMConvoSet extends ObservableOrderedDictionaryImpl<PMConvoChannelViewModelSortKey, PMConvoChannelViewModel> {
    static compare(a: PMConvoChannelViewModelSortKey, b: PMConvoChannelViewModelSortKey): number {
        // inverse
        if (a.zlastInteraction > b.zlastInteraction) return -1;
        if (a.zlastInteraction < b.zlastInteraction) return 1;

        if (a.zname.value < b.zname.value) return -1;
        if (a.zname.value > b.zname.value) return 1;

        return 0;
    }

    private readonly _byCharacterName: Map<CharacterName, PMConvoChannelViewModel> = new Map();

    constructor() {
        super(x => x.sortKey, SortedPMConvoSet.compare);
    }

    getByCharacter(name: CharacterName): PMConvoChannelViewModel | null {
        const res = this._byCharacterName.get(name);
        return res ?? null;
    }

    protected override raiseItemChangeEvent(type: DictionaryChangeType, kvp: KeyValuePair<PMConvoChannelViewModelSortKey, PMConvoChannelViewModel>) {
        super.raiseItemChangeEvent(type, kvp);
        switch (type) {
            case DictionaryChangeType.ITEM_ADDED:
                this._byCharacterName.set(kvp.value.character, kvp.value);
                break;
            case DictionaryChangeType.ITEM_REMOVED:
                this._byCharacterName.delete(kvp.value.character);
                break;
        }
    }
}

export enum LeftListSelectedPane {
    CHATS = "chats",
    WATCHLIST = "watchlist",
    OTHER = "other"
}

export enum ChatConnectionState {
    CONNECTING,
    CONNECTED,
    DISCONNECTED_NORMALLY,
    DISCONNECTED_UNEXPECTEDLY,
    DISCONNECTED_KICKED
}

export interface SelectableTabViewModel {
    isTabActive: boolean;
}

class ActiveLoginViewModelBBCodeSink implements BBCodeParseSink {
    constructor(
        private readonly owner: ActiveLoginViewModel,
        private readonly logger: Logger) {
    }

    private get appViewModel() { return this.owner.appViewModel; }

    userClick(name: CharacterName, context: BBCodeClickContext) {
        this.logger.logInfo("userclick", name.value, context.rightClick);
        try {
            if (context.rightClick && context.targetElement) {
                const po = new CharacterDetailPopupViewModel(this.appViewModel, this.owner, name, context.channelContext ?? null, context.targetElement);
                this.appViewModel.popups.push(po);
            }
            else {
                const pd = new CharacterProfileDialogViewModel(this.appViewModel, this.owner, name);
                this.appViewModel.showDialogAsync(pd);
            }
        }
        catch { }
    }

    webpageClick(url: string, forceExternal: boolean, context: BBCodeClickContext) {
        try {
            const maybeProfileTarget = URLUtils.tryGetProfileLinkTarget(url);
            if (maybeProfileTarget != null && !forceExternal) {
                this.userClick(CharacterName.create(maybeProfileTarget), context);
            }
            else {
                this.appViewModel.launchUrlAsync(url, forceExternal);
            }
        }
        catch { }
    }

    async sessionClick(target: string, titleHint: string, context: BBCodeClickContext) {
        this.logger.logInfo("sessionclick", target);
        try {
            const chanName = ChannelName.create(target);
            await this.owner.chatConnectionConnected?.joinChannelAsync(chanName, titleHint);
            const cvm = this.owner.getChannel(chanName);
            if (cvm) {
                this.owner.selectedChannel = cvm;
            }
        }
        catch { }
    }
}