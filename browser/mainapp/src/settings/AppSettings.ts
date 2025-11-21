import { ChannelName } from "../shared/ChannelName";
import { CharacterName } from "../shared/CharacterName";
import { OnlineStatus, OnlineStatusConvert } from "../shared/OnlineStatus";
import { HostInterop } from "../util/hostinterop/HostInterop";
import { IterableUtils } from "../util/IterableUtils";
import { Collection, CollectionChangeType } from "../util/ObservableCollection";
import { Optional } from "../util/Optional";
import { PromiseSource } from "../util/PromiseSource";
import { StringUtils } from "../util/StringUtils";
import { StdObservableCollectionChange, StdObservableCollectionChangeType } from "../util/collections/ReadOnlyStdObservableCollection";
import { RawAppSettings, RawSavedAccountCredentials, RawSavedChatState, RawSavedChatStateAutoAdSettings, RawSavedChatStateAutoAdSettingsEntry, RawSavedChatStateJoinedChannel, RawSavedChatStateNamedFilterMap, RawSavedChatStatePMConvo, RawSavedLogin, RawSavedWindowLocation } from "./RawAppSettings";

export class AppSettings {
    static async initializeAsync(): Promise<void> { 
        const axx = await HostInterop.getAppSettings();
        this._instance = new AppSettings(axx as RawAppSettings, () => HostInterop.updateAppSettings(this._instance));
    }

    private static _instance: AppSettings | null = null;

    static get instance() { 
        if (this._instance) {
            return this._instance;
        }
        else {
            throw new Error("not initialized");
        }
    }

    private constructor(inner: RawAppSettings | null, 
        private readonly onUpdate: () => void) {

        this.savedWindowLocations = new SavedWindowLocationMap(this, inner?.savedWindowLocations ?? []);
        this._lastUsedSavedAccount = inner?.lastUsedSavedAccount;
        this.savedAccountCredentials = new SavedAccountCredentialsMap(this, inner?.savedAccountCredentials ?? []);
        this.savedLogins = new SavedLoginMap(this, inner?.savedLogins ?? []);
        this.savedChatStates = new SavedChatStateMap(this, inner?.savedChatStates ?? []);
        this._autoIdleSec = inner?.autoIdleSec;
    }

    private _lastUsedSavedAccount?: string;
    private _autoIdleSec: Optional<number>;

    readonly savedWindowLocations: SavedWindowLocationMap;

    readonly savedAccountCredentials: SavedAccountCredentialsMap;
    
    get lastUsedSavedAccount() { return this._lastUsedSavedAccount; }
    set lastUsedSavedAccount(value) { 
        if (value != this._lastUsedSavedAccount) {
            this._lastUsedSavedAccount = value;
            this.onUpdate();
        }
    }

    readonly savedLogins: SavedLoginMap;

    readonly savedChatStates: SavedChatStateMap;

    get autoIdleSec() { return this._autoIdleSec; }
    set autoIdleSec(value) {
        if (value != this._autoIdleSec) {
            this._autoIdleSec = value;
            this.onUpdate();
        }
    }

    updated(): void {
        this.onUpdate();
    }

    toJSON() {
        const result: RawAppSettings = {
            savedWindowLocations: this.savedWindowLocations.toJSON(),
            lastUsedSavedAccount: this.lastUsedSavedAccount,
            savedAccountCredentials: this.savedAccountCredentials.toJSON(),
            savedChatStates: this.savedChatStates.toJSON(),
            savedLogins: this.savedLogins.toJSON(),
            autoIdleSec: this.autoIdleSec
        };
        return result;
    }
}

export abstract class CustomMap<TKey, TValue> {
    constructor() {
    }

    private readonly _map: Map<TKey, TValue> = new Map();

    protected get map() { return this._map; }

    abstract updated(): void;

    clear(): void {
        this._map.clear();
        this.updated();
    }

    delete(key: TKey): boolean {
        const result = this._map.delete(key);
        if (result) {
            this.updated();
        }
        return result;
    }

    forEach(callbackfn: (value: TValue, key: TKey) => void, thisArg?: any): void {
        this._map.forEach(callbackfn, thisArg);
    }

    get(key: TKey): TValue | undefined {
        return this._map.get(key);
    }

    has(key: TKey): boolean {
        return this._map.has(key);
    }

    get size(): number { return this._map.size; }

    entries(): IterableIterator<[TKey, TValue]> {
        return this._map.entries();
    }

    keys(): IterableIterator<TKey> {
        return this._map.keys();
    }

    values(): IterableIterator<TValue> {
        return this._map.values();
    }

    get [Symbol.iterator](): IterableIterator<[TKey, TValue]> {
        return (this._map as any)[Symbol.iterator];
    }

    get [Symbol.toStringTag](): string {
        return (this._map as any)[Symbol.toStringTag];
    }

    toJSON() {
        const result = [];
        for (let x of this.values()) {
            if (x && typeof (x as any).toJSON == "function") {
                result.push((x as any).toJSON());
            }
            else {
                result.push(x);
            }
        }
        return result;
    }
}

export class SavedWindowLocationMap extends CustomMap<string, SavedWindowLocation> {
    constructor(
        private readonly parent: AppSettings,
        items: RawSavedWindowLocation[]) {

        super();
        for (let x of items) {
            this.map.set(x.desktopMetrics, new SavedWindowLocation(this, x));
        }
    }

    add(data: RawSavedWindowLocation) {
        this.map.set(data.desktopMetrics, new SavedWindowLocation(this, data));
        this.updated();
    }

    toJSON(): any[] {
        const result = [];
        for (let x of this.values()) {
            result.push(x.toJSON());
        }
        return result;
    }

    updated() {
        this.parent.updated();
    }
}

export class SavedWindowLocation {
    constructor(
        private readonly parent: SavedWindowLocationMap,
        item?: RawSavedWindowLocation) {

        this._desktopMetrics = item?.desktopMetrics ?? "";
        this._windowX = item?.windowX ?? 0;
        this._windowY = item?.windowY ?? 0;
        this._windowWidth = item?.windowWidth ?? 0;
        this._windowHeight = item?.windowHeight ?? 0;
    }

    private _desktopMetrics: string;
    private _windowX: number;
    private _windowY: number;
    private _windowWidth: number;
    private _windowHeight: number;

    get desktopMetrics() { return this._desktopMetrics; }
    set desktopMetrics(value) {
        if (value != this._desktopMetrics) {
            this._desktopMetrics = value;
            this.updated();
        }
    }

    get windowX() { return this._windowX; }
    set windowX(value) {
        if (value != this._windowX) {
            this._windowX = value;
            this.updated();
        }
    }

    get windowY() { return this._windowY; }
    set windowY(value) {
        if (value != this._windowY) {
            this._windowY = value;
            this.updated();
        }
    }

    get windowWidth() { return this._windowWidth; }
    set windowWidth(value) {
        if (value != this._windowWidth) {
            this._windowWidth = value;
            this.updated();
        }
    }

    get windowHeight() { return this._windowHeight; }
    set windowHeight(value) {
        if (value != this._windowHeight) {
            this._windowHeight = value;
            this.updated();
        }
    }

    updateFromObject(data: RawSavedWindowLocation) {
        this._windowX = data.windowX;
        this._windowY = data.windowY;
        this._windowWidth = data.windowWidth;
        this._windowHeight = data.windowHeight;
        this.updated();
    }

    toJSON() {
        const result: RawSavedWindowLocation = {
            desktopMetrics: this._desktopMetrics,
            windowX: this._windowX,
            windowY: this._windowY,
            windowWidth: this._windowWidth,
            windowHeight: this._windowHeight
        };
        return result;
    }

    updated() {
        this.parent.updated();
    }
}

export class SavedLoginMap implements Iterable<SavedLogin> {
    constructor(
        private readonly parent: AppSettings,
        initialData: RawSavedLogin[]) {

        for (let x of initialData) {
            const sl = new SavedLogin(this, x);
            this._inner.push(sl);
        }
    }

    *[Symbol.iterator](): Iterator<SavedLogin, any, undefined> {
        for (let item of this._inner) {
            yield item;
        }
    }

    private _inner: Array<SavedLogin> = [];

    add(account: string, character: CharacterName): SavedLogin {
        const existingItem = IterableUtils.asQueryable(this._inner)
            .where(x => 
                StringUtils.caseInsensitiveEquals(x.account, account) &&
                StringUtils.caseInsensitiveEquals(x.characterName.value, character.value))
            .firstOrNull();
        if (!existingItem) {
            const result = new SavedLogin(this, { account: account.toLowerCase(), characterName: character.value.toLowerCase() });
            this._inner.push(result);
            this.updated();
            return result;
        }
        else {
            return existingItem;
        }
    }

    delete(account: string, character: Optional<CharacterName>): boolean {
        const existingItems = IterableUtils.asQueryable(this._inner)
            .where(x => 
                StringUtils.caseInsensitiveEquals(x.account, account) &&
                (character != null && StringUtils.caseInsensitiveEquals(x.characterName.value, character.value) || character == null)
            )
            .toArray();

        if (existingItems.length > 0) {
            for (let existingItem of existingItems) {
                this._inner = this._inner.filter(i => i != existingItem);
            }
            this.updated();
            return true;
        }
        else {
            return false;
        }
    }

    updated(): void {
        this.parent.updated();
    }

    toJSON(): RawSavedLogin[] {
        const result = IterableUtils.asQueryable(this._inner)
            .select(x => x.toJSON())
            .toArray();
        return result;
    }
}

export class SavedLogin {
    constructor(
        private readonly parent: SavedLoginMap,
        item?: RawSavedLogin) {

        this._account = item?.account ?? "";
        this._characterName = item ? CharacterName.create(item.characterName) : CharacterName.create("");
    }

    private _account: string;
    private _characterName: CharacterName = CharacterName.create("");

    get account() { return this._account; }
    set account(value) {
        if (value != this._account) {
            this._account = value;
            this.updated();
        }
    }

    get characterName() { return this._characterName; }
    set characterName(value) {
        if (value != this._characterName) {
            this._characterName = value;
            this.updated();
        }
    }

    updated() {
        this.parent.updated();
    }

    toJSON() {
        const result: RawSavedLogin = {
            account: this._account,
            characterName: this._characterName.value
        };
        return result;
    }
}

export class SavedAccountCredentialsMap extends CustomMap<string, SavedAccountCredentials> {
    constructor(
        private readonly parent: AppSettings,
        items: RawSavedAccountCredentials[]) {

        super();
        for (let x of items) {
            this.map.set(x.account.toLowerCase(), new SavedAccountCredentials(this, x));
        }
    }

    removeCredentials(account: string) {
        this.map.delete(account.toLowerCase());
        this.parent.savedLogins.delete(account);
        this.updated();
    }

    updateCredentials(account: string, password: string | null) {
        let savedCreds = this.map.get(account.toLowerCase());
        let needAdd = false;
        if (!savedCreds) {
            savedCreds = new SavedAccountCredentials(this, { 
                account: account,
                password: password ?? undefined
            });
            this.map.set(account.toLowerCase(), savedCreds);
            this.updated();
        }
        else {
            if (password != savedCreds.password) {
                savedCreds.password = password ?? null;
                this.updated();
            }
        }
    }

    updated(): void {
        this.parent.updated();
    }
}

export class SavedAccountCredentials {
    constructor(
        private readonly parent: SavedAccountCredentialsMap,
        item?: RawSavedAccountCredentials) {

        this._account = item?.account ?? "";
        this._password = item?.password ?? null;
    }

    private _account: string;
    private _password: string | null;

    get account() { return this._account; }
    set account(value) {
        if (value != this._account) {
            this._account = value;
            this.updated();
        }
    }

    get password() { return this._password; }
    set password(value) {
        if (value != this._password) {
            this._password = value;
            this.updated();
        }
    }

    updated() {
        this.parent.updated();
    }

    toJSON() {
        const result: RawSavedAccountCredentials = {
            account: this.account,
            password: this.password ?? undefined
        };
        return result;
    }
}

export class SavedChatStateMap extends CustomMap<CharacterName, SavedChatState> {
    constructor(
        private readonly parent: AppSettings,
        items: RawSavedChatState[]) {

        super();
        for (let x of items) {
            this.map.set(CharacterName.create(x.characterName), new SavedChatState(this, x));
        }
    }

    getOrCreate(character: CharacterName) {
        const v = this.get(character);
        if (v) return v;

        const scc = new SavedChatState(this);
        scc.characterName = character;
        this.map.set(character, scc);
        this.updated();
        return scc;
    }

    updated() {
        this.parent.updated();
    }
}

export class SavedChatState {
    constructor(
        private readonly parent: SavedChatStateMap,
        item?: RawSavedChatState) {
        
        this._characterName = item ? CharacterName.create(item.characterName) : CharacterName.create("");
        this._lastLogin = (item && item.lastLogin != null) ? item!.lastLogin : null;
        this.joinedChannels = new SavedChatStateJoinedChannelMap(this, item?.joinedChannels ?? []);
        this.pinnedChannels = new PinnedChannelsSet(this, item?.pinnedChannels ?? []);
        this.pmConvos = new PMConvosSet(this, item?.pmConvos ?? []);
        this._statusMessage = item?.statusMessage ?? "";
        this._onlineStatus = item?.onlineStatus ?? OnlineStatus.ONLINE;
        
        this._pinnedChannelSectionCollapsed = item?.pinnedChannelSectionCollapsed ?? false;
        this._unpinnedChannelSectionCollapsed = item?.unpinnedChannelSectionCollapsed ?? false;
        this._pmConvosSectionCollapsed = item?.pmConvosSectionCollapsed ?? false;
        this._selectedChannel = item?.selectedChannel ?? undefined;

        this._autoAdSettings = new SavedChatStateAutoAdSettings(this, item?.autoAdSettings);

        this.pingWords = new PingWordsSet(this, item?.pingWords ?? []);
    }

    readonly joinedChannels: SavedChatStateJoinedChannelMap;
    readonly pinnedChannels: PinnedChannelsSet;
    readonly pmConvos: PMConvosSet;
    readonly pingWords: PingWordsSet;

    private _lastLogin: number | null;

    get lastLogin(): number | null { return this._lastLogin; }
    set lastLogin(value: number | null) {
        if (value != this._lastLogin) {
            this._lastLogin = value;
            this.updated();
        }
    }

    private _characterName: CharacterName;

    get characterName() { return this._characterName; }
    set characterName(value) {
        if (value != this._characterName) {
            this._characterName = value;
            this.updated();
        }
    }

    private _statusMessage: string;

    get statusMessage() { return this._statusMessage; }
    set statusMessage(value) {
        if (value != this._statusMessage) {
            this._statusMessage = value;
            this.updated();
        }
    }

    private _onlineStatus: OnlineStatus = OnlineStatus.ONLINE;
    
    get onlineStatus() { return this._onlineStatus; }
    set onlineStatus(value) {
        if (value != this._onlineStatus) {
            this._onlineStatus = value;
            this.updated();
        }
    }

    private _pinnedChannelSectionCollapsed: boolean;

    get pinnedChannelSectionCollapsed() { return this._pinnedChannelSectionCollapsed; }
    set pinnedChannelSectionCollapsed(value) {
        if (value != this._pinnedChannelSectionCollapsed) {
            this._pinnedChannelSectionCollapsed = value;
            this.updated();
        }
    }

    private _unpinnedChannelSectionCollapsed: boolean;

    get unpinnedChannelSectionCollapsed() { return this._unpinnedChannelSectionCollapsed; }
    set unpinnedChannelSectionCollapsed(value) {
        if (value != this._unpinnedChannelSectionCollapsed) {
            this._unpinnedChannelSectionCollapsed = value;
            this.updated();
        }
    }

    private _pmConvosSectionCollapsed: boolean;

    get pmConvosSectionCollapsed() { return this._pmConvosSectionCollapsed; }
    set pmConvosSectionCollapsed(value) {
        if (value != this._pmConvosSectionCollapsed) {
            this._pmConvosSectionCollapsed = value;
            this.updated();
        }
    }

    private _selectedChannel?: string;

    get selectedChannel() { return this._selectedChannel; }
    set selectedChannel(value) {
        if (value != this._selectedChannel) {
            this._selectedChannel = value;
            this.updated();
        }
    }

    private _autoAdSettings: SavedChatStateAutoAdSettings;

    get autoAdSettings() { return this._autoAdSettings; }
    set autoAdSettings(value) { 
        if (value != this._autoAdSettings) {
            this._autoAdSettings = value; 
            this.updated();
        }
    }

    updated() {
        this.parent.updated();
    }

    toJSON() {
        const result: RawSavedChatState = {
            characterName: this._characterName.value,
            lastLogin: this._lastLogin,
            joinedChannels: this.joinedChannels.toJSON(),
            pingWords: this.pingWords.toJSON(),
            pinnedChannels: this.pinnedChannels.toJSON(),
            pmConvos: this.pmConvos.toJSON(),
            selectedChannel: this._selectedChannel,
            pinnedChannelSectionCollapsed: this._pinnedChannelSectionCollapsed,
            unpinnedChannelSectionCollapsed: this._unpinnedChannelSectionCollapsed,
            pmConvosSectionCollapsed: this._pmConvosSectionCollapsed,
            statusMessage: this._statusMessage,
            onlineStatus: this._onlineStatus,
            autoAdSettings: this._autoAdSettings.toJSON()
        };
        return result;
    }
}

export class SavedChatStateJoinedChannelMap extends Collection<SavedChatStateJoinedChannel> {
    constructor(
        private readonly parent: SavedChatState,
        items: RawSavedChatStateJoinedChannel[]) {

        super();
        for (let x of items) {
            const item = new SavedChatStateJoinedChannel(this, x);
            this.push(item);
        }

        this.addCollectionObserver(entries => {
            this.updated();
        });
    }

    updated() {
        this.parent.updated();
    }

    toJSON() {
        const result = [];
        for (let x of this.iterateValues()) {
            result.push(x.toJSON());
        }
        return result;
    }
}

export class SavedChatStateJoinedChannel {
    constructor(
        public readonly parent: SavedChatStateJoinedChannelMap,
        item?: RawSavedChatStateJoinedChannel) {

        this._name = item ? ChannelName.create(item.name) : ChannelName.create("");
        this._title = item?.title ?? this._name.value;
        this._order = item?.order ?? 0;
        this._namedFilters = item?.namedFilters ?? null;
    }

    private _name: ChannelName;
    private _title: string;
    private _order: number;
    private _namedFilters: RawSavedChatStateNamedFilterMap | null;

    get name() { return this._name; }
    set name(value) {
        if (value != this._name) {
            this._name = value;
            this.updated();
        }
    }

    get title() { return this._title; }
    set title(value) {
        if (value != this._title) {
            this._title = value;
            this.updated();
        }
    }

    get order() { return this._order; }
    set order(value) {
        if (value != this._order) {
            this._order = value;
            this.updated();
        }
    }

    get namedFilters() { return this._namedFilters; }
    set namedFilters(value) {
        if (value != this._namedFilters) {
            this._namedFilters = value;
            this.updated();
        }
    }

    updated() {
        if (this.parent) {
            this.parent.updated();
        }
    }

    toJSON() {
        const result: RawSavedChatStateJoinedChannel = {
            name: this._name.value,
            title: this._title,
            order: this._order,
            namedFilters: this._namedFilters ?? undefined
        };
        return result;
    }
}

export class SavedChatStatePMConvo {
    constructor(
        parent: PMConvosSet | null,
        item?: RawSavedChatStatePMConvo) {

        this.parent = parent;
        this._character = item ? CharacterName.create(item.character) : CharacterName.create("");
        this._lastInteraction = item?.lastInteraction ?? 0;
        this._namedFilters = item?.namedFilters ?? null;
    }

    parent: PMConvosSet | null = null;

    private _character: CharacterName;
    private _lastInteraction: number;
    private _namedFilters: RawSavedChatStateNamedFilterMap | null;

    get character() { return this._character; }
    set character(value) {
        if (value != this._character) {
            this._character = value;
            this.updated();
        }
    }

    get lastInteraction() { return this._lastInteraction; }
    set lastInteraction(value) {
        if (value != this._lastInteraction) {
            this._lastInteraction = value;
            this.updated();
        }
    }

    get namedFilters() { return this._namedFilters; }
    set namedFilters(value) {
        if (value != this._namedFilters) {
            this._namedFilters = value;
            this.updated();
        }
    }

    updated() {
        if (this.parent) {
            this.parent.updated();
        }
    }

    toJSON() {
        const result: RawSavedChatStatePMConvo = {
            character: this._character.value,
            lastInteraction: this._lastInteraction,
            namedFilters: this._namedFilters ?? undefined
        };
        return result;
    }
}

export class PinnedChannelsSet extends Collection<ChannelName> { 
    constructor(
        private readonly parent: SavedChatState,
        items: string[]) {

        super();
        for (let x of items) {
            const item = ChannelName.create(x);
            this.push(item);
        }

        this.addCollectionObserver(entries => {
            this.updated();
        });
    }

    updated() {
        this.parent.updated();
    }

    toJSON() {
        const result = [];
        for (let x of this.iterateValues()) {
            result.push(x.value);
        }
        return result;
    }    
}

export class PMConvosSet extends Collection<SavedChatStatePMConvo> { 
    constructor(
        private readonly parent: SavedChatState,
        items: RawSavedChatStatePMConvo[]) {

        super();
        for (let x of items) {
            const item = new SavedChatStatePMConvo(this, x);
            this.push(item);
        }

        this.addCollectionObserver(entries => {
            for (let e of entries) {
                e.item.parent = this;
            }
            this.updated();
        });
    }

    updated() {
        this.parent.updated();
    }

    toJSON() {
        const result = [];
        for (let x of this.iterateValues()) {
            result.push(x.toJSON());
        }
        return result;
    }    
}

export class PingWordsSet extends Collection<string> {
    constructor(
        private readonly parent: SavedChatState,
        items: string[]) {

        super();
        for (let x of items) {
            const item = x;
            this.push(item);
        }

        this.addCollectionObserver(entries => {
            this.updated();
        });
    }

    updated() {
        this.parent.updated();
    }

    toJSON() {
        const result = [];
        for (let x of this.iterateValues()) {
            result.push(x);
        }
        return result;
    }    
}

export class SavedChatStateAutoAdSettings {
    constructor(private readonly parent: SavedChatState,
        rawSettings?: RawSavedChatStateAutoAdSettings)
    {
        const rs: RawSavedChatStateAutoAdSettings = rawSettings ?? { entries: [], enabled: false };

        for (let x of rs.entries) {
            this._entries.add(new SavedChatStateAutoAdSettingsEntry(this, x));
        }
        this._enabled = rs.enabled;

        this._entries.addCollectionObserver(() => {
            this.updated();
        });
    }

    private readonly _entries: Collection<SavedChatStateAutoAdSettingsEntry> = new Collection();
    private _enabled: boolean = false;

    get entries(): Collection<SavedChatStateAutoAdSettingsEntry> { return this._entries; }

    get enabled(): boolean { return this._enabled; }
    set enabled(value: boolean) { 
        if (value !== this._enabled) {
            this._enabled = value;
            this.updated();
        }
    }

    updated() {
        this.parent.updated();
    }

    toJSON() {
        const result: RawSavedChatStateAutoAdSettings = {
            entries: this._entries.map(x => x.toJSON()),
            enabled: this._enabled
        };
        return result;
    }
}

export class SavedChatStateAutoAdSettingsEntry {
    constructor(private readonly parent: SavedChatStateAutoAdSettings,
        rawSettings?: RawSavedChatStateAutoAdSettingsEntry) {

        const rs: RawSavedChatStateAutoAdSettingsEntry = rawSettings ?? { enabled: true, title: "Untitled Ad", adText: "", targetChannels: [], targetOnlineStatuses: [] };

        this._enabled = rs.enabled;
        this._title = rs.title;
        this._adText = rs.adText;
        for (let x of rs.targetChannels) {
            this._targetChannels.add(ChannelName.create(x));
        }
        for (let x of rs.targetOnlineStatuses) {
            const os = OnlineStatusConvert.toOnlineStatus(x);
            if (os != null) {
                this._targetOnlineStatuses.add(os);
            }
        }

        this._targetChannels.addCollectionObserver(() => {
            this.updated();
        });
        this._targetOnlineStatuses.addCollectionObserver(() => {
            this.updated();
        });
    }

    private _enabled: boolean;
    private _adText: string;
    private _title: string;
    private readonly _targetChannels: Collection<ChannelName> = new Collection();
    private readonly _targetOnlineStatuses: Collection<OnlineStatus> = new Collection();

    get enabled() { return this._enabled; }
    set enabled(value) {
        if (value !== this._enabled) {
            this._enabled = value;
            this.updated();
        }
    }

    get title(): string { return this._title; }
    set title(value: string) {
        if (value !== this._title) {
            this._title = value;
            this.updated();
        }
    }

    get adText(): string { return this._adText; }
    set adText(value: string) {
        if (value !== this._adText) {
            this._adText = value;
            this.updated();
        }
    }

    get targetChannels(): Collection<ChannelName> { return this._targetChannels; }

    get targetOnlineStatuses(): Collection<OnlineStatus> { return this._targetOnlineStatuses; }

    updated() {
        this.parent.updated();
    }

    toJSON() {
        const result: RawSavedChatStateAutoAdSettingsEntry = {
            enabled: this._enabled,
            title: this._title,
            adText: this._adText,
            targetChannels: this._targetChannels.map(x => x.canonicalValue),
            targetOnlineStatuses: this._targetOnlineStatuses.map(x => OnlineStatusConvert.toString(x))
        };
        return result;
    }
}