import { ChannelView } from "../components/ChannelView.js";
import { PingLineItemDefinition, PingLineItemMatchStyle } from "../configuration/ConfigSchemaItem.js";
import { BottleSpinData, ChannelMessageData, RollData } from "../fchat/ChatConnectionSink.js";
import { CharacterGender } from "../shared/CharacterGender.js";
import { CharacterName } from "../shared/CharacterName.js";
import { CharacterSet, CharacterStatus } from "../shared/CharacterSet.js";
import { OnlineStatus } from "../shared/OnlineStatus.js";
import { TypingStatus } from "../shared/TypingStatus.js";
import { BBCodeParseResult, BBCodeParser, ChatBBCodeParser } from "../util/bbcode/BBCode.js";
import { CatchUtils } from "../util/CatchUtils.js";
import { KeyValuePair } from "../util/collections/KeyValuePair.js";
import { ReadOnlyStdObservableCollection, StdObservableCollectionChangeType } from "../util/collections/ReadOnlyStdObservableCollection.js";
import { StdObservableConcatCollectionView } from "../util/collections/StdObservableConcatCollectionView.js";
import { StdObservableList } from "../util/collections/StdObservableView.js";
import { asDisposable, tryDispose as maybeDispose, IDisposable, isDisposable } from "../util/Disposable.js";
import { HeldCacheManager } from "../util/HeldCacheManager.js";
import { LoggedMessage, LogMessageType } from "../util/HostInterop.js";
import { IterableUtils } from "../util/IterableUtils.js";
import { Logging } from "../util/Logger.js";
import { ObjectUniqueId } from "../util/ObjectUniqueId.js";
import { Observable, ObservableValue } from "../util/Observable.js";
import { ObservableBase, observableProperty } from "../util/ObservableBase.js";
import { Collection, ObservableCollection } from "../util/ObservableCollection.js";
import { ObservableExpression } from "../util/ObservableExpression.js";
import { ObservableKeyExtractedOrderedDictionary, ObservableOrderedDictionary, ObservableOrderedDictionaryImpl } from "../util/ObservableKeyedLinkedList.js";
import { StringUtils } from "../util/StringUtils.js";
import { WhenChangeManager } from "../util/WhenChange.js";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel.js";
import { AppNotifyEventType, AppViewModel } from "./AppViewModel.js";
import { ChannelFiltersViewModel } from "./ChannelFiltersViewModel.js";
import { MultiSelectPopupViewModel } from "./popups/MultiSelectPopupViewModel.js";
import { SlashCommandViewModel } from "./SlashCommandViewModel.js";

export abstract class ChannelViewModel extends ObservableBase implements IDisposable {
    constructor(parent: ActiveLoginViewModel, title: string) {
        super();

        this.parent = parent;
        this.title = title;

        this.mainMessages = new ChannelMessageViewModelOrderedDictionary();
    }

    readonly ownedDisposables: Set<IDisposable> = new Set();

    private _disposed: boolean = false;
    [Symbol.dispose]() { this.dispose(); }
    dispose() {
        if (!this._disposed) {
            this._disposed = true;

            this.clearMessages();
            for (let m of this.prefixMessages.values()) {
                m.dispose();
            }
            for (let m of this.suffixMessages.values()) {
                m.dispose();
            }
            this.prefixMessages.clear();
            this.suffixMessages.clear();
            this.recalculateMessagesToShow();

            if (this._pingWordSetOE != null) {
                this._pingWordSetOE.dispose();
            }
            if (this.channelFilters != null) {
                this.channelFilters.dispose();
            }

            for (let od of [...this.ownedDisposables]) {
                od.dispose();
            }
        }
    }
    get isDisposed() { return this._disposed; }

    @observableProperty
    readonly parent: ActiveLoginViewModel;

    get activeLoginViewModel() { return this.parent; }
    get appViewModel() { return this.parent.appViewModel; }

    protected _title: string = "";
    @observableProperty
    get title(): string { return this._title; }
    set title(value) { this._title = value; }

    abstract get collectiveName(): string;

    get messageDisplayStyle(): ChannelMessageDisplayStyle {
        const result = this.getConfigSettingById("messageDisplayStyle") as ChannelMessageDisplayStyle;
        return result;
    }

    @observableProperty
    showConfigButton: boolean = false;
    
    showSettingsDialogAsync() { }

    @observableProperty
    canClose: boolean = false;

    @observableProperty
    canPin: boolean = false;

    private _isPinned: boolean = false;
    @observableProperty
    get isPinned(): boolean { return this._isPinned; }
    set isPinned(value: boolean) { this._isPinned = value; }

    @observableProperty
    userListWidth: number = 245;

    @observableProperty
    filterOptions: ChannelFilterOptions | null = null;

    @observableProperty
    textBoxHeight: number = 90;

    private _textBoxContent: string = "";
    @observableProperty
    get textBoxContent() { return this._textBoxContent; }
    set textBoxContent(value: string) {
        if (value !== this._textBoxContent) {
            this._textBoxContent = value;
            this.onTextBoxContentUpdated();
        }
    }

    protected onTextBoxContentUpdated() { }

    @observableProperty
    canSendTextbox: boolean = true;

    @observableProperty
    processingTextbox: boolean = false;

    async sendTextboxAsync(): Promise<void> {
        if (this.textBoxContent && this.textBoxContent != "") {
            this.processingTextbox = true;
            try {
                if (this.textBoxContent && this.textBoxContent.startsWith("/") &&
                    !this.textBoxContent.startsWith("/me ") &&
                    !this.textBoxContent.startsWith("/me's ")) {
                    await this.processCommandAsync();
                }
                else {
                    await this.sendTextboxInternalAsync();
                }
            }
            finally {
                this.processingTextbox = false;
            }
        }
    }

    abstract sendTextboxInternalAsync(): Promise<void>;

    async processCommandAsync(): Promise<void> {
        try {
            const result = await this.processCommandInternalAsync(this.textBoxContent.substring(1));
            this.textBoxContent = "";
            if (!StringUtils.isNullOrWhiteSpace(result)) {
                this.addSystemMessage(new Date(), result, false);
            }
        }
        catch (e) {
            const errMsg = CatchUtils.getMessage(e);
            this.addSystemMessage(new Date(), errMsg, true);
        }
    }

    getSlashCommands(): SlashCommandViewModel[] {
        return [
            ...this.activeLoginViewModel.getSlashCommands(),
            new SlashCommandViewModel(
                ["roll"],
                "Roll Dice",
                "Roll the specified dice.",
                ["!text"],
                async (context, args) => {
                    const diceSpec = args[0] as string;
                    await this.performRollAsync(diceSpec);
                }
            ),
            new SlashCommandViewModel(
                ["bottle"],
                "Spin the Bottle",
                "Spin the bottle to select a random character in the channel.",
                [],
                async (context, args) => {
                    await this.performBottleSpinAsync();
                }
            ),
            new SlashCommandViewModel(
                ["clear"],
                "Clear Tab",
                "Clears existing messages out of the current tab.",
                [],
                async (context, args) => {
                    this.clearMessages();
                }
            ),
            new SlashCommandViewModel(
                ["create"],
                "Create New Channel",
                "Creates and joins a new private channel with the specified name.",
                ["!text"],
                async (context, args) => {
                    const newChanName = args[0] as string;
                    await this.createChannelAsync(newChanName);
                }
            )
        ]
    }

    async processCommandInternalAsync(command: string): Promise<string> {
        // const spacePos = command.indexOf(' ');
        // const commandStr = spacePos != -1 ? command.substring(0, spacePos) : command;
        // const commandArgs = spacePos != -1 ? command.substring(spacePos + 1) : "";
        // switch (commandStr.toLowerCase()) {
        //     case "roll":
        //         this.performRollAsync(commandArgs);
        //         return "";
        //     case "bottle":
        //         this.performBottleSpinAsync();
        //         return "";
        //     case "clear":
        //         this.clearMessages();
        //         return "";
        //     case "create":
        //         this.createChannelAsync(commandArgs);
        //         return "";
        //     default:
                const sres = await this.activeLoginViewModel.processCommandAsync(this.textBoxContent.substring(1), this);
                return sres;
        //}
    }

    async createChannelAsync(newChannelTitle: string): Promise<void> {
        await this.activeLoginViewModel.chatConnection.createChannelAsync(newChannelTitle);
    }

    performRollAsync(rollSpecification: string): Promise<void> {
        throw new Error("You cannot roll here");
    }

    performBottleSpinAsync(): Promise<void> {
        throw new Error("You cannot spin the bottle here");
    }

    private _scrolledTo: (ChannelViewScrollPositionModel | null) = null;

    @observableProperty
    get scrolledTo(): (ChannelViewScrollPositionModel | null) { return this._scrolledTo; }
    set scrolledTo(value: (ChannelViewScrollPositionModel | null)) {
        if (value !== this._scrolledTo) {
            this._scrolledTo = value;
            if (value == null) {
                this.newMessagesBelowNotify = false;
            }
        }
    }

    @observableProperty
    newMessagesBelowNotify: boolean = false;

    @observableProperty
    messageLimit: number = 200;

    @observableProperty
    channelFilters: ChannelFiltersViewModel | null = null;

    abstract getMaxMessageSize(): number | null;

    private readonly _filterClassesToShow: Set<string> = new Set(["all"]);

    get showFilterClasses(): string[] { return [...this._filterClassesToShow.values()]; }
    set showFilterClasses(value: string[]) {
        this._filterClassesToShow.clear();
        for (let c of value) {
            this._filterClassesToShow.add(c);
        }
        this.recalculateMessagesToShow();
    }

    private readonly _messagesByFilterClass: Map<string, ChannelMessageViewModel[]> = new Map();

    private addMessageWithFilterClasses(message: ChannelMessageViewModel, filterClasses: string[]) {
        const removedMessages = new Set<ChannelMessageViewModel>();

        for (let fc of filterClasses) {
            let arr = this._messagesByFilterClass.get(fc) ?? [];
            const newArr = [...arr, message];
            newArr.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            while (newArr.length > this.messageLimit) {
                const rm = newArr.shift()!;
                removedMessages.add(rm);
            }
            this._messagesByFilterClass.set(fc, newArr);
        }

        for (let maybeDisposeMessage of removedMessages.values()) {
            let messageStillPresent = false;
            for (let fc of this._messagesByFilterClass.values()) {
                if (fc.includes(maybeDisposeMessage)) {
                    messageStillPresent = true;
                    break;
                }
            }
            if (!messageStillPresent) {
                maybeDisposeMessage.dispose();
            }
        }

        this.recalculateMessagesToShow();
    }

    private recalculateMessagesToShow() {
        const mset = new Set<ChannelMessageViewModel>();
        for (let mc of this._filterClassesToShow.values()) {
            const arr = this._messagesByFilterClass.get(mc);
            if (arr) {
                for (let m of arr) {
                    mset.add(m);
                }
            }
        }
        const resMsg = [...mset.values()];
        resMsg.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        while (resMsg.length > this.messageLimit) {
            resMsg.shift();
        }

        const resMsgSet = new Set(resMsg);

        for (let curDispMsg of [...this._mainMessages.values()]) {
            if (!resMsgSet.has(curDispMsg)) {
                this._mainMessages.delete(curDispMsg);
            }
        }
        for (let dispMsg of resMsg) {
            if (!this._mainMessages.has(dispMsg)) {
                this._mainMessages.add(dispMsg);
            }
        }
    }

    protected readonly prefixMessages: ChannelMessageViewModelOrderedDictionary = new ChannelMessageViewModelOrderedDictionary();
    private _mainMessages: ChannelMessageViewModelOrderedDictionary = null!;
    protected readonly suffixMessages: ChannelMessageViewModelOrderedDictionary = new ChannelMessageViewModelOrderedDictionary();

    private _combinedMessagesView: StdObservableConcatCollectionView<KeyValuePair<ChannelMessageViewModel, ChannelMessageViewModel>> = null!;

    protected get mainMessages(): ChannelMessageViewModelOrderedDictionary { return this._mainMessages; }
    protected set mainMessages(value: ChannelMessageViewModelOrderedDictionary) {
        if (value != this._mainMessages) {
            this._mainMessages = value;
            const oldView = this._combinedMessagesView;
            const newView = new StdObservableConcatCollectionView<KeyValuePair<ChannelMessageViewModel, ChannelMessageViewModel>>([
                this.prefixMessages,
                this._mainMessages,
                this.suffixMessages
            ]);
            this._combinedMessagesView = newView;
            this._messages.value = newView;
            oldView?.dispose();
        }
    }

    private readonly _messages = new ObservableValue<StdObservableConcatCollectionView<KeyValuePair<ChannelMessageViewModel, ChannelMessageViewModel>>>(null!);

    @observableProperty
    get messages() { return this._messages.value; }

    populatedFromReplay: boolean = false;

    hasMatchingMessage(message: ChannelMessageViewModel) {
        for (let checkMessagePair of this.messages.iterateValues()) {
            const checkMessage = checkMessagePair.value;
            if (message.roughlyEquivalentTo(checkMessage)) {
                return true;
            }
        }
        return false;
    }

    getMessageFilterClasses(message: ChannelMessageViewModel): string[] {
        let result: string[];
        switch (message.type) {
            case ChannelMessageType.CHAT:
                if (message.text.startsWith("/me ") || message.text.startsWith("/me's ")) {
                    result = [ "chat", "chatemote" ];
                }
                else {
                    result = [ "chat", "chattext" ];
                }
                break;
            case ChannelMessageType.AD:
                result = [ "ad" ];
                break;
            case ChannelMessageType.ROLL:
                result = [ "chat", "roll" ];
                break;
            case ChannelMessageType.SPIN:
                result = [ "chat", "spin" ];
                break;
            case ChannelMessageType.SYSTEM:
                result = [ "system" ];
                break;
            case ChannelMessageType.SYSTEM_IMPORTANT:
                result = [ "system", "systemimportant" ];
                break;
            default:
                result = [ "system" ];
                break;
        }
        if (message.containsPing && !message.suppressPing) {
            result.push("ping");
        }
        result.push("all");
        return result;
    }

    addMessage(message: ChannelMessageViewModel, options?: AddMessageOptions) {
        if ((options?.fromReplay ?? false) == true) {
            // Clear the window when receiving historical messages from extended connection
            this.populatedFromReplay = true;
        }
        if (!this.parent.ignoredChars.has(message.characterStatus.characterName)) {

            const filterClasses = this.getMessageFilterClasses(message);
            this.addMessageWithFilterClasses(message, filterClasses);

            // this.mainMessages.add(message);

            // while (this.mainMessages.size >= this.messageLimit) {
            //     const messageBeingRemoved = this.mainMessages.minKey()!;
            //     this.mainMessages.delete(messageBeingRemoved);
            //     messageBeingRemoved.dispose();
            // }

            if (!(options?.seen ?? false)) {
                if (this.canPingAccordingToFilters(filterClasses)) {
                    this.pingIfNecessary(message);
                }
                if (!(options?.bypassUnseenCount ?? false)) {
                    if (this.canBeUnseenAccordingToFilters(filterClasses)) {
                        this.increaseUnseenCountIfNecessary();
                    }
                }
            }
            if (this.scrolledTo != null) {
                this.newMessagesBelowNotify = true;
            }
        }
    }
    canBeUnseenAccordingToFilters(filterClasses: string[]): boolean {
        if (this.channelFilters) {
            const umf = this.channelFilters.unseenMessagesFilter;
            for (let fc of filterClasses) {
                if (umf.isInSelectedCategoryCodes(fc)) {
                    return true;
                }
            }
            return false;
        }
        else {
            return true;
        }
    }
    canPingAccordingToFilters(filterClasses: string[]): boolean {
        if (this.channelFilters) {
            for (let fc of filterClasses) {
                if (this.channelFilters.isInPingableCategoryCodes(fc)) {
                    return true;
                }
            }
            return false;
        }
        else {
            return true;
        }
    }

    public static convertFromLoggedMessage(
        cvm: ChannelViewModel | null, 
        activeLoginViewModel: ActiveLoginViewModel,
        appViewModel: AppViewModel,
        loggedMessage: LoggedMessage): ChannelMessageViewModel | null {

        let m: ChannelMessageViewModel | null = null;
        switch (loggedMessage.messageType) {
            case LogMessageType.CHAT:
                m = ChannelMessageViewModel.deserializeFromLog(cvm, activeLoginViewModel, appViewModel, {
                    timestamp: loggedMessage.timestamp,
                    text: loggedMessage.messageText,
                    characterStatus: {
                        characterName: loggedMessage.speakingCharacter,
                        ignored: false,
                        isFriend: activeLoginViewModel.friends.has(loggedMessage.speakingCharacter),
                        isBookmark: activeLoginViewModel.bookmarks.has(loggedMessage.speakingCharacter),
                        isInterest: activeLoginViewModel.interests.has(loggedMessage.speakingCharacter),
                        gender: (loggedMessage.speakingCharacterGender as CharacterGender) ?? CharacterGender.NONE,
                        status: (loggedMessage.speakingCharacterOnlineStatus as OnlineStatus) ?? OnlineStatus.OFFLINE,
                        statusMessage: "",
                        typingStatus: TypingStatus.IDLE
                    },
                    suppressPing: true,
                    type: ChannelMessageType.CHAT
                });
                break;
            case LogMessageType.ROLL:
                m = ChannelMessageViewModel.deserializeFromLog(cvm, activeLoginViewModel, appViewModel, {
                    timestamp: loggedMessage.timestamp,
                    text: loggedMessage.messageText,
                    characterStatus: {
                        characterName: loggedMessage.speakingCharacter,
                        gender: (loggedMessage.speakingCharacterGender as CharacterGender) ?? CharacterGender.NONE,
                        status: (loggedMessage.speakingCharacterOnlineStatus as OnlineStatus) ?? OnlineStatus.OFFLINE,
                        ignored: false,
                        isFriend: activeLoginViewModel.friends.has(loggedMessage.speakingCharacter),
                        isBookmark: activeLoginViewModel.bookmarks.has(loggedMessage.speakingCharacter),
                        isInterest: activeLoginViewModel.interests.has(loggedMessage.speakingCharacter),
                        statusMessage: "",
                        typingStatus: TypingStatus.IDLE
                    },
                    suppressPing: true,
                    type: ChannelMessageType.ROLL
                });
                break;
        }
        return m;
    }

    restoreFromLoggedMessages(loggedMessages: LoggedMessage[]) {
        for (let loggedMessage of loggedMessages) {
            let m: ChannelMessageViewModel | null = ChannelViewModel.convertFromLoggedMessage(this, this.activeLoginViewModel, this.appViewModel, loggedMessage);
            if (m != null) {
                if (!this.hasMatchingMessage(m)) {
                    this.addMessage(m, { fromReplay: true, seen: true });
                }
            }
        }
    }

    private _bbcodeParser: BBCodeParser = new BBCodeParser();

    addChatMessage(data: ChannelMessageData) {
        const timestamp = data.asOf ?? new Date();
        const character = data.speakingCharacter;
        const text = data.message;
        const gender = data.gender;
        const onlineStatus = data.status;

        const m = ChannelMessageViewModel.createChatMessage(this, timestamp, character, text, gender, onlineStatus);
        this.addMessage(m, { seen: data.seen, fromReplay: (data.isHistorical ?? false) });
        return m;
    }

    addAdMessage(data: ChannelMessageData) {
        const timestamp = data.asOf ?? new Date();
        const character = data.speakingCharacter;
        const text = data.message;
        const gender = data.gender;
        const onlineStatus = data.status;

        const m = ChannelMessageViewModel.createAdMessage(this, timestamp, character, text, gender, onlineStatus);
        this.addMessage(m, { seen: data.seen, fromReplay: (data.isHistorical ?? false) });
        return m;
    }

    addRollMessage(timestamp: Date, rollData: RollData): ChannelMessageViewModel {
        const m = ChannelMessageViewModel.createRollMessage(this, timestamp, rollData);
        this.addMessage(m, { seen: (rollData.seen ?? false), fromReplay: (rollData.isHistorical ?? false) });
        return m;
    }

    addSpinMessage(spinData: BottleSpinData): ChannelMessageViewModel {
        const m = ChannelMessageViewModel.createSpinMessage(this, spinData);
        this.addMessage(m, { seen: (spinData.seen ?? false),fromReplay: (spinData.isHistorical ?? false) });
        return m;
    }

    addSystemMessage(timestamp: Date, text: string, 
        important: boolean = false,
        suppressPing: boolean = false,
        seen: boolean = false,
        isHistorical: boolean = false): ChannelMessageViewModel {

        const m = ChannelMessageViewModel.createSystemMessage(this, timestamp, text, important, suppressPing);
        this.addMessage(m, { seen: (seen ?? false), fromReplay: (isHistorical ?? false) });
        return m;
    }
    
    clearMessages() {
        const toDispose = new Set<ChannelMessageViewModel>();
        for (let fc of this._messagesByFilterClass.values()) {
            for (let m of fc) {
                toDispose.add(m);
            }
        }
        this._messagesByFilterClass.clear();
        for (let m of toDispose.values()) {
            m.dispose();
        }

        this.unseenMessageCount = 0;
        this.hasPing = false;
        this.recalculateMessagesToShow();
    }

    abstract get iconUrl(): string;

    // Is this tab "active" --
    //   1. Currently the shown tab in the window, and
    //   2. Window is focused
    private _isTabActive: boolean = false;
    @observableProperty
    get isTabActive(): boolean { return this._isTabActive; }
    set isTabActive(value) {
        if (value !== this._isTabActive) {
            this._isTabActive = value;
            this.onIsTabActiveChanged();
        }
    }

    protected onIsTabActiveChanged() { 
        if (this.isTabActive) {
            this.hasPing = false;
            this.unseenMessageCount = 0;
            this.ensureSelectableFilterSelected();
        }
    }

    ensureSelectableFilterSelected() {
    }

    protected pingIfNecessary(message: ChannelMessageViewModel) {
        if (message.containsPing && !this.isTabActive && message.characterStatus.characterName != this.parent.characterName) {
            this.hasPing = true;
            this.logger.logInfo("pinging due to message", this, message);
        }
    }

    protected increaseUnseenCountIfNecessary() {
        if (!this.isTabActive) {
            this.unseenMessageCount++;
        }
    }

    private readonly _hasPings: ObservableValue<boolean> = new ObservableValue(false);
    private readonly _unseenMessagesCount: ObservableValue<number> = new ObservableValue(0).withName("ChannelViewModel._unseenMessagesCount");

    @observableProperty
    get hasPing(): boolean {
        if (this.getConfigSettingById("allowPings")) {
            return this._hasPings.value
        }
        else {
            return false;
        }
    }
    set hasPing(value: boolean) {
        this._hasPings.value = value;
    }

    //@observableProperty
    get hasUnseenMessages() {
        return Observable.calculate("ChannelViewModel.hasUnseenMessages", () => this.unseenMessageCount > 0);
    }

    @observableProperty
    get unseenMessageCount(): number {
        if (this.getConfigSettingById("unseenIndicator")) {
            return this._unseenMessagesCount.value
        }
        else {
            return 0;
        }
    }
    set unseenMessageCount(value: number) {
        this._unseenMessagesCount.value = value;
    }

    @observableProperty
    hiddenForClose: boolean = false;

    abstract close(): void;

    @observableProperty
    public pendingSendsCount: number = 0;

    isEffectiveOp(name: CharacterName) { return false; }

    isEffectiveOwner(name: CharacterName) { return false; }

    getConfigSettingById(configSettingId: string) {
        return this.appViewModel.getConfigSettingById(configSettingId, this.activeLoginViewModel, this);
    }

    getConfigEntryHierarchical(key: string) {
        return this.appViewModel.getConfigEntryHierarchical(key, this.activeLoginViewModel, this);
    }

    getFirstConfigEntryHierarchical(keys: string[]): (unknown | null) {
        return this.appViewModel.getFirstConfigEntryHierarchical(keys, this.activeLoginViewModel, this);
    }

    private _pingWordSetOE: ObservableExpression<(PingLineItemDefinition & { pattern: RegExp | null })[]> | null = null;
    private _pingWordsConverted: (PingLineItemDefinition & { pattern: RegExp | null })[] = [];

    private createPingRegexp(x: PingLineItemDefinition): RegExp | null {
        if (x == null || StringUtils.isNullOrWhiteSpace(x.text)) {
            return null;
        }

        switch (x.matchStyle) {
            default:
            case PingLineItemMatchStyle.CONTAINS:
                {
                    const pattern = new RegExp(StringUtils.regexpEscape(x.text), "i");
                    return pattern;
                }
                break;
            case PingLineItemMatchStyle.WHOLE_WORD:
                {
                    const pattern = new RegExp("\\b" + StringUtils.regexpEscape(x.text) + "\\b", "i");
                    return pattern;
                }
                break;
            case PingLineItemMatchStyle.REGEX:
                {
                    try {
                        const pattern = new RegExp(x.text, "i");
                        return pattern;
                    }
                    catch {
                        return null;
                    }
                }
                break;
        }
    }

    getPingWordSet(): (PingLineItemDefinition & { pattern: RegExp | null })[] {
        if (this._pingWordSetOE == null && !this._disposed) {
            this._pingWordSetOE = new ObservableExpression(
                () => {
                    const selfPingWordRaw = this.activeLoginViewModel.getConfigSettingById("pingCharName", this.parent);
                    const cfgPingWordsRaw = this.activeLoginViewModel.getConfigSettingById("pingWords", this.parent) as (string | PingLineItemDefinition)[];
                    const oldPingWordsRaw = this.activeLoginViewModel.pingWords.map(x => x);
                    
                    const selfPingWord: PingLineItemDefinition[] = selfPingWordRaw 
                        ? [ { text: this.activeLoginViewModel.characterName.value, matchStyle: PingLineItemMatchStyle.CONTAINS } ] 
                        : [];
                    const cfgPingWords = cfgPingWordsRaw.map(x => {
                        if (typeof x == "string") {
                            return { text: x, matchStyle: PingLineItemMatchStyle.CONTAINS };
                        }
                        else {
                            return x;
                        }
                    })
                    const oldPingWords = oldPingWordsRaw.map(x => {
                        return { text: x, matchStyle: PingLineItemMatchStyle.CONTAINS };
                    });
                    const allPingWordsx = IterableUtils.asQueryable(cfgPingWords).concat(oldPingWords).concat(selfPingWord)
                        .select(x => { return { text: x.text.toLowerCase(), matchStyle: x.matchStyle, pattern: this.createPingRegexp(x) }})
                        .toArray();
                    return allPingWordsx;
                },
                (v) => { this._pingWordsConverted = v ?? []; },
                () => { }
            );
        }
        
        return this._pingWordsConverted;
    }
}

export interface AddMessageOptions {
    seen?: boolean;
    bypassUnseenCount?: boolean;
    fromReplay?: boolean;
}

export class ChannelMessageViewModelOrderedDictionary extends ObservableOrderedDictionaryImpl<ChannelMessageViewModel, ChannelMessageViewModel> {
    constructor() {
        super(x => x, ChannelMessageViewModelComparer);
    }
}


export function ChannelMessageViewModelComparer(a: ChannelMessageViewModel, b: ChannelMessageViewModel) {
    if (a.timestamp.getTime() < b.timestamp.getTime()) {
        return -1;
    }
    else if (a.timestamp.getTime() > b.timestamp.getTime()) {
        return 1;
    }
    else {
        if (a.uniqueMessageId < b.uniqueMessageId) {
            return -1;
        }
        else if (b.uniqueMessageId > a.uniqueMessageId) {
            return 1;
        }
        else {
            return 0;
        }
    }
}

const cleanupRegisteryLogger = Logging.createLogger("ChannelViewModel.cleanupRegistry");
const cleanupRegistry = new FinalizationRegistry<IDisposable>(hv => {
    cleanupRegisteryLogger.logInfo("cleanupdispose", hv);
    try { hv.dispose(); }
    catch { }
});
function registerCleanupDispose(cmvm: ChannelMessageViewModel, disposable: IDisposable) {
    cleanupRegistry.register(cmvm, disposable);
}

let nextUniqueMessageId: number = 1;
export class ChannelMessageViewModel extends ObservableBase implements IDisposable {
    static createChatMessage(parent: ChannelViewModel, timestamp: Date, character: CharacterName, text: string,
        gender?: CharacterGender | null, onlineStatus?: OnlineStatus | null): ChannelMessageViewModel {

        const isSelfMessage = parent.activeLoginViewModel.characterName.equals(character);

        const cs = parent.parent.characterSet.getCharacterStatus(character);
        const effCs = { ...cs };
        effCs.gender = gender ?? effCs.gender;
        effCs.status = onlineStatus ?? effCs.status;
        const result = new ChannelMessageViewModel(
            parent, parent.activeLoginViewModel, parent.appViewModel,
            timestamp, ChannelMessageType.CHAT, effCs, text, isSelfMessage);
        return result;
    }

    static createAdMessage(parent: ChannelViewModel, timestamp: Date, character: CharacterName, text: string, 
        gender?: CharacterGender | null, onlineStatus?: OnlineStatus | null): ChannelMessageViewModel {

        const isSelfMessage = parent.activeLoginViewModel.characterName.equals(character);

        const cs = parent.parent.characterSet.getCharacterStatus(character);
        const effCs = { ...cs };
        effCs.gender = gender ?? effCs.gender;
        effCs.status = onlineStatus ?? effCs.status;
        const result = new ChannelMessageViewModel(
            parent, parent.activeLoginViewModel, parent.appViewModel,
            timestamp, ChannelMessageType.AD, effCs, text, isSelfMessage);
        return result;
    }

    static createRollMessage(parent: ChannelViewModel, timestamp: Date, rollData: RollData): ChannelMessageViewModel {
        const cs = parent.parent.characterSet.getCharacterStatus(rollData.rollingCharacter);
        const effCs = { ...cs };
        effCs.gender = rollData.gender ?? effCs.gender;
        effCs.status = rollData.status ?? effCs.status;

        const messageBuilder = [];
        messageBuilder.push("rolls ");
        messageBuilder.push(rollData.individualRolls.join("+"));
        messageBuilder.push(": ");
        if (rollData.individualResults.length > 1) {
            messageBuilder.push(rollData.individualResults.join(" + "));
            messageBuilder.push(" = ");
        }
        messageBuilder.push("[b]");
        messageBuilder.push(rollData.endResult.toString());
        messageBuilder.push("[/b]");
        const result = new ChannelMessageViewModel(
            parent, parent.activeLoginViewModel, parent.appViewModel,
            timestamp, ChannelMessageType.ROLL, effCs, messageBuilder.join(""), true);
        return result;
    }

    static createSpinMessage(parent: ChannelViewModel, spinData: BottleSpinData): ChannelMessageViewModel {
        const isSelfMessage = parent.activeLoginViewModel.characterName.equals(spinData.spinningCharacter);

        const cs = parent.parent.characterSet.getCharacterStatus(spinData.spinningCharacter);
        const effCs = { ...cs };
        effCs.gender = spinData.gender ?? effCs.gender;
        effCs.status = spinData.status ?? effCs.status;

        const messageBuilder = [];
        messageBuilder.push("spins the bottle: ");
        messageBuilder.push("[user]");
        messageBuilder.push(spinData.targetCharacter.value);
        messageBuilder.push("[/user]");
        const result = new ChannelMessageViewModel(
            parent, parent.activeLoginViewModel, parent.appViewModel,
            spinData.asOf ?? new Date(), ChannelMessageType.SPIN, effCs, messageBuilder.join(""), isSelfMessage);
        return result;
    }

    static createSystemMessage(parent: ChannelViewModel, timestamp: Date, text: string, important: boolean, suppressPing: boolean): ChannelMessageViewModel {
        const cmt = important ? ChannelMessageType.SYSTEM_IMPORTANT : ChannelMessageType.SYSTEM;
        const result = new ChannelMessageViewModel(
            parent, parent.activeLoginViewModel, parent.appViewModel,
            timestamp, 
            cmt, 
            CharacterSet.emptyStatus(CharacterName.create("System")),
            text, 
            suppressPing);

        return result;
    }

    static createLogNavMessage(parent: ChannelViewModel, text: string, onClick: () => any): ChannelMessageViewModel {
        const result = new ChannelMessageViewModel(
            parent, parent.activeLoginViewModel, parent.appViewModel,
            new Date(),
            ChannelMessageType.LOG_NAV_PROMPT,
            CharacterSet.emptyStatus(CharacterName.create("System")),
            text,
            true,
            onClick);

        return result;
    }

    static createTypingStatusMessage(parent: ChannelViewModel, character: CharacterName, typingStatus: TypingStatus): ChannelMessageViewModel {
        let text: string;
        switch (typingStatus) {
            case TypingStatus.TYPING:
                text = `${character.value} is typing...`;
                break;
            case TypingStatus.IDLE:
                text = `${character.value} has stopped typing.`;
                break;
            default:                
            case TypingStatus.NONE:
                text = "";
                break;
        }

        const cs = parent.parent.characterSet.getCharacterStatus(character);

        const result = new ChannelMessageViewModel(
            parent, parent.activeLoginViewModel, parent.appViewModel,
            new Date(),
            ChannelMessageType.TYPING_STATUS_INDICATOR,
            cs,
            text,
            true);

        return result;
    }


    private constructor(
        parent: ChannelViewModel | null,
        public readonly activeLoginViewModel: ActiveLoginViewModel,
        public readonly appViewModel: AppViewModel,
        public readonly timestamp: Date,
        public readonly type: ChannelMessageType,
        public readonly characterStatus: Omit<CharacterStatus, "equals">,
        public readonly text: string,
        public readonly suppressPing: boolean = false,
        public readonly onClick?: () => any
    ) {
        super();
        this._weakParent = parent ? new WeakRef<ChannelViewModel>(parent) : null;
        this.uniqueMessageId = nextUniqueMessageId++;
        this.containsPing = this.checkForPing();
    }

    private _disposed: boolean = false;
    [Symbol.dispose]() { this.dispose(); }
    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            maybeDispose(this._parsedText);
            this._parsedText = null;
        }
    }
    get isDisposed() { return this._disposed; }

    private readonly _weakParent: WeakRef<ChannelViewModel> | null;

    get parent() { return this._weakParent?.deref() ?? null; }

    get channelViewModel() { return this.parent; }
    //get activeLoginViewModel() { return this.parent.activeLoginViewModel; }
    //get appViewModel() { return this.parent.appViewModel; }

    public readonly uniqueMessageId: number;

    private _parsedText: BBCodeParseResult | null = null;
    private _parsedTextInUse: number = 0;
    private _parsedTextReleaseTimer: IDisposable | null = null;

    incrementParsedTextUsage() {
        this._parsedTextInUse++;
        //this.logger.logInfo("incrementParsedTextUsage", ObjectUniqueId.get(this), this._parsedTextInUse);
        this.cancelParsedTextReleaseTimer();
    }
    decrementParsedTextUsage() {
        this._parsedTextInUse = Math.max(0, this._parsedTextInUse - 1);
        //this.logger.logInfo("decrementParsedTextUsage", ObjectUniqueId.get(this), this._parsedTextInUse);
        if (this._parsedTextInUse == 0) {
            this.cancelParsedTextReleaseTimer();
            this._parsedTextReleaseTimer = HeldCacheManager.addReleasableItem(() => {
                this._parsedTextReleaseTimer = null;
                if (this._parsedText != null) {
                    //cthis.logger.logInfo("releasing parsedText");
                    this._parsedText.dispose();
                    this._parsedText = null;
                }
            }, 1000 * 60 * 2);
        }
    }

    private cancelParsedTextReleaseTimer() {
        if (this._parsedTextReleaseTimer != null) {
            this._parsedTextReleaseTimer.dispose();
            this._parsedTextReleaseTimer = null;
        }
    }

    get parsedText() {
        return this.parseResult.element;
    }
    get parseResult() {
        if (this._parsedText == null) {
            let effectiveText = this.text;
            if (this.type == ChannelMessageType.CHAT) {
                if (this.text.startsWith("/me ")) {
                    effectiveText = this.text.substring(4);
                }
                else if (this.text.startsWith("/me's ")) {
                    effectiveText = this.text.substring(6);
                }
                else if (this.text.startsWith("/warn ")) {
                    effectiveText = this.text.substring(6);
                }
            }

            const parseResult = ChatBBCodeParser.parse(effectiveText, { 
                sink: this.activeLoginViewModel.bbcodeSink, 
                addUrlDomains: true, 
                appViewModel: this.appViewModel, 
                activeLoginViewModel: this.activeLoginViewModel,
                channelViewModel: this.parent ?? undefined,
                imagePreviewPopups: true,
                eiconsUniqueLoadTag: "bbcodemsg#"
            });
            //registerCleanupDispose(this, parseResult);
            this._parsedText = parseResult;
        }
        return this._parsedText;
    }

    readonly containsPing: boolean;

    private getPingWordSet() {
        return this.parent?.getPingWordSet() ?? [];
    }

    private checkForPing(): boolean {
        if (this.suppressPing) {
            return false;
        }

        if (!this.activeLoginViewModel.getConfigSettingById("allowPings", this.parent)) { return false; }
        if (!this.activeLoginViewModel.getConfigSettingById("allowPings", { characterName: this.characterStatus.characterName })) { return false; }
        if (this.type == ChannelMessageType.AD && !this.activeLoginViewModel.getConfigSettingById("allowPingsInAds", this.parent)) { return false; }

        const allPingWords = this.getPingWordSet();

        let needPing = false;
        const msgText = this.text /* .toLowerCase() */;
        for (let x of allPingWords) {
            if (x != null && x.pattern != null) {
                if (msgText.match(x.pattern)) {
                    needPing = true;
                    break;
                }
            }
        }
        return needPing;
    }

    roughlyEquivalentTo(other: ChannelMessageViewModel) {
        if (this.text == other.text &&
            this.characterStatus.characterName.equals(other.characterStatus.characterName)) {

            const thisMs = this.timestamp.getUTCMilliseconds();
            const otherMs = other.timestamp.getUTCMilliseconds();
            if (Math.abs(thisMs - otherMs) < 2000) {
                return true;
            }
        }
        return false;
    }

    private readonly _isOversized: ObservableValue<boolean> = new ObservableValue(true);
    get isOversized() { return this._isOversized.value; };
    set isOversized(value) { this._isOversized.value = value; }

    @observableProperty
    collapsed: boolean | null = true;

    serializeForLog(): SerializedChannelMessageViewModel {
        return {
            timestamp: this.timestamp,
            type: this.type,
            characterStatus: this.characterStatus,
            text: this.text,
            suppressPing: this.suppressPing
        };
    }

    static deserializeFromLog(
        parent: ChannelViewModel | null, 
        activeLoginViewModel: ActiveLoginViewModel,
        appViewModel: AppViewModel,
        serialized: SerializedChannelMessageViewModel) {
        const result = new ChannelMessageViewModel(
            parent, activeLoginViewModel, appViewModel,
            serialized.timestamp, serialized.type,
            serialized.characterStatus, serialized.text, serialized.suppressPing);
        return result;
    }
}

export interface SerializedChannelMessageViewModel {
    readonly timestamp: Date;
    readonly type: ChannelMessageType;
    readonly characterStatus: Omit<CharacterStatus, "equals">;
    readonly text: string;
    readonly suppressPing: boolean;
}

export interface CreateSystemMessageOptionsPartial {
    parent: ChannelViewModel;
    timestamp: Date;
    text: string;
    important?: boolean;
    suppressPing?: boolean;
}
export interface CreateSystemMessageOptions {
    parent: ChannelViewModel;
    timestamp: Date;
    text: string;
    important: boolean;
    suppressPing: boolean;
}

export enum ChannelMessageType {
    CHAT,
    AD,
    ROLL,
    SPIN,
    SYSTEM,
    SYSTEM_IMPORTANT,

    LOG_NAV_PROMPT,
    TYPING_STATUS_INDICATOR
}


// export class ChannelViewScrollPositionModel extends ObservableBase {
//     constructor(
//         public readonly message: KeyValuePair<any, ChannelMessageViewModel>,
//         public readonly depth: number
//     ) {
//         super();
//     }
// }

export interface ChannelViewScrollPositionModel {
    elementIdentity: object;
    scrollDepth: number;
}


export class PendingMessageSendViewModel {
    constructor(
        type: PendingMessageType,
        character: CharacterName | null, 
        message: string,
        private readonly sendFunc: () => Promise<any>) {

        this.type = type;
        this.character = character;
        this.message = message;
    }

    @observableProperty
    readonly type: PendingMessageType;

    @observableProperty
    readonly character: CharacterName | null;

    @observableProperty
    readonly message: string;

    @observableProperty
    sendState: PendingMessageSendState = PendingMessageSendState.NOTYETSENT;

    async attemptResend() {
        if (this.sendState != PendingMessageSendState.SENDING) {
            this.sendState = PendingMessageSendState.SENDING;
            try {
                await this.sendFunc();
            }
            catch { 
                this.sendState = PendingMessageSendState.FAILED;
            }
        }
    }
}

export enum PendingMessageType {
    CHAT,
    AD,
    OTHER
}

export enum PendingMessageSendState {
    NOTYETSENT,
    SENDING,
    FAILED
}


export interface ChannelFilterOptions {
}

export class SingleSelectChannelFilterOptions extends ObservableBase implements ChannelFilterOptions {
    @observableProperty
    items: Collection<SingleSelectChannelFilterOptionItem> = new Collection();

    addItem(value: string, title: string, onSelect: () => any): SingleSelectChannelFilterOptionItem {
        const opt = new SingleSelectChannelFilterOptionItem(this, value, title, onSelect);
        this.items.push(opt);
        return opt;
    }
}

export class SingleSelectChannelFilterOptionItem {
    constructor(
        private readonly owner: SingleSelectChannelFilterOptions,
        public readonly value: string,
        public readonly title: string,
        private readonly onSelect: () => any) {
    }

    private _isSelected: ObservableValue<boolean> = new ObservableValue(false);
    get isSelected() { return this._isSelected.value; }
    set isSelected(value: boolean) {
        if (value != this._isSelected.value) {
            if (value) {
                for (let i of this.owner.items) {
                    if (i != this) {
                        i.isSelected = false;
                    }
                }
            }
            this._isSelected.value = value;

            if (value) {
                this.onSelect();
            }
        }
    }
}

export class MultiSelectChannelFilterOptions extends ObservableBase implements ChannelFilterOptions {
    constructor(
        public readonly channel: ChannelViewModel,
        private readonly onSelect: (selectedValues: string[]) => any) {

        super();
        this.items.addCollectionObserver(entries => {
            for (let entry of entries) {
                switch (entry.changeType) {
                    case StdObservableCollectionChangeType.ITEM_ADDED:
                        entry.item.owner = this;
                        break;
                    case StdObservableCollectionChangeType.ITEM_REMOVED:
                        entry.item.owner = null;
                        break;
                }
            }
            this.selectionChanged();
        });
    }

    @observableProperty
    items: Collection<MultiSelectChannelFilterOptionItem> = new Collection();

    addItem(value: string, title: string): MultiSelectChannelFilterOptionItem {
        const i = new MultiSelectChannelFilterOptionItem(title, value);
        this.items.add(i);
        return i;
    }

    private _previousSelectionValue: Set<string> = new Set();
    selectionChanged() {
        const selectedItems: Set<string> = new Set();
        for (let i of this.items) {
            if (i.isSelected) {
                selectedItems.add(i.value);
            }
        }

        if (selectedItems.symmetricDifference(this._previousSelectionValue).size > 0) {
            this._previousSelectionValue = selectedItems;
            this.onSelect([...selectedItems.values()]);
        }
    }
}

export class MultiSelectChannelFilterOptionItem {
    constructor(
        public readonly value: string,
        public readonly title: string) {
    }

    owner: MultiSelectChannelFilterOptions | null = null;

    private _isSelected: ObservableValue<boolean> = new ObservableValue(false);
    get isSelected() { return this._isSelected.value; }
    set isSelected(value: boolean) { 
        if (value != this._isSelected.value) {
            this._isSelected.value = value; 
            if (this.owner) {
                this.owner.selectionChanged();
            }
        }
    }
}

export enum ChannelMessageDisplayStyle {
    FCHAT = "fchat",
    DISCORD = "discord"
}
