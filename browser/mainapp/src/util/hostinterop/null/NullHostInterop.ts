import { RawSavedWindowLocation } from "../../../settings/RawAppSettings";
import { ChannelName } from "../../../shared/ChannelName";
import { CharacterGender } from "../../../shared/CharacterGender";
import { CharacterName } from "../../../shared/CharacterName";
import { OnlineStatus } from "../../../shared/OnlineStatus";
import { AppViewModel } from "../../../viewmodel/AppViewModel";
import { CancellationToken } from "../../CancellationTokenSource";
import { asDisposable, EmptyDisposable, IDisposable } from "../../Disposable";
import { IdleDetectionUserState, IdleDetectionScreenState } from "../../IdleDetection";
import { IObservable, ObservableValue } from "../../Observable";
import { UpdateCheckerState } from "../../UpdateCheckerClient";
import { LogMessageType, LogChannelMessage, LogPMConvoMessage, HostWindowState, EIconSearchResults, ConfigKeyValue, ChooseLocalFileOptions, HostLocaleInfo } from "../HostInterop";
import { DateAnchor, HostInteropLogSearch, LogSearchKind, LogSearchResult, RecentConversationResult } from "../HostInteropLogSearch";
import { HostInteropLogSearch2, LogSearch2Results, PerformSearchOptions } from "../HostInteropLogSearch2";
import { ChatWebSocket, HostInteropBase, IHostInterop } from "../IHostInterop";

export class NullHostInterop extends HostInteropBase implements IHostInterop {
    get isInXarChatHost(): boolean { return false; }

    get devMode(): boolean { return false; }

    launchUrl(app: AppViewModel, url: string, forceExternal: boolean): void {
        window.open(url, "_blank");
    }

    async getImagePreviewPopupUrlAsync(url: string): Promise<(string | null)> {
        return null;
    }

    appReady(): void {
        document.body.classList.add("loaded");
    }

    minimizeWindow(): void {
    }

    maximizeWindow(): void {
    }

    restoreWindow(): void {
    }

    closeWindow(): void {
    }

    showDevTools(): void {
    }

    logChannelMessage(myCharacterName: CharacterName, channelName: ChannelName, channelTitle: string, speakingCharacter: CharacterName, speakingCharacterGender: CharacterGender, speakingCharacterOnlineStatus: OnlineStatus, messageType: LogMessageType, messageText: string): void {
    }

    logPMConvoMessage(myCharacterName: CharacterName, interlocutor: CharacterName, speakingCharacter: CharacterName, speakingCharacterGender: CharacterGender, speakingCharacterOnlineStatus: OnlineStatus, messageType: LogMessageType, messageText: string): void {
    }

    async getRecentLoggedChannelMessagesAsync(channelName: ChannelName, maxEntries: number): Promise<LogChannelMessage[]> {
        return [];
    }

    async getRecentLoggedPMConvoMessagesAsync(myCharacterName: CharacterName, interlocutor: CharacterName, maxEntries: number): Promise<LogPMConvoMessage[]> {
        return [];
    }

    endCharacterSession(characterName: CharacterName): void {
    }

    private _appSettings: any = {};

    getAppSettings(): Promise<unknown> {
        return this._appSettings;
    }

    async updateAppSettings(settings: any): Promise<void> {
        this._appSettings = settings;
    }

    updateAppBadge(pingCount: number, unseenCount: number): void {
    }

    registerIdleDetectionAsync(idleAfterMs: number, callback: (userState: IdleDetectionUserState, screenState: IdleDetectionScreenState) => void): IDisposable {
        return EmptyDisposable;
    }

    registerUpdateCheckerRegistrationAsync(callback: (state: UpdateCheckerState) => void): IDisposable {
        callback(UpdateCheckerState.NoUpdatesAvailable);
        return EmptyDisposable;
    }

    async relaunchToApplyUpdateAsync(): Promise<void> {
    }

    async signalLoginSuccessAsync(): Promise<void> {
    }

    get windowState(): HostWindowState {
        return HostWindowState.NORMAL;
    }

    registerWindowStateChangeCallback(callback: (windowState: HostWindowState) => void): IDisposable {
        return EmptyDisposable;
    }

    registerWindowBoundsChangeCallback(callback: (loc: RawSavedWindowLocation) => void): IDisposable {
        return EmptyDisposable;
    }

    async searchEIconsAsync(term: string, start: number, length: number): Promise<EIconSearchResults> {
        return { totalCount: 0, results: [] };
    }

    async clearEIconSearchAsync(): Promise<void> {
    }

    async getAllCssFilesAsync(): Promise<string[]> {
        return [];
    }

    async getCssDataAsync(path: string, cancellationToken: CancellationToken): Promise<string> {
        const fres = await fetch(path)
        const text = await fres.text();
        return text;
    }

    async getSvgDataAsync(path: string, cancellationToken: CancellationToken): Promise<string> {
        const sres = await fetch(path)
        const text = await sres.text();
        return text;
    }

    private readonly _configFiles: { [key: string]: (unknown | null) } = {};
    private readonly _configChangeCallbacks: Map<object, (value: ConfigKeyValue) => void> = new Map();

    async getConfigValuesAsync(): Promise<ConfigKeyValue[]> {
        const results: ConfigKeyValue[] = [];
        for (let k of Object.getOwnPropertyNames(this._configFiles)) {
            if (typeof k == "string") {
                results.push({ key: k, value: this._configFiles[k] });
            }
        }
        return results;
    }

    setConfigValue(key: string, value: (unknown | null)): void {
        if (value !== this._configFiles[key]) {
            this._configFiles[key] = value;
            for (let cb of [...this._configChangeCallbacks.values()]) {
                try {
                    cb({ key: key, value: value });
                }
                catch { }
            }
        }
    }

    registerConfigChangeCallback(callback: (value: ConfigKeyValue) => void): IDisposable {
        const myKey = {};
        this._configChangeCallbacks.set(myKey, callback);
        return asDisposable(() => {
            this._configChangeCallbacks.delete(myKey);
        });
    }

    logSearch: HostInteropLogSearch = new NullHostInteropLogSearch();

    logSearch2: HostInteropLogSearch2 = new NullHostInteropLogSearch2();

    async chooseLocalFileAsync(options?: ChooseLocalFileOptions): Promise<string | null> {
        return null;
    }

    getLocalFileUrl(fn: string): string {
        return "";
    }

    async performWindowCommandAsync(windowId: number | null, args: object): Promise<object> {
        return {};
    }

    readonly canGetEIconDataBlobs: boolean = false;

    getEIconDataBlob(name: string, cancellationToken: CancellationToken): Promise<Blob> {
        throw new Error("Method not implemented.");
    }

    async submitEIconMetadata(name: string, contentLength: number, etag: string): Promise<void> {
    }

    async setZoomLevel(value: number): Promise<void> {
    }

    async getMemoAsync(account: string, getForChar: CharacterName, cancellationToken?: CancellationToken): Promise<string | null> {
        return null;
    }

    async getAvailableLocales(cancellationToken?: CancellationToken): Promise<HostLocaleInfo[]> {
        return [];
    }

    flashWindow(): void {
    }

    createChatWebSocket(): ChatWebSocket {
        throw new Error("Method not implemented."); 
    }

    refreshChatLogFileSize(): void {
    }

    readonly chatLogFileSize: ObservableValue<number> = new ObservableValue(0);
}

class NullHostInteropLogSearch implements HostInteropLogSearch {
    async getHintsFromTermAsync(logsFor: CharacterName, kind: LogSearchKind, term: string, cancellationToken: CancellationToken): Promise<string[]> {
        return [];
    }
    async validateSearchTextAsync(logsFor: CharacterName, kind: LogSearchKind, searchText: string, cancellationToken: CancellationToken): Promise<boolean> {
        return false;
    }
    async performSearchAsync(logsFor: CharacterName, kind: LogSearchKind, searchText: string, dateAnchor: DateAnchor, date: Date, maxEntries: number, cancellationToken: CancellationToken): Promise<LogSearchResult[]> {
        return [];
    }
    async getRecentConversationsAsync(logsFor: CharacterName, resultLimit: number, cancellationToken: CancellationToken): Promise<RecentConversationResult[]> {
        return [];
    }
}

class NullHostInteropLogSearch2 implements HostInteropLogSearch2 {
    async performSearchAsync(searchOptions: PerformSearchOptions, cancellationToken: CancellationToken): Promise<LogSearch2Results> {
        return { resultCount: 0 };
    }
}