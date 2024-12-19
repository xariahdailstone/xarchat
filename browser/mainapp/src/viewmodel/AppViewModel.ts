import { ConfigSchema, getConfigSchemaItemById } from "../configuration/ConfigSchemaItem.js";
import { FListApi } from "../fchat/api/FListApi.js";
import { HostInteropApi } from "../fchat/api/HostInteropApi.js";
import { AppSettings, RawSavedWindowLocation } from "../settings/AppSettings.js";
import { ChannelName } from "../shared/ChannelName.js";
import { CharacterName } from "../shared/CharacterName.js";
import { ConfigBlock } from "../util/ConfigBlock.js";
import { HostInterop, HostWindowState } from "../util/HostInterop.js";
import { IdleDetection, IdleDetectionScreenState, IdleDetectionUserState } from "../util/IdleDetection.js";
import { Observable, ObservableValue, PropertyChangeEvent } from "../util/Observable.js";
import { ObservableBase, observableProperty } from "../util/ObservableBase.js";
import { Collection, CollectionChangeEvent, CollectionChangeType } from "../util/ObservableCollection.js";
import { PromiseSource } from "../util/PromiseSource.js";
import { UpdateCheckerClient, UpdateCheckerState } from "../util/UpdateCheckerClient.js";
import { StdObservableCollectionChangeType } from "../util/collections/ReadOnlyStdObservableCollection.js";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel.js";
import { ChannelViewModel } from "./ChannelViewModel.js";
import { ChatChannelUserViewModel, ChatChannelViewModel } from "./ChatChannelViewModel.js";
import { ColorThemeViewModel } from "./ColorThemeViewModel.js";
import { PMConvoChannelViewModel } from "./PMConvoChannelViewModel.js";
import { AlertOptions, AlertViewModel } from "./dialogs/AlertViewModel.js";
import { AppInitializeViewModel } from "./dialogs/AppInitializeViewModel.js";
import { DialogViewModel } from "./dialogs/DialogViewModel.js";
import { PromptOptions, PromptViewModel } from "./dialogs/PromptViewModel.js";
import { SettingsDialogViewModel } from "./dialogs/SettingsDialogViewModel.js";
import { ContextMenuPopupViewModel } from "./popups/ContextMenuPopupViewModel.js";
import { PopupViewModel } from "./popups/PopupViewModel.js";

export class AppViewModel extends ObservableBase {
    constructor(configBlock: ConfigBlock) {
        super();

        this.configBlock = configBlock;
        this.colorTheme = new ColorThemeViewModel(this);

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

        this.appWindowState = HostInterop.windowState;
        HostInterop.registerWindowStateChangeCallback((winState) => {
            this.appWindowState = winState;
        });

        (async () => {
            this._updateCheckerClient = await UpdateCheckerClient.createAsync(state => {
                this.updateCheckerState = state;
            });
        })();
    }

    readonly colorTheme: ColorThemeViewModel;

    private _updateCheckerClient: UpdateCheckerClient | null = null;

    @observableProperty
    updateCheckerState: UpdateCheckerState = UpdateCheckerState.Unknown;

    async relaunchToApplyUpdateAsync() {
        await HostInterop.relaunchToApplyUpdateAsync();
    }

    @observableProperty
    initialized: boolean = false;

    readonly configBlock: ConfigBlock;

    flistApi: FListApi;

    private _appSettings!: AppSettings;
    get appSettings() { return this._appSettings; }
    set appSettings(value) {
        this._appSettings = value;
        this.idleAfterSec = value.autoIdleSec ?? null;
    }

    @observableProperty
    appWindowState: HostWindowState;

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
            //console.log("isWindowActive", value);
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

    alertAsync(message: string, title?: string, options?: Partial<AlertOptions>): Promise<void> {
        return this.showDialogAsync(new AlertViewModel(this, message, title, options));
    }

    promptAsync<TResult>(options: PromptOptions<TResult>): Promise<TResult> {
        const vm = new PromptViewModel(this, options);
        return this.showDialogAsync(vm);
    }

    async launchUrlAsync(url: string, forceExternal?: boolean): Promise<void> {
        try {
            await HostInterop.launchUrl(this, url, forceExternal ?? false);
        }
        catch { }
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

    @observableProperty
    get idleAfterSec() { return this._idleAfterSec; }
    set idleAfterSec(value: number | null) {
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

            if (value != null && value > 0) {
                (async () => {
                    const id = await IdleDetection.createAsync(value, (userState, screenState) => {
                        if (this._idleAfterAssign == thisIdleAssign) {
                            console.log("idledetect", userState, screenState);
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

    getMainContextMenuItems(ctxVm: ContextMenuPopupViewModel<() => void>, activeLoginViewModel?: ActiveLoginViewModel) {
        ctxVm.addMenuItem("Settings", () => {
            const dlg = new SettingsDialogViewModel(this, activeLoginViewModel);
            this.showDialogAsync(dlg);
        });
        ctxVm.addSeparator();
    }

    getConfigSettingById(configSettingId: string, alvm?: { characterName: CharacterName }, channel?: ChannelViewModel) {
        const settingSchema = getConfigSchemaItemById(configSettingId);
        if (settingSchema) {
            const result = this.getConfigEntryHierarchical(settingSchema.configBlockKey, alvm, channel);
            return result ?? settingSchema.defaultValue;
        }
        else {
            return null;
        }
    }

    getConfigEntryHierarchical(key: string, alvm?: { characterName: CharacterName }, channel?: ChannelViewModel) {
        return this.getFirstConfigEntryHierarchical([key], alvm, channel);
    }

    getFirstConfigEntryHierarchical(keys: string[], alvm?: { characterName: CharacterName }, channel?: ChannelViewModel): (unknown | null) {
        const k: string[] = [];
        if (alvm != null) {
            if (channel != null) {
                if (channel instanceof ChatChannelViewModel) {
                    for (let key of keys) {
                        k.push(`character.${alvm.characterName.canonicalValue}.channel.${channel.name.canonicalValue}.${key}`);
                    }
                }
                else if (channel instanceof PMConvoChannelViewModel) {
                    for (let key of keys) {
                        k.push(`character.${alvm.characterName.canonicalValue}.channel.${channel.character.canonicalValue}.${key}`);
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

    soundNotification(event: AppNotifyEvent) {
        let fn: string | null = null;

        fn = this.getConfigEntryHierarchical(`sound.event.${event.eventType.toString()}`, event.activeLoginViewModel, event.channel) as (string | null);

        if (fn == null)
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

        if (fn && fn != "") {
            let n = this._audioCache.get(fn);
            if (!n) {
                n = new Audio(fn);
                this._audioCache.set(fn, n);
            }
            n.play();
        }
    }
}

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