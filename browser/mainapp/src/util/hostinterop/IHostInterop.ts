import { RawSavedWindowLocation } from "../../settings/RawAppSettings";
import { ChannelName } from "../../shared/ChannelName";
import { CharacterGender } from "../../shared/CharacterGender";
import { CharacterName } from "../../shared/CharacterName";
import { OnlineStatus } from "../../shared/OnlineStatus";
import { AppViewModel } from "../../viewmodel/AppViewModel";
import { CancellationToken } from "../CancellationTokenSource";
import { IDisposable } from "../Disposable";
import { HostInteropLogSearch } from "./HostInteropLogSearch";
import { HostInteropLogSearch2 } from "./HostInteropLogSearch2";
import { IdleDetectionUserState, IdleDetectionScreenState } from "../IdleDetection";
import { UpdateCheckerState } from "../UpdateCheckerClient";
import { LogMessageType, LogChannelMessage, LogPMConvoMessage, HostWindowState, EIconSearchResults, ConfigKeyValue, ChooseLocalFileOptions, HostLocaleInfo } from "./HostInterop";
import { IObservable, ObservableValue } from "../Observable";
import { HostInteropLogFileMaintenance } from "./HostInteropLogFileMaintenance";

export interface UrlLaunchedEventArgs {
    url: string;
    forceExternal: boolean;
}

export interface IHostInterop {
    get isInXarChatHost(): boolean;
    get devMode(): boolean;

    launchUrl(app: AppViewModel, url: string, forceExternal: boolean): void;

    addUrlLaunchedHandler(callback: (args: UrlLaunchedEventArgs) => void): IDisposable;
    removeUrlLaunchedHandler(callback: (args: UrlLaunchedEventArgs) => void): void;

    launchCharacterReport(app: AppViewModel, name: CharacterName): Promise<void>;
    getImagePreviewPopupUrlAsync(url: string): Promise<(string | null)>;
    appReady(): void;
    minimizeWindow(): void;
    maximizeWindow(): void;
    restoreWindow(): void;
    closeWindow(): void;
    showDevTools(): void;

    logChannelMessage(myCharacterName: CharacterName, channelName: ChannelName, channelTitle: string,
        speakingCharacter: CharacterName, speakingCharacterGender: CharacterGender, speakingCharacterOnlineStatus: OnlineStatus,
        messageType: LogMessageType, messageText: string): void;

    logPMConvoMessage(myCharacterName: CharacterName, interlocutor: CharacterName,
        speakingCharacter: CharacterName, speakingCharacterGender: CharacterGender, speakingCharacterOnlineStatus: OnlineStatus,
        messageType: LogMessageType, messageText: string): void;

    getRecentLoggedChannelMessagesAsync(channelName: ChannelName, maxEntries: number): Promise<LogChannelMessage[]>;
    getRecentLoggedPMConvoMessagesAsync(myCharacterName: CharacterName, interlocutor: CharacterName, maxEntries: number): Promise<LogPMConvoMessage[]>;

    convertFromApiChannelLoggedMessage(x: any): LogChannelMessage;
    convertFromApiPMConvoLoggedMessage(x: any): LogPMConvoMessage;

    endCharacterSession(characterName: CharacterName): void;

    getAppSettings(): Promise<unknown>;
    updateAppSettings(settings: any): Promise<void>;

    updateAppBadge(pingCount: number, unseenCount: number): void;
    getLastAppBadge(): { pingCount: number, unseenCount: number };

    registerIdleDetectionAsync(idleAfterMs: number, callback: (userState: IdleDetectionUserState, screenState: IdleDetectionScreenState) => void): IDisposable;

    registerUpdateCheckerRegistrationAsync(callback: (state: UpdateCheckerState) => void): IDisposable;
    relaunchToApplyUpdateAsync(): Promise<void>;
    signalLoginSuccessAsync(): Promise<void>;

    get windowState(): HostWindowState;
    registerWindowStateChangeCallback(callback: (windowState: HostWindowState) => void): IDisposable;

    registerWindowBoundsChangeCallback(callback: (loc: RawSavedWindowLocation) => void): IDisposable;

    searchEIconsAsync(term: string, start: number, length: number): Promise<EIconSearchResults>;
    clearEIconSearchAsync(): Promise<void>;

    getAllCssFilesAsync(): Promise<string[]>;
    getCssDataAsync(path: string, cancellationToken: CancellationToken): Promise<string>;

    getSvgDataAsync(path: string, cancellationToken: CancellationToken): Promise<string>;

    getConfigValuesAsync(): Promise<ConfigKeyValue[]>;
    setConfigValue(key: string, value: (unknown | null)): void;
    registerConfigChangeCallback(callback: (value: ConfigKeyValue) => void): IDisposable;

    readonly logSearch: HostInteropLogSearch;
    readonly logSearch2: HostInteropLogSearch2;

    readonly logFileMaintenance: HostInteropLogFileMaintenance;

    chooseLocalFileAsync(options?: ChooseLocalFileOptions): Promise<string | null>;
    getLocalFileUrl(fn: string): string;

    performWindowCommandAsync(windowId: number | null, args: object): Promise<object>;

    readonly canGetEIconDataBlobs: boolean;
    getEIconDataBlob(name: string, cancellationToken: CancellationToken): Promise<Blob>;
    submitEIconMetadata(name: string, contentLength: number, etag: string): Promise<void>;

    setZoomLevel(value: number): Promise<void>;

    getMemoAsync(account: string, getForChar: CharacterName, cancellationToken?: CancellationToken): Promise<string | null>;

    getAvailableLocales(cancellationToken?: CancellationToken): Promise<HostLocaleInfo[]>;

    flashWindow(): void;

    createChatWebSocket(): ChatWebSocket;

    noCorsFetch(args: NoCorsFetchArgs, cancellationToken: CancellationToken): Promise<NoCorsFetchResult>;
}

export interface NoCorsFetchArgs {
    method: string;
    url: string;
    requestHeaders?: NoCorsHeaderSet;
    contentHeaders?: NoCorsHeaderSet;
    body?: string;
}
export interface NoCorsFetchResult {
    status: number;
    responseHeaders: NoCorsHeaderSet;
    contentHeaders: NoCorsHeaderSet;
    text(): Promise<string>;
    json(): Promise<unknown>;
}
export type NoCorsHeaderSet = { name: string, value: string }[];

export interface ChatWebSocket {
    send(data: string): void;
    close(): void;
    onopen: ((e: Event) => any) | null;
    onmessage: ((e: MessageEvent) => any) | null;
    onclose: ((e: CloseEvent) => any) | null;
    onerror: ((e: Event) => any) | null;
}

export abstract class HostInteropBase {
    abstract launchUrl(app: AppViewModel, url: string, forceExternal: boolean): void;

    async launchCharacterReport(app: AppViewModel, name: CharacterName): Promise<void> {
        this.launchUrl(
            app,
            `https://www.f-list.net/tickets2.php?report=${encodeURIComponent(name.value)}`,
            true);
    }

    convertFromApiChannelLoggedMessage(x: any): LogChannelMessage {
        return {
            channelName: ChannelName.create(x.channelName),
            channelTitle: x.channelTitle,
            speakingCharacter: CharacterName.create(x.speakerName),
            messageType: x.messageType,
            messageText: x.messageText,
            timestamp: new Date(x.timestamp),
            speakingCharacterGender: CharacterGender.create(x.gender) ?? CharacterGender.NONE,
            speakingCharacterOnlineStatus: (x.status as OnlineStatus) ?? OnlineStatus.OFFLINE,
        };
    }

    convertFromApiPMConvoLoggedMessage(x: any): LogPMConvoMessage {
        return {
            myCharacterName: CharacterName.create(x.myCharacterName),
            interlocutor: CharacterName.create(x.interlocutorName),
            speakingCharacter: CharacterName.create(x.speakerName),
            messageType: x.messageType,
            messageText: x.messageText,
            timestamp: new Date(x.timestamp),
            speakingCharacterGender: CharacterGender.create(x.gender) ?? CharacterGender.NONE,
            speakingCharacterOnlineStatus: (x.status as OnlineStatus) ?? OnlineStatus.OFFLINE,
        };
    }
}