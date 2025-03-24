import { SavedChatStateAutoAdSettings, SavedChatStateAutoAdSettingsEntry } from "../settings/AppSettings";
import { ChannelName } from "../shared/ChannelName";
import { OnlineStatus, OnlineStatusConvert } from "../shared/OnlineStatus";
import { KeyCodes } from "../util/KeyCodes";
import { ObservableValue } from "../util/Observable";
import { ObservableBase, observableProperty } from "../util/ObservableBase";
import { Collection } from "../util/ObservableCollection";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";
import { AppViewModel } from "./AppViewModel";
import { DialogButtonStyle, DialogButtonViewModel, DialogViewModel } from "./dialogs/DialogViewModel";

export class ConfigureAutoAdsViewModel extends DialogViewModel<void> {

    constructor(parent: AppViewModel,
        public readonly activeLoginViewModel: ActiveLoginViewModel) {
        super(parent);

        this.title = "Auto Ad Posting Configuration";

        this.buttons.add(new DialogButtonViewModel({
            title: "Cancel",
            style: DialogButtonStyle.CANCEL,
            onClick: async () => { 
                if (this.hasUnsavedChanges) {
                    const shouldCancel = await this.activeLoginViewModel.appViewModel.promptAsync({
                        title: "Unsaved Changes",
                        message: "You have made changes, are you sure you want to cancel and lose those changes?",
                        buttons: [
                            {
                                title: "No, Continue Editing",
                                shortcutKeyCode: KeyCodes.KEY_N,
                                style: DialogButtonStyle.CANCEL,
                                resultValue: false
                            },
                            {
                                title: "Yes, Abandon Changes",
                                shortcutKeyCode: KeyCodes.KEY_Y,
                                style: DialogButtonStyle.NORMAL,
                                resultValue: true
                            },
                        ],
                        closeBoxResult: false
                    });
                    if (!shouldCancel) {
                        return;
                    }
                }
                this.cancel();
            },
            shortcutKeyCode: KeyCodes.ESCAPE
        }));
        this.buttons.add(new DialogButtonViewModel({
            title: "Apply Changes",
            style: DialogButtonStyle.NORMAL,
            onClick: () => { this.applyChanges(); },
        }));

        for (let x of activeLoginViewModel.savedChatState.autoAdSettings.entries) {
            this.entries.add(new ConfiguredAdViewModel(this, x));
        }

        const newAdPlaceholder = this.createNewAdPlaceholder();
        this.entries.add(newAdPlaceholder);

        this.selectedEntry = this.entries[0]!;

        this.enabled = activeLoginViewModel.savedChatState.autoAdSettings.enabled;

        this.entries.addCollectionObserver(() => {
            this.hasUnsavedChanges = true;
        });

        this.hasUnsavedChanges = false;
    }

    createNewAdPlaceholder(): ConfiguredAdViewModel {
        const newAdPlaceholder = new ConfiguredAdViewModel(this);
        newAdPlaceholder.targetOnlineStatuses.add(OnlineStatus.LOOKING);
        newAdPlaceholder.isNewAdPlaceholder = true;
        return newAdPlaceholder;
    }

    @observableProperty
    readonly entries: Collection<ConfiguredAdViewModel> = new Collection();

    @observableProperty
    selectedEntry: ConfiguredAdViewModel = null!;

    private readonly _enabled: ObservableValue<boolean> = new ObservableValue(false).withName("ConfigureAutoAdsViewModel._enabled");

    get enabled(): boolean { return this._enabled.value; }
    set enabled(value: boolean) {
        if (value !== this._enabled.value) {
            this._enabled.value = value;
            this.hasUnsavedChanges = true;
        }
    }

    @observableProperty
    hasUnsavedChanges: boolean = false;

    cancel() {
        this.close();
    }

    applyChanges() {
        this.activeLoginViewModel.savedChatState.autoAdSettings = new SavedChatStateAutoAdSettings(this.activeLoginViewModel.savedChatState, {
            enabled: this.enabled,
            entries: this.entries.filter(x => !x.isNewAdPlaceholder).map(x => { return {
                enabled: x.enabled,
                title: x.title,
                adText: x.adText,
                targetChannels: x.targetChannels.map(tc => tc.canonicalValue),
                targetOnlineStatuses: x.targetOnlineStatuses.map(x => OnlineStatusConvert.toString(x))
            }})
        });
        this.close();
    }
}

export class ConfiguredAdViewModel extends ObservableBase {

    constructor(
        private readonly owner: ConfigureAutoAdsViewModel,
        entry?: SavedChatStateAutoAdSettingsEntry) {

        super();

        if (entry) {
            this.enabled = entry.enabled;
            this.adText = entry.adText;
            for (let x of entry.targetChannels) {
                this.targetChannels.add(x);
            }
            for (let x of entry.targetOnlineStatuses) {
                this.targetOnlineStatuses.add(x);
            }
        }
        else {
            this.enabled = true;
            this.title = "";
            this.adText = "";
        }

        this.targetOnlineStatuses.addCollectionObserver(() => {
            this.clearNewAdPlaceholderStatus();
        });
        this.targetChannels.addCollectionObserver(() => {
            this.clearNewAdPlaceholderStatus();
        })
    }

    private readonly _enabled: ObservableValue<boolean> = new ObservableValue(true).withName("ConfiguredAdViewModel._enabled");
    private readonly _title: ObservableValue<string> = new ObservableValue("").withName("ConfiguredAdViewModel._title");
    private readonly _adText: ObservableValue<string> = new ObservableValue("").withName("ConfiguredAdViewModel._adText");

    @observableProperty
    isNewAdPlaceholder: boolean = false;

    @observableProperty
    get enabled() { return this._enabled.value; }
    set enabled(value: boolean) {
        if (value != this._enabled.value) {
            this._enabled.value = value;
            this.clearNewAdPlaceholderStatus();
        }
    }

    @observableProperty
    get title() { return this._title.value; }
    set title(value: string) {
        if (value != this._title.value) {
            this._title.value = value;
            this.clearNewAdPlaceholderStatus();
        }
    }

    @observableProperty
    get adText() { return this._adText.value; }
    set adText(value: string) {
        if (value != this._adText.value) {
            this._adText.value = value;
            this.clearNewAdPlaceholderStatus();
        }
    }

    @observableProperty
    readonly targetChannels: Collection<ChannelName> = new Collection();

    @observableProperty
    readonly targetOnlineStatuses: Collection<OnlineStatus> = new Collection();

    private clearNewAdPlaceholderStatus() {
        this.owner.hasUnsavedChanges = true;
        if (this.isNewAdPlaceholder) {
            this.isNewAdPlaceholder = false;
            const newPh = this.owner.createNewAdPlaceholder();
            this.owner.entries.add(newPh);
        }
    }

    select() {
        if (this.owner.entries.contains(this)) {
            this.owner.selectedEntry = this;
        }
    }

    delete() {
        this.owner.entries.remove(this);
        if (this.owner.selectedEntry == this) {
            this.owner.selectedEntry = this.owner.entries[0]!;
        }
    }
}