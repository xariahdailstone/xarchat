import { ChannelView } from "../components/ChannelView.js";
import { BottleSpinData, ChannelMessageData, RollData } from "../fchat/ChatConnectionSink.js";
import { CharacterGender } from "../shared/CharacterGender.js";
import { CharacterName } from "../shared/CharacterName.js";
import { CharacterSet, CharacterStatus } from "../shared/CharacterSet.js";
import { OnlineStatus } from "../shared/OnlineStatus.js";
import { TypingStatus } from "../shared/TypingStatus.js";
import { BBCodeParseResult, BBCodeParser, ChatBBCodeParser } from "../util/bbcode/BBCode.js";
import { CatchUtils } from "../util/CatchUtils.js";
import { KeyValuePair } from "../util/collections/KeyValuePair.js";
import { ReadOnlyStdObservableCollection } from "../util/collections/ReadOnlyStdObservableCollection.js";
import { StdObservableConcatCollectionView } from "../util/collections/StdObservableConcatCollectionView.js";
import { StdObservableList } from "../util/collections/StdObservableView.js";
import { asDisposable, tryDispose as maybeDispose, IDisposable, isDisposable } from "../util/Disposable.js";
import { LoggedMessage, LogMessageType } from "../util/HostInterop.js";
import { IterableUtils } from "../util/IterableUtils.js";
import { Observable, ObservableValue } from "../util/Observable.js";
import { ObservableBase, observableProperty } from "../util/ObservableBase.js";
import { Collection, ObservableCollection } from "../util/ObservableCollection.js";
import { ObservableKeyExtractedOrderedDictionary, ObservableOrderedDictionary, ObservableOrderedDictionaryImpl } from "../util/ObservableKeyedLinkedList.js";
import { StringUtils } from "../util/StringUtils.js";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel.js";
import { AppNotifyEventType, AppViewModel } from "./AppViewModel.js";
import { SlashCommandViewModel } from "./SlashCommandViewModel.js";



export abstract class ChannelViewModel extends ObservableBase implements IDisposable {
    constructor(parent: ActiveLoginViewModel, title: string) {
        super();

        this.parent = parent;
        this.title = title;

        this.mainMessages = new ChannelMessageViewModelOrderedDictionary();
    }

    private _disposed: boolean = false;
    [Symbol.dispose]() { this.dispose(); }
    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            for (let m of [...this.mainMessages.values(), ...this.prefixMessages.values(), ...this.suffixMessages.values()]) {
                m.dispose();
            }
            this.mainMessages.clear();
            this.prefixMessages.clear();
            this.suffixMessages.clear();
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

    @observableProperty
    showConfigButton: boolean = false;
    
    showSettingsDialogAsync() { }

    @observableProperty
    readonly abstract canClose: boolean;

    @observableProperty
    readonly abstract canPin: boolean;

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
    textBoxToolbarShown: boolean = false;

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

    addMessage(message: ChannelMessageViewModel, options?: AddMessageOptions) {
        if ((options?.fromReplay ?? false) == true) {
            // Clear the window when receiving historical messages from extended connection
            this.populatedFromReplay = true;
        }
        if (!this.parent.ignoredChars.has(message.characterStatus.characterName)) {

            this.mainMessages.add(message);

            while (this.mainMessages.size >= this.messageLimit) {
                const messageBeingRemoved = this.mainMessages.minKey()!;
                this.mainMessages.delete(messageBeingRemoved);
                messageBeingRemoved.dispose();
            }

            if (!(options?.seen ?? false)) {
                this.pingIfNecessary(message);
                if (!(options?.bypassUnseenCount ?? false)) {
                    this.increaseUnseenCountIfNecessary();
                }
            }
            if (this.scrolledTo != null) {
                this.newMessagesBelowNotify = true;
            }
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
        this.addMessage(m, { fromReplay: (rollData.isHistorical ?? false) });
        return m;
    }

    addSpinMessage(spinData: BottleSpinData): ChannelMessageViewModel {
        const m = ChannelMessageViewModel.createSpinMessage(this, spinData);
        this.addMessage(m, { fromReplay: (spinData.isHistorical ?? false) });
        return m;
    }

    addSystemMessage(timestamp: Date, text: string, important: boolean = false, suppressPing: boolean = false): ChannelMessageViewModel {
        const m = ChannelMessageViewModel.createSystemMessage(this, timestamp, text, important, suppressPing);
        this.addMessage(m);
        return m;
    }
    
    clearMessages() {
        this.mainMessages.clear();
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
        }
    }

    protected pingIfNecessary(message: ChannelMessageViewModel) {
        if (message.containsPing && !this.isTabActive && message.characterStatus.characterName != this.parent.characterName) {
            this.hasPing = true;
        }
    }

    protected increaseUnseenCountIfNecessary() {
        if (!this.isTabActive) {
            this.unseenMessageCount++;
        }
    }

    private _hasPing: boolean = false;
    private _unseenMessageCount: number = 0;

    @observableProperty
    get hasPing(): boolean {
        return this._hasPing;
    }
    set hasPing(value: boolean) {
        this._hasPing = value;
    }

    @observableProperty
    get unseenMessageCount(): number {
        if (this.getConfigSettingById("unseenIndicator")) {
            return this._unseenMessageCount;
        }
        else {
            return 0;
        }
    }
    set unseenMessageCount(value: number) {
        this._unseenMessageCount = value;
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

const cleanupRegistry = new FinalizationRegistry<IDisposable>(hv => {
    console.log("cleanupdispose", hv);
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

    get parsedText() {
        if (this._parsedText == null) {
            let effectiveText = this.text;
            if (this.type == ChannelMessageType.CHAT) {
                if (this.text.startsWith("/me ")) {
                    effectiveText = this.text.substring(4);
                }
                else if (this.text.startsWith("/me's ")) {
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
        return this._parsedText.element;
    }

    readonly containsPing: boolean;

    private checkForPing(): boolean {
        if (this.suppressPing) {
            return false;
        }

        const cfgPingWords = this.activeLoginViewModel.getConfigSettingById("pingWords", this.parent) as string[];
        const oldPingWords = this.activeLoginViewModel.pingWords;
        const allPingWords = IterableUtils.asQueryable(cfgPingWords).concat(oldPingWords).select(x => x.toLowerCase());

        let needPing = false;
        const msgText = this.text.toLowerCase();
        for (let x of allPingWords) {
            if (msgText.indexOf(x) != -1) {
                needPing = true;
                break;
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


export abstract class ChannelFilterOptions extends ObservableBase {
}

export class SingleSelectChannelFilterOptions extends ChannelFilterOptions {
    @observableProperty
    items: Collection<SingleSelectChannelFilterOptionItem> = new Collection();
}

export class SingleSelectChannelFilterOptionItem {
    constructor(
        public readonly value: string,
        public readonly title: string,
        private readonly onSelect: () => any) {
    }

    select() {
        this.onSelect();
    }
}