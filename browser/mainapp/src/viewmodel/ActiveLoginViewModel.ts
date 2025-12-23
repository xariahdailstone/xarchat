import { ChannelMetadata, ChatConnection } from "../fchat/ChatConnection.js";
import { FListAuthenticatedApi, FriendsList, ProfileInfo } from "../fchat/api/FListApi.js";
import { ChannelName } from "../shared/ChannelName.js";
import { CharacterName } from "../shared/CharacterName.js";
import { CharacterSet } from "../shared/CharacterSet.js";
import { BBCodeClickContext, BBCodeParseSink, ChatBBCodeParser } from "../util/bbcode/BBCode.js";
import { tryDispose, IDisposable, addOnDispose, ConvertibleToDisposable, asDisposable } from "../util/Disposable.js";
import { HostInterop, LogMessageType } from "../util/hostinterop/HostInterop.js";
import { Observable, ObservableValue, PropertyChangeEvent } from "../util/Observable.js";
import { ObservableBase, observableProperty, observablePropertyExt } from "../util/ObservableBase.js";
import { Collection, CollectionChangeEvent, CollectionChangeType, ObservableCollection } from "../util/ObservableCollection.js";
import { DictionaryChangeType, ObservableKeyExtractedOrderedDictionary, ObservableOrderedDictionaryImpl, ObservableOrderedSet } from "../util/ObservableKeyedLinkedList.js";
import { AppNotifyEventType, AppViewModel, AppViewModelBBCodeSink, GetConfigSettingChannelViewModel } from "./AppViewModel.js";
import { ChannelMessageViewModel, ChannelViewModel } from "./ChannelViewModel.js";
import { CharacterNameSet, CharacterNameSetImpl, ReadOnlyCharacterNameSet } from "./CharacterNameSet.js";
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
import { OperationCancelledError, PromiseSource } from "../util/PromiseSource.js";
import { IterableUtils } from "../util/IterableUtils.js";
import { SavedChatState } from "../settings/AppSettings.js";
import { CharacterStatusEditorPopupViewModel } from "./popups/CharacterStatusEditorPopupViewModel.js";
import { OnlineStatus } from "../shared/OnlineStatus.js";
import { Logger, Logging } from "../util/Logger.js";
import { CatchUtils } from "../util/CatchUtils.js";
import { ContextMenuPopupItemViewModel, ContextMenuPopupViewModel } from "./popups/ContextMenuPopupViewModel.js";
import { MiscTabViewModel } from "./MiscTabViewModel.js";
import { LogSearchViewModel } from "./LogSearchViewModel.js";
import { DateAnchor } from "../util/hostinterop/HostInteropLogSearch.js";
import { URLUtils } from "../util/URLUtils.js";
import { SlashCommandViewModel } from "./SlashCommandViewModel.js";
import { IdleDetection } from "../util/IdleDetection.js";
import { StringUtils } from "../util/StringUtils.js";
import { NamedObservableExpression, ObservableExpression } from "../util/ObservableExpression.js";
import { InAppToastViewModel } from "./InAppToastViewModel.js";
import { InAppToastManagerViewModel } from "./InAppToastManagerViewModel.js";
import { LogSearch2ViewModel } from "./newlogsearch/LogSearch2ViewModel.js";
import { PartnerSearchViewModel } from "./PartnerSearchViewModel.js";
import { AutoAdManager } from "../util/AutoAdManager.js";
import { NicknameSet } from "../shared/NicknameSet.js";
import { EIconFavoriteBlockViewModel } from "./EIconFavoriteBlockViewModel.js";
import { LeftSidebarTabContainerViewModel } from "./sidebartabs/LeftSidebarTabContainerViewModel.js";
import { RightSidebarTabContainerViewModel } from "./sidebartabs/RightSidebarTabContainerViewModel.js";
import { RecentConversationsViewModel } from "./RecentConversationsViewModel.js";
import { CharacterGender } from "../shared/CharacterGender.js";
import { NotificationManagerViewModel } from "./NotificationManagerViewModel.js";
import { CallbackSet } from "../util/CallbackSet.js";
import { LogSearch3ViewModel } from "./logsearch/LogSearch3ViewModel.js";
import { FriendsAndBookmarksViewModel } from "./FriendsAndBookmarksViewModel.js";
import { SessionFriendsAndBookmarksViewModel } from "./AccountsFriendsAndBookmarksViewModel.js";

declare const XCHost: any;

let nextViewModelId = 1;

export class ActiveLoginViewModel extends ObservableBase implements IDisposable {
    constructor(
        public readonly parent: AppViewModel,
        public readonly authenticatedApi: FListAuthenticatedApi,
        public readonly savedChatState: SavedChatState) {

        super();

        this._nicknameSet = new NicknameSet(this);
        this._disposeActions.push(() => this._nicknameSet.dispose());

        this.characterSet = new CharacterSet();
        this.sessionFriendsAndBookmarks = this.appViewModel.accountsFriendsAndBookmarks.getOrCreate(this.authenticatedApi.account).createForSession(this);
        this.characterSet.initializeSets(this.ignoredChars, this.friends, this.bookmarks, this.interests, this.nicknameSet)

        this._disposeActions.push(this.sessionFriendsAndBookmarks);
        this._disposeActions.push(this.characterSet);        

        this.addPropertyListener("pmConvosCollapsed", (e) => {
            this.logger.logWarn("pmConvosCollapsed changed", e.propertyName, e.propertyValue);
        })

        this._viewModelId = nextViewModelId++;
        this._logger = Logging.createLogger("ActiveLoginViewModel");
        this._logger.enterScope(`id#${this._viewModelId}`);

        this.toastManager = new InAppToastManagerViewModel(this);

        this.console = new ConsoleChannelViewModel(this);
        this.partnerSearch = new PartnerSearchViewModel(this);
        this.recentConversations = new RecentConversationsViewModel(this);
        
        this.recentNotifications = new NotificationManagerViewModel(this);
        this._disposeActions.push(() => this.recentNotifications.dispose());

        this.friendAndBookmarksTab = new FriendsAndBookmarksViewModel(this);

        this.miscTabs.push(new MiscTabViewModel(this, "Console", this.console));
        //this._logSearchViewModel = new LogSearchViewModel(this, this.appViewModel, savedChatState.characterName);
        //this.miscTabs.push(new MiscTabViewModel(this, "Log Viewer", this._logSearchViewModel));
        //this._logSearchViewModel2 = new LogSearch2ViewModel(this, this.appViewModel, savedChatState.characterName);
        //this.miscTabs.push(new MiscTabViewModel(this, "Log Viewer 2", this._logSearchViewModel2));

        this._logSearchViewModel3 = new LogSearch3ViewModel(this);
        this._disposeActions.push(() => this._logSearchViewModel3.dispose());
        this.miscTabs.push(new MiscTabViewModel(this, "Log Viewer", this._logSearchViewModel3));

        this.miscTabs.push(new MiscTabViewModel(this, "Partner Search", this.partnerSearch));
        this.miscTabs.push(new MiscTabViewModel(this, "Recent Conversations", this.recentConversations));
        this.miscTabs.push(new MiscTabViewModel(this, "Recent Notifications", this.recentNotifications));
        this.miscTabs.push(new MiscTabViewModel(this, "Friends & Bookmarks", this.friendAndBookmarksTab));

        this.leftTabs = new LeftSidebarTabContainerViewModel(this);
        this.rightTabs = new RightSidebarTabContainerViewModel(this);
        this._disposeActions.push(() => {
            this.leftTabs.dispose();
            this.rightTabs.dispose();
        });

        //this.serverOps.addEventListener("collectionchange", (ev) => { this.notifyChannelsOfCharacterChange(this.serverOps, ev); });
        //this.watchedChars.addEventListener("collectionchange", (ev) => { this.notifyChannelsOfCharacterChange(this.watchedChars, ev); });

        this._disposeActions.push(
            this.serverOps.addEventListener("dictionarychange", (dce) => {
                const chars = [ dce.item ];
                this.notifyChannelsOfCharacterChange(chars);
            })
        );
        this._disposeActions.push(
            this.watchedChars.addEventListener("dictionarychange", (dce) => {
                const chars = [ dce.item ];
                this.notifyChannelsOfCharacterChange(chars);
            })
        );
        this._disposeActions.push(
            this.ignoredChars.addEventListener("dictionarychange", (dce) => {
                const chars = [ dce.item ];
                this.notifyChannelsOfCharacterChange(chars);
            })
        );

        this.openChannels.addCollectionObserver(changes => {
            for (let change of changes) {
                switch (change.changeType) {
                    case StdObservableCollectionChangeType.ITEM_ADDED:
                        {
                            this.openChannelsByChannelName.set(change.item.name, change.item);

                            const item = change.item;
                            const oePing = new ObservableExpression(
                                () => item.pingMessagesCount,
                                () => this.refreshPingMentionCount(),
                                () => this.refreshPingMentionCount()
                            );
                            const oeUnread = new ObservableExpression(
                                () => item.unseenMessageCount,
                                () => this.refreshPingMentionCount(),
                                () => this.refreshPingMentionCount()
                            );
                            (item as any)[this.SYM_CHAN_DISPOSABLE] = asDisposable(oePing, oeUnread);

                            this.refreshPingMentionCount();
                            this.raiseChannelJoinLeaveHandler(change.item, true);
                        }
                        break;
                    case StdObservableCollectionChangeType.ITEM_REMOVED:
                        {
                            const item = change.item;
                            const itemDisposable = (item as any)[this.SYM_CHAN_DISPOSABLE];
                            delete (item as any)[this.SYM_CHAN_DISPOSABLE];
                            tryDispose(itemDisposable);

                            this._pinnedChannels.delete(change.item.sortKey);
                            this._pinnedChannels2.remove(change.item);
                            this._unpinnedChannels.delete(change.item.sortKey);
                            this._unpinnedChannels2.remove(change.item);
                            this.openChannelsByChannelName.delete(change.item.name);
                            this.refreshPingMentionCount();
                            this.raiseChannelJoinLeaveHandler(change.item, false);
                        }
                        break;
                    case StdObservableCollectionChangeType.CLEARED:
                        this.logger.logWarn("unhandled clear");
                        break;
                }
            }
        });
        this._pmConversations2.addCollectionObserver(changes => {
            for (let change of changes) {
                switch (change.changeType) {
                    case StdObservableCollectionChangeType.ITEM_ADDED:
                        {
                            const item = change.item;
                            const oePing = new ObservableExpression(
                                () => item.pingMessagesCount,
                                () => this.refreshPingMentionCount(),
                                () => this.refreshPingMentionCount()
                            );
                            const oeUnread = new ObservableExpression(
                                () => item.unseenMessageCount,
                                () => this.refreshPingMentionCount(),
                                () => this.refreshPingMentionCount()
                            );
                            (item as any)[this.SYM_CHAN_DISPOSABLE] = asDisposable(oePing, oeUnread);

                            this.refreshPingMentionCount();

                            if (change.item instanceof PMConvoChannelViewModel) {
                                if (!this.savedChatState.pmConvos.contains(change.item.savedChatStatePMConvo)) {
                                    this.savedChatState.pmConvos.push(change.item.savedChatStatePMConvo);
                                }
                            }
                        }
                        break;
                    case StdObservableCollectionChangeType.ITEM_REMOVED:
                        {
                            const item = change.item;
                            const itemDisposable = (item as any)[this.SYM_CHAN_DISPOSABLE]
                            delete (item as any)[this.SYM_CHAN_DISPOSABLE];
                            tryDispose(itemDisposable);

                            this.refreshPingMentionCount();

                            if (change.item instanceof PMConvoChannelViewModel) {
                                this.savedChatState.pmConvos.removeWhere(x => x.character.equals(change.item.character));
                            }
                        }
                        break;
                    case StdObservableCollectionChangeType.CLEARED:
                        this.logger.logWarn("unhandled clear");
                        break;
                }
            }
        });

        this.bbcodeSink = new ActiveLoginViewModelBBCodeSink(this, this._logger);
        this.eIconFavoriteBlockViewModel = new EIconFavoriteBlockViewModel(this);

        this.getMyFriendsListInfo(CancellationToken.NONE);
    }

    private readonly SYM_CHAN_DISPOSABLE = Symbol();

    private _isDisposed: boolean = false;
    get isDisposed(): boolean { return this._isDisposed; }

    private _disposeActions: ConvertibleToDisposable[] = [];

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            asDisposable(...this._disposeActions).dispose();
            this._disposeActions = [];
        }
    }
    [Symbol.dispose](): void {
        this.dispose();
    }

    private _channelJoinLeaveHandlers: CallbackSet<(channelViewModel: ChannelViewModel, isJoin: boolean) => any> = new CallbackSet("ActiveLoginViewModel.channelJoinLeaveHandlers");
    addChannelJoinLeaveHandler(callback: (channelViewModel: ChannelViewModel, isJoin: boolean) => any): IDisposable {
        return this._channelJoinLeaveHandlers.add(callback);
    }
    removeChannelJoinLeaveHandler(callback: (channelViewModel: ChannelViewModel, isJoin: boolean) => any) {
        this._channelJoinLeaveHandlers.delete(callback);
    }
    private raiseChannelJoinLeaveHandler(channelViewModel: ChannelViewModel, isJoin: boolean) {
        this._channelJoinLeaveHandlers.invoke(channelViewModel, isJoin);
    }

    private readonly _chanPropChangeSym = Symbol("ActiveLoginViewModel.ChanPropChange");

    private readonly _viewModelId: number;
    private readonly _logger: Logger;

    //private readonly _logSearchViewModel: LogSearchViewModel;

    eIconFavoriteBlockViewModel: EIconFavoriteBlockViewModel;

    //private readonly _logSearchViewModel2: LogSearch2ViewModel;

    private readonly _logSearchViewModel3: LogSearch3ViewModel;

    get appViewModel() { return this.parent; }

    @observableProperty
    isLoggingIn: boolean = false;

    private readonly _serverVariables: ObservableValue<{ [key: string]: any }> = new ObservableValue({});
    get serverVariables() { return this._serverVariables.value; }
    updateServerVariable(varName: string, varValue: any) {
        const nv = {...this._serverVariables.value, [varName]: varValue};
        this._serverVariables.value = nv;
    }

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
            for (let ch of this._unpinnedChannels2) {
                ch.sessionConnectionStateChanged();
            }
            for (let ch of this._pinnedChannels2) {
                ch.sessionConnectionStateChanged();
            }

            // for (let ch of this._unpinnedChannels.values()) {
            //     ch.sessionConnectionStateChanged();
            // }
            // for (let ch of this._pinnedChannels.values()) {
            //     ch.sessionConnectionStateChanged();
            // }

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

    private readonly _nicknameSet: NicknameSet;
    get nicknameSet() { return this._nicknameSet; }

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

    private _autoAdManager: AutoAdManager | null = null;

    addedToLogins() { 
        this._autoAdManager = new AutoAdManager(this);
    }
    removingFromLogins() { 
        this._autoAdManager?.dispose();
        this._autoAdManager = null;
    }

    readonly sessionFriendsAndBookmarks: SessionFriendsAndBookmarksViewModel;

    get serverOps(): ReadOnlyCharacterNameSet { return this.sessionFriendsAndBookmarks.serverOps; }

    get friends(): ReadOnlyCharacterNameSet { return this.sessionFriendsAndBookmarks.friends; }

    get bookmarks(): ReadOnlyCharacterNameSet { return this.sessionFriendsAndBookmarks.bookmarks; }

    get interests(): ReadOnlyCharacterNameSet { return this.sessionFriendsAndBookmarks.interests; }

    get watchedChars(): ReadOnlyCharacterNameSet { return this.sessionFriendsAndBookmarks.watchedChars; }

    get ignoredChars(): ReadOnlyCharacterNameSet { return this.sessionFriendsAndBookmarks.ignored; }

    get onlineFriends(): ReadOnlyCharacterNameSet { return this.sessionFriendsAndBookmarks.onlineFriends; }

    get onlineBookmarks(): ReadOnlyCharacterNameSet { return this.sessionFriendsAndBookmarks.onlineBookmarks; }

    get onlineInterests(): ReadOnlyCharacterNameSet { return this.sessionFriendsAndBookmarks.onlineInterests; }

    get onlineWatchedChars(): ReadOnlyCharacterNameSet { return this.sessionFriendsAndBookmarks.onlineWatchedChars; }

    get lookingFriends(): ReadOnlyCharacterNameSet { return this.sessionFriendsAndBookmarks.lookingFriends; }

    get lookingBookmarks(): ReadOnlyCharacterNameSet { return this.sessionFriendsAndBookmarks.lookingBookmarks; }

    get lookingInterests(): ReadOnlyCharacterNameSet { return this.sessionFriendsAndBookmarks.lookingInterests; }

    get lookingWatchedChars(): ReadOnlyCharacterNameSet { return this.sessionFriendsAndBookmarks.lookingWatchedChars; }

    @observableProperty
    watchedListFilter: WatchedListFilterType = WatchedListFilterType.ONLINE;

    @observableProperty
    readonly openChannels: Collection<ChatChannelViewModel> = new Collection();

    readonly openChannelsByChannelName: Map<ChannelName, ChatChannelViewModel> = new Map();

    readonly console: ConsoleChannelViewModel;

    readonly partnerSearch: PartnerSearchViewModel;

    readonly recentConversations: RecentConversationsViewModel;

    readonly recentNotifications: NotificationManagerViewModel;

    readonly friendAndBookmarksTab: FriendsAndBookmarksViewModel;

    get pingWords() { return this.savedChatState.pingWords; };

    private readonly _unseenCount: ObservableValue<number> = new ObservableValue(0);
    private readonly _pingCount: ObservableValue<number> = new ObservableValue(0);

    get unseenCount() { return this._unseenCount.value; }
    get pingCount() { return this._pingCount.value; }
    get hasUnseenMessages() { return Observable.calculate("ActiveLoginViewModel.hasUnseenMessages", () => this._unseenCount.value > 0); }
    get hasPings() { return Observable.calculate("ActiveLoginViewModel.hasPings", () => this._pingCount.value > 0); }

    private refreshPingMentionCount() {
        let unseenTotal = 0;
        let pingTotal = 0;
        for (let ch of this.openChannels.iterateValues()) {
            pingTotal += ch.pingMessagesCount;
            unseenTotal += ch.unseenMessageCount;
        }
        for (let ch of this._pmConversations2.iterateValues()) {
            pingTotal += ch.pingMessagesCount;
            unseenTotal += ch.unseenMessageCount;
        }
        this._unseenCount.value = unseenTotal;
        this._pingCount.value = pingTotal;
    }

    private readonly _pinnedChannels2: Collection<ChatChannelViewModel> = new Collection<ChatChannelViewModel>();
    private readonly _unpinnedChannels2: Collection<ChatChannelViewModel> = new Collection<ChatChannelViewModel>();
    private readonly _pmConversations2: Collection<PMConvoChannelViewModel> = new Collection<PMConvoChannelViewModel>();

    private readonly _pinnedChannels = new SortedChannelSet();
    private readonly _unpinnedChannels = new SortedChannelSet();
    private readonly _pmConversations = new SortedPMConvoSet();

    @observableProperty
    readonly pinnedChannelsOLD: ObservableKeyExtractedOrderedDictionary<ChatChannelViewModelSortKey, ChatChannelViewModel> = this._pinnedChannels;

    @observableProperty
    readonly unpinnedChannelsOLD: ObservableKeyExtractedOrderedDictionary<ChatChannelViewModelSortKey, ChatChannelViewModel> = this._unpinnedChannels;

    @observableProperty
    readonly pinnedChannels: Collection<ChatChannelViewModel> = this._pinnedChannels2;

    @observableProperty
    readonly unpinnedChannels: Collection<ChatChannelViewModel> = this._unpinnedChannels2;

    @observableProperty
    readonly pmConversationsOLD: ObservableKeyExtractedOrderedDictionary<PMConvoChannelViewModelSortKey, PMConvoChannelViewModel> = this._pmConversations;

    @observableProperty
    readonly pmConversations: Collection<PMConvoChannelViewModel> = this._pmConversations2;

    private addChannelToCollectionSorted(channel: ChatChannelViewModel, collection: Collection<ChatChannelViewModel>) {
        const insertingChannelTitle = StringUtils.channelTitleAsSortableString(channel.title);
        for (let i = 0; i < collection.length; i++) {
            const comparingChannelTitle = StringUtils.channelTitleAsSortableString(collection[i]!.title);
            if (comparingChannelTitle > insertingChannelTitle) {
                collection.addAt(channel, i);
                return;
            }
        }
        collection.push(channel);
    }

    updateChannelPinState(ch: ChatChannelViewModel) {
        const origSk = ch.sortKey;
        if (ch.needRekey()) {
            if (origSk.zpinned) {
                this._pinnedChannels.delete(ch.sortKey);
                this._pinnedChannels2.remove(ch);
            }
            else {
                this._unpinnedChannels.delete(ch.sortKey);
                this._unpinnedChannels2.remove(ch);
            }
            ch.rekey();
            if (ch.isPinned) {
                this._pinnedChannels.add(ch);
                this.addChannelToCollectionSorted(ch, this._pinnedChannels2);
            }
            else {
                this._unpinnedChannels.add(ch);
                this.addChannelToCollectionSorted(ch, this._unpinnedChannels2);
            }
        }
    }

    updatePMConvoOrdering(ch: PMConvoChannelViewModel) {
        const origSk = ch.sortKey;
        if (ch.needRekey()) {
            this._pmConversations.delete(ch.sortKey);
            this._pmConversations2.remove(ch);
            ch.rekey();
            this._pmConversations.add(ch);
            this.insertPMConversation(ch);
        }
    }

    private insertPMConversation(ch: PMConvoChannelViewModel) {
        ch.rekey();
        const chSortKey = ch.sortKey;
        for (let i = 0; i < this._pmConversations2.length; i++) {
            if (PMConvoChannelViewModelSortKey.compare(this._pmConversations2[i]!.sortKey, chSortKey) > 0) {
                this._pmConversations2.addAt(ch, i);
                return;
            }
        }
        this._pmConversations2.add(ch);
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
            this.maybeDisposeChannel(channel);
        }
    }

    setChannelOrdering(names: ChannelName[]) {
        this.setChannelOrderingInternal(names, this._pinnedChannels2);
        this.setChannelOrderingInternal(names, this._unpinnedChannels2);
        this.renumberChannelOrders();
    }

    private renumberChannelOrders() {
        let idx = 0;
        for (let c of this._pinnedChannels2) {
            c.order = idx;
            idx++;
        }
        for (let c of this._unpinnedChannels2) {
            c.order = idx;
            idx++;
        }
    }

    private setChannelOrderingInternal(names: ChannelName[], list: Collection<ChatChannelViewModel>) {
        const nameToOrderMap = new Map<ChannelName, number>();
        for (let i = 0; i < names.length; i++) {
            nameToOrderMap.set(names[i], i);
        }

        list.sortBy((a, b) => nameToOrderMap.get(a.name)! - nameToOrderMap.get(b.name)!);
    }

    reorderChannel(name: ChannelName, where: ("before" | "after"), relTo: ChannelViewModel) {
        const movingChan = this.getChannel(name);
        if (movingChan && relTo instanceof ChatChannelViewModel && movingChan.channelCategory == relTo.channelCategory &&
            movingChan != relTo) {
            if (movingChan.isPinned) {
                this.pinnedChannels.remove(movingChan);
                const targetIdx = this.pinnedChannels.indexOf(relTo);
                this.pinnedChannels.addAt(movingChan, targetIdx + (where == "after" ? 1 : 0));
            }
            else {
                this.unpinnedChannels.remove(movingChan);
                const targetIdx = this.unpinnedChannels.indexOf(relTo);
                this.unpinnedChannels.addAt(movingChan, targetIdx + (where == "after" ? 1 : 0));
            }
            this.renumberChannelOrders();
        }
    }

    getOrCreatePmConvo(convoCharacter: CharacterName, transient: boolean = false): (PMConvoChannelViewModel | null) {
        const x = this.getPmConvo(convoCharacter);
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
                this.insertPMConversation(newConvo);
            }

            this.chatConnectionConnected?.openPrivateMessageTab(convoCharacter);
            return newConvo;
        }
        else {
            return x;
        }
    }

    private async populatePmConvoFromLogs(convovm: PMConvoChannelViewModel, interlocutor: CharacterName): Promise<void> {
        if (this.getConfigSettingById("loggingEnabled", convovm)) {
            const messages = await HostInterop.getRecentLoggedPMConvoMessagesAsync(this.characterName, interlocutor, 200);  // TODO: come from config
            if (!convovm.populatedFromReplay) {
                convovm.restoreFromLoggedMessages(messages);
            }
        }
    }

    private async populateChannelFromLogs(chanvm: ChatChannelViewModel, channelName: ChannelName) {
        if (this.getConfigSettingById("loggingEnabled", chanvm)) {
            const messages = await HostInterop.getRecentLoggedChannelMessagesAsync(channelName, 200);  // TODO: come from config
            if (!chanvm.populatedFromReplay) {
                chanvm.restoreFromLoggedMessages(messages);
            }
        }
    }

    getPmConvo(convoCharacter: CharacterName): PMConvoChannelViewModel | null {
        for (let i = 0; i < this._pmConversations2.length; i++) {
            if (this._pmConversations2[i]?.character == convoCharacter) {
                return this._pmConversations2[i]!;
            }
        }
        return null;
    }

    closePmConvo(convoCharacter: CharacterName) {
        const convo = this.getPmConvo(convoCharacter);
        if (convo) {
            this._pmConversations.deleteByValue(convo);
            this._pmConversations2.remove(convo);
            this.removeFromSelectedChannelHistory(convo, true);
            this.chatConnectionConnected?.closePrivateMessageTab(convoCharacter);
        }
    }

    //@observableProperty
    //readonly openPmConvos: Collection<PMConvoChannelViewModel> = new Collection();

    @observableProperty
    leftListSelectedPane: LeftListSelectedPane = LeftListSelectedPane.CHATS;

    @observableProperty
    leftTabs: LeftSidebarTabContainerViewModel;

    @observableProperty
    rightTabs: RightSidebarTabContainerViewModel;

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
            const prevSelectedTab = this._selectedTab;
            if (this._selectedTab){
                //if (this._selectedTab instanceof ChannelViewModel) {
                    this._selectedTab.isTabActive = false;
                //}
            }
            this._selectedTab = value;
            this._selectedTab.isTabActive = this.appViewModel.isWindowActive;
            if (this._selectedTab && this._selectedTab instanceof ChannelViewModel) {
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
            this.maybeDisposeChannel(prevSelectedTab);
        }
    }

    private maybeDisposeChannel(chan: any) {
        if (chan instanceof ChannelViewModel) {
            if (!this._pmConversations2.contains(chan) &&
                !this._pinnedChannels2.contains(chan) &&
                !this._unpinnedChannels2.contains(chan) &&
                !(chan instanceof ConsoleChannelViewModel) &&
                this.selectedTab != chan) {

                chan.dispose();
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
        // if (this.selectedChannel) {
        //     this.selectedChannel.isTabActive = this.isSelectedSession && this.appViewModel.isWindowActive;
        // }
        if (this.selectedTab) {
            this.selectedTab.isTabActive = this.isSelectedSession && this.appViewModel.isWindowActive;
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

    get friendsList() { return this.sessionFriendsAndBookmarks.friendsList; }

    async getMyFriendsListInfo(cancellationToken: CancellationToken): Promise<FriendsList> {
        const ps = new PromiseSource<FriendsList>();

        using cancelReg = cancellationToken.register(() => {
            ps.trySetCancelled(cancellationToken);
        });

        const oe = new ObservableExpression(
            () => this.sessionFriendsAndBookmarks.friendsList,
            (fl) => {
                if (fl?.isError) {
                    ps.tryReject(fl.error!);
                }
                else if (fl?.isValue) {
                    ps.tryResolve(fl.value!);
                }
            },
            (err) => {
                ps.tryReject(err);
            }
        );

        const result = await ps.promise;
        return result;
    }
    expireMyFriendsListInfo() {
        this.sessionFriendsAndBookmarks.expireFriendsList();
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
                    textBuilder.push("[list]");
                    for (let tvm of vms) {
                        if (tvm.showInHelp) {
                            textBuilder.push(`[listitem][color=yellow][b]/${tvm.command[0]}[/b][/color] - [i]${tvm.title}[/i]: [indent]${tvm.description}[/indent][/listitem]`);
                        }
                    }
                    textBuilder.push("[/list]");
                    return textBuilder.join("");
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
            ),
            new SlashCommandViewModel(
                ["devtools"],
                "Show Developer Tools",
                "Opens the browser developer tools for the XarChat user interface.",
                [],
                async (context, args) => {
                    HostInterop.showDevTools();
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
        const autoIdleSetting = !!this.appViewModel.getConfigSettingById("autoIdle"); // !!this.getFirstConfigEntryHierarchical(["autoIdle"]);
        const autoAwaySetting = !!this.appViewModel.getConfigSettingById("autoAway"); // !!this.getFirstConfigEntryHierarchical(["autoAway"]);

        if (autoIdleSetting || autoAwaySetting) {
            const userState = autoIdleSetting ? this.parent.userState : "active";
            const screenState = autoAwaySetting ? this.parent.screenState : "unlocked";
            this.logger.logInfo("idleStateChanged", userState, screenState);
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

    openLogViewer(logsFor: CharacterName, dateAnchor: DateAnchor, date: Date, target: string | CharacterName) {
        if (target instanceof CharacterName) {
            this._logSearchViewModel3.openPMConvoSearch(logsFor, target);
        }
        else {
            this._logSearchViewModel3.openChannelSearch(target);
        }
        this.selectedTab = this._logSearchViewModel3;

        // this._logSearchViewModel.setSearch(logsFor, dateAnchor, date, target);
        // this.selectedTab = this._logSearchViewModel;
    }

    getConfigSettingById(configSettingId: string, channel?: GetConfigSettingChannelViewModel | null) {
        return this.appViewModel.getConfigSettingById(configSettingId, this, channel);
    }

    getConfigEntryHierarchical(key: string, channel?: GetConfigSettingChannelViewModel | null) {
        return this.appViewModel.getConfigEntryHierarchical(key, this, channel);
    }

    getFirstConfigEntryHierarchical(keys: string[], channel?: GetConfigSettingChannelViewModel | null): (unknown | null) {
        return this.appViewModel.getFirstConfigEntryHierarchical(keys, this, channel);
    }

    readonly toastManager: InAppToastManagerViewModel;

    // Called when an eicon loads the "no eicon" image
    trackInvalidEIcon(eiconName: string) {
        const eiconNameCanonical = eiconName.toLowerCase();

        // Remove from recently-used list
        {
            const configBlockKey = `character.${this.characterName.canonicalValue}.recentlyUsedEIcons`;
            let recentList: string[] = this.appViewModel.configBlock.get(configBlockKey) as (string[] | null | undefined) ?? [];
            const rlIndex = recentList.indexOf(eiconNameCanonical);
            if (rlIndex >= 0) {
                recentList.splice(rlIndex, 1)
                this.appViewModel.configBlock.set(configBlockKey, recentList);
            }
        }

        // Remove from most-used list
        {
            const configBlockKey = `character.${this.characterName.canonicalValue}.mostUsedEIcons`;
            let mostUsedList = {... this.appViewModel.configBlock.get(configBlockKey) as (Record<string, {lastUsed: number,count: number}> | null | undefined) ?? {} };
            let muItem = mostUsedList[eiconNameCanonical];
            if (muItem) {
                delete mostUsedList[eiconNameCanonical];
                this.appViewModel.configBlock.set(configBlockKey, mostUsedList);
            }
        }
    }

    trackUsedEIconsInMessage(msgContent: string) {
        using parseResult = ChatBBCodeParser.parse(msgContent)
        const usedSet = parseResult.usedEIcons;
        usedSet.forEach(v => {
            this.trackUsedEIcon(v);
        });
    }

    // Called when this character sends a message containing an eicon
    trackUsedEIcon(eiconName: string) {
        const eiconNameCanonical = eiconName.toLowerCase();

        // Add to recently-used list
        {
            const configBlockKey = `character.${this.characterName.canonicalValue}.recentlyUsedEIcons`;
            let recentList: string[] = this.appViewModel.configBlock.get(configBlockKey) as (string[] | null | undefined) ?? [];
            const rlIndex = recentList.indexOf(eiconNameCanonical);
            if (rlIndex != 0) {
                if (rlIndex >= 0) {
                    recentList.splice(rlIndex, 1)
                }
                recentList.unshift(eiconNameCanonical);
                while (recentList.length > 100) {
                    recentList.pop();
                }
                this.appViewModel.configBlock.set(configBlockKey, recentList);
            }
        }

        // Add to most used list
        {
            const configBlockKey = `character.${this.characterName.canonicalValue}.mostUsedEIcons`;
            let mostUsedList = {... this.appViewModel.configBlock.get(configBlockKey) as (Record<string, {lastUsed: number,count: number}> | null | undefined) ?? {} };
            let muItem = mostUsedList[eiconNameCanonical];
            if (muItem) {
                muItem.lastUsed = (new Date()).getTime();
                muItem.count++;
            }
            else {
                mostUsedList[eiconNameCanonical] = { lastUsed: (new Date()).getTime(), count: 1 };
                while (Object.getOwnPropertyNames(mostUsedList).length > 100) {
                    let leastRecentlyUsedKey: string | null = null;
                    let leastRecentlyUsedItem: {lastUsed: number,count: number} | null = null;
                    for (let item of Object.getOwnPropertyNames(mostUsedList).map(k => { return { key: k, value: mostUsedList[k] }; })) {
                        const tkey = item.key;
                        const titem = item.value;
                        if (!leastRecentlyUsedItem || titem.lastUsed < leastRecentlyUsedItem.lastUsed) {
                            leastRecentlyUsedKey = tkey;
                            leastRecentlyUsedItem = titem;
                        }
                    }
                    if (leastRecentlyUsedKey) {
                        delete mostUsedList[leastRecentlyUsedKey];
                    }
                    else {
                        break;
                    }
                }
            }
            this.appViewModel.configBlock.set(configBlockKey, mostUsedList);
        }
    }

    getRecentlyUsedEIcons(): string[] {
        const configBlockKey = `character.${this.characterName.canonicalValue}.recentlyUsedEIcons`;
        const recentList: string[] = this.appViewModel.configBlock.get(configBlockKey) as (string[] | null | undefined) ?? [];
        return recentList;
    }

    getMostUsedEIcons(): string[] {
        const configBlockKey = `character.${this.characterName.canonicalValue}.mostUsedEIcons`;
        const mostUsedList = {... this.appViewModel.configBlock.get(configBlockKey) as (Record<string, {lastUsed: number,count: number}> | null | undefined) ?? {} };
        return [...Object.getOwnPropertyNames(mostUsedList)
            .map(k => { return { key: k, value: mostUsedList[k] }; })
            .sort((a, b) => b.value.count - a.value.count)
            .map(e => e.key)];
    }

    logChannelMessage(channel: ChatChannelViewModel,
            speakingCharacter: CharacterName, speakingCharacterGender: CharacterGender, speakingCharacterOnlineStatus: OnlineStatus,
            messageType: LogMessageType, messageText: string): void {
        if (this.getConfigSettingById("loggingEnabled", channel)) {
            HostInterop.logChannelMessage(this.characterName, channel.name, channel.title, speakingCharacter, speakingCharacterGender,
                speakingCharacterOnlineStatus, messageType, messageText);
        }
    }

    logPMConvoMessage(pmConvo: PMConvoChannelViewModel,
            speakingCharacter: CharacterName, speakingCharacterGender: CharacterGender, speakingCharacterOnlineStatus: OnlineStatus,
            messageType: LogMessageType, messageText: string): void {
        if (this.getConfigSettingById("loggingEnabled", pmConvo)) {
            HostInterop.logPMConvoMessage(this.characterName, pmConvo.character, speakingCharacter, speakingCharacterGender,
                speakingCharacterOnlineStatus, messageType, messageText);
        }
    }
}

export type SelectedChannel = ChannelViewModel | AddChannelsViewModel | LogSearchViewModel | LogSearch2ViewModel | LogSearch3ViewModel;

export interface SelectableTab {
    isTabActive: boolean;
}
//export type SelectableTab = SelectedChannel | PartnerSearchViewModel | RecentConversationsViewModel | NotificationManagerViewModel | FriendsAndBookmarksViewModel;

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

export enum WatchedListFilterType {
    ALL,
    ONLINE,
    LOOKING
}

export enum LeftListSelectedPane {
    CHATS = "chats",
    WATCHED = "watched",
    FRIENDS = "friends",
    BOOKMARKS = "bookmarks",
    OTHER = "other"
}

export enum ChatConnectionState {
    CONNECTING,
    CONNECTED,
    DISCONNECTED_NORMALLY,
    DISCONNECTED_UNEXPECTEDLY,
    DISCONNECTED_KICKED,
    DISCONNECTED_LOGGED_IN_ELSEWHERE
}

export interface SelectableTabViewModel {
    isTabActive: boolean;
}

class ActiveLoginViewModelBBCodeSink extends AppViewModelBBCodeSink {
    constructor(
        private readonly owner: ActiveLoginViewModel,
        private readonly logger: Logger) {

        super(owner.appViewModel);
    }

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