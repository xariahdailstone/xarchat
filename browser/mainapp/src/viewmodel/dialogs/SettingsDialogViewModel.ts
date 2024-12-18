import { ConfigSchema, ConfigSchemaDefinition, ConfigSchemaItemDefinition, ConfigSchemaItemDefinitionItem, ConfigSchemaItemDefinitionSection, ConfigSchemaItemType, ConfigSchemaScopeType } from "../../configuration/ConfigSchemaItem";
import { ChannelName } from "../../shared/ChannelName";
import { CharacterName } from "../../shared/CharacterName";
import { IterableUtils } from "../../util/IterableUtils";
import { ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty, observablePropertyExt } from "../../util/ObservableBase";
import { Collection } from "../../util/ObservableCollection";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { AppViewModel } from "../AppViewModel";
import { ChannelViewModel } from "../ChannelViewModel";
import { ChatChannelViewModel } from "../ChatChannelViewModel";
import { PMConvoChannelViewModel } from "../PMConvoChannelViewModel";
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
    constructor(parent: AppViewModel, 
        private readonly session?: ActiveLoginViewModel, 
        private readonly channel?: ChannelViewModel) {

        super(parent);
        this.schemaDefinition = ConfigSchema;

        this.closeBoxResult = 0;
        this.title = "";
        this.initializeTabs();
    }

    readonly schemaDefinition: ConfigSchemaDefinition;

    private initializeTabs() {
        this.tabs.push(new GlobalSettingsDialogTabViewModel(this));
        if (this.session) {
            this.tabs.push(new SessionSettingsDialogTabViewModel(this, this.session));
        }
        if (this.channel) {
            if (this.channel instanceof ChatChannelViewModel) {
                this.tabs.push(new ChannelSettingsDialogTabViewModel(this, this.channel));
            }
            else if (this.channel instanceof PMConvoChannelViewModel) {
                this.tabs.push(new PMConvoSettingsDialogTabViewModel(this, this.channel));
            }
        }

        this.selectedTab = IterableUtils.asQueryable(this.tabs).first();
    }

    @observableProperty
    readonly tabs: Collection<SettingsDialogTabViewModel> = new Collection<SettingsDialogTabViewModel>();

    @observableProperty
    selectedTab: (SettingsDialogTabViewModel | null) = null;
}

export abstract class SettingsDialogSettingViewModel extends ObservableBase {
    constructor(
        private readonly itemDefinition: ConfigSchemaItemDefinition, 
        public readonly scope: ScopeData) {

        super();
        this.prepareSettings(itemDefinition.items, this.settings);
    }

    get isDisabled(): boolean {
        return ((this.itemDefinition as any).notYetImplemented != null);
    }

    get title(): string { return (this.itemDefinition as any).sectionTitle ?? (this.itemDefinition as any).title }

    get description(): string | undefined { return this.itemDefinition.description; }

    @observableProperty
    readonly settings: Collection<SettingsDialogSettingViewModel> = new Collection<SettingsDialogSettingViewModel>();

    protected prepareSettings(source: ConfigSchemaItemDefinition[] | null | undefined, target: Collection<SettingsDialogSettingViewModel>) {
        if (source) {
            for (let x of source) {
                if (x.scope && x.scope.includes(this.scope.scopeString)) {
                    this.settings.add(this.includeSetting(x, target));
                }
            }
        }
    }

    private includeSetting(sourceItem: ConfigSchemaItemDefinition, target: Collection<SettingsDialogSettingViewModel>): SettingsDialogSettingViewModel {
        // const subList = new Collection<SettingsDialogSettingViewModel>();
        // if (sourceItem.items) {
        //     this.prepareSettings(sourceItem.items, subList);
        // }

        let vm: SettingsDialogSettingViewModel;
        if ((sourceItem as any).sectionTitle) {
            vm = this.createSection(sourceItem as ConfigSchemaItemDefinitionSection);
        }
        else {
            vm = this.createItem(sourceItem as ConfigSchemaItemDefinitionItem);
        }
        return vm;
    }

    private createSection(item: ConfigSchemaItemDefinitionSection): SettingsDialogSectionViewModel {
        const res = new SettingsDialogSectionViewModel(item, this.scope);
        return res;
    }

    private createItem(item: ConfigSchemaItemDefinitionItem): SettingsDialogItemViewModel {
        const res = new SettingsDialogItemViewModel(item, this.scope);
        return res;
    }
}

export abstract class SettingsDialogTabViewModel extends SettingsDialogSettingViewModel {
    constructor(
        public readonly parent: SettingsDialogViewModel, tabTitle: string, scope: ScopeData) {

        super({ sectionTitle: tabTitle, items: parent.schemaDefinition.settings }, scope);
        this.parent = parent;
    }

    get tabTitle(): string { return this.title; }

    select() {
        console.log("selecting tab", this.tabTitle);
        this.parent.selectedTab = this;
    }
}

class GlobalSettingsDialogTabViewModel extends SettingsDialogTabViewModel {
    constructor(parent: SettingsDialogViewModel) {
        super(parent, "Global", new ScopeData(parent.parent));
    }
}

class SessionSettingsDialogTabViewModel extends SettingsDialogTabViewModel {
    constructor(parent: SettingsDialogViewModel, session: ActiveLoginViewModel) {
        super(parent, session.characterName.value, new ScopeData(parent.parent, session.characterName));
    }
}

class ChannelSettingsDialogTabViewModel extends SettingsDialogTabViewModel {
    constructor(parent: SettingsDialogViewModel, channel: ChatChannelViewModel) {
        super(parent, channel.title, new ScopeData(parent.parent, channel.activeLoginViewModel.characterName, channel.name));
    }
}

class PMConvoSettingsDialogTabViewModel extends SettingsDialogTabViewModel {
    constructor(parent: SettingsDialogViewModel, convo: PMConvoChannelViewModel) {
        super(parent, convo.character.value, new ScopeData(parent.parent, convo.activeLoginViewModel.characterName, undefined, convo.character));
    }
}



export class SettingsDialogSectionViewModel extends SettingsDialogSettingViewModel  {
    constructor(
        item: ConfigSchemaItemDefinitionSection,
        scope: ScopeData) {
        
        super(item, scope);
        this.schema = item;
    }

    readonly schema: ConfigSchemaItemDefinitionSection;
}

export class SettingsDialogItemViewModel extends SettingsDialogSettingViewModel {
    constructor(
        item: ConfigSchemaItemDefinitionItem,
        scope: ScopeData) {
            
        super(item, scope);
        this.schema = item;
    }

    readonly schema: ConfigSchemaItemDefinitionItem;

    private getAppConfigKey(): string {
        let prefix: string;
        switch (this.scope.scopeString) {
            case "global":
                prefix = "global";
                break;
            case "char":
                prefix = `character.${this.scope.myCharacter!.canonicalValue}.any`;
                break;
            case "char.chan":
                prefix = `character.${this.scope.myCharacter!.canonicalValue}.channel.${this.scope.targetChannel!.canonicalValue}`;
                break;
            case "char.convo":
                prefix = `character.${this.scope.myCharacter!.canonicalValue}.pm.${this.scope.pmConvoCharacter!.canonicalValue}`;
                break;
            default:
                throw new Error(`unknown scope string: ${this.scope.scopeString}`);
        }

        return `${prefix}.${this.schema.configBlockKey}`;
    }

    get value(): any { 
        const k = this.getAppConfigKey();
        const result = this.scope.appViewModel.configBlock.getWithDefault(k, this.schema.defaultValue);
        return result;
    }

    set value(value: any) {
        const k = this.getAppConfigKey();
        if (value === undefined || value === null) {
            this.scope.appViewModel.configBlock.set(k, null);
        }
        else {
            switch (this.schema.type) {
                case "color":
                case "color-hs":
                    this.assignStringValue(value);
                    break;
                case "boolean":
                    this.assignBooleanValue(!!value);
                    break;
                default:
                    console.log(`don't know how to assign ${this.schema.type}`);
            }
        }
    }

    private assignStringValue(value: string) {
        const k = this.getAppConfigKey();
        this.scope.appViewModel.configBlock.set(k, value);
    }

    private assignBooleanValue(value: boolean) {
        const k = this.getAppConfigKey();
        this.scope.appViewModel.configBlock.set(k, !!value);
    }
}

class ScopeData {
    constructor(
        public readonly appViewModel: AppViewModel,
        public readonly myCharacter?: CharacterName,
        public readonly targetChannel?: ChannelName,
        public readonly pmConvoCharacter?: CharacterName
    ) {
    }

    get scopeString(): ConfigSchemaScopeType {
        if (this.myCharacter == null) {
            return "global";
        }
        else if (this.targetChannel != null) {
            return "char.chan";
        }
        else if (this.pmConvoCharacter != null) {
            return "char.convo";
        }
        else {
            return "char";
        }
    }
}