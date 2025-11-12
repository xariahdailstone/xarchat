import { RawSavedWindowLocation } from "../../../settings/RawAppSettings";
import { ChannelName } from "../../../shared/ChannelName";
import { CharacterGender } from "../../../shared/CharacterGender";
import { CharacterName } from "../../../shared/CharacterName";
import { OnlineStatus } from "../../../shared/OnlineStatus";
import { AppViewModel } from "../../../viewmodel/AppViewModel";
import { FramePanelDialogViewModel } from "../../../viewmodel/dialogs/FramePanelDialogViewModel";
import { AsyncWebSocket } from "../../AsyncWebSocket";
import { CallbackSet } from "../../CallbackSet";
import { CancellationToken } from "../../CancellationTokenSource";
import { SnapshottableMap } from "../../collections/SnapshottableMap";
import { IDisposable, asDisposable } from "../../Disposable";
import { IdleDetectionUserState, IdleDetectionScreenState } from "../../IdleDetection";
import { Logging, Logger } from "../../Logger";
import { Mutex } from "../../Mutex";
import { PromiseSource } from "../../PromiseSource";
import { Scheduler } from "../../Scheduler";
import { StringUtils } from "../../StringUtils";
import { TaskUtils } from "../../TaskUtils";
import { UpdateCheckerState } from "../../UpdateCheckerClient";
import { EIconSearchResults, HostWindowState, HostLaunchUrlResponse, LogMessageType, LogChannelMessage, LogPMConvoMessage, NOW, ConfigKeyValue, ChooseLocalFileOptions, HostLocaleInfo } from "../HostInterop";
import { XarHost2HostInteropEIconLoader } from "./HostInteropEIconLoader";
import { LogSearchKind, DateAnchor, LogSearchResultChannelMessage, LogSearchResultPMConvoMessage } from "../HostInteropLogSearch";
import { XarHost2InteropLogSearch } from "./XarHost2InteropLogSearch";
import { XarHost2InteropWindowCommand } from "./XarHost2InteropWindowCommand";
import { XarHost2InteropSession } from "./XarHost2InteropSession";
import { HostInteropLogSearch2 } from "../HostInteropLogSearch2";
import { XarHost2HostInteropLogSearch2Impl } from "./XarHost2HostInteropLogSearch2Impl";
import { IXarHost2HostInterop } from "./IXarHost2HostInterop";
import { ChatWebSocket } from "../IHostInterop";



export class XarHost2Interop implements IXarHost2HostInterop {
    constructor() {
        this.logger = Logging.createLogger("XarHost2Interop");

        this.writeToXCHostSocket = () => { };
        this.webSocketManagementLoop();

        const processMessage = (data: any) => {
            if (data.type == "clientresize") {
                this.doClientResize(data.bounds[0], data.bounds[1], false);
            }
            else if (data.type == "windowBoundsChange") {
                this.doWindowBoundsChange(data.desktopMetrics, data.windowBounds);
            }
            else if (data.type == "downloadStatusUpdate") {
                this.doDownloadStatusUpdate(data);
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

        // TODO:
        this.logSearch2 = new XarHost2HostInteropLogSearch2Impl();

        this.doClientResize(window.innerWidth, window.innerHeight, true);

        this._windowCommandSession = new XarHost2InteropWindowCommand();
        this._hostInteropEIconLoader = new XarHost2HostInteropEIconLoader();

        this.sessions = [
            this._windowCommandSession,
            this._hostInteropEIconLoader
        ];
        for (let sess of this.sessions) {
            sess.writeMessage = (msg) => this.writeToXCHostSocket(sess.prefix + msg);
        }

        window.addEventListener("resize", () => {
            this.doClientResize(window.innerWidth * window.devicePixelRatio, window.innerHeight * window.devicePixelRatio, false);
        });
    }

    doDownloadStatusUpdate(data: any) {
        if ((window as any)["__vm"]) {
            const appViewModel = (window as any)["__vm"];
            switch (data.state) {
                case "InProgress":
                    const msgBuilder: string[] = [];
                    msgBuilder.push(`Downloading ${this.getUrlFilename(data.uri)}`);
                    if (data.bytesReceived != null && data.totalBytesToReceive != null) {
                        const pctComplete = Math.round((data.bytesReceived / data.totalBytesToReceive) * 100);
                        if (data.estimatedSecRemaining != null) {
                            const timeRemaining = this.secondsToTimeDisplay(data.estimatedSecRemaining);
                            msgBuilder.push(` (${pctComplete}%, ${timeRemaining} remaining)`);
                        }
                        else {
                            msgBuilder.push(` (${pctComplete}%)`);
                        }
                    }
                    else if (data.bytesReceived != null) {
                        msgBuilder.push(` (downloaded ${data.bytesReceived} bytes)`);
                    }
                    msgBuilder.push("...");

                    appViewModel.statusMessage = msgBuilder.join("");
                    break;
                case "Interrupted":
                    appViewModel.statusMessage = "Download failed.";
                    window.setTimeout(() => {
                        if (appViewModel.statusMessage == "Download failed.") {
                            appViewModel.statusMessage = null;
                        }
                    }, 6000);
                    break;
                case "Completed":
                    appViewModel.statusMessage = "Download complete.";
                    window.setTimeout(() => {
                        if (appViewModel.statusMessage == "Download complete.") {
                            appViewModel.statusMessage = null;
                        }
                    }, 2000);
                    break;
            }
        }
    }

    secondsToTimeDisplay(estimatedSecRemaining: any) {
        const timeParts: string[] = [];

        if (estimatedSecRemaining > 60) {
            let minRemaining = Math.floor(estimatedSecRemaining / 60);
            if (minRemaining > 60) {
                const hrsRemaining = Math.floor(minRemaining / 60);
                minRemaining -= (hrsRemaining * 60);
                timeParts.push(`${hrsRemaining} hr`);
            }
            estimatedSecRemaining -= (minRemaining * 60);
            timeParts.push(`${minRemaining} min`);
        }
        timeParts.push(`${estimatedSecRemaining} sec`);

        return timeParts.join(", ");
    }

    getUrlFilename(uri: string) {
        let fnPart = uri.substring(uri.lastIndexOf("/") + 1);
        const qPos = fnPart.indexOf("?");
        const hPos = fnPart.indexOf("#");
        if (qPos != -1) {
            fnPart = fnPart.substring(0, qPos);
        }
        else if (hPos != -1) {
            fnPart = fnPart.substring(0, hPos);
        }
        return fnPart;
    }

    readonly logger: Logger;

    readonly logSearch: XarHost2InteropLogSearch;
    readonly logSearch2: HostInteropLogSearch2;

    readonly sessions: XarHost2InteropSession[];
    private _windowCommandSession: XarHost2InteropWindowCommand;
    private _hostInteropEIconLoader: XarHost2HostInteropEIconLoader;

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
        this.logger.logDebug("eiconsearchresult", results);
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
            this._windowStateCallbacks.invoke(value);
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

        this._allResponseWaiters2.invoke(cmd, arg);

        if (cmd == "clientresize") {
            const argo = JSON.parse(arg);
            this.doClientResize(argo[0], argo[1], false);
        }
        else if (cmd == "windowboundschange") {
            const argo = JSON.parse(arg);
            this.doWindowBoundsChange(argo.desktopMetrics, argo.windowBounds);
        }
        else if (cmd == "win.minimized") {
            this.setWindowState(HostWindowState.MINIMZED);
        }
        else if (cmd == "win.maximized") {
            this.setWindowState(HostWindowState.MAXIMIZED);
        }
        else if (cmd == "win.restored") {
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
        else if (cmd == "gotsvgdata") {
            const argo = JSON.parse(arg);
            const msgid = argo.msgid;
            const data = argo.data;
            this.returnSvgDataXC(msgid, data);
        }
        else if (cmd == "gotconfig") {
            const argo = JSON.parse(arg);
            const msgid = argo.msgid;
            const data = argo.data;
            this.returnConfigData(msgid, data);
        }
        else if (cmd == "configchange") {
            const argo = JSON.parse(arg);
            this._configChangeListeners.forEachValueSnapshotted(ccl => {
                try { ccl(argo); }
                catch { }
            });
        }
        else if (cmd.startsWith("logsearch.")) {
            const argo = JSON.parse(arg);
            this.logSearch.receiveMessage(rcmd.substring(10), argo);
        }
        else if (cmd == "cssfileupdated") {
            const argo = JSON.parse(arg);
            (window as any).__refreshCss(argo.filename);
        }
        else {
            for (let sess of this.sessions) {
                if (cmd.startsWith(sess.prefix)) {
                    const argo = JSON.parse(arg);
                    sess.receiveMessage(rcmd.substring(sess.prefix.length), argo);
                    break;
                }
            }
        }
    }

    get clientPlatform(): string {
        const usp = new URLSearchParams(document.location.search);
        return usp.get("ClientPlatform") ?? "unknown";
    }

    private neededWidth: number = 0;
    private neededHeight: number = 0;
    private hasResizeQueued = false;
    private doClientResize(width: number, height: number, isInitial: boolean) {
        this.neededHeight = height;
        this.neededWidth = width;
        if (!this.hasResizeQueued) {
            this.hasResizeQueued = true;
            Scheduler.scheduleNamedCallback("XarHost2Interop.doClientResize", ["frame", "idle", 250], () => {
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
                    case "macos-arm64":
                        {
                            //const pxScaleFactor = window.devicePixelRatio;
                            //elMain.style.top = "0px";
                            //elMain.style.width = `${this.neededWidth / pxScaleFactor}px`;
                            //elMain.style.height = `${this.neededHeight / pxScaleFactor}px`;
                            //elMain.style.setProperty("--main-interface-width", `${this.neededWidth / pxScaleFactor}px`);
                            elMain.style.top = "0px";
                            elMain.style.width = "100vw";
                            elMain.style.height = "100vh";
                            elMain.style.setProperty("--main-interface-width", "100vw");
                        }
                        break;
                    default:
                        {
                            const w = this.neededWidth / (isInitial ? 1 : window.devicePixelRatio);
                            const h = this.neededHeight / (isInitial ? 1 : window.devicePixelRatio);
                            elMain.style.top = "-6px";
                            elMain.style.width = `${w}px`;
                            elMain.style.height = `${(h) + 6}px`;
                            elMain.style.setProperty("--main-interface-width", `${this.neededWidth / window.devicePixelRatio}px`);
                        }
                        break;
                }
            });
        }
    }

    private writeToXCHostSocket: (data: any) => void;

    private async writeToXCHostSocketAndRead(data: any, onMessage: (cmd: string, data: string) => boolean): Promise<void> {
        const ps = new PromiseSource();

        const tw = (cmd: string, data: string) => {
            let stopListening: boolean;
            try {
                stopListening = onMessage(cmd, data);
            }
            catch (e) {
                stopListening = true;
                this._allResponseWaiters2.delete(tw);
                ps.tryReject(e);
            }
            if (stopListening) {
                this._allResponseWaiters2.delete(tw);
                ps.tryResolve(undefined);
            }
        };

        this._allResponseWaiters2.add(tw);

        this.writeToXCHostSocket(data);

        await ps.promise;
    }

    private _nextMsgId: number = 1;
    private _responseWaiters: Map<number, { resolve: (data: any) => void; fail: (reason: string) => void; cancel: () => void; }> = new Map();

    private _allResponseWaiters2: CallbackSet<(cmd: string, data: string) => void> = new CallbackSet("XarHost2Interop-allResponseWaiters");

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

    async launchCharacterReport(app: AppViewModel, name: CharacterName): Promise<void> {
        this.launchUrl(
            app,
            `https://www.f-list.net/tickets2.php?report=${encodeURIComponent(name.value)}`,
            true);
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
        Scheduler.scheduleNamedCallback("XarHost2Interop.appReady", ["frame", "idle", 250], () => {
            document.body.classList.add("loaded");
        });
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
        const lsrs = await this.logSearch.performSearchAsync(CharacterName.SYSTEM, LogSearchKind.Channels,
            channelName.value, DateAnchor.Before, new Date(), 200, CancellationToken.NONE);
        return lsrs.map(x => this.convertToLogChannelMessage(x as LogSearchResultChannelMessage));
    }

    async getRecentLoggedPMConvoMessagesAsync(myCharacterName: CharacterName, interlocutor: CharacterName, maxEntries: number): Promise<LogPMConvoMessage[]> {
        const lsrs = await this.logSearch.performSearchAsync(myCharacterName, LogSearchKind.PrivateMessages,
            interlocutor.canonicalValue, DateAnchor.Before, new Date(), 200, CancellationToken.NONE);
        return lsrs.map(x => this.convertToLogPMConvoMessage(x as LogSearchResultPMConvoMessage));
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

    convertToLogChannelMessage(x: LogSearchResultChannelMessage): LogChannelMessage {
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

    convertToLogPMConvoMessage(x: LogSearchResultPMConvoMessage): LogPMConvoMessage {
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

    private _getAppSettingsMutex: Mutex = new Mutex();
    async getAppSettings(): Promise<unknown> {
        await this._getAppSettingsMutex.acquireAsync();
        try {
            const ps = new PromiseSource<unknown>();

            await this.writeToXCHostSocketAndRead("getAppSettings",
                (cmd, arg) => {
                    if (cmd.toLowerCase() == "gotappsettings") {
                        var argObj = JSON.parse(arg);
                        ps.tryResolve(argObj);
                        return true;
                    }
                    else if (cmd.toLowerCase() == "gotappsettingserror") {
                        var errStr = JSON.parse(arg);
                        ps.tryReject(errStr);
                        return true;
                    }
                    else {
                        return false;
                    }
                });

            const result = await ps.promise;
            return result;
        }
        finally {
            this._getAppSettingsMutex.release();
        }
    }

    private _updateAppSettingsMutex: Mutex = new Mutex();
    async updateAppSettings(settings: any): Promise<void> {
        await this._updateAppSettingsMutex.executeLatestWhileHeldAsync(async () => {
            const ps = new PromiseSource<void>();

            await this.writeToXCHostSocketAndRead(`setAppSettings ${JSON.stringify(settings)}`,
                (cmd, arg) => {
                    if (cmd.toLowerCase() == "updatedappsettings") {
                        ps.tryResolve();
                        return true;
                    }
                    else if (cmd.toLowerCase() == "setappsettingserror") {
                        var errStr = JSON.parse(arg);
                        ps.tryReject(errStr);
                        return true;
                    }
                    else {
                        return false;
                    }
                });

            await ps.promise;
        });
    }

    private _lastAppBadgeAssign: { hasPings: boolean; pingCount: number, hasUnseen: boolean; unseenCount: number } 
        = { hasPings: false, pingCount: 0, hasUnseen: false, unseenCount: 0 };
    get lastAppBadgeAssign() { return this._lastAppBadgeAssign; }

    updateAppBadge(pingCount: number, unseenCount: number): void {
        this._lastAppBadgeAssign = {
            hasPings: pingCount > 0,
            pingCount: pingCount,
            hasUnseen: unseenCount > 0,
            unseenCount: unseenCount
        };
        this.logger.logDebug("updateAppBadge", this._lastAppBadgeAssign);
        this.writeToXCHostSocket("updateAppBadge " + JSON.stringify(this._lastAppBadgeAssign));
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
        this.logger.logDebug("idle - addIdleMonitorRegistration", myIdleMonitorId);

        return asDisposable(() => {
            this.logger.logDebug("idle - removeIdleMonitorRegistration", myIdleMonitorId);
            this.writeToXCHostSocket("removeIdleMonitorRegistration " + JSON.stringify({
                monitorName: myIdleMonitorId
            }));
            this._idleDetectionCallbacks.delete(myIdleMonitorId);
        });
    }

    private handleIdleMonitorUpdate(monitorName: string, userState: IdleDetectionUserState, screenState: IdleDetectionScreenState) {
        this.logger.logDebug("idle - handleIdleMonitorUpdate", monitorName, userState, screenState);
        const cb = this._idleDetectionCallbacks.get(monitorName);
        if (cb) {
            try { cb(userState, screenState); }
            catch { }
        }
    }

    private _windowStateCallbacks: CallbackSet<(windowState: HostWindowState) => void> = new CallbackSet("XarHost2Interop-windowStateCallbacks");

    registerWindowStateChangeCallback(callback: (windowState: HostWindowState) => void): IDisposable {
        return this._windowStateCallbacks.add(callback);
    }

    private _windowBoundsChangeCallbacks: CallbackSet<(loc: RawSavedWindowLocation) => void> = new CallbackSet("XarHost2Interop-windowBoundsChangeCallbacks");

    registerWindowBoundsChangeCallback(callback: (loc: RawSavedWindowLocation) => void): IDisposable {
        return this._windowBoundsChangeCallbacks.add(callback);
    }

    private doWindowBoundsChange(desktopMetrics: string, windowBounds: [number, number, number, number]) {
        this._windowBoundsChangeCallbacks.invoke({
            desktopMetrics: desktopMetrics,
            windowX: windowBounds[0],
            windowY: windowBounds[1],
            windowWidth: windowBounds[2],
            windowHeight: windowBounds[3]
        });
    }

    // private _newAppSettings: NewAppSettings | null = null;

    // getNewAppSettingsAsync(cancellationToken: CancellationToken): Promise<NewAppSettings> {
    //     this._newAppSettings = this._newAppSettings ?? new XarHost2NewAppSettings(this);
    //     const ps = new PromiseSource<NewAppSettings>();
    //     ps.resolve(this._newAppSettings!);
    //     return ps.promise;
    // }

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
        const result = await this.getCssDataXCAsync(url, cancellationToken);
        return result;
    }

    async getSvgDataAsync(path: string, cancellationToken: CancellationToken): Promise<string> {
        const result = await this.getSvgDataXCAsync(path, cancellationToken);
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

    private readonly _svgDataReaders: Map<number, PromiseSource<string>> = new Map();
    private _nextSvgDataReaderId: number = 0;

    private getSvgDataXCAsync(url: string, cancellationToken: CancellationToken): Promise<string> {
        const ps = new PromiseSource<string>();
        const mySvgDataReaderId = this._nextSvgDataReaderId++;
        this._svgDataReaders.set(mySvgDataReaderId, ps);

        this.writeToXCHostSocket("getsvgdata " + JSON.stringify({
            msgid: mySvgDataReaderId,
            url: url
        }));

        return ps.promise;
    }

    private returnSvgDataXC(msgid: number, data: string): void {
        const ps = this._svgDataReaders.get(msgid);
        if (ps) {
            this._svgDataReaders.delete(msgid);
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

    private readonly _configChangeListeners: SnapshottableMap<number, (value: ConfigKeyValue) => void> = new SnapshottableMap();

    registerConfigChangeCallback(callback: (value: ConfigKeyValue) => void): IDisposable {
        const myId = this._nextConfigWaiterId++;
        this._configChangeListeners.set(myId, callback);
        return asDisposable(() => {
            this._configChangeListeners.delete(myId);
        });
    }

    async chooseLocalFileAsync(options?: ChooseLocalFileOptions): Promise<string | null> {
        try {
            const resp = await fetch("/api/localFile/choose", { method: "POST", body: JSON.stringify(options) });
            const respObj = await resp.json() as (string | null);
            return respObj;
        }
        catch (e) {
            return null;
        }
    }

    getLocalFileUrl(fn: string): string {
        return `/api/localFile/getLocalFile?fn=${encodeURIComponent(fn).replaceAll('+', '%20')}`;
    }

    async performWindowCommandAsync(windowId: number | null, args: { cmd: string;[x: string]: any; }): Promise<object> {
        if (windowId == null) {
            const qp = new URLSearchParams(document.location.search);
            windowId = +(qp.get("windowid")!);
        }

        const respObj = await this._windowCommandSession.performWindowCommand(windowId, args, CancellationToken.NONE);
        return respObj;
    }

    readonly canGetEIconDataBlobs: boolean = true;

    async getEIconDataBlob(name: string, cancellationToken: CancellationToken): Promise<Blob> {
        const resp = await this._hostInteropEIconLoader.getEIconAsync(name, cancellationToken);
        if (resp.statusCode >= 400) {
            throw new Error(`failed to fetch eicon, status code ${resp.statusCode}`);
        }

        const dataUrl = `data:${resp.contentType};base64,${resp.data}`;
        const blob = await (await fetch(dataUrl)).blob();
        return blob;
    }

    async submitEIconMetadata(name: string, contentLength: number, etag: string): Promise<void> {
        this.writeToXCHostSocket("submiteiconmetadata " + JSON.stringify({
            name: name,
            contentLength: contentLength,
            etag: etag
        }));
    }

    // async getEIconDataBlob2(name: string, cancellationToken: CancellationToken): Promise<Blob> {
    //     const eiconUrl = URLUtils.getEIconUrl(name);
    //     const fetchResp = await fetch(eiconUrl, {
    //         signal: cancellationToken.signal
    //     });
    //     if (fetchResp.status >= 400) {
    //         throw new Error(`failed to fetch eicon, status code ${fetchResp.status}`);
    //     }
    //     const blob = await fetchResp.blob();
    //     return blob;
    // }
    async setZoomLevel(value: number): Promise<void> {
        this.writeToXCHostSocket("setZoomLevel " + JSON.stringify({
            value: value
        }));
    }

    async getMemoAsync(account: string, getForChar: CharacterName, cancellationToken?: CancellationToken): Promise<string | null> {
        cancellationToken ??= CancellationToken.NONE;
        const ps = new PromiseSource<string | null>();

        await this.writeToXCHostSocketAndRead("getMemo " + JSON.stringify({
            me: account,
            char: getForChar.value
        }),
            (cmd, arg) => {
                if (cmd.toLowerCase() == "gotmemo") {
                    var argObj = JSON.parse(arg);
                    if (argObj.name == getForChar.value) {
                        ps.tryResolve(argObj.note ?? null);
                        return true;
                    }
                    else {
                        return false;
                    }
                }
                else if (cmd.toLowerCase() == "gotmemoerror") {
                    var argObj = JSON.parse(arg);
                    if (argObj.name == getForChar.value) {
                        ps.tryReject(argObj.error);
                        return true;
                    }
                    else {
                        return false;
                    }
                }
                else {
                    return false;
                }
            });

        const result = await ps.promise;
        return result;
    }

    async getAvailableLocales(cancellationToken?: CancellationToken): Promise<HostLocaleInfo[]> {
        cancellationToken ??= CancellationToken.NONE;
        const ps = new PromiseSource<HostLocaleInfo[]>();

        await this.writeToXCHostSocketAndRead("getLocales",
            (cmd, arg) => {
                if (cmd.toLowerCase() == "gotlocales") {
                    var argObj = JSON.parse(arg);
                    if (argObj.locales) {
                        ps.tryResolve(argObj.locales);
                        return true;
                    }
                    else {
                        return false;
                    }
                }
                else if (cmd.toLowerCase() == "gotlocaleserror") {
                    var argObj = JSON.parse(arg);
                    if (argObj.error) {
                        ps.tryReject(argObj.error);
                        return true;
                    }
                    else {
                        return false;
                    }
                }
                else {
                    return false;
                }
            });

        const result = await ps.promise;
        return result;
    }

    flashWindow() {
        this.writeToXCHostSocket("flashWindow");
    }

    createChatWebSocket(): ChatWebSocket {
        let url = new URL(`wss://${document.location.host}/api/chatSocket`);
        const sp = new URLSearchParams(document.location.search);
        if (sp.has("wsport")) {
            if (url.hostname == "localhost") {
                url.port = sp.get("wsport")!;
            }
        }
        const ws = new WebSocket(url.href);
        return ws;
    }
}
