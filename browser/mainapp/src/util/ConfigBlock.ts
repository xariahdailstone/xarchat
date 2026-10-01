import { ConfigSchema, ConfigSchemaItemDefinition, ConfigSchemaItemDefinitionItem, ConfigSchemaItemDefinitionSection, ConfigSchemaVersion } from '../configuration/ConfigSchemaItem';
import { CallbackSet } from './CallbackSet';
import { KeyValuePair } from './collections/KeyValuePair';
import { SnapshottableMap } from './collections/SnapshottableMap';
import { IDisposable } from './Disposable';
import { HostInterop } from './hostinterop/HostInterop';
import { Logger, Logging } from './Logger';
import { Observable } from './Observable';
import { ObservableExpression } from './ObservableExpression';

export interface ConfigBlock {
    get(key: string): (unknown | null);
    getWithDefault(key: string, defaultValue: any): (unknown | null);
    set(key: string, value: (unknown | null)): void;

    getFirst(keys: string[]): (unknown | null);
    getFirstWithDefault(keys: string[], defaultValue: any): (unknown | null);

    observe(key: string, onValueUpdated: (value: (unknown | null)) => void): IDisposable;
    observeAll(onValueUpdated: (key: string, value: (unknown | null)) => void): IDisposable;

    forEach(callback: (kvp: KeyValuePair<string, unknown | null>) => void): void;
}

interface IConfigBlockSection {
    getSection(sectionName: string): IConfigBlockSection | null;
    getOrCreateSection(sectionName: string): IConfigBlockSection;
    deleteSection(sectionName: string): void;

    getValue(keyName: string): any;
    setValue(keyName: string, value: any): any;
    deleteValue(keyName: string): void;

    forEachValue(callback: (name: string, value: unknown) => any): void;
    forEachSection(callback: (name: string, section: IConfigBlockSection) => any): void;
}

class HierarchicalConfigBlockStorageSection implements IConfigBlockSection {
    private _subsections: SnapshottableMap<string, HierarchicalConfigBlockStorageSection> | null = null;
    private _values: SnapshottableMap<string, any> | null = null;

    constructor(
        private readonly sectionName: string,
        private readonly parentSection: HierarchicalConfigBlockStorageSection | null) { 
    }

    getSection(sectionName: string): HierarchicalConfigBlockStorageSection | null {
        const section = this.resolveSectionNameToSection(sectionName, false);
        return section ?? null;
    }

    private getSectionInternal(sectionName: string): HierarchicalConfigBlockStorageSection | null {
        if (!this._subsections) {
            return null;
        }
        const subsection = this._subsections.get(sectionName) ?? null;
        return subsection;
    }

    getOrCreateSection(sectionName: string): HierarchicalConfigBlockStorageSection {
        const section = this.resolveSectionNameToSection(sectionName, true);
        return section!;
    }

    private getOrCreateSectionInternal(sectionName: string): HierarchicalConfigBlockStorageSection {
        if (!this._subsections) {
            this._subsections = new SnapshottableMap();
        }
        let subsection = this._subsections.get(sectionName) ?? null;
        if (!subsection) {
            subsection = new HierarchicalConfigBlockStorageSection(sectionName, this);
            this._subsections.set(sectionName, subsection);
        }
        return subsection;
    }

    deleteSection(sectionName: string): void {
        const dotPos = sectionName.indexOf('.');
        if (dotPos == -1) {
            this.deleteSectionInternal(sectionName);
        }
        else {
            const subSectionName = sectionName.substring(0, dotPos);
            const subsubSectionName = sectionName.substring(dotPos + 1);
            const section = this.getSectionInternal(subSectionName);
            if (section) {
                section.deleteSection(subsubSectionName);
            }
        }
    }

    private deleteSectionInternal(sectionName: string): void {
        if (!this._subsections) {
            return;
        }

        this._subsections.delete(sectionName);
        this.#cleanupAfterDelete();
    }

    #cleanupAfterDelete() {
        if (this._subsections && this._subsections.size == 0) {
            this._subsections = null;
        }
        if (this._values && this._values.size == 0) {
            this._values = null;
        }

        if (!this._subsections && !this._values && this.parentSection) {
            this.parentSection.deleteSection(this.sectionName);
        }
    }

    private resolveSectionNameToSection(sectionName: string, create: boolean): HierarchicalConfigBlockStorageSection | null {
        const dotPos = sectionName.indexOf('.');
        if (dotPos == -1) {
            return create ? this.getOrCreateSectionInternal(sectionName) : this.getSectionInternal(sectionName);
        }

        const immediateSubsectionName = sectionName.substring(0, dotPos);
        const subsubSectionName = sectionName.substring(dotPos + 1);
        const section = create ? this.getOrCreateSectionInternal(immediateSubsectionName) : this.getSectionInternal(immediateSubsectionName);
        if (!section) { return null; }
        return section.resolveSectionNameToSection(subsubSectionName, create);
    }

    private resolveKeyNameToSection(keyName: string, create: boolean): ({ section: HierarchicalConfigBlockStorageSection, keyName: string } | null) {
        const dotPos = keyName.indexOf('.');
        if (dotPos == -1) {
            return { section: this, keyName: keyName };
        }

        const sectionName = keyName.substring(0, dotPos);
        const subKeyName = keyName.substring(dotPos + 1);
        const section = create ? this.getOrCreateSection(sectionName) : this.getSection(sectionName);
        if (!section) { return null; }
        return section.resolveKeyNameToSection(subKeyName, create);
    }

    getValue(keyName: string) {
        const section = this.resolveKeyNameToSection(keyName, false);
        if (section?.section) {
            return section.section.getValueInternal(section.keyName);
        }
    }

    private getValueInternal(keyName: string) {
        if (!this._values) {
            return null;
        }

        const result = this._values.get(keyName);
        return result;
    }

    setValue(keyName: string, value: any) {
        const section = this.resolveKeyNameToSection(keyName, true);
        if (section?.section) {
            return section.section.setValueInternal(section.keyName, value);
        }
    }

    private setValueInternal(keyName: string, value: any) {
        if (!this._values) {
            this._values = new SnapshottableMap();
        }
        
        this._values.set(keyName, value);
        return value;
    }

    deleteValue(keyName: string): void {
        const section = this.resolveKeyNameToSection(keyName, false);
        if (section?.section) {
            section.section.deleteValueInternal(section.keyName);
        }
    }

    private deleteValueInternal(keyName: string): void {
        if (!this._values) {
            return;
        }
        
        this._values.delete(keyName);
        this.#cleanupAfterDelete();
    }

    forEachValue(callback: (name: string, value: unknown) => any): void {
        if (!this._values) {
            return;
        }

        this._values.forEachEntrySnapshotted(kvp => {
            callback(kvp[0], kvp[1]);
        });
    }

    forEachSection(callback: (name: string, section: HierarchicalConfigBlockStorageSection) => any): void {
        if (!this._subsections) {
            return;
        }

        this._subsections.forEachEntrySnapshotted(kvp => {
            callback(kvp[0], kvp[1]);
        });
    }
}    

export class NewHostInteropConfigBlock implements ConfigBlock {
    private readonly _rootSection: HierarchicalConfigBlockStorageSection = new HierarchicalConfigBlockStorageSection("", null);

    static async createAsync(): Promise<NewHostInteropConfigBlock> {
        const pairs = await HostInterop.getConfigValuesAsync();

        const result = new NewHostInteropConfigBlock();
        for (let kvp of pairs) {
            result._rootSection.setValue(kvp.key, kvp.value);
        }
        HostInterop.registerConfigChangeCallback(kvp => {
            result.hostAssign(kvp.key, kvp.value);
        });

        result.performMigration(ConfigSchemaVersion);
        return result;
    }

    private readonly _logger: Logger;

    private constructor() { 
        this._logger = Logging.createLogger("NewHostInteropConfigBlock");
    }

    private _isHostAssigning: string | null = null;
    private hostAssign(key: string, value: (unknown | null)): void {
        const prevHostAssigning = this._isHostAssigning;
        this._isHostAssigning = key;
        try {
            this.set(key, value);
        }
        finally {
            this._isHostAssigning = prevHostAssigning;
        }
    }

    private performMigration(targetVersion: number) {
        const migrator = new ConfigMigrator(this);
        migrator.performMigration(targetVersion);
    }

    get(key: string): (unknown | null) {
        let v = this._rootSection.getValue(key) ?? null;
        if (v instanceof Array) {
            v = [ ...v ];
        }
        Observable.publishNamedRead(`hicb:${key}`, v);
        return v;
    }

    getWithDefault(key: string, defaultValue: any): (unknown | null) {
        return this.get(key) ?? defaultValue;
    }

    set(key: string, value: (unknown | null)): void {
        const v = this._rootSection.getValue(key) ?? null;
        if (value != v) {
            if (value != null) {
                this._rootSection.setValue(key, value);
            }
            else {
                this._rootSection.deleteValue(key);
            }
            HostInterop.setConfigValue(key, value);
            Observable.publishNamedUpdate(`hicb:${key}`, value);
            this._allObservers.invoke(key, value);
            this.logDebugChange(key, value);
        }
    }

    private logDebugChange(key: string, value: (unknown | null)) {
        this._logger.logDebug("configchange", key, value);
    }

    getFirst(keys: string[]): (unknown | null) {
        throw new Error('Method not implemented.');
    }

    getFirstWithDefault(keys: string[], defaultValue: any): (unknown | null) {
        throw new Error('Method not implemented.');
    }

    observe(key: string, onValueUpdated: (value: unknown | null) => void): IDisposable {
        const expr = new ObservableExpression(() => this.get(key),
            (v) => { onValueUpdated(v ?? null); },
            (err) => { onValueUpdated(null); });

        return expr;
    }

    private _allObservers: CallbackSet<(key: string, value: (unknown | null)) => void> = new CallbackSet("ConfigBlockAllObservers");
    observeAll(onValueUpdated: (key: string, value: (unknown | null)) => void): IDisposable {
        return this._allObservers.add(onValueUpdated);
    }

    forEach(callback: (kvp: KeyValuePair<string, unknown | null>) => void): void {
        this.forEachInternal(this._rootSection, "", callback);
    }

    private forEachInternal(
        section: HierarchicalConfigBlockStorageSection,
        prefix: string,
        callback: (kvp: KeyValuePair<string, unknown | null>) => void): void {

        section.forEachValue((name, value) => {
            callback(new KeyValuePair(prefix + name, value));
        });
        section.forEachSection((name, subSection) => {
            const newPrefix = prefix + name + ".";
            this.forEachInternal(subSection, newPrefix, callback);
        });
    }
}


export class HostInteropConfigBlock implements ConfigBlock {

    static async createAsync(): Promise<HostInteropConfigBlock> {
        var pairs = await HostInterop.getConfigValuesAsync();
        const result = new HostInteropConfigBlock(pairs);
        HostInterop.registerConfigChangeCallback(kvp => {
            result.hostAssign(kvp.key, kvp.value);
        });
        //debugger;
        result.performMigration(ConfigSchemaVersion);
        return result;
    }

    private constructor(pairs: { key: string, value: (unknown | null)}[]) {
        this._logger = Logging.createLogger("HostInteropConfigBlock");
        for (let pair of pairs) {
            if (pair.value != null) {
                this._values.set(pair.key, pair.value);
            }
        }
    }

    private readonly _logger: Logger;
    private _values: SnapshottableMap<string, unknown | null> = new SnapshottableMap();

    get(key: string): unknown | null {
        let v = this._values.get(key) ?? null;
        if (v instanceof Array) {
            v = [ ...v ];
        }
        Observable.publishNamedRead(`hicb:${key}`, v);
        return v;
    }

    getWithDefault(key: string, defaultValue: any): (unknown | null) {
        return this.get(key) ?? defaultValue;
    }

    getFirst(keys: string[]): (unknown | null) {
        for (let tkey of keys) {
            const v = this.get(tkey);
            if (v != null) {
                return v;
            }
        }
        return null;
    }

    getFirstWithDefault(keys: string[], defaultValue: any): (unknown | null) {
        return this.getFirst(keys) ?? defaultValue;
    }

    set(key: string, value: unknown | null): void {
        const v = this._values.get(key) ?? null;
        if (value != v) {
            if (value != null) {
                this._values.set(key, value);
            }
            else {
                this._values.delete(key);
            }
            HostInterop.setConfigValue(key, value);
            Observable.publishNamedUpdate(`hicb:${key}`, value);
            this._allObservers.invoke(key, value);
            this.logDebugChange(key, value);
        }
    }

    observe(key: string, onValueUpdated: (value: unknown | null) => void): IDisposable {
        const expr = new ObservableExpression(() => this.get(key),
            (v) => { onValueUpdated(v ?? null); },
            (err) => { onValueUpdated(null); });

        return expr;
    }

    private _allObservers: CallbackSet<(key: string, value: (unknown | null)) => void> = new CallbackSet("ConfigBlockAllObservers");
    observeAll(onValueUpdated: (key: string, value: (unknown | null)) => void): IDisposable {
        return this._allObservers.add(onValueUpdated);
    }

    hostAssignSet(pairs: { key: string, value: (unknown | null) }[]): void {
        for (let pair of pairs) {
            this.hostAssign(pair.key, pair.value);
        }
    }

    hostAssign(key: string, value: (unknown | null)): void {
        const v = this._values.get(key) ?? null;
        if (value != v) {
            if (value != null) {
                this._values.set(key, value);
            }
            else {
                this._values.delete(key);
            }
            Observable.publishNamedUpdate(`hicb:${key}`, value);
            this._allObservers.invoke(key, value);
            this.logDebugChange(key, value);
        }
    }

    forEach(callback: (kvp: KeyValuePair<string, unknown | null>) => void) {
        this._values.forEachEntrySnapshotted(kvp => {
            callback(new KeyValuePair(kvp[0], kvp[1]));
        });
    }

    private logDebugChange(key: string, value: (unknown | null)) {
        this._logger.logDebug("configchange", key, value);
    }

    private performMigration(targetVersion: number) {
        const migrator = new ConfigMigrator(this);
        migrator.performMigration(targetVersion);
    }
}

class ConfigMigrator {
    constructor(
        private readonly configBlock: ConfigBlock) {

    }

    performMigration(targetVersion: number) {
        const rawCurrentVersion = +(this.configBlock.get("configVersion") ?? 0);
        const currentVersion = (isNaN(rawCurrentVersion) || !isFinite(rawCurrentVersion)) ? 0 : rawCurrentVersion;

        for (let thisVer = currentVersion + 1; thisVer <= targetVersion; thisVer++) {
            this.performSpecificVersionMigration(thisVer);
            this.configBlock.set("configVersion", thisVer);
        }
    }

    private performSpecificVersionMigration(version: number) {
        this.configBlock.forEach(kvp => {
            const key = kvp.key;
            const existingValue = kvp.value;
            const configSchemaItem = this.findConfigSchemaItemForKey(key, ConfigSchema.settings);
            if (configSchemaItem) {
                const newValue = this.performSpecificVersionMigrationForItem(version, existingValue, configSchemaItem);
                this.configBlock.set(key, newValue);
            }
        });
    }

    private performSpecificVersionMigrationForItem(version: number, existingValue: unknown, configSchemaItem: ConfigSchemaItemDefinitionItem) {
        if (configSchemaItem.migrations && configSchemaItem.migrations[version]) {
            try {
                const migrationFunc = configSchemaItem.migrations[version];
                const newValue = migrationFunc(existingValue);
                return newValue;
            }
            catch { }
        }
        return existingValue;
    }

    private findConfigSchemaItemForKey(key: string, section: ConfigSchemaItemDefinition[]): (ConfigSchemaItemDefinitionItem | null) {

        for (let k of section) {
            if (k.items) {
                const tk = k as ConfigSchemaItemDefinitionSection;
                const subCheck = this.findConfigSchemaItemForKey(key, tk.items);
                if (subCheck != null) {
                    return subCheck;
                }
            }
            else {
                const tk = k as ConfigSchemaItemDefinitionItem;
                if (this.isKeyMatchForConfigItem(key, tk)) {
                    return tk;
                }
            }
        }

        return null;
    }

    private isKeyMatchForConfigItem(key: string, tk: ConfigSchemaItemDefinitionItem): boolean {
        return key.endsWith("." + tk.configBlockKey);
    }
}