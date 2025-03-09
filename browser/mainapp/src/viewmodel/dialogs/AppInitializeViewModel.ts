import { AppSettings } from "../../settings/AppSettings";
import { CharacterName } from "../../shared/CharacterName";
import { CancellationToken, CancellationTokenSource } from "../../util/CancellationTokenSource";
import { CatchUtils } from "../../util/CatchUtils";
import { HostInteropConfigBlock } from "../../util/ConfigBlock";
import { HostInterop } from "../../util/HostInterop";
import { LoginUtils } from "../../util/LoginUtils";
import { observableProperty } from "../../util/ObservableBase";
import { AwaitableObservableExpression } from "../../util/ObservableExpression";
import { OperationCancelledError } from "../../util/PromiseSource";
import { UpdateCheckerState } from "../../util/UpdateCheckerClient";
import { AppViewModel } from "../AppViewModel";
import { DialogButtonStyle, DialogViewModel } from "./DialogViewModel";
import { LoginViewModel } from "./LoginViewModel";

export class AppInitializeViewModel extends DialogViewModel<void> {
    constructor(parent: AppViewModel) {
        super(parent);
    }

    @observableProperty
    action: string = "";

    @observableProperty
    cancelButtonText: string | null = null;

    private _onCancel: (() => void) | null = null;

    cancel() {
        if (this._onCancel) {
            this._onCancel();
        }
    }

    async runAsync(initialShow: boolean) {
        try {
            if (initialShow) {
                this.action = "Reading settings...";
                await AppSettings.initializeAsync();
                this.parent.appSettings = AppSettings.instance;

                HostInterop.appReady();

                // check for updates
                {
                    using updateCheckerStateExpr = new AwaitableObservableExpression(() => this.parent.updateCheckerState);

                    const updateCheckCTS = new CancellationTokenSource();
                    this._onCancel = () => updateCheckCTS.cancel();
                    this.cancelButtonText = "Skip";

                    let exitLoop = false;
                    while (!exitLoop) {
                        try {
                            const updateCheckerState = await updateCheckerStateExpr.waitForChange(updateCheckCTS.token);
                            this.logger.logDebug(`updateCheckerState = ${updateCheckerState}`);
                            switch (updateCheckerState) {
                                default:
                                case UpdateCheckerState.NoUpdatesAvailable:
                                    exitLoop = true;
                                    break;
                                case UpdateCheckerState.Unknown:
                                case UpdateCheckerState.CheckingForUpdates:
                                    exitLoop = false;
                                    this.action = "Checking for updates...";
                                    break;
                                case UpdateCheckerState.DownloadingUpdate:
                                case UpdateCheckerState.DownloadingUpdateMustUpdate:
                                    exitLoop = false;
                                    this.action = "Downloading update...";
                                    break;
                                case UpdateCheckerState.UpdateReady:
                                case UpdateCheckerState.UpdateReadyMustUpdate:
                                    this.action = "Restarting to apply update...";
                                    await this.parent.relaunchToApplyUpdateAsync();
                                    HostInterop.closeWindow();
                                    throw new OperationCancelledError("Relaunching to apply update");
                                    break;
                                case UpdateCheckerState.UpdateAvailable:
                                    {
                                        const goToDownloadPage =
                                            await this.parent.promptAsync<boolean>({
                                                    title: "Update Available",
                                                    message: "An update for XarChat is available.  Click OK to go to the download page, " +
                                                        "or Cancel to continue without updating.",
                                                    messageAsHtml: false,
                                                    buttons: [
                                                        {
                                                            title: "OK",
                                                            resultValue: true,
                                                            style: DialogButtonStyle.DEFAULT
                                                        },
                                                        {
                                                            title: "Cancel",
                                                            resultValue: false,
                                                            style: DialogButtonStyle.CANCEL
                                                        }
                                                    ]
                                                }
                                            );
                                        if (goToDownloadPage) {
                                            await this.launchUpdateUrlAsync();
                                            HostInterop.closeWindow();
                                            throw new Error("opted for update");
                                        }
                                        exitLoop = true;
                                    }
                                    break;
                                case UpdateCheckerState.UpdateAvailableRequired:
                                    {
                                        const goToDownloadPage =
                                            await this.parent.promptAsync<boolean>({
                                                    title: "Required Update Available",
                                                    message: "A required update for XarChat is available. " +
                                                        "Click OK to go to the download page, or Cancel to exit.",
                                                    messageAsHtml: false,
                                                    buttons: [
                                                        {
                                                            title: "OK",
                                                            resultValue: true,
                                                            style: DialogButtonStyle.DEFAULT
                                                        },
                                                        {
                                                            title: "Cancel",
                                                            resultValue: false,
                                                            style: DialogButtonStyle.CANCEL
                                                        }
                                                    ]
                                                }
                                            );
                                        if (goToDownloadPage) {
                                            await this.launchUpdateUrlAsync();
                                        }
                                        HostInterop.closeWindow();
                                        throw new Error("required update");
                                    }
                                    break;
                            }
                        }
                        catch (e) {
                            if (updateCheckCTS.isCancellationRequested) {
                                exitLoop = true;
                            }
                            else {
                                throw e;
                            }
                        }
                    }
                }

                // TODO: restore saved connections
                const restoreSavedCTS = new CancellationTokenSource();
                this._onCancel = () => restoreSavedCTS.cancel();
                this.cancelButtonText = null;

                const appSettings = AppSettings.instance;
                let shownConnecting = false;
                for (let savedLoginAccount of appSettings.savedLogins) {
                    if (!shownConnecting) {
                        this.action = "Connecting to F-Chat...";
                        this.cancelButtonText = "Cancel";
                        shownConnecting = true;
                    }
                    const creds = appSettings.savedAccountCredentials.get(savedLoginAccount.account);
                    if (creds && creds.password) {
                        await LoginUtils.performLoginAsync(this.parent, creds.account, creds.password, savedLoginAccount.characterName, restoreSavedCTS.token);
                    }
                }
            }

            this.cancelButtonText = null;
            this._onCancel = null;

            // TODO: show login dialog if no open connections
            if (this.parent.logins.length == 0) {
                this.action = "Please wait...";

                try {                
                    const ld = new LoginViewModel(this.parent);
                    await this.parent.showDialogAsync(ld);
                }
                finally {
                    if (this.parent.logins.length == 0) {
                        HostInterop.closeWindow();
                    }
                }
            }
        }
        catch (e) {
            if (!(e instanceof OperationCancelledError)) {
                await this.parent.alertAsync(CatchUtils.getMessage(e), "Error");
            }
        }
        finally {
            this.parent.initialized = true;
        }
        
        this.close();
    }

    private async launchUpdateUrlAsync(): Promise<void> {
        await this.parent.launchUpdateUrlAsync();
    }
}