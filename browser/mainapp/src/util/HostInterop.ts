import { AppSettings, RawSavedWindowLocation } from "../settings/AppSettings";
import { NewAppSettings, XarHost2NewAppSettings } from "../settings/NewAppSettings";
import { ChannelName } from "../shared/ChannelName";
import { CharacterGender } from "../shared/CharacterGender";
import { CharacterName } from "../shared/CharacterName";
import { CharacterStatus } from "../shared/CharacterSet";
import { OnlineStatus } from "../shared/OnlineStatus";
import { AppViewModel } from "../viewmodel/AppViewModel";
import { FramePanelDialogViewModel } from "../viewmodel/dialogs/FramePanelDialogViewModel";
import { AsyncWebSocket } from "./AsyncWebSocket";
import { CancellationToken, CancellationTokenSource } from "./CancellationTokenSource";
import { SnapshottableMap } from "./collections/SnapshottableMap";
import { IDisposable, EmptyDisposable, asDisposable } from "./Disposable";
import { EventListenerUtil } from "./EventListenerUtil";
import { HostInteropLogSearch, XarHost2InteropLogSearch } from "./HostInteropLogSearch";
import { IdleDetectionScreenState, IdleDetectionUserState } from "./IdleDetection";
import { PromiseSource } from "./PromiseSource";
import { StringUtils } from "./StringUtils";
import { TaskUtils } from "./TaskUtils";
import { UpdateCheckerState } from "./UpdateCheckerClient";
// import { SqliteConnection } from "./sqlite/SqliteConnection";
// import { XarHost2SqliteConnection } from "./sqlite/xarhost2/XarHost2SqliteConnection";

declare const XCHost: any;

const freg = new FinalizationRegistry<() => void>(heldValue => {
    try { heldValue(); }
    catch { }
});
function onFinalize(obj: object, callback: () => void): IDisposable {
    const unregisterToken = {};
    freg.register(obj, callback, unregisterToken);
    return asDisposable(() => freg.unregister(unregisterToken));
}

export interface IHostInterop {
    get isInXarChatHost(): boolean;
    get devMode(): boolean;
    launchUrl(app: AppViewModel, url: string, forceExternal: boolean): void;
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
    updateAppSettings(settings: any): Promise<void>
    updateAppBadge(hasPings: boolean, hasUnseen: boolean): void;

    getNewAppSettingsAsync(cancellationToken: CancellationToken): Promise<NewAppSettings>;

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

    getConfigValuesAsync(): Promise<ConfigKeyValue[]>;
    setConfigValue(key: string, value: (unknown | null)): void;
    registerConfigChangeCallback(callback: (value: ConfigKeyValue) => void): IDisposable;

    readonly logSearch: HostInteropLogSearch;
}

export interface IXarHost2HostInterop extends IHostInterop {
    // closeSqlConnection(connId: string): void;
    // sendSqlCommandAsync(cmd: any, cancellationToken: CancellationToken): Promise<any>;

    writeAndReadToXCHostSocketAsync(data: any, cancellationToken?: CancellationToken): Promise<any>;
}

export interface LoggedMessage {
    speakingCharacter: CharacterName;
    messageType: LogMessageType;
    messageText: string;
    timestamp: Date;
    speakingCharacterGender: CharacterGender;
    speakingCharacterOnlineStatus: OnlineStatus;
}

export interface LogPMConvoMessage extends LoggedMessage {
    myCharacterName: CharacterName;
    interlocutor: CharacterName; 
}

export interface LogChannelMessage extends LoggedMessage {
    channelName: ChannelName;
    channelTitle: string;
}

export interface EIconSearchResults {
    totalCount: number;
    results: string[];
}

export enum HostWindowState {
    NORMAL,
    MINIMZED,
    MAXIMIZED
}


class XarHost2Interop implements IXarHost2HostInterop {
    constructor() {
        this.writeToXCHostSocket = () => { };
        this.webSocketManagementLoop();

        const processMessage = (data: any) => {
            if (data.type == "clientresize") {
                this.doClientResize(data.bounds[0], data.bounds[1]);
            }
            else if (data.type == "windowBoundsChange") {
                this.doWindowBoundsChange(data.desktopMetrics, data.windowBounds);
            }
        };

        if ((window as any).chrome?.webview) {
            (window as any).chrome.webview.addEventListener('message', (e: any) => {
                const data = e.data;
                processMessage(data);
            });
        }
        else if ((window as any).external?.receiveMessage) {
            (window as any).external.receiveMessage((message: any) => {
                const data = JSON.parse(message);
                processMessage(data);
            });
        }

        this.logSearch = new XarHost2InteropLogSearch((msg) => this.writeToXCHostSocket("logsearch." + msg));
    }

    readonly logSearch: XarHost2InteropLogSearch;

    private _nextEIconSearchId: number = 0;
    private _pendingEIconSearches: Set<(results: any) => boolean> = new Set();
    searchEIconsAsync(term: string, start: number, length: number): Promise<EIconSearchResults> {
        const ps = new PromiseSource<EIconSearchResults>();

        const mySearchId = (this._nextEIconSearchId++).toString();
        this._pendingEIconSearches.add((x) => {
            if (x.key == mySearchId) {
                const totalCount = x.totalCount as number;
                const results = x.results as string[];
                ps.resolve({
                    totalCount: totalCount,
                    results: results
                });
                return true;
            }
            else {
                return false;
            }
        });
        this.writeToXCHostSocket("eiconsearch " + JSON.stringify({
            key: mySearchId,
            search: term,
            start: start,
            length: length
        }));

        return ps.promise;
    }

    private distributeSearchResults(results: any) {
        console.log("eiconsearchresult", results);
        for (let x of this._pendingEIconSearches.values()) {
            if (x(results)) {
                this._pendingEIconSearches.delete(x);
                break;
            }
        }
    }
    
    clearEIconSearchAsync(): Promise<void> {
        this.writeToXCHostSocket("eiconsearchclear");
        const ps = new PromiseSource<void>();
        ps.resolve();
        return ps.promise;
    }

    private _windowState: HostWindowState = HostWindowState.NORMAL;

    get windowState(): HostWindowState { return this._windowState; }
    private setWindowState(value: HostWindowState) {
        if (value !== this._windowState) {
            this._windowState = value;
            this._windowStateCallbacks.forEachValueSnapshotted(x => {
                try { x(value); }
                catch { }
            });
        }
    }

    private _ws: WebSocket | null = null;

    async webSocketManagementLoop() {
        const dataQueue: any[] = [];
        while (true) {
            this.writeToXCHostSocket = (data) => { dataQueue.push(data); };

            try {
                let url = new URL(`wss://${document.location.host}/api/xchost`);
                const sp = new URLSearchParams(document.location.search);
                if (sp.has("wsport")) {
                    if (url.hostname == "localhost") {
                        url.port = sp.get("wsport")!;
                    }
                }

                using aws = await AsyncWebSocket.createAsync(url.href);

                while (dataQueue.length > 0) {
                    const tdata = dataQueue.shift()!;
                    try { aws.writeData(tdata); }
                    catch { aws.dispose(); dataQueue.unshift(tdata); }
                }

                this.writeToXCHostSocket = (data) => {
                    try { aws.writeData(data); }
                    catch { aws.dispose(); dataQueue.push(data); }
                };

                while (true) {
                    //const readTimeout = new CancellationTokenSource();
                    //readTimeout.cancelAfter(1000);
                    try {
                        //const data = await aws.readDataAsync(readTimeout.token);
                        const data = await aws.readDataAsync(CancellationToken.NONE);
                        try {
                            // TODO: handle incoming data
                            if (typeof data == "string") {
                                this.processIncomingMessage(data);
                            }
                        }
                        catch { }
                    }
                    catch {
                        //if (readTimeout.isCancellationRequested) {
                            //this.writeToXCHostSocket("ping");
                        //}
                    }
                }
            }
            catch { }
        }
    }

    private processIncomingMessage(data: string) {
        const spaceIdx = data.indexOf(' ');
        const rcmd = (spaceIdx == -1 ? data : data.substring(0, spaceIdx));
        const cmd = rcmd.toLowerCase();
        const arg = spaceIdx == -1 ? "" : data.substring(spaceIdx + 1);

        if (cmd == "clientresize") {
            const argo = JSON.parse(arg);
            this.doClientResize(argo[0], argo[1]);
        }
        else if (cmd == "windowboundschange") {
            const argo = JSON.parse(arg);
            this.doWindowBoundsChange(argo.desktopMetrics, argo.windowBounds);
        }
        else if (cmd == "win.minimized") {
            this.setWindowState(HostWindowState.MINIMZED);
        }
        else if (cmd== "win.maximized") {
            this.setWindowState(HostWindowState.MAXIMIZED);
        }
        else if (cmd== "win.restored") {
            this.setWindowState(HostWindowState.NORMAL);
        }
        else if (cmd == "idlemonitorupdate") {
            const argo = JSON.parse(arg);
            this.handleIdleMonitorUpdate(argo.monitorName, argo.userState, argo.screenState);
        }
        else if (cmd == "updatecheckerstate") {
            const argo = JSON.parse(arg);
            this.handleUpdateCheckerStateUpdate(argo.monitorName, argo.state);
        }
        else if (cmd == "eiconsearchresult") {
            const argo = JSON.parse(arg);
            this.distributeSearchResults(argo);
        }
        else if (cmd == "reply") {
            const argo = JSON.parse(arg);
            const msgid = argo._msgid;
            const data = argo.data;
            this.dispatchReply(msgid, data);
        }
        else if (cmd == "replycancelled") {
            const argo = JSON.parse(arg);
            const msgid = argo._msgid;
            this.dispatchCancel(msgid);
        }
        else if (cmd == "replyfailed") {
            const argo = JSON.parse(arg);
            const msgid = argo._msgid;
            const failMsg = argo.message;
            this.dispatchFailure(msgid, failMsg);
        }
        else if (cmd == "relaunchconfirmed") {
            this._relaunchToApplyUpdatePCS.tryResolve();
        }
        else if (cmd == "gotallcss") {
            const argo = JSON.parse(arg);
            const msgid = argo.msgid;
            const files = argo.filenames;
            this.gotAllCss(msgid, files);
        }
        else if (cmd == "gotcssdata") {
            const argo = JSON.parse(arg);
            const msgid = argo.msgid;
            const data = argo.data;
            this.returnCssDataXC(msgid, data);
        }
        else if (cmd == "gotconfig") {
            const argo = JSON.parse(arg);
            const msgid = argo.msgid;
            const data = argo.data;
            this.returnConfigData(msgid, data);
        }
        else if (cmd == "configchange") {
            const argo = JSON.parse(arg);
            for (let ccl of this._configChangeListeners.values()) {
                try { ccl(argo); }
                catch { }
            }
        }
        else if (cmd.startsWith("logsearch.")) {
            const argo = JSON.parse(arg);
            this.logSearch.receiveMessage(rcmd.substring(10), argo);
        }
    }

    get clientPlatform(): string {
        const usp = new URLSearchParams(document.location.search);
        return usp.get("ClientPlatform") ?? "unknown";
    }

    private neededWidth: number = 0;
    private neededHeight: number = 0;
    private hasResizeQueued = false;
    private doClientResize(width: number, height: number) {
        this.neededHeight = height;
        this.neededWidth = width;
        if (!this.hasResizeQueued) {
            this.hasResizeQueued = true;
            window.requestAnimationFrame(() => {
                this.hasResizeQueued = false;
                const elMain = document.getElementById("elMain")!;

                switch (this.clientPlatform) {
                    case "linux-x64":
                        {
                            elMain.style.top = "0px";
                            elMain.style.width = `${this.neededWidth}px`;
                            elMain.style.height = `${this.neededHeight}px`;
                            elMain.style.setProperty("--main-interface-width", `${this.neededWidth}px`);
                        }
                        break;
                    default:
                        {
                            elMain.style.top = "-6px";
                            elMain.style.width = `${this.neededWidth / window.devicePixelRatio}px`;
                            elMain.style.height = `${(this.neededHeight / window.devicePixelRatio) + 6}px`;
                            elMain.style.setProperty("--main-interface-width", `${this.neededWidth / window.devicePixelRatio}px`);
                        }
                        break;
                }
            });
        }
    }

    private writeToXCHostSocket: (data: any) => void;

    private _nextMsgId: number = 1;
    private _responseWaiters: Map<number, { resolve: (data: any) => void, fail: (reason: string) => void, cancel: () => void }> = new Map();

    private dispatchReply(msgid: number, data: any) {
        const w = this._responseWaiters.get(msgid);
        if (w) {
            this._responseWaiters.delete(msgid);
            w.resolve(data);
        }
    }

    private dispatchCancel(msgid: number) {
        const w = this._responseWaiters.get(msgid);
        if (w) {
            this._responseWaiters.delete(msgid);
            w.cancel();
        }
    }

    private dispatchFailure(msgid: number, message: string) {
        const w = this._responseWaiters.get(msgid);
        if (w) {
            this._responseWaiters.delete(msgid);
            w.cancel();
        }
    }

    async writeAndReadToXCHostSocketAsync(data: any, cancellationToken?: CancellationToken): Promise<any> {
        cancellationToken = cancellationToken ?? CancellationToken.NONE;
        cancellationToken.throwIfCancellationRequested();

        const myMsgId = this._nextMsgId++;
        const wrapper = {
            _msgid: myMsgId,
            data: data
        };
        this.writeToXCHostSocket(`request ${JSON.stringify(wrapper)}`);

        const ps = new PromiseSource<any>();
        this._responseWaiters.set(myMsgId, {
            resolve: (data) => {
                ps.tryResolve(data);
            },
            fail: (message) => {
                ps.tryReject(message);
            },
            cancel: () => {
                ps.trySetCancelled();
            }
        });

        using _ = cancellationToken.register(() => {
            const ccmd = {
                _msgid: myMsgId
            };
            this.writeToXCHostSocket(`cancel ${JSON.stringify(ccmd)}`);
        });

        const resp = await ps.promise;
        return resp;
    }
    
    get isInXarChatHost(): boolean { return true; }

    get devMode(): boolean {
        const sp = new URLSearchParams(window.location.search);
        const result = (sp.get("devmode") == "true");
        return result;
    }

    async launchUrl(app: AppViewModel, url: string, forceExternal: boolean): Promise<void> {
        const resp = await fetch(`/api/launchUrl?url=${encodeURIComponent(url)}&forceExternal=${forceExternal}`);
        try {
            if (resp.status == 200) {
                const respObj = await resp.json()! as HostLaunchUrlResponse;
                if (!!respObj.loadInternally && !StringUtils.isNullOrWhiteSpace(respObj.url)) {
                    const ifrUrl = `imageview.html?url=${encodeURIComponent(respObj.url!)}`;
                    const dlg = new FramePanelDialogViewModel(app, ifrUrl, url);
                    await app.showDialogAsync(dlg);
                }
            }
        }
        catch (e) { }
    }

    async getImagePreviewPopupUrlAsync(url: string): Promise<string | null> {
        const resp = await fetch(`/api/getImagePreviewUrl?url=${encodeURIComponent(url)}`);
        const robj = await resp.json();
        switch (robj.kind) {
            case "image":
                return robj.url;
            default:
                return null;
        }
    }

    appReady(): void {
        this.writeToXCHostSocket("appReady");
    }

    minimizeWindow(): void {
        this.writeToXCHostSocket("win.minimize");
    }

    maximizeWindow(): void {
        this.writeToXCHostSocket("win.maximize");
    }

    restoreWindow(): void {
        this.writeToXCHostSocket("win.restore");
    }

    closeWindow(): void {
        this.writeToXCHostSocket("win.close");
        if (this.clientPlatform == "linux-x64") {
            document.location = "about:blank";
        }
    }

    showDevTools(): void {
        this.writeToXCHostSocket("showDevTools");
    }

    logChannelMessage(myCharacterName: CharacterName, channelName: ChannelName, channelTitle: string, 
        speakingCharacter: CharacterName, speakingCharacterGender: CharacterGender, speakingCharacterOnlineStatus: OnlineStatus,
        messageType: LogMessageType, messageText: string): void {

        this.writeToXCHostSocket("log.channelmessage " + JSON.stringify({
            myCharacterName: myCharacterName.value,
            channelName: channelName.value,
            channelTitle: channelTitle,
            speakingCharacter: speakingCharacter.value,
            messageType: messageType,
            messageText: messageText,
            gender: speakingCharacterGender as number,
            status: speakingCharacterOnlineStatus as number,
        }));
    }

    logPMConvoMessage(myCharacterName: CharacterName, interlocutor: CharacterName, 
        speakingCharacter: CharacterName, speakingCharacterGender: CharacterGender, speakingCharacterOnlineStatus: OnlineStatus,
        messageType: LogMessageType, messageText: string): void {

        this.writeToXCHostSocket("log.pmconvomessage " + JSON.stringify({
            myCharacterName: myCharacterName.value,
            interlocutor: interlocutor.value,
            speakingCharacter: speakingCharacter.value,
            messageType: messageType,
            messageText: messageText,
            gender: speakingCharacterGender as number,
            status: speakingCharacterOnlineStatus as number,
        }));
    }

    async getRecentLoggedChannelMessagesAsync(channelName: ChannelName, maxEntries: number): Promise<LogChannelMessage[]> {
        const fd = new URLSearchParams();
        fd.append("channelName", channelName.value);
        fd.append("maxEntries", maxEntries.toString());
        fd.append("x", new Date().toString());
        const resp = await fetch(`/api/logs/getRecentLoggedChannelMessages?${fd.toString()}`);
        const json: any[] = await resp.json();
        return json.map(x => { return this.convertFromApiChannelLoggedMessage(x); });
    }

    async getRecentLoggedPMConvoMessagesAsync(myCharacterName: CharacterName, interlocutor: CharacterName, maxEntries: number): Promise<LogPMConvoMessage[]> {
        const fd = new URLSearchParams();
        fd.append("myCharacterName", myCharacterName.value);
        fd.append("interlocutor", interlocutor.value);
        fd.append("maxEntries", maxEntries.toString());
        fd.append("x", new Date().toString());
        const resp = await fetch(`/api/logs/getRecentLoggedPMConvoMessages?${fd.toString()}`);
        const json: any[] = await resp.json();
        return json.map(x => { return this.convertFromApiPMConvoLoggedMessage(x); });
    }

    convertFromApiChannelLoggedMessage(x: any): LogChannelMessage {
        return {
            channelName: ChannelName.create(x.channelName),
            channelTitle: x.channelTitle,
            speakingCharacter: CharacterName.create(x.speakerName),
            messageType: x.messageType,
            messageText: x.messageText,
            timestamp: new Date(x.timestamp),
            speakingCharacterGender: (x.gender as CharacterGender) ?? CharacterGender.NONE,
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
            speakingCharacterGender: (x.gender as CharacterGender) ?? CharacterGender.NONE,
            speakingCharacterOnlineStatus: (x.status as OnlineStatus) ?? OnlineStatus.OFFLINE,
        };
    }

    endCharacterSession(characterName: CharacterName): void {
        this.writeToXCHostSocket("endCharacterSession " + characterName.value);
    }

    async getAppSettings(): Promise<unknown> {
        const resp = await fetch("/api/appSettings");
        const json = await resp.json();
        return json;
    }

    private _isUpdatingAppSettings: boolean = false;

    private _nextAppSettingsUpdate: any = undefined;
    private _nextAppSettingsUpdatePCS: PromiseSource<void> | null = null;

    async updateAppSettings(settings: any): Promise<void> {
        if (!this._isUpdatingAppSettings) {
            this._isUpdatingAppSettings = true;
            const resp = await fetch("/api/appSettings", {
                method: "PUT",
                body: JSON.stringify(settings)
            });

            try {
                const body = await resp.text();
            }
            catch { }

            this._isUpdatingAppSettings = false;

            if (this._nextAppSettingsUpdate !== undefined) {
                const pcs = this._nextAppSettingsUpdatePCS;
                const nu = this._nextAppSettingsUpdate;

                this._nextAppSettingsUpdate = undefined;
                this._nextAppSettingsUpdatePCS = null;

                this.updateAppSettings(nu);
                pcs?.resolve();
            }
        }
        else {
            this._nextAppSettingsUpdate = settings;
            if (this._nextAppSettingsUpdatePCS == null) {
                this._nextAppSettingsUpdatePCS = new PromiseSource<void>();
            }
            await this._nextAppSettingsUpdatePCS.promise;
        }
    }

    updateAppBadge(hasPings: boolean, hasUnseen: boolean): void {
        this.writeToXCHostSocket("updateAppBadge " + JSON.stringify({
            hasPings: hasPings,
            hasUnseen: hasUnseen
        }));
    }

    // async getNewAppSettingsAsync(cancellationToken: CancellationToken): Promise<SqliteConnection> {
    //     const sqld = await this.writeAndReadToXCHostSocketAsync({
    //         cmd: "getNewAppSettingsConnection"
    //     }, cancellationToken);

    //     const connectionId = sqld.connectionId as string;
    //     return new XarHost2SqliteConnection(this, connectionId);
    // }

    // closeSqlConnection(connId: string): void {
    //     this.writeToXCHostSocket({
    //         cmd: "closeSqlConnection",
    //         connectionId: connId
    //     });
    // }

    // async sendSqlCommandAsync(cmd: XarHost2SqliteConnection, cancellationToken: CancellationToken): Promise<any> {
    //     const sqld = await this.writeAndReadToXCHostSocketAsync({
    //         cmd: "doSqlCommand",
    //         connectionId: cmd.connectionId
    //     }, cancellationToken);

    //     return sqld;
    // }

    private _updateCheckerCallbacks: Map<string, (state: UpdateCheckerState) => void> = new Map();

    registerUpdateCheckerRegistrationAsync(callback: (state: UpdateCheckerState) => void): IDisposable {
        const myRegId = "ucreg" + (this._nextIdleMonitorId++);
        this._updateCheckerCallbacks.set(myRegId, callback);
        this.writeToXCHostSocket("addUpdateCheckerMonitorRegistration " + JSON.stringify({
            monitorName: myRegId
        }));

        return asDisposable(() => {
            this.writeToXCHostSocket("removeUpdateCheckerMonitorRegistration " + JSON.stringify({
                monitorName: myRegId
            }));
            this._updateCheckerCallbacks.delete(myRegId);
        });
    }

    private handleUpdateCheckerStateUpdate(monitorName: string, state: UpdateCheckerState) {
        const r = this._updateCheckerCallbacks.get(monitorName);
        if (r) {
            r(state);
        }
    }

    private readonly _relaunchToApplyUpdatePCS = new PromiseSource<void>();
    async relaunchToApplyUpdateAsync(): Promise<void> {
        this.writeToXCHostSocket("relaunchToApplyUpdate");
        await this._relaunchToApplyUpdatePCS.promise;
    }

    private _idleDetectionCallbacks: Map<string, (userState: IdleDetectionUserState, screenState: IdleDetectionScreenState) => void> = new Map();
    private _nextIdleMonitorId: number = 0;

    registerIdleDetectionAsync(idleAfterMs: number, callback: (userState: IdleDetectionUserState, screenState: IdleDetectionScreenState) => void): IDisposable {
        const myIdleMonitorId = "idlemon" + (this._nextIdleMonitorId++);
        this._idleDetectionCallbacks.set(myIdleMonitorId, callback);
        this.writeToXCHostSocket("addIdleMonitorRegistration " + JSON.stringify({
            monitorName: myIdleMonitorId,
            idleAfterMs: idleAfterMs
        }));

        return asDisposable(() => {
            this.writeToXCHostSocket("removeIdleMonitorRegistration " + JSON.stringify({
                monitorName: myIdleMonitorId
            }));
            this._idleDetectionCallbacks.delete(myIdleMonitorId);
        });
    }

    private handleIdleMonitorUpdate(monitorName: string, userState: IdleDetectionUserState, screenState: IdleDetectionScreenState) {
        const cb = this._idleDetectionCallbacks.get(monitorName);
        if (cb) {
            try { cb(userState, screenState); }
            catch { }
        }
    }

    private _windowStateCallbacks: SnapshottableMap<object, (windowState: HostWindowState) => void> = new SnapshottableMap();

    registerWindowStateChangeCallback(callback: (windowState: HostWindowState) => void): IDisposable {
        const myKey = {};
        this._windowStateCallbacks.set(myKey, callback);
        return asDisposable(() => {
            this._windowStateCallbacks.delete(myKey);
        })
    }

    private _windowBoundsChangeCallbacks: SnapshottableMap<object, (loc: RawSavedWindowLocation) => void> = new SnapshottableMap();

    registerWindowBoundsChangeCallback(callback: (loc: RawSavedWindowLocation) => void): IDisposable {
        const myKey = {};
        this._windowBoundsChangeCallbacks.set(myKey, callback);
        return asDisposable(() => {
            this._windowBoundsChangeCallbacks.delete(myKey);
        });
    }

    private doWindowBoundsChange(desktopMetrics: string, windowBounds: [number, number, number, number] ) {
        this._windowBoundsChangeCallbacks.forEachValueSnapshotted(x => {
            try {
                x({
                    desktopMetrics: desktopMetrics,
                    windowX: windowBounds[0],
                    windowY: windowBounds[1],
                    windowWidth: windowBounds[2],
                    windowHeight: windowBounds[3]
                });
            }
            catch { }
        });
    }

    private _newAppSettings: NewAppSettings | null = null;

    getNewAppSettingsAsync(cancellationToken: CancellationToken): Promise<NewAppSettings> {
        this._newAppSettings = this._newAppSettings ?? new XarHost2NewAppSettings(this);
        const ps = new PromiseSource<NewAppSettings>();
        ps.resolve(this._newAppSettings!);
        return ps.promise;
    }

    private readonly _getAllCssDataReaders: Map<number, PromiseSource<string[]>> = new Map();

    async getAllCssFilesAsync(): Promise<string[]> {
        const ps = new PromiseSource<string[]>();

        const myId = this._nextCssDataReaderId++;
        this._getAllCssDataReaders.set(myId, ps);

        this.writeToXCHostSocket("getallcss " + JSON.stringify({
            msgid: myId
        }));

        return ps.promise;
    }

    private gotAllCss(messageId: number, files: string[]) {
        const ps = this._getAllCssDataReaders.get(messageId);
        if (ps) {
            this._getAllCssDataReaders.delete(messageId);
            ps.tryResolve(files);
        }
    }

    async getCssDataAsync(url: string, cancellationToken: CancellationToken): Promise<string> {
        //const result = await this.getCssDataFetchAsync(url, cancellationToken);
        const result = await this.getCssDataXCAsync(url, cancellationToken);
        return result;
    }

    private async getCssDataFetchAsync(url: string, cancellationToken: CancellationToken): Promise<string> {
        try {
            const xurl = url + ((url.indexOf("?") == -1) ? "?" : "&") + `now=${NOW()}`;
            const resp = await fetch(xurl, {
                signal: cancellationToken != CancellationToken.NONE ? cancellationToken.signal : undefined
            });
            const body = await resp.text();
            return body;
        }
        catch {
            return "";
        }
    }

    private readonly _cssDataReaders: Map<number, PromiseSource<string>> = new Map();
    private _nextCssDataReaderId: number = 0;

    private getCssDataXCAsync(url: string, cancellationToken: CancellationToken): Promise<string> {
        const ps = new PromiseSource<string>();
        const myCssDataReaderId = this._nextCssDataReaderId++;
        this._cssDataReaders.set(myCssDataReaderId, ps);

        this.writeToXCHostSocket("getcssdata " + JSON.stringify({
            msgid: myCssDataReaderId,
            url: url
        }));
        
        return ps.promise;
    }

    private returnCssDataXC(msgid: number, data: string): void {
        const ps = this._cssDataReaders.get(msgid);
        if (ps) {
            this._cssDataReaders.delete(msgid);
            ps.tryResolve(data);
        }
    }

    async signalLoginSuccessAsync(): Promise<void> {
        await TaskUtils.delay(15000, CancellationToken.NONE);
        this.writeToXCHostSocket("loginsuccess");
    }

    private readonly _configWaiters: Map<number, PromiseSource<{}>> = new Map();
    private _nextConfigWaiterId: number = 0;

    getConfigValuesAsync(): Promise<ConfigKeyValue[]> {
        const ps = new PromiseSource<ConfigKeyValue[]>();
        const myReaderId = this._nextConfigWaiterId++;
        this._configWaiters.set(myReaderId, ps);

        this.writeToXCHostSocket("getconfig " + JSON.stringify({
            msgid: myReaderId
        }));

        return ps.promise;
    }

    private returnConfigData(msgid: number, data: ConfigKeyValue[]) {
        const ps = this._configWaiters.get(msgid);
        if (ps) {
            this._configWaiters.delete(msgid);
            ps.tryResolve(data);
        }
    }

    setConfigValue(key: string, value: (unknown | null)): void {
        this.writeToXCHostSocket("setconfig " + JSON.stringify({
            key: key,
            value: value
        }));
    }

    private readonly _configChangeListeners: Map<number, (value: ConfigKeyValue) => void> = new Map();

    registerConfigChangeCallback(callback: (value: ConfigKeyValue) => void): IDisposable {
        const myId = this._nextConfigWaiterId++;
        this._configChangeListeners.set(myId, callback);
        return asDisposable(() => {
            this._configChangeListeners.delete(myId);
        });
    }
}

export type ConfigKeyValue = { key: string, value: (unknown | null)};

const NOW = () => (new Date()).getTime();

const qp = new URLSearchParams(document.location.search);
export const HostInterop: IHostInterop = new XarHost2Interop();
    // (qp.get("XarHostMode") == "2") ? new XarHost2Interop()
    // : new CefHostInterop();

(window as any)["__hostinterop"] = HostInterop;

export interface HostInteropSocket extends IDisposable {
    sendAsync(data: string): Promise<void>;
    receiveAsync(): Promise<string | null>;
}

export enum LogMessageType {
    CHAT = 0,
    AD = 1,
    ROLL = 2,
    SPIN = 3
}

interface HostLaunchUrlResponse {
    loadInternally?: boolean;
    url?: string;
}