import { ConfigSchema, ConfigSchemaDefinition, ConfigSchemaItemDefinition, ConfigSchemaItemDefinitionItem, ConfigSchemaItemDefinitionSection, ConfigSchemaItemType, ConfigSchemaScopeType, PingLineItemDefinition } from "../../configuration/ConfigSchemaItem";
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
        private readonly channel?: ChannelViewModel,
        private readonly interlocutorName?: CharacterName) {

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

            if (this.channel || this.interlocutorName) {
                if (this.channel instanceof ChatChannelViewModel) {
                    this.tabs.push(new ChannelCategorySettingsDialogTabViewModel(this, this.channel.activeLoginViewModel.characterName, this.channel.channelCategory));
                    this.tabs.push(new ChannelSettingsDialogTabViewModel(this, this.channel));
                }
                else if (this.channel instanceof PMConvoChannelViewModel) {
                    this.tabs.push(PMConvoSettingsDialogTabViewModel.createForChannel(this, this.channel));
                }
                else if (this.interlocutorName instanceof CharacterName) {
                    this.tabs.push(PMConvoSettingsDialogTabViewModel.createForCharacter(this, this.session?.characterName, this.interlocutorName));
                }
            }
        }

        this.selectedTab = IterableUtils.asQueryable(this.tabs).last();
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

    get showInheritedInfo(): boolean { return false; }

    get inheritedFromText(): string { return ""; }
    get revertToText(): string { return ""; }

    revertToInherited() {
    }

    get useInheritedValue(): boolean { return false; }

    get title(): string { return (this.itemDefinition as any).sectionTitle ?? (this.itemDefinition as any).title }

    get description(): string | undefined { 
        let descStr = this.itemDefinition.description;
        if (this.itemDefinition.descriptionByScope && this.itemDefinition.descriptionByScope[this.scope.scopeString]) {
            descStr = this.itemDefinition.descriptionByScope[this.scope.scopeString];
        }
        descStr = descStr?.replace("$MYCHAR$", this.scope.myCharacter?.value ?? "");
        descStr = descStr?.replace("$CHANCATEGORY$", this.scope.categoryName ?? "");
        descStr = descStr?.replace("$CONVOCHAR$", this.scope.pmConvoCharacter?.value ?? "");
        return descStr;
    }

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

    get tabInstructions(): string { return this.scope.scopeDescription; }

    select() {
        this.logger.logInfo("selecting tab", this.tabTitle);
        this.parent.selectedTab = this;
    }
}

class GlobalSettingsDialogTabViewModel extends SettingsDialogTabViewModel {
    constructor(parent: SettingsDialogViewModel) {
        super(parent, 
            "Global",
            new ScopeData(parent.parent));
    }
}

class SessionSettingsDialogTabViewModel extends SettingsDialogTabViewModel {
    constructor(parent: SettingsDialogViewModel, session: ActiveLoginViewModel) {
        super(parent, 
            `Session - ${session.characterName.value}`,
            new ScopeData(parent.parent, session.characterName));
    }
}

class ChannelCategorySettingsDialogTabViewModel extends SettingsDialogTabViewModel {
    constructor(parent: SettingsDialogViewModel, myCharacterName: CharacterName, categoryName: string) {
        super(parent, 
            `Category - ${categoryName}`,
            new ScopeData(parent.parent, myCharacterName, categoryName));
    }
}

class ChannelSettingsDialogTabViewModel extends SettingsDialogTabViewModel {
    constructor(parent: SettingsDialogViewModel, channel: ChatChannelViewModel) {
        super(parent, 
            `Channel - ${channel.title}`,
            new ScopeData(parent.parent, channel.activeLoginViewModel.characterName, channel.channelCategory, channel.title));
    }
}

class PMConvoSettingsDialogTabViewModel extends SettingsDialogTabViewModel {
    static createForChannel(parent: SettingsDialogViewModel, convo: PMConvoChannelViewModel): PMConvoSettingsDialogTabViewModel {
        return new PMConvoSettingsDialogTabViewModel(parent, convo.activeLoginViewModel.characterName, convo.character);
    }

    static createForCharacter(parent: SettingsDialogViewModel, myCharName: CharacterName, interlocutorName: CharacterName): PMConvoSettingsDialogTabViewModel {
        return new PMConvoSettingsDialogTabViewModel(parent, myCharName, interlocutorName);
    }

    private constructor(parent: SettingsDialogViewModel, myCharName: CharacterName, interlocutorName: CharacterName) {
        super(parent, 
            `Character - ${interlocutorName.value}`,
            new ScopeData(parent.parent, myCharName, undefined, undefined, interlocutorName));
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
        return this.scope.getAppConfigKey(this.schema.configBlockKey);
    }

    get useInheritedValue(): boolean {
        if (this.scope.scopeString == "global") {
            return false;
        }
        else {
            const k = this.getAppConfigKey();
            const result = this.scope.appViewModel.configBlock.getWithDefault(k, null);
            return (result == null);
        }
    }
    set useInheritedValue(value: boolean) {
        if (this.scope.scopeString == "global") {
            // Ignore, global has no inherited value
        }
        else {
            const k = this.getAppConfigKey();        
            if (value == true) {
                this.scope.appViewModel.configBlock.set(k, null);
            }
            else {
                const curSettingValue = this.scope.appViewModel.configBlock.getWithDefault(k, null);
                if (curSettingValue == null) {
                    this.scope.appViewModel.configBlock.set(k, this.schema.defaultValue);
                }
            }
        }
    }

    get value(): any {
        let cscope: ScopeData | null = this.scope;
        while (cscope) {
            const k = cscope.getAppConfigKey(this.schema.configBlockKey);
            let result = null;
            if (cscope.scopeString == "global") {
                result = this.scope.appViewModel.configBlock.getWithDefault(k, this.schema.defaultValue);
            }
            else {
                result = this.scope.appViewModel.configBlock.getWithDefault(k, null);
            }
            if (result != null) {
                return result;
            }
            cscope = cscope.parentScope;
        }
        return null;
    }

    set value(value: any) {
        if (!this._reverted) {
            this.logger.logDebug("set value start");
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
                    case "text[]":
                        this.assignTextListValue(value);
                        break;
                    case "pinglist":
                        this.assignPingListValue(value);
                        break;
                    case "text":
                    case "radio":
                    case "notifroutes":
                    case "select":
                            this.assignStringValue(value);
                        break;
                    default:
                        this.logger.logError(`don't know how to assign ${this.schema.type}`);
                }
            }
            this.logger.logDebug("set value end");
        }
        else {
            this.logger.logDebug("set value skipped");
        }
    }

    private readonly _scratchValue: ObservableValue<any> = new ObservableValue(null);
    get scratchValue(): any { return this._scratchValue.value; }
    set scratchValue(value: any) { this._scratchValue.value = value; }

    private assignStringValue(value: string) {
        const k = this.getAppConfigKey();
        this.scope.appViewModel.configBlock.set(k, value);
    }

    private assignBooleanValue(value: boolean) {
        const k = this.getAppConfigKey();
        this.scope.appViewModel.configBlock.set(k, !!value);
    }

    private assignTextListValue(value: string[]) {
        const k = this.getAppConfigKey();
        this.scope.appViewModel.configBlock.set(k, value);
    }

    private assignPingListValue(value: (string | PingLineItemDefinition)[]) {
        const k = this.getAppConfigKey();
        this.scope.appViewModel.configBlock.set(k, value);
    }

    override get showInheritedInfo(): boolean {
        const ss = this.scope.scopeString;
        if (ss == "global" || !this.schema.scope) { return false; }
        if (ss == "char" && this.schema.scope?.filter(x => x == "global").length > 0 ) { return true; }
        if (ss == "char.chancategory" && this.schema.scope?.filter(x => x == "char").length > 0 ) { return true; }
        if (ss == "char.chan" && this.schema.scope?.filter(x => x == "char.chancategory").length > 0 ) { return true; }
        if (ss == "char.convo" && this.schema.scope?.filter(x => x == "char").length > 0 ) { return true; }
        return false;
    }

    override get inheritedFromText(): string { return this.scope.settingIsInheritedPrompt; }
    override get revertToText(): string { return this.scope.settingIsAssignedPrompt; }

    private _reverted: boolean = false;
    override revertToInherited() {
        this.logger.logDebug("revertToInherited start");
        this._reverted = true;
        window.setTimeout(() => this._reverted = false, 50);
        this.useInheritedValue = true;
        this.logger.logDebug("revertToInherited end");
    }
}

class ScopeData {
    constructor(
        public readonly appViewModel: AppViewModel,
        public readonly myCharacter?: CharacterName,
        public readonly categoryName?: string,
        public readonly targetChannel?: string,
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
        else if (this.categoryName != null) {
            return "char.chancategory";
        }
        else if (this.pmConvoCharacter != null) {
            return "char.convo";
        }
        else {
            return "char";
        }
    }

    get parentScope(): ScopeData | null {
        if (this.scopeString == "char") {
            return new ScopeData(this.appViewModel);
        }
        else if (this.scopeString == "char.chancategory") {
            return new ScopeData(this.appViewModel, this.myCharacter);
        }
        else if (this.scopeString == "char.chan") {
            return new ScopeData(this.appViewModel, this.myCharacter, this.categoryName);
        }
        else if (this.scopeString == "char.convo") {
            return new ScopeData(this.appViewModel, this.myCharacter);
        }
        return null;
    }

    getAppConfigKey(baseKey: string): string {
        let prefix: string;
        switch (this.scopeString) {
            case "global":
                prefix = "global";
                break;
            case "char":
                prefix = `character.${this.myCharacter!.canonicalValue}.any`;
                break;
            case "char.chancategory":
                prefix = `character.${this.myCharacter!.canonicalValue}.channelcategory.${this.categoryName!.toLowerCase()}`;
                break;
            case "char.chan":
                prefix = `character.${this.myCharacter!.canonicalValue}.channel.${this.targetChannel!.toLowerCase()}`;
                break;
            case "char.convo":
                prefix = `character.${this.myCharacter!.canonicalValue}.pm.${this.pmConvoCharacter!.canonicalValue}`;
                break;
            default:
                throw new Error(`unknown scope string: ${this.scopeString}`);
        }

        return `${prefix}.${baseKey}`;
    }

    get scopeDescription(): string {
        switch (this.scopeString) {
            case "global":
                return "Settings that apply globally within XarChat.";
            case "char":
                return `Settings that apply only for sessions logged in as ${this.myCharacter!.value}.`;
            case "char.chancategory":
                return `Settings that apply to channels in the "${this.categoryName}" category when logged in as ${this.myCharacter!.value}.`;
            case "char.chan":
                return `Settings that apply to the channel "${this.targetChannel}" when logged in as ${this.myCharacter!.value}.`;
            case "char.convo":
                return `Settings that apply  to the character "${this.pmConvoCharacter!.value}" when logged in as ${this.myCharacter!.value}.`;
            default:
                throw new Error(`unknown scope string: ${this.scopeString}`);
        }
    }

    get settingIsInheritedPrompt(): string {
        switch (this.scopeString) {
            case "global":
                return "";
            case "char":
                return `Currently using the value inherited from the global settings.`;
            case "char.chancategory":
                return `Currently using the value inherited from the session settings for ${this.myCharacter?.value}.`;
            case "char.chan":
                return `Currently using the value inherited from the channel category settings for "${this.categoryName}".`;
            case "char.convo":
                return `Currently using the value inherited from the session settings for ${this.myCharacter?.value}.`;
            default:
                throw new Error(`unknown scope string: ${this.scopeString}`);
        }
    }

    get settingIsAssignedPrompt(): string {
        switch (this.scopeString) {
            case "global":
                return "";
            case "char":
                return `Using overridden value. Click @@ to use the value from the global settings instead.`;
            case "char.chancategory":
                return `Using overridden value. Click @@ to use the value from the session settings for ${this.myCharacter?.value} instead.`;
            case "char.chan":
                return `Using overridden value. Click @@ to use the value from the channel category settings for "${this.categoryName}" instead.`;
            case "char.convo":
                return `Using overridden value. Click @@ to use the value from the session settings for ${this.myCharacter?.value} instead.`;
            default:
                throw new Error(`unknown scope string: ${this.scopeString}`);
        }
    }
}