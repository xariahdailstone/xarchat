import { ChannelName } from "../../shared/ChannelName";
import { IterableUtils } from "../../util/IterableUtils";
import { ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty, observablePropertyExt } from "../../util/ObservableBase";
import { Collection } from "../../util/ObservableCollection";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { AppViewModel } from "../AppViewModel";
import { ChatChannelViewModel } from "../ChatChannelViewModel";
import { DialogViewModel } from "./DialogViewModel";

interface InitializationOptions {
    title: string;
    type: "standard"
    settings?: (InitializationSettingOptions | InitializationGroupOptions | null)[];
}

interface InitializationSettingOptions {
    title: string;
    type: "text" | "timespan" | "boolean" | "text-list";
    description: string;
    allowNull?: boolean;
    getValue: () => any;
    setValue: (value: any) => void;
}

interface InitializationGroupOptions {
    title: string;
    type: "group";
    description: string;
    settings?: (InitializationSettingOptions | InitializationGroupOptions | null)[];
}

export class SettingsDialogViewModel extends DialogViewModel<number> {
    constructor(parent: AppViewModel, session?: ActiveLoginViewModel, channel?: ChatChannelViewModel) {
        super(parent);

        this.closeBoxResult = 0;
        this.title = "";
        this.initialize([
            {
                title: "Global",
                type: "standard",
                settings: [
                    {
                        title: "Sound",
                        type: "group",
                        description: "Control sound settings for XarChat",
                        settings: [
                            {
                                title: "Sound Enabled",
                                type: "boolean",
                                description: "Controls whether XarChat plays sounds or not.",
                                getValue() { return true; },
                                setValue(value: boolean) { }
                            }
                        ]
                    }
                ]
            },
            !session ? null : {
                title: session.characterName.value,
                type: "standard",
                settings: [
                    {
                        title: "Auto Idle",
                        type: "group",
                        description: `XarChat can automatically change your online status to Idle and Away when you are away or when you lock
                                        your computer.`,
                        settings: [
                            {
                                title: "Automatically Set Idle",
                                type: "timespan",
                                allowNull: true,
                                description: "Set your online status to Idle when your mouse and keyboard are idle for a length of time.",
                                getValue() { return true; },
                                setValue(value: boolean) {}
                            },
                            {
                                title: "Automatically Set Away",
                                type: "boolean",
                                description: "Set your online status to Away when you lock your computer.",
                                getValue() { return true; },
                                setValue(value: boolean) {}
                            }
                        ]
                    },
                    {
                        title: "Highlight Words",
                        type: "text-list",
                        description: "If any of these appear in a message, the message will be highlighted and an alert will light up on the channel.",
                        getValue() { return [] },
                        setValue(value: string[]) {}
                    }
                ]
            },
            !channel ? null : {
                title: channel.title,
                type: "standard",
                settings: []
            }
        ]);
    }

    private initialize(options: (InitializationOptions | null)[]) {
        for (let tabOptions of IterableUtils.asQueryable(options).where(x => x != null).select(x => x!)) {
            const vm = new SettingsDialogStandardTabViewModel(this, tabOptions.title);
            this.initializeSettings(vm, tabOptions.settings);
            this.tabs.push(vm);
        }
        this.selectedTab = IterableUtils.asQueryable(this.tabs).first();
    }

    private initializeSettings(vm: HasSettings, settings?: (InitializationSettingOptions | InitializationGroupOptions | null)[]) {
        if (!settings) { return; }
        for (let setting of settings) {
            if (!setting) {
                continue;
            }

            let settingvm: SettingsDialogSettingViewModel | null = null;
            switch (setting.type) {
                case "text":
                    settingvm = new SettingsDialogStringSettingViewModel(setting.title, setting.description, "test");
                    break;
                case "group":
                    const gsettingvm = new SettingsDialogGroupSettingViewModel(setting.title, setting.description);
                    this.initializeSettings(gsettingvm, (setting as InitializationGroupOptions).settings);
                    settingvm = gsettingvm;
                    break;
                default:
                    settingvm = new SettingsDialogStringSettingViewModel(setting.title, setting.description, "TODO");
                    break;
            }
            if (settingvm) {
                vm.settings.push(settingvm);
            }
        }
    }

    @observableProperty
    readonly tabs: Collection<SettingsDialogTabViewModel> = new Collection<SettingsDialogTabViewModel>();

    @observableProperty
    selectedTab: (SettingsDialogTabViewModel | null) = null;
}

export abstract class SettingsDialogTabViewModel extends ObservableBase {
    constructor(parent: SettingsDialogViewModel, tabTitle: string) {
        super();
        this.parent = parent;
        this.tabTitle = tabTitle;
    }

    @observableProperty
    readonly parent: SettingsDialogViewModel;

    @observableProperty
    tabTitle: string;

    select() {
        console.log("selecting tab", this.tabTitle);
        this.parent.selectedTab = this;
    }
}

interface HasSettings {
    readonly settings: Collection<SettingsDialogSettingViewModel>;
}

export class SettingsDialogStandardTabViewModel extends SettingsDialogTabViewModel implements HasSettings {
    constructor(parent: SettingsDialogViewModel, tabTitle: string) {
        super(parent, tabTitle);
    }

    @observableProperty
    readonly settings: Collection<SettingsDialogSettingViewModel> = new Collection<SettingsDialogSettingViewModel>();
}



export abstract class SettingsDialogSettingViewModel extends ObservableBase {
    constructor(title: string, description: string) {
        super();
        this.title = title;
        this.description = description;
    }

    @observableProperty
    title: string;

    @observableProperty
    description: string;
}

export class SettingsDialogGroupSettingViewModel extends SettingsDialogSettingViewModel implements HasSettings {
    constructor(title: string, description: string) {
        super(title, description);
    }

    @observableProperty
    readonly settings: Collection<SettingsDialogSettingViewModel> = new Collection<SettingsDialogSettingViewModel>();
}

export class SettingsDialogStringSettingViewModel extends SettingsDialogSettingViewModel {
    constructor(title: string, description: string, value: string) {
        super(title, description);
        this.value = value;
    }

    @observableProperty
    value: string;
}