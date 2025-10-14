import { ConfigSchema, ConfigSchemaScopeType, getConfigSchemaItemById } from "../configuration/ConfigSchemaItem.js";
import { FListApi } from "../fchat/api/FListApi.js";
import { HostInteropApi } from "../fchat/api/HostInteropApi.js";
import { AppSettings } from "../settings/AppSettings.js";
import { RawSavedWindowLocation } from "../settings/RawAppSettings.js";
import { ChannelName } from "../shared/ChannelName.js";
import { CharacterName } from "../shared/CharacterName.js";
import { ConfigBlock } from "../util/ConfigBlock.js";
import { IDisposable } from "../util/Disposable.js";
import { HostInterop, HostWindowState } from "../util/HostInterop.js";
import { IdleDetection, IdleDetectionScreenState, IdleDetectionUserState } from "../util/IdleDetection.js";
import { Observable, ObservableValue, PropertyChangeEvent } from "../util/Observable.js";
import { ObservableBase, observableProperty } from "../util/ObservableBase.js";
import { Collection, CollectionChangeEvent, CollectionChangeType } from "../util/ObservableCollection.js";
import { ObservableExpression } from "../util/ObservableExpression.js";
import { PromiseSource } from "../util/PromiseSource.js";
import { StringUtils } from "../util/StringUtils.js";
import { URLUtils } from "../util/URLUtils.js";
import { UpdateCheckerClient, UpdateCheckerState } from "../util/UpdateCheckerClient.js";
import { BBCodeClickContext, BBCodeParseSink } from "../util/bbcode/BBCode.js";
import { StdObservableCollectionChangeType } from "../util/collections/ReadOnlyStdObservableCollection.js";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel.js";
import { ChannelViewModel } from "./ChannelViewModel.js";
import { ChatChannelUserViewModel, ChatChannelViewModel } from "./ChatChannelViewModel.js";
import { ColorThemeViewModel } from "./ColorThemeViewModel.js";
import { DateFormatSpecifier, LocaleViewModel, TimeFormatSpecifier } from "./LocaleViewModel.js";
import { PMConvoChannelViewModel } from "./PMConvoChannelViewModel.js";
import { AboutViewModel } from "./dialogs/AboutViewModel.js";
import { AlertOptions, AlertViewModel } from "./dialogs/AlertViewModel.js";
import { AppInitializeViewModel } from "./dialogs/AppInitializeViewModel.js";
import { DialogViewModel } from "./dialogs/DialogViewModel.js";
import { PromptForStringOptions, PromptForStringViewModel, PromptOptions, PromptViewModel } from "./dialogs/PromptViewModel.js";
import { SettingsDialogViewModel } from "./dialogs/SettingsDialogViewModel.js";
import { ContextMenuPopupViewModel } from "./popups/ContextMenuPopupViewModel.js";
import { PopupViewModel } from "./popups/PopupViewModel.js";
import { TooltipPopupViewModel } from "./popups/TooltipPopupViewModel.js";
import { UIZoomNotifyPopupViewModel } from "./popups/UIZoomNotifyPopupViewModel.js";

export class AppViewModel extends ObservableBase {
    constructor(configBlock: ConfigBlock) {
        super();

        this.configBlock = configBlock;
        this.colorTheme = new ColorThemeViewModel(this);

        this.bbcodeParseSink = new AppViewModelBBCodeSink(this);

        //this.flistApi = new FListApiImpl();
        this.flistApi = new HostInteropApi();

        const loginPingUnseenChange = (ev: PropertyChangeEvent) => {
            if (ev.propertyName == "hasPings" || ev.propertyName == "hasUnseenMessages") {
                this.refreshPingMentionCount();
            }
        };
        this.logins.addCollectionObserver(entries => {
            for (let entry of entries) {
                switch (entry.changeType) {
                    case StdObservableCollectionChangeType.ITEM_ADDED:
                        entry.item.addEventListener("propertychange", loginPingUnseenChange);
                        this.refreshPingMentionCount();
                        break;
                    case StdObservableCollectionChangeType.ITEM_REMOVED:
                        entry.item.removeEventListener("propertychange", loginPingUnseenChange);
                        this.refreshPingMentionCount();
                        if (entry.item == this.currentlySelectedSession) {
                            this.currentlySelectedSession = this.logins[0] ?? null;
                        }
                        entry.item.dispose();
                        break;
                    case StdObservableCollectionChangeType.CLEARED:
                        break;
                }
            }
            if (this.logins.length == 0) {
                const initializeVM = new AppInitializeViewModel(this);
                const dlgShowPromise = this.showDialogAsync(initializeVM);
                initializeVM.runAsync(false);
            }
        });

        this.addEventListener("propertychange", (ev) => {
            if (ev.propertyName == "hasPings" || ev.propertyName == "hasUnseenMessages") {
                HostInterop.updateAppBadge(this.hasPings, this.hasUnseenMessages);
            }
            else if (ev.propertyName == "userState" || ev.propertyName == "screenState") {
                for (let login of this.logins.iterateValues()) {
                    login.idleStateChanged();
                }
            }
        });
        this.configBlock.observe("global.autoIdle", v => {
            this.updateAutoIdleSettings();
        });
        this.configBlock.observe("global.autoAway", v => {
            this.updateAutoIdleSettings();
        });
        this.configBlock.observe("global.idleAfterMinutes", v => {
            this.updateAutoIdleSettings();
        });
        this.updateAutoIdleSettings();

        this.appWindowState = HostInterop.windowState;
        HostInterop.registerWindowStateChangeCallback((winState) => {
            this.appWindowState = winState;
        });

        (async () => {
            this._updateCheckerClient = await UpdateCheckerClient.createAsync(state => {
                this.updateCheckerState = state;
            });
        })();

        this.setupLocaleMonitoring();
    }

    isInStartup: boolean = true;

    readonly colorTheme: ColorThemeViewModel;

    readonly bbcodeParseSink: BBCodeParseSink;

    private _updateCheckerClient: UpdateCheckerClient | null = null;

    @observableProperty
    updateCheckerState: UpdateCheckerState = UpdateCheckerState.Unknown;

    async relaunchToApplyUpdateAsync() {
        await HostInterop.relaunchToApplyUpdateAsync();
    }

    @observableProperty
    initialized: boolean = false;

    @observableProperty
    statusMessage: string | null = null;

    zoomNotifyPopup: UIZoomNotifyPopupViewModel | null = null;

    get interfaceZoom(): number { return +(this.configBlock.get("uiZoom") ?? 1); }
    set interfaceZoom(value: number) {
        value = Math.round(value * 100) / 100;
        if (value != this.interfaceZoom) {
            this.configBlock.set("uiZoom", value);

            if (this.zoomNotifyPopup == null) {
                this.zoomNotifyPopup = new UIZoomNotifyPopupViewModel(this);    
                this.zoomNotifyPopup.show();
            }
            this.zoomNotifyPopup.message = `Zoom level changed to ${Math.round(value * 100)}%`;
        }
    }

    readonly configBlock: ConfigBlock;

    flistApi: FListApi;

    private _appSettings!: AppSettings;
    get appSettings() { return this._appSettings; }
    set appSettings(value) {
        this._appSettings = value;
    }

    @observableProperty
    appWindowState: HostWindowState;

    @observableProperty
    locale: LocaleViewModel = LocaleViewModel.default;

    setupLocaleMonitoring(): IDisposable {
        const setDefaultLocale = () => {
            this.locale = LocaleViewModel.default;
        };

        const oe = new ObservableExpression(
            () => [ this.configBlock.get("global.locale.dateFormat"), this.configBlock.get("global.locale.timeFormat") ],
            (v) => {
                if (v) {
                    const dateFormat = v[0];
                    const timeFormat = v[1];

                    let dateFormatFunc: (d: Date, format: DateFormatSpecifier) => string;
                    let timeFormatFunc: (d: Date, format: TimeFormatSpecifier) => string;

                    switch (dateFormat) {
                        case "mdyyyy":
                            dateFormatFunc = (d: Date, format: DateFormatSpecifier) => {
                                const mm = d.getMonth() + 1;
                                const dd = d.getDate();
                                const yy = d.getFullYear();
                                return `${mm}/${dd}/${yy}`;
                            };
                            break;
                        case "mmddyyyy":
                            dateFormatFunc = (d: Date, format: DateFormatSpecifier) => {
                                const mm = StringUtils.makeTwoDigitString(d.getMonth() + 1);
                                const dd = StringUtils.makeTwoDigitString(d.getDate());
                                const yy = d.getFullYear();
                                return `${mm}/${dd}/${yy}`;
                            };
                            break;
                        case "dmyyyy":
                            dateFormatFunc = (d: Date, format: DateFormatSpecifier) => {
                                const mm = d.getMonth() + 1;
                                const dd = d.getDate();
                                const yy = d.getFullYear();
                                return `${dd}/${mm}/${yy}`;
                            };
                            break;
                        case "ddmmyyyy":
                            dateFormatFunc = (d: Date, format: DateFormatSpecifier) => {
                                const mm = StringUtils.makeTwoDigitString(d.getMonth() + 1);
                                const dd = StringUtils.makeTwoDigitString(d.getDate());
                                const yy = d.getFullYear();
                                return `${dd}/${mm}/${yy}`;
                            };
                            break;
                        case "yyyymmdd":
                            dateFormatFunc = (d: Date, format: DateFormatSpecifier) => {
                                const mm = StringUtils.makeTwoDigitString(d.getMonth() + 1);
                                const dd = StringUtils.makeTwoDigitString(d.getDate());
                                const yy = d.getFullYear();
                                return `${yy}/${mm}/${dd}`;
                            };
                            break;
                        default:
                        case "default":
                            dateFormatFunc = LocaleViewModel.defaultConvertDate;
                            break;
                    }

                    switch (timeFormat) {
                        case "12h":
                            timeFormatFunc = (d: Date, format: TimeFormatSpecifier) => {
                                return new Intl.DateTimeFormat(undefined, { timeStyle: format, hourCycle: "h12" }).format(d);
                            };
                            break;
                        case "24h":
                            timeFormatFunc = (d: Date, format: TimeFormatSpecifier) => {
                                return new Intl.DateTimeFormat(undefined, { timeStyle: format, hourCycle: "h23" }).format(d);
                            };
                            break;
                        default:
                        case "default":
                            timeFormatFunc = LocaleViewModel.defaultConvertTime;
                            break;
                    }

                    this.locale = new LocaleViewModel({ convertDate: dateFormatFunc, convertTime: timeFormatFunc });
                }
                else {
                    setDefaultLocale();
                }
            },
            (err) => {
                setDefaultLocale();
            }
        );
        return oe;
    }

    @observableProperty
    get showTitlebar(): boolean {
        const sp = new URLSearchParams(document.location.search);
        if (sp.get("ClientPlatform") == "linux-x64") {
            return false;
        }
        return true;
    }

    @observableProperty
    get windowTitle(): string { return (this.configBlock.get("AppTitle") ?? "XarChat").toString(); }

    @observableProperty
    readonly dialogs: Collection<DialogViewModel<any>> = new Collection();

    @observableProperty
    readonly popups: Collection<PopupViewModel> = new Collection();

    @observableProperty
    leftBarWidth: number = 255;

    @observableProperty
    readonly logins: Collection<ActiveLoginViewModel> = new Collection<ActiveLoginViewModel>();

    private _currentlySelectedSession: (ActiveLoginViewModel | null) = null;
    @observableProperty
    get currentlySelectedSession() { return this._currentlySelectedSession; }
    set currentlySelectedSession(value) {
        if (value !== this._currentlySelectedSession) {
            if (this._currentlySelectedSession) {
                this._currentlySelectedSession.isSelectedSession = false;
                this._currentlySelectedSession.isActiveSession = false;
            }
            this._currentlySelectedSession = value;
            if (this._currentlySelectedSession) {
                this._currentlySelectedSession.isSelectedSession = true;
                this._currentlySelectedSession.isActiveSession = this.isWindowActive;
            }
        }
    }

    private _isWindowActive: ObservableValue<boolean> = new ObservableValue<boolean>(true);
    get isWindowActive() { return this._isWindowActive.value; }
    set isWindowActive(value) {
        if (value !== this._isWindowActive.value) {
            //this.logger.logDebug("isWindowActive", value);
            this._isWindowActive.value = value;
            if (this.currentlySelectedSession) {
                this.currentlySelectedSession.isActiveSession = this.isWindowActive;
            }
        }
    }

    collapseAds: boolean = true;
    collapseHeight: number = 40;

    @observableProperty
    hasPings: boolean = false;

    @observableProperty
    hasUnseenMessages: boolean = false;

    private refreshPingMentionCount() {
        let newPings = false;
        let newUnseen = false;
        for (let login of this.logins) {
            newPings = newPings || login.hasPings;
            newUnseen = newUnseen || login.hasUnseenMessages;
        }
        this.hasPings = newPings;
        this.hasUnseenMessages = newUnseen;
    }

    flashTooltipAsync(message: string, contextElement: HTMLElement, clientX: number, clientY: number) {
        const ttvm = new TooltipPopupViewModel(this, contextElement);
        ttvm.mousePoint = { x: clientX, y: clientY };
        ttvm.text = message;
        ttvm.flashDisplay = true;
        this.popups.push(ttvm);
    }

    alertAsync(message: string, title?: string, options?: Partial<AlertOptions>): Promise<void> {
        return this.showDialogAsync(new AlertViewModel(this, message, title, options));
    }

    promptAsync<TResult>(options: PromptOptions<TResult>): Promise<TResult> {
        const vm = new PromptViewModel(this, options);
        return this.showDialogAsync(vm);
    }

    promptForStringAsync(options: PromptForStringOptions): Promise<string | null> {
        const vm = new PromptForStringViewModel(this, options);
        return this.showDialogAsync(vm);
    }

    async launchUrlAsync(url: string, forceExternal?: boolean): Promise<void> {
        try {
            const canLaunchInternally = !!this.getConfigSettingById("launchImagesInternally");
            forceExternal = (forceExternal ?? false) || (!canLaunchInternally);

            await HostInterop.launchUrl(this, url, forceExternal ?? false);
        }
        catch { }
    }

    @observableProperty
    get noGpuMode() {
        const p = new URLSearchParams(document.location.search);
        return (p.get("nogpu") == "1");
    }

    async launchUpdateUrlAsync(): Promise<void> {
        const p = new URLSearchParams(document.location.search);
        const ver = encodeURIComponent(p.get("ClientVersion")!);
        const platform = encodeURIComponent(p.get("ClientPlatform")!);
        const branch = encodeURIComponent(p.get("ClientBranch")!);
        await this.launchUrlAsync(`https://xariah.net/XarChat/DownloadUpdate?v=${ver}&p=${platform}&b=${branch}`, true);
    }

    showDialogAsync<TResult>(dialog: DialogViewModel<TResult>): Promise<TResult> {
        return new Promise(resolve => {
            dialog.addCloseListener(() => {
                this.dialogs.remove(dialog);
                resolve(dialog.dialogResult);
            });
            for (let p of [...this.popups.iterateValues()]) {
                p.dismissed();
            }
            dialog.onShowing();
            this.dialogs.push(dialog);
        });
    }

    applicationWindowMoved(data: RawSavedWindowLocation) {
        if (!this.appSettings) return;

        let swl = this.appSettings.savedWindowLocations.get(data.desktopMetrics);
        if (!swl) {
            this.appSettings.savedWindowLocations.add(data);
        }
        else {
            swl.updateFromObject(data);
        }
    }

    private _idleDetection: IdleDetection | null = null;
    private _idleAfterAssign: object | null = null;
    private _idleAfterSec: number | null = null;

    @observableProperty
    userState: IdleDetectionUserState = "active";

    @observableProperty
    screenState: IdleDetectionScreenState = "unlocked";

    private get idleAfterSec() { return this._idleAfterSec; }
    private set idleAfterSec(value: number | null) {
        if (value != this._idleAfterSec) {
            const thisIdleAssign = {};
            this._idleAfterAssign = thisIdleAssign;

            if (this._idleDetection) {
                this._idleDetection.dispose();
                this._idleDetection = null;
            }

            this._idleAfterSec = value;
            if (this._appSettings) {
                this._appSettings.autoIdleSec = value;
            }

            this.logger.logDebug("idleAfterSec set", value);
            if (value != null && value > 0) {
                (async () => {
                    const id = await IdleDetection.createAsync(value, (userState, screenState) => {
                        if (this._idleAfterAssign == thisIdleAssign) {
                            this.logger.logDebug("idledetect", userState, screenState);
                            this.userState = userState;
                            this.screenState = screenState;
                        }    
                    });
                    if (this._idleAfterAssign == thisIdleAssign) {
                        this._idleDetection = id;
                    }
                    else {
                        id.dispose();
                    }
                })();
            }
            else {
                this.userState = "active";
                this.screenState = "unlocked";
            }
        }
    }

    private updateAutoIdleSettings() {
        const autoIdleEnabled = !!this.configBlock.get("global.autoIdle") || !!this.configBlock.get("global.autoAway");
        const autoIdleSec = autoIdleEnabled 
            ? Math.round((+(this.configBlock.get("global.idleAfterMinutes") ?? 10)) * 60)
            : null;
        this.idleAfterSec = autoIdleSec;
    }

    async showSettingsDialogAsync(activeLoginViewModel?: ActiveLoginViewModel, interlocutor?: CharacterName) {
        const dlg = new SettingsDialogViewModel(this, activeLoginViewModel, undefined, interlocutor);
        await this.showDialogAsync(dlg);
    }

    async showSettingsDialogForChannelAsync(activeLoginViewModel: ActiveLoginViewModel, channel: ChannelViewModel) {
        const dlg = new SettingsDialogViewModel(this, activeLoginViewModel, channel);
        await this.showDialogAsync(dlg);
    }

    async showAboutDialogAsync() {
        const dlg = new AboutViewModel(this);
        await this.showDialogAsync(dlg);
    }

    getMainContextMenuItems(ctxVm: ContextMenuPopupViewModel<() => void>, activeLoginViewModel?: ActiveLoginViewModel) {
        ctxVm.addMenuItem("About XarChat...", () => {
            this.showAboutDialogAsync();
        });
        ctxVm.addMenuItem("Settings...", () => {
            this.showSettingsDialogAsync(activeLoginViewModel);
        });
        ctxVm.addSeparator();
    }

    getConfigSettingById(configSettingId: string, alvm?: { characterName: CharacterName } | null, channel?: GetConfigSettingChannelViewModel | null) {
        const settingSchema = getConfigSchemaItemById(configSettingId);
        if (settingSchema) {
            const result = this.getConfigEntryHierarchical(settingSchema.configBlockKey, alvm, channel);
            return result ?? settingSchema.defaultValue;
        }
        else {
            return null;
        }
    }

    setConfigSettingById(configSettingId: string, newValue: any, alvm?: { characterName: CharacterName } | null, channel?: GetConfigSettingChannelViewModel | null) {
        const settingSchema = getConfigSchemaItemById(configSettingId);
        if (settingSchema) {
            const settingScopes = new Set<ConfigSchemaScopeType>();
            if (settingSchema.scope) {
                settingSchema.scope.forEach(s => {
                    settingScopes.add(s);
                });
            }

            if (alvm != null) {
                if (channel instanceof ChatChannelViewModel) {
                    if (settingScopes.has("char.chan")) {
                        const settingKey = `character.${alvm.characterName.canonicalValue}.channel.${channel.name.canonicalValue}.${settingSchema.configBlockKey}`;
                        this.configBlock.set(settingKey, newValue);
                        return;
                    }
                }

                if (settingScopes.has("char")) {
                    const settingKey = `character.${alvm.characterName.canonicalValue}.any.${settingSchema.configBlockKey}`;
                    this.configBlock.set(settingKey, newValue);
                    return;
                }
            }
            
            if (settingScopes.has("global")) {
                const settingKey = `global.${settingSchema.configBlockKey}`;
                this.configBlock.set(settingKey, newValue);
                return;
            }
        }
    }

    getConfigEntryHierarchical(key: string, alvm?: { characterName: CharacterName } | null, channel?: GetConfigSettingChannelViewModel | null) {
        return this.getFirstConfigEntryHierarchical([key], alvm, channel);
    }

    getFirstConfigEntryHierarchical(keys: string[], alvm?: { characterName: CharacterName } | null, channel?: GetConfigSettingChannelViewModel | null): (unknown | null) {
        const k: string[] = [];
        if (alvm != null) {
            if (channel != null) {
                const getChannelTitle = () => {
                    if (channel instanceof ChatChannelViewModel) { return channel.title; }
                    if (typeof (channel as any).channelTitle == "string") { return (channel as any).channelTitle as string; }
                    return null;
                };
                const getChannelCategory = () => {
                    if (channel instanceof ChatChannelViewModel) { return channel.channelCategory; }
                    if (typeof (channel as any).channelCategory == "string") { return (channel as any).channelCategory as string; }
                    return null;
                };
                const getCharName = () => {
                    if (channel instanceof PMConvoChannelViewModel) { return channel.character; }
                    if ((channel as any).characterName) { return (channel as any).characterName; }
                    return null;
                };

                const channelTitle = getChannelTitle();
                const channelCategory = getChannelCategory();
                const charName = getCharName();

                if (channelTitle) {
                    for (let key of keys) {
                        k.push(`character.${alvm.characterName.canonicalValue}.channel.${channelTitle.toLowerCase()}.${key}`);
                    }
                }
                if (channelCategory) {
                    for (let key of keys) {
                        k.push(`character.${alvm.characterName.canonicalValue}.channelcategory.${channelCategory.toLowerCase()}.${key}`);
                    }
                }
                if (charName) {
                    for (let key of keys) {
                        k.push(`character.${alvm.characterName.canonicalValue}.pm.${charName.canonicalValue}.${key}`);
                    }
                }
            }
            for (let key of keys) {
                k.push(`character.${alvm.characterName.canonicalValue}.any.${key}`);
            }    
        }
        for (let key of keys) {
            k.push(`global.${key}`);
        }
        return this.configBlock.getFirst(k);
    }

    private readonly _audioCache: Map<string, HTMLAudioElement> = new Map();

    private _currentNotificationAudio: HTMLAudioElement | null = null;
    soundNotification(event: AppNotifyEvent) {
        let fn: string | null = null;

        fn = this.getConfigEntryHierarchical(`sound.event.${event.eventType.toString()}`, event.activeLoginViewModel, event.channel) as (string | null);

        if (this.getConfigSettingById("flashTaskbarButton") ?? true) {
            let shouldFlashWindow: boolean;
            switch (event.eventType) {
                case AppNotifyEventType.CONNECTED:
                case AppNotifyEventType.DISCONNECTED:
                    shouldFlashWindow = false;
                    break;
                case AppNotifyEventType.HIGHLIGHT_MESSAGE_RECEIVED:
                case AppNotifyEventType.PRIVATE_MESSAGE_RECEIVED:
                    shouldFlashWindow = true;
                    break;
            }
            if (shouldFlashWindow) {
                HostInterop.flashWindow();
            }
        }

        if (fn == null || fn == "default:")
        {
            switch (event.eventType) {
                case AppNotifyEventType.CONNECTED:
                    fn = "default_connect.mp3";
                    break;
                case AppNotifyEventType.DISCONNECTED:
                    fn = "default_disconnect.mp3";
                    break;
                case AppNotifyEventType.HIGHLIGHT_MESSAGE_RECEIVED:
                    fn = "default_highlightrecv.mp3";
                    break;
                case AppNotifyEventType.PRIVATE_MESSAGE_RECEIVED:
                default:
                    fn = "default_pmrecv.mp3";
                    break;
            }
            fn = `assets/sfx/${fn}`;
        }
        else if (fn == "none:") {
            fn = "";
        }
        else if (fn.startsWith("file:")) {
            fn = HostInterop.getLocalFileUrl(fn.substring(5));
        }

        if (fn && fn != "") {
            if (this._currentNotificationAudio != null) {
                this._currentNotificationAudio.pause();
                this._currentNotificationAudio.currentTime = 0;
                this._currentNotificationAudio = null;
            }
    
            let n = this._audioCache.get(fn);
            if (!n) {
                n = new Audio(fn);
                this._audioCache.set(fn, n);
            }
            this._currentNotificationAudio = n;
            n.play().then(
                () => {},
                (e) => {}
            );
        }
    }
}

export type GetConfigSettingChannelViewModel = 
    ChannelViewModel | 
    { channelTitle: string, channelCategory: string } |
    { characterName: CharacterName };

export enum AppNotifyEventType {
    CONNECTED = "connect",
    DISCONNECTED = "disconnect",
    PRIVATE_MESSAGE_RECEIVED = "pm",
    HIGHLIGHT_MESSAGE_RECEIVED = "ping"
}

export interface AppNotifyEvent {
    eventType: AppNotifyEventType,
    activeLoginViewModel: ActiveLoginViewModel,
    channel?: ChannelViewModel
}

export class AppViewModelBBCodeSink implements BBCodeParseSink {
    constructor(
        protected readonly appViewModel: AppViewModel) {
    }

    userClick(name: CharacterName, context: BBCodeClickContext) {
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
    }
}