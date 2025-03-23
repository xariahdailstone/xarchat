import { AppViewModel } from "../../viewmodel/AppViewModel";
import { SettingsDialogSectionViewModel, SettingsDialogItemViewModel, SettingsDialogSettingViewModel, SettingsDialogTabViewModel, SettingsDialogViewModel } from "../../viewmodel/dialogs/SettingsDialogViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { makeRenderingComponent, RenderingComponentBase } from "../RenderingComponentBase";
import { DialogBorderType, DialogComponentBase, dialogViewFor } from "./DialogFrame";
import { Fragment, init, jsx, VNode, styleModule, toVNode, propsModule, eventListenersModule, h, Hooks, Attrs, On } from "../../snabbdom/index.js";
import { IterableUtils } from "../../util/IterableUtils";
import { HTMLUtils } from "../../util/HTMLUtils";
import { ConfigSchemaItemDefinitionItem, PingLineItemDefinition, PingLineItemMatchStyle, PingLineItemMatchStyleConvert } from "../../configuration/ConfigSchemaItem";
import { ColorHSSelectPopup } from "../popups/ColorHSSelectPopup";
import { ColorHSSelectPopupViewModel } from "../../viewmodel/popups/ColorHSSelectPopupViewModel";
import { HostInterop } from "../../util/HostInterop";
import { NotificationRouting, NotificationRoutingTargetSetting } from "../../configuration/NotificationRouting";
import { ColorRGBSelectPopupViewModel } from "../../viewmodel/popups/ColorRGBSelectPopupViewModel";
import { ThemeToggle } from "../ThemeToggle";
import { Collection } from "../../util/ObservableCollection";

@componentArea("dialogs")
@componentElement("x-settingsdialog")
@dialogViewFor(SettingsDialogViewModel)
export class SettingsDialog extends DialogComponentBase<SettingsDialogViewModel> {
    constructor() {
        super();
        makeRenderingComponent(
            this, {
                render: () => this.render()
            }
        );
    }

    override get dialogBorderType() { return DialogBorderType.FULLPAGEWITHTITLEBAR; }
    
    render(): VNode {
        const vm = this.viewModel;
        if (vm == null) {
            return <div></div>;
        }
        else {
            return <div classList={["settings-container"]}>
                <div classList={["tabstrip"]}>
                    { IterableUtils.asQueryable(vm.tabs).select(x => this.renderTab(x)).toArray() ?? "" }
                </div>
                <div classList={[ "contentarea" ]}>
                    <div classList={[ "treeview" ]}>
                        { vm.selectedTab ? this.renderTreeViewPane(vm.selectedTab.settings) : "" }
                    </div>
                    <div classList={["tabpanel"]}>
                        { vm.selectedTab ? this.renderTabPane(vm.selectedTab) : "" }
                    </div>
                </div>
            </div>;
        }
    }

    private renderTreeViewPane(settings: Collection<SettingsDialogSettingViewModel>): VNode {
        const items: VNode[] = [];

        for (let settingsItem of settings) {
            if (settingsItem instanceof SettingsDialogSectionViewModel) {
                items.push(<div classList={[ "treeview-item", "treeview-item-group" ]}>
                    <div classList={[ "treeview-item-group-title"]} on={{
                        "click": () => {
                            this.scrollToSection(settingsItem.title);
                        }
                    }}>{settingsItem.title}</div>
                    { this.renderTreeViewPane(settingsItem.settings) }
                </div>);
            }
        }

        return <div classList={[ "treeview-item-group-items"]}>{items}</div>;
    }

    private scrollToSection(title: string) {
        const tabpane = this.elMain.querySelector(".tabpane");
        const el = this.elMain.querySelector(`*[data-sectiontitle='${title}']`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth" });
        }
    }

    private renderTab(tab: SettingsDialogTabViewModel): VNode {
        return <div classList={{"tabstrip-tab": true, "selected": tab.parent.selectedTab == tab }}
                on={{ "click": () => { tab.select(); } }}>
            <div classList={["tabstrip-tab-title"]}>{tab.tabTitle}</div>
        </div>;
    }

    private renderTabPane(tab: SettingsDialogTabViewModel): VNode {
        return <div classList={["tabpane", "tabpane-standard"]}>
            <div classList={["tabpane-description"]}>{ tab.tabInstructions }</div>
            { IterableUtils.asQueryable(tab.settings).select(x => this.renderSetting(x)).toArray() }
        </div>;
    }

    private renderSetting(setting: SettingsDialogSettingViewModel): VNode {
        let inner: VNode;
        let settingClasses: string[] = ["setting"];

        if (setting instanceof SettingsDialogSectionViewModel) {
            settingClasses.push("setting-group");
            inner = <div classList={["setting-group-container"]}>{IterableUtils.asQueryable(setting.settings).select(x => this.renderSetting(x)).toArray()}</div>;
        }
        else if (setting instanceof SettingsDialogItemViewModel) {
            settingClasses.push("setting-item");
            switch (setting.schema.type) {
                case "text":
                    inner = this.renderSettingText(setting.schema);
                    break;
                case "boolean":
                    inner = this.renderSettingBoolean(setting);
                    break;
                case "integer":
                    inner = this.renderSettingInteger(setting);
                    break;
                case "color":
                    inner = this.renderSettingColor(setting);
                    break;
                case "bgcolorcontrol":
                    inner = this.renderSettingBgColorControl(setting);
                    break;
                case "color-hs":
                    inner = this.renderSettingColorHS(setting);
                    break;
                case "radio":
                    inner = this.renderSettingRadio(setting);
                    break;
                case "text[]":
                    inner = this.renderSettingTextList(setting);
                    break;
                case "pinglist":
                    inner = this.renderSettingPingList(setting);
                    break;
                case "timespan":
                    inner = this.renderSettingTimespan(setting.schema);
                    break;
                case "notifroutes":
                    inner = this.renderSettingNotifRoute(setting);
                    break;
                case "select":
                    inner = this.renderSettingSelect(setting);
                    break;
            }
        }
        else {
            inner = <div classList={["setting-entry"]}>Unknown Setting Type: {setting.constructor.name}</div>;
        }

        if (setting.isDisabled) {
            settingClasses.push("setting-is-disabled");
        }
        return <div classList={settingClasses} data-sectiontitle={setting.title} props={{ "inert": setting.isDisabled }}>
            <div classList={["setting-title"]}>{setting.title}</div>
            <div classList={["setting-description"]}>{setting.description}</div>
            { this.getInheritedInfoVNode(setting) }
            { inner }
        </div>;
    }

    private getInheritedInfoVNode(setting: SettingsDialogSettingViewModel): VNode {
        if (setting.showInheritedInfo) {
            if (setting.useInheritedValue) {
                return <div classList={["setting-inheritprompt", "setting-using-inherited"]}>{setting.inheritedFromText}</div>
            }
            else {
                const ihText = setting.revertToText;
                const atatPos = ihText.indexOf("@@");
                if (atatPos == -1) {
                    return <div classList={["setting-inheritprompt", "setting-revert-to-inherited"]}>{ihText}</div>;
                }
                else {
                    const beforeText = ihText.substring(0, atatPos);
                    const afterText = ihText.substring(atatPos + 2);
                    return <div classList={["setting-inheritprompt", "setting-revert-to-inherited"]}><span>{beforeText}</span>
                            <span classList={["revert-link"]}
                                on={{ "click": (e) => { setting.revertToInherited() } }}>here</span> 
                        <span>{afterText}</span></div>
                }
            }
        }
        else {
            return <></>;
        }
    }

    private renderSettingText(setting: ConfigSchemaItemDefinitionItem): VNode {
        //return <input classList={["setting-entry", "setting-entry-text"]} attr-type="text"></input>
        return <></>;
    }

    private renderSettingBoolean(setting: SettingsDialogItemViewModel): VNode {
        const schema = setting.schema;

        const hooks: Hooks = {
            postpatch: (o, n) => {
                (n.elm as ThemeToggle).value = !!setting.value;
            }
        }
        const onChange = (e: Event) => {
            this.logger.logDebug('on change', (e.target as ThemeToggle).value, setting.schema.id);
            setting.value = (e.target as ThemeToggle).value;
        };

        return <x-themetoggle classList={["setting-entry", "setting-entry-boolean"]} 
            props={{ "value": !!setting.value }} hook={hooks}
            on={{ "change": onChange }}></x-themetoggle>
    }

    private renderSettingInteger(setting: SettingsDialogItemViewModel): VNode {
        let min: number | undefined = setting.schema.min;
        let max: number | undefined = setting.schema.max;
        const attrs: Attrs = {
            "type": "number",
            "step": "1"
        };
        if (min != null) { attrs.min = min.toString(); }
        if (min != null) { attrs.max = min.toString(); }

        const vChange = (e: Event) => {
            const x = (e.target as HTMLInputElement).value.trim();
            if (x == "") {
                if (!(setting.schema.allowEmpty ?? false)) { return; }
                setting.value = null;
            }

            const xnum = parseInt(x);
            if (xnum == null) { return; }
            if (min != null && xnum < min) { return; }
            if (max != null && xnum > max) { return; }
            setting.value = xnum;
        };
        const evts: On = {
            "change": vChange,
            "input": vChange
        };

        return <input classList={["setting-entry", "setting-entry-integer"]} attrs={attrs} on={evts} props={{ "value": setting.value?.toString() ?? "" }}></input>
    }

    private renderSettingColor(setting: SettingsDialogItemViewModel): VNode {
        return <div classList={["setting-entry", "setting-entry-color"]}>
            <div classList={[ "setting-entry-color-swatch" ]} style={{ "fontWeight": "bold", "backgroundColor": setting.value }}
                on={{ "click": (e) => { this.showColorRGBPicker(setting, e.target as HTMLElement); } }}></div>
            <button classList={[ "setting-entry-color-btn-default", "theme-button" ]}
                on={{ "click": () => { setting.value = null; } }}>Default</button>
        </div>
    }
    private showColorRGBPicker(setting: SettingsDialogItemViewModel, el: HTMLElement) {
        if (this.viewModel){
            const vm = new ColorRGBSelectPopupViewModel(this.viewModel.parent, el);
            vm.rgbString = setting.value;
            vm.onChange = (value) => {
                setting.value = value;
            };
            this.viewModel.parent.popups.push(vm);
        }
    }

    private renderSettingBgColorControl(setting: SettingsDialogItemViewModel): VNode {
        const vparts = (setting.value as string).split(';');
        if (vparts.length == 2) {
            vparts.push("1");
        }

        const cssValue = `hsl(${+vparts[0]}, ${+vparts[1]}%, ${+vparts[2] * 50}%)`;
        return <div classList={["setting-entry", "setting-entry-color"]}>
            <div classList={[ "setting-entry-color-swatch" ]} style={{ "fontWeight": "bold", "backgroundColor": cssValue }}
                on={{ "click": (e) => { this.showColorHSPicker(setting, true, e.target as HTMLElement); } }}></div>
            <button classList={[ "setting-entry-color-btn-default", "theme-button" ]}
                on={{ "click": () => { setting.value = null; } }}>Default</button>
        </div>
    }

    private renderSettingColorHS(setting: SettingsDialogItemViewModel): VNode {
        const vparts = (setting.value as string).split(';');
        const cssValue = `hsl(${+vparts[0]}, ${+vparts[1]}%, 50%)`;
        return <div classList={["setting-entry", "setting-entry-color"]}>
            <div classList={[ "setting-entry-color-swatch" ]} style={{ "fontWeight": "bold", "backgroundColor": cssValue }}
                on={{ "click": (e) => { this.showColorHSPicker(setting, false, e.target as HTMLElement); } }}></div>
            <button classList={[ "setting-entry-color-btn-default", "theme-button" ]}
                on={{ "click": () => { setting.value = null; } }}>Default</button>
        </div>
    }
    private showColorHSPicker(setting: SettingsDialogItemViewModel, includeBrightnessFactor: boolean, el: HTMLElement) {
        if (this.viewModel){
            const vparts = (setting.value as string).split(';');
            const vm = new ColorHSSelectPopupViewModel(this.viewModel.parent, el, includeBrightnessFactor);
            if (!includeBrightnessFactor) {
                vm.setHueSaturation(+vparts[0], +vparts[1]);
            }
            else {
                vm.setHueSaturation(+vparts[0], +vparts[1], +vparts[2]);
            }
            vm.onChange = (h, s, b) => {
                let v: string;
                if (!includeBrightnessFactor) {
                    v = `${h.toString()};${s.toString()}`;
                }
                else {
                    v = `${h.toString()};${s.toString()};${b.toString()}`;
                }
                setting.value = v;
            };
            this.viewModel.parent.popups.push(vm);
        }
    }

    private renderSettingRadio(setting: SettingsDialogItemViewModel): VNode {
        const schema = setting.schema;
        const settingId = schema.id ?? this.getOrCreateSettingId(schema);
        const radioName = `el${schema.id}radio`;

        const curValue = setting.value as (string | undefined | null);

        const optNodes: VNode[] = [];
        for (let opts of schema.options!) {
            const radioOptId = `el${schema.id}radio${opts.id}`;

            let isEnabled: boolean;
            let isChecked: boolean;
            let labelContent: VNode;
            let handleSelected: () => void;
            
            switch (opts.type) {
                default:
                    labelContent = <>{opts.prompt ?? opts.value ?? "unspecified"}</>;
                    isChecked = (curValue == opts.value);
                    isEnabled = true;
                    handleSelected = () => {
                        this.logger.logDebug("assigning", opts.value);
                        setting.value = opts.value;
                    };
                    break;
                case "file":
                    {
                        let curFileName: string;
                        if (curValue && (curValue as string).startsWith("file:")) {
                            curFileName = (curValue as string).substring(5);
                            isEnabled = true;
                        }
                        else {
                            curFileName = "";
                            isEnabled = false;
                        }

                        handleSelected = () => {
                            const assignValue = `file:${curFileName}`;
                            this.logger.logDebug("assigning", assignValue);
                            setting.value = assignValue;
                        };
                        const chooseFile = async () => {
                            const fn = await HostInterop.chooseLocalFileAsync({
                                title: `Choose Audio File`,
                                file: curFileName,
                                filters: [
                                    { name: "MP3 Files (*.mp3)", pattern: "*.mp3" },
                                    { name: "All Files (*.*)", pattern: "*.*" },
                                ]
                            });
                            if (fn) {
                                setting.value = `file:${fn}`;
                            }
                        };

                        labelContent = <>
                                <button classList={[ "theme-button", "theme-button-smaller" ]}
                                    on={{ "click": (e) => chooseFile() }}>Select File</button>
                                <span>{curFileName}</span>
                            </>;
                        isChecked = isEnabled;
                    }
                    break;
            }

            const optNode = <div classList={["setting-entry-radio-option"]}>
                    <input attr-type="radio" id={radioOptId} attr-name={radioName} 
                            props={{
                                "checked": isChecked,
                                "disabled": !isEnabled
                            }}
                            on={{
                                "change": (e) => { if (((e.target) as HTMLInputElement).checked) { handleSelected(); } }
                            }}/>
                    <label attr-for={radioOptId}>{labelContent}</label>
                </div>;
            optNodes.push(optNode);
        }
        return <div classList={["setting-entry", "setting-entry-radio-container"]}>
            {optNodes}
        </div>
    }

    private static _nextGeneratedIdNum = 1;
    private static readonly ItemGeneratedIdSym = Symbol("ItemGeneratedIdSym");

    private getOrCreateSettingId(setting: ConfigSchemaItemDefinitionItem): string {
        let id = (setting as any)[SettingsDialog.ItemGeneratedIdSym] as (string | undefined | null);
        if (!id) {
            id = `gen${SettingsDialog._nextGeneratedIdNum++}`;
            (setting as any)[SettingsDialog.ItemGeneratedIdSym] = id;
        }
        return id;
    }

    private renderSettingPingList(setting: SettingsDialogItemViewModel): VNode {
        const rawv = setting.value as (string | PingLineItemDefinition)[];
        const v: PingLineItemDefinition[] = [];
        for (let item of rawv) {
            if (typeof item == "string") {
                v.push({ text: item, matchStyle: PingLineItemMatchStyle.CONTAINS });
            }
            else {
                v.push(item);
            }
        }

        const scratchValue: PingLineItemDefinition = setting.scratchValue 
            ? setting.scratchValue as PingLineItemDefinition
            : { text: "", matchStyle: PingLineItemMatchStyle.CONTAINS };

        const getTypeSelectVNode = (def: PingLineItemDefinition, onChange: (style: PingLineItemMatchStyle) => any) => {
            const optionNodes: VNode[] = [];
            const createOptionNode = (style: PingLineItemMatchStyle) => {
                optionNodes.push(<option attrs={{
                    "value": style.toString(),
                    "selected": def.matchStyle == style
                }}>{PingLineItemMatchStyleConvert.toString(style)}</option>)
            };
            createOptionNode(PingLineItemMatchStyle.CONTAINS);
            createOptionNode(PingLineItemMatchStyle.WHOLE_WORD);
            createOptionNode(PingLineItemMatchStyle.REGEX);
            return <select classList={[ "setting-entry-pinglist-item-type "]} on={{ 
                    "change": (e) => {
                        const elSelect = e.target as HTMLSelectElement;
                        const value = elSelect.value as PingLineItemMatchStyle;
                        onChange(value);
                    }
                }}>{optionNodes}</select>
        }
        const addFromScratchValue = (text: string) => {
            const addValue = { ...scratchValue, text: text };
            setting.scratchValue = null;

            const newV = v.slice(); 
            newV.push(addValue); 
            setting.value = newV;
        }

        return <div classList={["setting-entry", "setting-entry-pinglist"]}>
            {
                v.map((def, idx) => {
                    return <div classList={["setting-entry-pinglist-item-container"]}>
                        {getTypeSelectVNode(def, (newStyle) => {
                            const newV = v.slice(); newV[idx].matchStyle = newStyle; setting.value = newV;
                        })}
                        <input classList={["setting-entry-pinglist-item-input", "theme-textbox"]} attr-type="text" attr-value={def.text} value-sync="true"
                            on={{ 
                                    "change": (e) => { const newV = v.slice(); newV[idx].text = (e.target as HTMLInputElement).value; setting.value = newV; },
                                    "input": (e) => { const newV = v.slice(); newV[idx].text = (e.target as HTMLInputElement).value; setting.value = newV; } 
                                }} />
                        <button classList={["setting-entry-pinglist-item-btnremove", "theme-button", "theme-button-smaller"]}
                            on={{ "click": (e) => { const newV = v.slice(); newV.splice(idx, 1); setting.value = newV;  } }}>Remove</button>
                    </div>
                })
            }
            <div classList={["setting-entry-pinglist-item-container-add"]}>
                {getTypeSelectVNode(scratchValue, (newStyle) => {
                    setting.scratchValue = { ...scratchValue, matchStyle: newStyle };
                })}
                <input classList={["setting-entry-pinglist-item-input", "theme-textbox"]} attr-type="text" prop-value="" value-sync="true"
                    on={{ 
                            "change": (e) => { addFromScratchValue((e.target as HTMLInputElement).value); },
                            "input": (e) => { addFromScratchValue((e.target as HTMLInputElement).value); } 
                        }} />
            </div>
        </div>;
    }

    private renderSettingTextList(setting: SettingsDialogItemViewModel): VNode {
        const v = setting.value as string[];
        return <div classList={["setting-entry", "setting-entry-textlist"]}>
            {
                v.map((str, idx) =>
                    <div classList={["setting-entry-textlist-item-container"]}>
                        <input classList={["setting-entry-textlist-item-input", "theme-textbox"]} attr-type="text" attr-value={str} value-sync="true"
                            on={{ 
                                    "change": (e) => { const newV = v.slice(); newV[idx] = (e.target as any).value; setting.value = newV; },
                                    "input": (e) => { const newV = v.slice(); newV[idx] = (e.target as any).value; setting.value = newV; } 
                                }} />
                        <button classList={["setting-entry-textlist-item-btnremove", "theme-button", "theme-button-smaller"]}
                            on={{ "click": (e) => { const newV = v.slice(); newV.splice(idx, 1); setting.value = newV;  } }}>Remove</button>
                    </div>
                )
            }
            <div classList={["setting-entry-textlist-item-container-add"]}>
                <input classList={["setting-entry-textlist-item-input", "theme-textbox"]} attr-type="text" prop-value="" value-sync="true"
                    on={{ 
                            "change": (e) => { const newV = v.slice(); newV.push((e.target as any).value); setting.value = newV; },
                            "input": (e) => { const newV = v.slice(); newV.push((e.target as any).value); setting.value = newV; } 
                        }} />
            </div>
        </div>;
    }

    private renderSettingTimespan(setting: ConfigSchemaItemDefinitionItem): VNode {
        // return <div classList={["setting-entry", "setting-entry-timespan"]}>
        //     <input attr-type="text"></input>
        // </div>
        return <></>;
    }

    private renderSettingNotifRoute(setting: SettingsDialogItemViewModel): VNode {
        const settingId = this.getOrCreateSettingId(setting.schema);
        const nr = new NotificationRouting(setting.value as string);

        const makeButton = (title: string, value: NotificationRoutingTargetSetting, id: keyof NotificationRouting) => {
            const nextValue = value == "no" ? "yes"
                : value == "yes" ? "important"
                : "no";

            return <div classList={[ "notifroute-button", `notifroute-button-${value}` ]} on={{
                    "click": () => { 
                        (nr as any)[id] = nextValue;
                        setting.value = nr.toString()
                    }
                }}><span classList={[ "notifroute-button-text" ]}>{title}</span></div>;
        };
        const makeSelect = (title: string, id: keyof NotificationRouting, tooltip: string) => {
            const selId = `sel${settingId}-${id}`;
            const curValue = nr[id] as NotificationRoutingTargetSetting;

            let showButton = true;
            if (!(setting.schema.notifRouteOptions?.hasChannelContext ?? false) && id == "targetChannel") {
                showButton = false;
            }
            if (!(setting.schema.notifRouteOptions?.hasCharacterContext ?? false) && id == "pmConvo") {
                showButton = false;
            }

            return <div classList={["notifroute-button-container"]} attr-title={showButton ? tooltip : ""}>
                { showButton ? makeButton(title, curValue, id) : <></> }
            </div>;
        };

        return <div classList={["setting-entry", "setting-entry-notifroute"]}>
            { makeSelect("Console", "console", "Send notifications of this type to the console.") }
            { makeSelect("Current", "currentTab", "Send notifications of this type to the currently active tab.") }
            { makeSelect("Character", "pmConvo", "Send notifications of this type to the PM conversation tab for the related character (if one exists).") }
            { makeSelect("Channel", "targetChannel", "Send notifications of this type to the channel tab for the related channel (if one exists).") }
            { makeSelect("All", "everywhere", "Send notifications of this type to every open tab.") }
        </div>
    }

    private renderSettingSelect(setting: SettingsDialogItemViewModel): VNode {
        const optionNodes: VNode[] = [];

        const valueMap = new Map<number, any>();
        let nextValueNum = 1;

        for (let o of setting.schema.selectOptions!) {
            const isSelected = setting.value == o.value;
            const thisValueNum = nextValueNum++;
            valueMap.set(thisValueNum, o.value);
            optionNodes.push(<option attrs={{ "value": thisValueNum.toString(), "selected": isSelected }}>{o.displayValue ?? o.value.toString()}</option>)
        }

        const onChange = (e: Event) => {
            const elSelect = e.target as HTMLSelectElement;
            setting.value = valueMap.get(+elSelect.value);
        };

        return <div classList={[ "setting-entry", "setting-entry-select" ]}>
            <select classList={[ "theme-select" ]} on={{ "change": onChange }}>
                {optionNodes}
            </select>
        </div>;
    }
}