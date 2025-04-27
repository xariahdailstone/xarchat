import { ChannelName } from "../shared/ChannelName.js";
import { AddMessageOptions, ChannelMessageType, ChannelMessageViewModel, ChannelMessageViewModelOrderedDictionary, ChannelViewModel, MultiSelectChannelFilterOptionItem, MultiSelectChannelFilterOptions, PendingMessageSendViewModel, PendingMessageType, SingleSelectChannelFilterOptionItem, SingleSelectChannelFilterOptions } from "./ChannelViewModel.js";
import { ActiveLoginViewModel, CharactersEventListener, ChatConnectionState } from "./ActiveLoginViewModel.js";
import { Collection, CollectionChangeType, ObservableCollection, ReadOnlyObservableCollection } from "../util/ObservableCollection.js";
import { CharacterName } from "../shared/CharacterName.js";
import { ObservableBase, observableProperty } from "../util/ObservableBase.js";
import { OnlineStatus } from "../shared/OnlineStatus.js";
import { ObservableKeyExtractedOrderedDictionary, ObservableOrderedDictionary, ObservableOrderedDictionaryImpl } from "../util/ObservableKeyedLinkedList.js";
import { IDisposable, asDisposable } from "../util/Disposable.js";
import { HostInterop, LogMessageType } from "../util/HostInterop.js";
import { RawSavedChatStateNamedFilterEntry, RawSavedChatStateNamedFilterMap } from "../settings/RawAppSettings.js";
import { SavedChatState, SavedChatStateJoinedChannel } from "../settings/AppSettings.js";
import { SendQueue } from "../util/SendQueue.js";
import { TaskUtils } from "../util/TaskUtils.js";
import { AppNotifyEventType } from "./AppViewModel.js";
import { DateAnchor, LogSearchKind } from "../util/HostInteropLogSearch.js";
import { SnapshottableMap } from "../util/collections/SnapshottableMap.js";
import { SnapshottableSet } from "../util/collections/SnapshottableSet.js";
import { DialogButtonStyle } from "./dialogs/DialogViewModel.js";
import { KeyCodes } from "../util/KeyCodes.js";
import { SlashCommandViewModel } from "./SlashCommandViewModel.js";
import { IterableUtils } from "../util/IterableUtils.js";
import { ChannelFiltersViewModel } from "./ChannelFiltersViewModel.js";
import { ObservableExpression } from "../util/ObservableExpression.js";
import { ObservableValue } from "../util/Observable.js";
import { ServerError } from "../fchat/ChatConnectionImpl.js";
import { CatchUtils } from "../util/CatchUtils.js";
import { CallbackSet } from "../util/CallbackSet.js";
import { ContextMenuPopupViewModel } from "./popups/ContextMenuPopupViewModel.js";
import { ConfigureAutoAdsViewModel } from "./ConfigureAutoAdsViewModel.js";
import { StringUtils } from "../util/StringUtils.js";
import { CancellationToken } from "../util/CancellationTokenSource.js";
import { SuggestionHeader, SuggestionItem } from "./SuggestTextBoxViewModel.js";
import { HTMLUtils } from "../util/HTMLUtils.js";

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

    private _disposed: boolean = false;
    [Symbol.dispose]() { this.dispose(); }
    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            this._statusListener.dispose();
        }
    }
    get isDisposed() { return this._disposed; }

    get characterSet() { return this.parent.parent.characterSet; }
}

export class ChatChannelViewModelSortKey {
    constructor(
        public readonly zsortOrder: number,
        public readonly ztitle: string,
        public readonly zpinned: boolean) {
    }

    static compare(a: ChatChannelViewModelSortKey, b: ChatChannelViewModelSortKey): number {
        if (a.zsortOrder < b.zsortOrder) return -1;
        if (a.zsortOrder > b.zsortOrder) return 1;

        if (a.ztitle < b.ztitle) return -1;
        if (a.ztitle > b.ztitle) return 1;

        return 0;
    }
}

export class ChatChannelViewModel extends ChannelViewModel {
    constructor(parent: ActiveLoginViewModel, name: ChannelName, title: string) {
        super(parent, title);

        this.name = name;
        this.title = title;
        this.showConfigButton = true;
        this.canClose = true;
        this.canPin = true;

        this.filterMode = ChatChannelMessageMode.BOTH;

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
                else {
                    parent.openLogViewer(
                        parent.characterName,
                        DateAnchor.Before,
                        new Date(),
                        this.name
                    );
                }
            }));

        this.channelFilters = new ChannelFiltersViewModel(this);
        this.channelFilters.addCategory("chattext", "Chat (Text)", "Normal chat messages.");
        this.channelFilters.addCategory("chatemote", "Chat (Emote)", "Chat emote messages.");
        this.channelFilters.addCategory("ad", "Ads", "Roleplay Advertisements");
        this.channelFilters.addCategory("roll", "Dice Rolls", "Dice Rolls");
        this.channelFilters.addCategory("spin", "Bottle Spins", "Bottle Spins");
        this.channelFilters.addCategory("system", "System Messages", "System Messages");
        const setupDefaultFilters = () => {
            const nfAll = this.channelFilters!.addNamedFilter("All", [ "chattext", "chatemote", "ad", "roll", "spin", "system" ]);
            this.channelFilters!.addNamedFilter("Chat", [ "chattext", "chatemote", "roll", "spin", "system" ]);
            this.channelFilters!.addNamedFilter("Ads", [ "ad", "system" ]);
            this.channelFilters!.selectedFilter = nfAll;
        };
    
        const existingSCC = IterableUtils.asQueryable(parent.savedChatState.joinedChannels).where(x => x.name == name).firstOrNull();
        if (!existingSCC) {
            this._scc = new SavedChatStateJoinedChannel(
                parent.savedChatState.joinedChannels,
                { name: name.value, title: title ?? name.value, order: this.order });
            parent.savedChatState.joinedChannels.push(this._scc);
            setupDefaultFilters();
        }
        else {
            this._scc = existingSCC;
            this._order = existingSCC.order;
            this.channelFilters.loadFromSCC(existingSCC.namedFilters, () => setupDefaultFilters());
        }

        this.ownedDisposables.add(new ObservableExpression(() => this.channelFilters!.sccData,
            (v) => { this._scc!.namedFilters = v ?? null; },
            (err) => { }));

        // if (existingSCC && existingSCC.filters) {
        //     this.showFilterClasses = existingSCC.filters
        // }
        this.updateFilterOptions();

    }

    private _scc?: SavedChatStateJoinedChannel;

    override get showFilterClasses() { return super.showFilterClasses; }
    override set showFilterClasses(value: string[]) {
        super.showFilterClasses = value;
        // if (this._scc) {
        //     this._scc.filters = value;
        // }
    }

    getMaxMessageSize(): number | null {
        return +this.activeLoginViewModel.serverVariables["chat_max"];
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

    private _order: number = 0;
    @observableProperty
    get order(): number { return this._order; }
    set order(value: number) {
        if (value !== this._order) {
            this._order = value;
            const scc = IterableUtils.asQueryable(this.parent.savedChatState.joinedChannels).where(scc => scc.name == this.name).firstOrNull();
            if (scc) {
                scc.order = value;
            }
        }
    }

    get collectiveName(): string { return `ch:${this.name.value}`; }

    override async showSettingsDialogAsync() { 
        await this.parent.appViewModel.showSettingsDialogForChannelAsync(this.parent, this);
    }

    @observableProperty
    presenceState: ChatChannelPresenceState = ChatChannelPresenceState.NOT_IN_CHANNEL;

    @observableProperty
    get actuallyInChannel() { return (this.presenceState == ChatChannelPresenceState.IN_CHANNEL); }

    private _descriptionAssigned: boolean = false;
    private _description: string = "";

    @observableProperty
    get description(): string { return this._description; }
    set description(value: string) {
        if (value !== this._description) {
            this._description = value;
        }
        if (this._descriptionAssigned) {
            this.addSystemMessage(new Date(), "The channel description has been updated.", false, true);
        }
        this._descriptionAssigned = true;
    }

    @observableProperty
    descriptionIsNew: boolean = false;

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

    @observableProperty
    get channelCategory() {
        if (this.isPinned) {
            return "Pinned Channels";
        }
        else {
            return "Other Channels";
        }
    }

    private _messageMode: ChatChannelMessageMode = ChatChannelMessageMode.BOTH;
    @observableProperty
    get messageMode() { return this._messageMode; }
    set messageMode(value: ChatChannelMessageMode) {
        if (value != this._messageMode) {
            this._messageMode = value;

            if (value == ChatChannelMessageMode.CHAT_ONLY) {
                this._cantSendAsAdReasons.value =
                    [CantSendAsAdReasons.ChannelDoesntAllowAds, ...this._cantSendAsAdReasons.value.filter(r => r != CantSendAsAdReasons.ChannelDoesntAllowAds)];
            }
            else {
                this._cantSendAsAdReasons.value =this._cantSendAsAdReasons.value.filter(r => r != CantSendAsAdReasons.ChannelDoesntAllowAds);
            }

            this.updateFilterOptions();
        }
    }

    private updateFilterOptions() {
        //if (this._messageMode == ChatChannelMessageMode.BOTH) {
            const filterSelectOptions: MultiSelectChannelFilterOptionItem[] = [];
            filterSelectOptions.push(
                new MultiSelectChannelFilterOptionItem("chattext", "Chat (Text)"),
                new MultiSelectChannelFilterOptionItem("chatemote", "Chat (Emote)"),
                new MultiSelectChannelFilterOptionItem("ad", "Ads"),
                new MultiSelectChannelFilterOptionItem("roll", "Dice Rolls"),
                new MultiSelectChannelFilterOptionItem("spin", "Bottle Spins"),
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
        //}
        //else {
        //    this.filterOptions = null;
        //}
    }

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
    assignChannelOps(characters: CharacterName[]) {
        const charsToAdd = new Set(characters);
        const charsToRemove = new Set(this._channelOps.values());

        for (let character of [...charsToAdd.values()]) {
            charsToRemove.delete(character);
            if (this._channelOps.has(character)) {
                charsToAdd.delete(character);
            }
        }
        for (let c of charsToAdd.values()) {
            this.addChannelOps([c]);
        }
        for (let c of charsToRemove.values()) {
            this.removeChannelOp(c);
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

    private readonly _channelOpsListeners2: CallbackSet<CharactersEventListener> = new CallbackSet("ChatChannelViewModel-channelOpsListeners");
    addChannelOpsListener(callback: CharactersEventListener): IDisposable {
        return this._channelOpsListeners2.add(callback);
    }
    private notifyChannelOpsListeners(characters: CharacterName[]) {
        this._channelOpsListeners2.invoke(characters);
    }

    isCharacterInChannel(character: CharacterName): boolean {
        const result = this._allUsers.has(character);
        return result;
    }

    updateUserInLists(character: CharacterName | null) {
        if (!character) return;

        let uvm = this._allUsers.get(character);
        let isInChannel = uvm != null;
        let isModerator = isInChannel 
            && (CharacterName.equals(this._channelOwner, character) || this._channelOps.has(character) || this.parent.serverOps.has(character));
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

    private _filterMode: ChatChannelMessageMode = ChatChannelMessageMode.ADS_ONLY; // reset in constructor

    @observableProperty
    get filterMode(): ChatChannelMessageMode { return this._filterMode; }
    set filterMode(value: ChatChannelMessageMode) {
        if (value !== this._filterMode) {
            this.scrolledTo = null;
            this._filterMode = value;
            switch (value) {
                case ChatChannelMessageMode.ADS_ONLY:
                    this.showFilterClasses = [ "ad", "roll", "spin", "system" ];
                    break;
                case ChatChannelMessageMode.CHAT_ONLY:
                    this.showFilterClasses = [ "chattext", "chatemote", "roll", "spin", "system" ];
                    break;
                case ChatChannelMessageMode.BOTH:
                    this.showFilterClasses = [ "chattext", "chatemote", "ad", "roll", "spin", "system" ];
                    break;
            }
            this.updateFilterOptions();
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

    override getSlashCommands(): SlashCommandViewModel[] {
        return [
            ...super.getSlashCommands(),
            new SlashCommandViewModel(
                ["code"],
                "Get Channel Link Code",
                "Gets the BBCode used to link to this channel.",
                [],
                async (context, args) => {
                    const linkCode = `[session=${this.title}]${this.name.value}[/session]`;
                    const linkCopyScript = `navigator.clipboard.writeText(e.target.getAttribute('data-linkcode')); appViewModel.flashTooltipAsync('Copied!', e.target, e.clientX, e.clientY)`;
                    const linkCodeAttr = HTMLUtils.escapeHTML(linkCode);
                    return `Channel link code: [noparse=nocopy]${linkCode}[/noparse]`
                        + HTMLUtils.getHtmlBBCodeTag(` <a class="bbcode-url" data-linkcode="${linkCodeAttr}" data-onclick="${linkCopyScript}">Click to Copy</a>`);
                }
            ),
            new SlashCommandViewModel(
                ["invite"],
                "Invite User to Channel",
                "Invites a user to this channel (requires channel op status).",
                ["character"],
                async (context, args) => {
                    const inviteCharName = args[0] as CharacterName;
                    await this.inviteAsync(inviteCharName);
                    return "";
                }
            ),
            new SlashCommandViewModel(
                ["desc", "description", "setdescription"],
                "Update Channel Description",
                "Updates the description of this channel to the specified text (requires channel op status).",
                ["text"],
                async (context, args) => {
                    const newDesc = args[0] as string;
                    await this.changeDescriptionAsync(newDesc);
                    return "";
                }
            ),
            new SlashCommandViewModel(
                ["kick"],
                "Kick Character From Channel",
                "Kicks the specified character from the channel (requires channel op status).",
                ["character"],
                async (context, args) => {
                    const kickCharName = args[0] as CharacterName;
                    await this.kickAsync(kickCharName);
                    return "";
                }
            ),
            new SlashCommandViewModel(
                ["timeout"],
                "Timeout Character From Channel",
                "Kicks the specified character from the channel and temporarily bans them for the specified number of minutes (requires channel op status).\n\nExample:  /timeout 30 Character Name",
                ["integer", "character"],
                async (context, args) => {
                    const lengthMin = args[0] as number;
                    const timeoutCharName = args[1] as CharacterName;
                    await this.timeoutAsync(timeoutCharName, lengthMin);
                    return "";
                }
            ),
            new SlashCommandViewModel(
                ["oplist"],
                "Get Operator List For Channel",
                "Gets the list of channel ops for this channel.",
                [],
                async (context, args) => {
                    await this.getChannelOpListAsync();
                    return "";
                }
            ),
            new SlashCommandViewModel(
                ["banlist"],
                "Get Ban List For Channel",
                "Gets the list of channel ops for this channel (requires channel op status).",
                [],
                async (context, args) => {
                    await this.getBanListAsync();
                    return "";
                }
            ),
            new SlashCommandViewModel(
                ["op"],
                "Give a Character Channel Op Status",
                "Gives the specified character channel operator status for this channel (requires channel owner status).",
                ["character"],
                async (context, args) => {
                    const opCharName = args[0] as CharacterName;
                    await this.opAsync(opCharName);
                    return "";
                }
            ),
            new SlashCommandViewModel(
                ["deop", "dop"],
                "Remove a Character's Channel Op Status",
                "Removes channel operator status for this channel from the specified character (requires channel owner status).",
                ["character"],
                async (context, args) => {
                    const deopCharName = args[0] as CharacterName;
                    await this.deopAsync(deopCharName);
                    return "";
                }
            ),
            new SlashCommandViewModel(
                ["ban"],
                "Ban a Character From Channel",
                "Bans the specified character from this channel indefinitely (requires channel op status).",
                ["character"],
                async (context, args) => {
                    const banCharName = args[0] as CharacterName;
                    await this.banAsync(banCharName);
                    return "";
                }
            ),
            new SlashCommandViewModel(
                ["unban"],
                "Unban a Character From Channel",
                "Unbans the specified character from this channel (requires channel op status).",
                ["character"],
                async (context, args) => {
                    const banCharName = args[0] as CharacterName;
                    await this.unbanAsync(banCharName);
                    return "";
                }
            ),
            new SlashCommandViewModel(
                ["makeowner"],
                "Transfer Channel Ownership",
                "Transfers ownership of this channel to the specified character (requires channel owner status).",
                ["character"],
                async (context, args) => {
                    const newOwnerCharName = args[0] as CharacterName;
                    await this.changeOwnerAsync(newOwnerCharName);
                    return "";
                }
            ),
            new SlashCommandViewModel(
                ["setmode"],
                "Change Channel Message Mode",
                "Changes the message mode of this channel to the specified value (one of 'chat', 'ads', or 'both'; requires channel op status).",
                ["text"],
                async (context, args) => {
                    const newMode = args[0] as string;
                    await this.changeChannelModeAsync(newMode);
                    return "";
                }
            ),
            new SlashCommandViewModel(
                ["openroom"],
                "Open Channel to the Public",
                "Changes the status of the channel to public, allowing anyone to join (requires channel op status).",
                [],
                async (context, args) => {
                    await this.changeChannelPrivacyStatusAsync("public");
                    return "";
                }
            ),
            new SlashCommandViewModel(
                ["closeroom"],
                "Close Channel to the Public",
                "Changes the status of the channel to private, allowing only invited characters to join (requires channel op status).",
                [],
                async (context, args) => {
                    await this.changeChannelPrivacyStatusAsync("private");
                    return "";
                }
            ),
            new SlashCommandViewModel(
                ["warn"],
                "Send a Warning Message",
                "Sends a message to the channel, highlighted as a warning message (requires channel op status).",
                ["!text"],
                async (context, args) => {
                    await this.sendAsWarningMessageAsync();
                    return "";
                }
            )
        ]
    }

    // override async processCommandInternalAsync(command: string): Promise<string> {
    //     const spacePos = command.indexOf(' ');
    //     const commandStr = spacePos != -1 ? command.substring(0, spacePos) : command;
    //     const commandArgs = spacePos != -1 ? command.substring(spacePos + 1) : "";
    //     switch (commandStr.toLowerCase()) {
    //         case "code":
    //             return `Channel link code: [noparse][session=${this.title}]${this.name.value}[/session][/noparse]`
    //         case "invite":
    //             {
    //                 const inviteCharName = CharacterName.create(commandArgs.trim());
    //                 await this.inviteAsync(inviteCharName);
    //                 return "";
    //             }
    //         case "desc":
    //         case "description":
    //             {
    //                 await this.changeDescriptionAsync(commandArgs.trim());
    //                 return "";
    //             }
    //         case "kick":
    //             {
    //                 const kickCharName = CharacterName.create(commandArgs.trim());
    //                 await this.kickAsync(kickCharName);
    //                 return "";
    //             }
    //         case "timeout":
    //             {
    //                 const m = commandArgs.match(/^\s*(\d+)\s+(.+)$/);
    //                 if (m) {
    //                     const minutes = +m[1];
    //                     const timeoutCharName = CharacterName.create(m[2]);
    //                     await this.timeoutAsync(timeoutCharName, minutes);
    //                     return "";
    //                 }
    //                 else {
    //                     return "Invalid arguments.  Supply arguments as '<minutes> <character>'";
    //                 }
    //             }
    //         case "oplist":
    //             {
    //                 await this.getChannelOpListAsync();
    //                 return "";
    //             }
    //         case "banlist":
    //             {
    //                 await this.getBanListAsync();
    //                 return "";
    //             }
    //         case "op":
    //             {
    //                 const opCharName = CharacterName.create(commandArgs.trim());
    //                 await this.opAsync(opCharName);
    //                 return "";
    //             }
    //         case "deop":
    //         case "dop":
    //             {
    //                 const deopCharName = CharacterName.create(commandArgs.trim());
    //                 await this.deopAsync(deopCharName);
    //                 return "";
    //             }
    //         case "ban":
    //             {
    //                 const banCharName = CharacterName.create(commandArgs.trim());
    //                 await this.banAsync(banCharName);
    //                 return "";
    //             }
    //         case "unban":
    //             {
    //                 const unbanCharName = CharacterName.create(commandArgs.trim());
    //                 await this.unbanAsync(unbanCharName);
    //                 return "";
    //             }
    //         case "makeowner":
    //             {
    //                 const newOwnerCharName = CharacterName.create(commandArgs.trim());
    //                 await this.changeOwnerAsync(newOwnerCharName);
    //                 return `Made [user]${newOwnerCharName}[/user] the new channel owner.`;
    //             }
    //         case "setmode":
    //             {
    //                 await this.changeChannelModeAsync(commandArgs.trim());
    //                 return "";
    //             }
    //         case "openroom":
    //             {
    //                 await this.changeChannelPrivacyStatusAsync("public");
    //                 return "";
    //             }
    //         case "closeroom":
    //             {
    //                 await this.changeChannelPrivacyStatusAsync("private");
    //                 return "";
    //             }
    //         default:
    //             const sres = await super.processCommandInternalAsync(command);
    //             return sres;
    //     }
    // }

    private searchAllOnlineCharacters(value: string, filterFunc?: (cn: CharacterName) => boolean): SuggestionItem[] {
        this.logger.logInfo("getting online char suggestions", value);
        if (StringUtils.isNullOrWhiteSpace(value)) {
            return [];
        }

        const friendMatches: string[] = [];
        const bookmarkMatches: string[] = [];
        const otherMatches: string[] = [];
        this.activeLoginViewModel.characterSet.forEachMatchingCharacter(value.trim(), cname => {
            if (filterFunc && !filterFunc(cname)) { return; }

            const cs = this.activeLoginViewModel.characterSet.getCharacterStatus(cname);
            if (cs.isFriend) {
                friendMatches.push(cname.value);
            }
            else if (cs.isBookmark) {
                bookmarkMatches.push(cname.value);
            }
            else {
                otherMatches.push(cname.value);
            }
        });

        friendMatches.sort();
        bookmarkMatches.sort();
        otherMatches.sort();

        const results: SuggestionItem[] = [];
        const needsHeaders = (friendMatches ? 1 : 0) + (bookmarkMatches ? 1 : 0) + (otherMatches ? 1 : 0) > 1;

        if (friendMatches.length > 0) {
            if (needsHeaders) {
                results.push(new SuggestionHeader("Friend Matches"));
            }
            for (let x of friendMatches) {
                results.push(x);
            }
        }
        if (bookmarkMatches.length > 0) {
            if (needsHeaders) {
                results.push(new SuggestionHeader("Bookmark Matches"));
            }
            for (let x of bookmarkMatches) {
                results.push(x);
            }
        }
        if (otherMatches.length > 0) {
            if (needsHeaders) {
                results.push(new SuggestionHeader("Other Matches"));
            }
            for (let x of otherMatches) {
                results.push(x);
            }
        }

        let moreCount = 0;
        while (results.length > 20) {
            const popped = results.pop();
            if (typeof popped == "string") {
                moreCount++;
            }
        }
        if (results.length > 0 && !(typeof results[results.length - 1])) {
            results.pop();
        }

        if (moreCount > 0) {
            results.push(new SuggestionHeader(`Plus ${moreCount} more matches, refine your search`));
        }

        this.logger.logInfo("done getting online char suggestions", results);
        return results;
    }

    async inviteAsync(char?: CharacterName) {
        this.verifyCurrentlyEffectiveOp();
        if (!char) {
            char = await this.promptForOnlineCharacterAsync(
                "Invite to Channel",
                "Specify which character should be invited to the channel",
                {
                    resultMustBeOnline: true,
                    filterFunc: (cn: CharacterName) => {
                        if (this.isCharacterInChannel(cn)) { 
                            return false; 
                        }
                        return true;
                    }
                }
            );
        }
        if (char) {
            const cstat = this.activeLoginViewModel.characterSet.getCharacterStatus(char);
            if (cstat.status != OnlineStatus.OFFLINE) {
                await this.activeLoginViewModel.chatConnection.inviteToChannelAsync(this.name, char);
            }
            else {
                throw "That character is not online.";
            }
        }
    }

    async changeDescriptionAsync(newDescription?: string) {
        this.verifyCurrentlyEffectiveOp();

        if (newDescription === undefined) {
            const nd = await this.appViewModel.promptForStringAsync({
                message: `Enter a description for channel \"${this.title}\".`,
                title: "Change Channel Description",
                confirmButtonTitle: "Set Description",
                cancelButtonTitle: "Cancel",
                multiline: true,
                maxLength: this.activeLoginViewModel.serverVariables.cds_max != null ? +this.activeLoginViewModel.serverVariables.cds_max : 5000,
                isBBCodeString: true,
                initialValue: this.description
            });
            if (nd == null) {
                return;
            }
            newDescription = nd;
        }

        await this.activeLoginViewModel.chatConnection.changeChannelDescriptionAsync(this.name, newDescription);
    }

    override addMessage(message: ChannelMessageViewModel, options?: AddMessageOptions): void {
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

        super.addMessage(message, options);

        if (logMessageType != null && !(options?.fromReplay ?? false)) {
            HostInterop.logChannelMessage(this.activeLoginViewModel.characterName, this.name, this.title, 
                message.characterStatus.characterName, message.characterStatus.gender, message.characterStatus.status,
                logMessageType, message.text);
        }
    }

    @observableProperty
    get iconUrl() {
        //return `https://static.f-list.net/images/avatar/${this.name.canonicalValue}.png`;
        return `assets/ui/chatchannel-icon.svg`;
    }

    @observableProperty
    canSendTextboxAsChat: boolean = true;

    @observableProperty
    adSendWaitRemainingSec: number | null = null;

    private readonly _sendQueue: SendQueue = new SendQueue();

    async sendTextboxInternalAsync(): Promise<void> {
        if (this.textBoxContent && this.textBoxContent != "") {
            const msgContent = this.textBoxContent;

            try {
                await this.parent.chatConnection.checkChannelSendMessageAsync(this.name, msgContent);
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
                onFailTerminalAsync: async (err) => {
                    this.addSystemMessage(new Date(), `Failed to send: ${msgContent}`, true);
                    this.pendingSendsCount--;
                }
            });
        }
    }

    get isPublicChannel() { return !this.name.canonicalValue.startsWith("adh-"); }

    protected override getCanBottleSpin(): boolean {
        if (this.name.canonicalValue == "frontpage") { return false; }
        if (this.isPublicChannel) { return false; }
        if (this.messageMode == ChatChannelMessageMode.ADS_ONLY) { return false; }
        return true;
    }

    protected override getCanRollDice(): boolean {
        if (this.name.canonicalValue == "frontpage") { return false; }
        if (this.messageMode == ChatChannelMessageMode.ADS_ONLY) { return false; }
        return true;
    }

    override async performRollAsync(rollSpecification: string): Promise<void> {
        if (!this.getCanRollDice()) {
            this.addSystemMessage(new Date(), "Cannot roll dice here.", true);
        }
        else {
            await this.activeLoginViewModel.chatConnection.channelPerformRollAsync(this.name, rollSpecification);
        }
    }

    override async performBottleSpinAsync(): Promise<void> {
        if (!this.getCanBottleSpin()) {
            this.addSystemMessage(new Date(), "Cannot spin the bottle here.", true);
        }
        else {
            await this.activeLoginViewModel.chatConnection.channelPerformBottleSpinAsync(this.name);
        }
    }

    override ensureSelectableFilterSelected() {
        if (this.channelFilters) {
            const selectableFiltersArray = 
                IterableUtils.asQueryable(this.channelFilters.namedFilters).where(nf => 
                    (nf.showInAdsOnlyChannel && this.messageMode == ChatChannelMessageMode.ADS_ONLY) ||
                    (nf.showInChatOnlyChannel && this.messageMode == ChatChannelMessageMode.CHAT_ONLY) ||
                    (nf.showInBothAdsAndChatChannel && this.messageMode == ChatChannelMessageMode.BOTH)).toArray();
            const selectableFiltersSet = new Set(selectableFiltersArray);

            const sf = this.channelFilters.selectedFilter;
            let needReselect = true;
            if (sf) {
                if (selectableFiltersSet.has(sf)) { needReselect = false; }
            }
            if (needReselect && selectableFiltersArray.length > 0) {
                this.channelFilters.selectedFilter = selectableFiltersArray[0];
            }
        }
    }

    protected pingIfNecessary(message: ChannelMessageViewModel) {
        super.pingIfNecessary(message);
        if (message.containsPing && !this.isTabActive && message.characterStatus.characterName != this.parent.characterName) {
            this.activeLoginViewModel.appViewModel.soundNotification({
                eventType: AppNotifyEventType.HIGHLIGHT_MESSAGE_RECEIVED,
                activeLoginViewModel: this.activeLoginViewModel,
                channel: this
            });
        }
    }

    private readonly _cantSendAsAdReasons: ObservableValue<CantSendAsAdReasons[]> = new ObservableValue([]);

    @observableProperty
    get canSendTextboxAsAd() { return this._cantSendAsAdReasons.value.length == 0; }

    async sendAdAsync(msgContent: string): Promise<void> {
        try {
            await this.parent.chatConnection.checkChannelAdMessageAsync(this.name, msgContent);
        }
        catch (e) {
            this.addSystemMessage(new Date(), `Cannot send: ${CatchUtils.getMessage(e)}`, true);
            return;
        }

        await this._sendQueue.executeAsync({
            maxRetries: 3,
            onAttemptAsync: async () => {
                await this.parent.chatConnection.channelAdMessageAsync(this.name, msgContent);

                this._cantSendAsAdReasons.value =
                    [CantSendAsAdReasons.WaitingOnAdThrottle, ...this._cantSendAsAdReasons.value.filter(r => r != CantSendAsAdReasons.WaitingOnAdThrottle)];

                const canSendAgainAt = (new Date()).getTime() + (1000 * 60 * 10);

                const tick = window.setInterval(() => { 
                    const timeRemaining = Math.floor(Math.max(0, canSendAgainAt - (new Date()).getTime()) / 1000);
                    this.adSendWaitRemainingSec = timeRemaining;
                }, 1000);
                window.setTimeout(() => {
                    window.clearInterval(tick);
                    this.adSendWaitRemainingSec = null;
                    this._cantSendAsAdReasons.value = this._cantSendAsAdReasons.value.filter(r => r != CantSendAsAdReasons.WaitingOnAdThrottle);
                }, 1000 * 60 * 10);
            },
            onSuccessAsync: async () => {
                this.addAdMessage({
                    speakingCharacter: this.parent.characterName,
                    message: msgContent,
                    isAd: true,
                    seen: true,
                    asOf: new Date()
                });
            },
            onFailBeforeRetryAsync: async () => {
                await TaskUtils.delay(1000);
            },
            onFailTerminalAsync: async () => {
                this.addSystemMessage(new Date(), `Failed to send: ${msgContent}`, true);
            }
        });
    }

    async sendTextboxAsAdAsync(): Promise<void> {
        if (this.textBoxContent && this.textBoxContent != "" && (this.canSendTextboxAsAd || this.textBoxContent.startsWith("/"))) {
            const msgContent = this.textBoxContent;

            this.pendingSendsCount++;
            try {
                if (msgContent.startsWith("/")) {
                    await this.processCommandAsync();
                }
                else {
                    this.textBoxContent = "";
                    await this.sendAdAsync(msgContent);
                }
            }
            finally {
                this.pendingSendsCount--;
            }
        }
    }

    showSendAdContextMenu(contextElement: HTMLElement) {
        const ctxVm = new ContextMenuPopupViewModel<() => void>(this.appViewModel, contextElement);

        ctxVm.addMenuItem("Setup Ad Auto Posting...", () => {
            const vm = new ConfigureAutoAdsViewModel(this.appViewModel, this.activeLoginViewModel);
            this.appViewModel.showDialogAsync(vm);
        });

        ctxVm.onValueSelected = (func) => {
            ctxVm.dismissed();
            func();
        }

        this.appViewModel.popups.push(ctxVm);
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

    verifyCurrentlyEffectiveOp() {
        if (!this.isEffectiveOp(this.activeLoginViewModel.characterName)) {
            throw "You are not a channel operator."
        }
    }

    verifyCurrentlyEffectiveOwner() {
        if (!this.isEffectiveOwner(this.activeLoginViewModel.characterName)) {
            throw "You are not the channel owner."
        }
    }

    async kickAsync(name?: CharacterName) {
        this.verifyCurrentlyEffectiveOp();
        if (!name) {
            name = await this.promptForCharacterInChannelAsync(
                "Kick From Channel",
                "Specify which character should be kicked from the channel");
        }
        if (name) {
            await this.activeLoginViewModel.chatConnection.kickFromChannelAsync(this.name, name);
        }
    }

    async timeoutAsync(name: CharacterName, minutes: number) {
        this.verifyCurrentlyEffectiveOp();
        if (minutes != Math.floor(minutes) || minutes < 1 || minutes > 90) {
            throw "You must timeout for a whole number of minutes between 1 and 90, inclusive."
        }
        await this.activeLoginViewModel.chatConnection.timeoutFromChannelAsync(this.name, name, minutes);
    }

    async getChannelOpListAsync() {
        const oplistinfo = await this.activeLoginViewModel.chatConnection.getChannelOpListAsync(this.name);
        if (oplistinfo.ops.length == 0) {
            this.addSystemMessage(new Date(), 
                `Nobody is currently moderating [b]${oplistinfo.channelTitle}[/b].`,
                false, true, false, false);
        }
        else {
            this.addSystemMessage(new Date(), 
                `Channel moderators for [b]${oplistinfo.channelTitle}[/b]: ` + oplistinfo.ops.map(cn => `[user]${cn.value}[/user]`).join(", "),
                false, true, false, false);
        }
    }

    async getBanListAsync() {
        this.verifyCurrentlyEffectiveOp();
        const banlistinfo = await this.activeLoginViewModel.chatConnection.getChannelBanListAsync(this.name);
        if (banlistinfo.bans.length == 0) {
            this.addSystemMessage(new Date(), 
                `Nobody is currently banned from [b]${banlistinfo.channelTitle}[/b].`,
                false, true, false, false);
        }
        else {
            this.addSystemMessage(new Date(), 
                `Channel bans for [b]${banlistinfo.channelTitle}[/b]: ` + banlistinfo.bans.map(cn => `[user]${cn.value}[/user]`).join(", "),
                false, true, false, false);
        }
    }

    async opAsync(name?: CharacterName) {
        this.verifyCurrentlyEffectiveOp();
        if (!name) {
            name = await this.promptForCharacterInChannelAsync(
                "Add Channel Moderator", 
                "Specify which character should be added as a moderator for the channel");
        }
        if (name) {
            await this.activeLoginViewModel.chatConnection.channelAddOpAsync(this.name, name);
        }
    }

    async deopAsync(name?: CharacterName) {
        this.verifyCurrentlyEffectiveOp();
        if (!name) {
            name = await this.promptForCharacterInListAsync(
                "Remove Channel Moderator", 
                "Specify which character should be removed as a moderator for the channel",
                [...this._channelOps], {
                    resultMustBeInList: true
                }
            );
        }
        if (name) {
            await this.activeLoginViewModel.chatConnection.channelRemoveOpAsync(this.name, name);
        }
    }

    private async promptForOnlineCharacterAsync(
        title: string, 
        message: string,
        options?: PromptForOnlineCharacterOptions): Promise<CharacterName | undefined> {

        options ??= {};

        const charName = await this.appViewModel.promptForStringAsync({
            title: title,
            message: message,
            validationFunc: (value: string) => {
                if (!CharacterName.isValidCharacterName(value.trim())) { return false; }

                const cn = CharacterName.create(value.trim());

                if (options.resultMustBeOnline ?? true) {
                    const cc = this.activeLoginViewModel.characterSet.getCharacterStatus(cn);
                    if (cc.status == OnlineStatus.OFFLINE) {
                        return false;
                    }
                }

                if (options.filterFunc) {
                    return options.filterFunc(cn);
                }
                else {
                    return true;
                }
            },
            suggestionFunc: async (value: string, cancellationToken: CancellationToken) => {
                const result = this.searchAllOnlineCharacters(value, options.filterFunc);
                return result;
            }
        });
        if (!charName) {
            return undefined;
        }
        return CharacterName.create(charName.trim());
    }

    private async promptForCharacterInChannelAsync(title: string, message: string): Promise<CharacterName | undefined> {
        const iclist: CharacterName[] = [];
        this._allUsers.forEach(u => { iclist.push(u.character); });

        const result = await this.promptForCharacterInListAsync(title, message, iclist);
        return result;
    }

    private async promptForCharacterInListAsync(
        title: string, message: string, 
        charList: CharacterName[],
        options?: PromptForCharacterInListOptions): Promise<CharacterName | undefined> {

        options ??= {};

        const charName = await this.appViewModel.promptForStringAsync({
            title: title,
            message: message,
            validationFunc: (value: string) => {
                if (!CharacterName.isValidCharacterName(value.trim())) { return false; }

                if (options.resultMustBeInList ?? false) {
                    const candidateResult = CharacterName.create(value);
                    let foundInList = false;
                    for (let x of charList) {
                        if (CharacterName.equals(x, candidateResult)) {
                            foundInList = true;
                            break;
                        }
                    }
                    if (!foundInList) {
                        return false;
                    }
                }

                return true;
            },
            suggestionFunc: async (value: string, cancellationToken: CancellationToken) => {
                this.logger.logInfo("getting inlist suggestions", value);
                if (StringUtils.isNullOrWhiteSpace(value)) {
                    return [];
                }

                const results: string[] = [];
                charList.forEach(c => {
                    if (c.canonicalValue.startsWith(value.toLowerCase())) {
                        results.push(c.value);
                    }
                });
                this.logger.logInfo("done getting inlist suggestions", results);
                return results;
            }
        });
        if (!charName) {
            return undefined;
        }
        return CharacterName.create(charName.trim());
    }

    async banAsync(name?: CharacterName) {
        this.verifyCurrentlyEffectiveOp();
        if (!name) {
            name = await this.promptForCharacterInChannelAsync(
                "Ban From Channel", 
                "Specify which character should be banned from the channel");
        }
        if (name) {
            await this.activeLoginViewModel.chatConnection.banFromChannelAsync(this.name, name);
        }
    }

    async unbanAsync(name?: CharacterName) {
        this.verifyCurrentlyEffectiveOp();
        if (!name) {
            const banList = await this.activeLoginViewModel.chatConnection.getChannelBanListAsync(this.name);
            name = await this.promptForCharacterInListAsync(
                "Unban From Channel",
                "Specify which character should be unbanned from the channel",
                banList.bans, {
                    resultMustBeInList: true
                });
        }
        if (name) {
            await this.activeLoginViewModel.chatConnection.unbanFromChannelAsync(this.name, name);
        }
    }

    async changeOwnerAsync(name: CharacterName) {
        this.verifyCurrentlyEffectiveOwner();

        if (!this.isCharacterInChannel(name)) {
            const cs = this.activeLoginViewModel.characterSet.getCharacterStatus(name);
            if (cs.status == OnlineStatus.OFFLINE) {
                const confirmResponse = await this.activeLoginViewModel.appViewModel.promptAsync({
                    title: "Change Channel Owner",
                    message: `Are you sure you want to make ${name} the new owner of ${this.title}?  That character is not currently online, double check that you spelled the name correctly!`,
                    buttons: [
                        { title: "Yes", shortcutKeyCode: KeyCodes.KEY_Y, resultValue: true, style: DialogButtonStyle.NORMAL },
                        { title: "No", shortcutKeyCode: KeyCodes.KEY_N, resultValue: false, style: DialogButtonStyle.BACKOFF },
                    ]
                });
                if (!confirmResponse) { return false; };
            }
            else {
                const confirmResponse = await this.activeLoginViewModel.appViewModel.promptAsync({
                    title: "Change Channel Owner",
                    message: `Are you sure you want to make ${name} the new owner of ${this.title}?  That character is not currently in the channel.`,
                    buttons: [
                        { title: "Yes", shortcutKeyCode: KeyCodes.KEY_Y, resultValue: true, style: DialogButtonStyle.NORMAL },
                        { title: "No", shortcutKeyCode: KeyCodes.KEY_N, resultValue: false, style: DialogButtonStyle.BACKOFF },
                    ]
                });
                if (!confirmResponse) { return false; };
            }
        }

        await this.activeLoginViewModel.chatConnection.channelSetOwnerAsync(this.name, name);
    }

    async changeChannelModeAsync(newMode: string) {
        newMode = newMode.toLowerCase();
        if (newMode == "chat" || newMode == "ads" || newMode == "both") {
            await this.activeLoginViewModel.chatConnection.channelSetModeAsync(this.name, newMode);
        }
        else {
            throw "Invalid channel mode.  Valid values are 'chat', 'ads', or 'both'.";
        }
    }

    async changeChannelPrivacyStatusAsync(status: "public" | "private") {
        this.verifyCurrentlyEffectiveOp();
        await this.activeLoginViewModel.chatConnection.changeChannelPrivacyStatusAsync(this.name, status);
    }

    async sendAsWarningMessageAsync() {
        this.verifyCurrentlyEffectiveOp();
        this.sendTextboxInternalAsync();
    }
}

enum CantSendAsAdReasons {
    ChannelDoesntAllowAds,
    WaitingOnAdThrottle
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

interface PromptForOnlineCharacterOptions {
    resultMustBeOnline?: boolean;
    filterFunc?: (cn: CharacterName) => boolean;
}

interface PromptForCharacterInListOptions {
    resultMustBeInList?: boolean;
}