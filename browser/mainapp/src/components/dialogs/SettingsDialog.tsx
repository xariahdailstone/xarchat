import { AppViewModel, GetConfigSettingChannelViewModel } from "../../viewmodel/AppViewModel";
import { SettingsDialogSectionViewModel, SettingsDialogItemViewModel, SettingsDialogSettingViewModel, SettingsDialogTabViewModel, SettingsDialogViewModel, ISettingsDialogItemViewModel, ISettingsDialogSettingViewModel } from "../../viewmodel/dialogs/SettingsDialogViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { makeRenderingComponent, RenderingComponentBase } from "../RenderingComponentBase";
import { DialogBorderType, DialogComponentBase, dialogViewFor } from "./DialogFrame";
import { Fragment, init, jsx, VNode, styleModule, toVNode, propsModule, eventListenersModule, h, Hooks, Attrs, On, VNodeStyle } from "../../snabbdom/index.js";
import { IterableUtils } from "../../util/IterableUtils";
import { HTMLUtils } from "../../util/HTMLUtils";
import { ConfigSchemaItemDefinitionItem, EnableIfOptions, PingLineItemDefinition, PingLineItemMatchStyle, PingLineItemMatchStyleConvert } from "../../configuration/ConfigSchemaItem";
import { ColorHSSelectPopup } from "../popups/ColorHSSelectPopup";
import { ColorHSSelectPopupViewModel } from "../../viewmodel/popups/ColorHSSelectPopupViewModel";
import { HostInterop } from "../../util/hostinterop/HostInterop";
import { NotificationRouting, NotificationRoutingTargetSetting } from "../../configuration/NotificationRouting";
import { ColorRGBSelectPopupViewModel } from "../../viewmodel/popups/ColorRGBSelectPopupViewModel";
import { ThemeToggle } from "../ThemeToggle";
import { Collection } from "../../util/ObservableCollection";
import { ChannelName } from "../../shared/ChannelName";
import { StringUtils } from "../../util/StringUtils";

const EMOJI_NO = "\u274C";
const EMOJI_YES = "\u2705";
const EMOJI_IMPORTANT = "\u26A0\uFE0F";

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
                        { vm.selectedTab ? this.renderTabPane(vm, vm.selectedTab) : "" }
                    </div>
                </div>
            </div>;
        }
    }

    private renderTreeViewPane(settings: Collection<ISettingsDialogSettingViewModel>): VNode {
        const items: VNode[] = [];

        for (let settingsItem of settings) {
            if (!settingsItem.isItem) {
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

    private renderTabPane(vm: SettingsDialogViewModel, tab: SettingsDialogTabViewModel): VNode {
        return <div classList={["tabpane", "tabpane-standard"]}>
            <div classList={["tabpane-description"]}>{ tab.tabInstructions }</div>
            { IterableUtils.asQueryable(tab.settings).select(x => this.renderSetting(vm, x)).toArray() }
        </div>;
    }

    private renderSetting(vm: SettingsDialogViewModel, setting: ISettingsDialogSettingViewModel): VNode {
        let inner: VNode;
        let actionButtonsNode: VNode | null = null;
        let settingClasses: string[] = ["setting"];

        if (setting instanceof SettingsDialogSectionViewModel) {
            settingClasses.push("setting-group");
            inner = <div classList={["setting-group-container"]}>{IterableUtils.asQueryable(setting.settings).select(x => this.renderSetting(vm, x)).toArray()}</div>;
        }
        else if (setting.isItem) {
            const itemSetting = setting as unknown as ISettingsDialogItemViewModel;
            settingClasses.push("setting-item");
            if (itemSetting.isReadOnly) {
                settingClasses.push("setting-item-readonly");
            }
            switch (itemSetting.schema.type) {
                case "text":
                    inner = this.renderSettingText(itemSetting);
                    break;
                case "boolean":
                    inner = this.renderSettingBoolean(itemSetting);
                    break;
                case "integer":
                    inner = this.renderSettingInteger(itemSetting);
                    break;
                case "number":
                    inner = this.renderSettingNumber(itemSetting);
                    break;
                case "color":
                    inner = this.renderSettingColor(itemSetting);
                    break;
                case "bgcolorcontrol":
                    inner = this.renderSettingBgColorControl(itemSetting);
                    break;
                case "color-hs":
                    inner = this.renderSettingColorHS(itemSetting);
                    break;
                case "radio":
                    inner = this.renderSettingRadio(itemSetting);
                    break;
                case "text[]":
                    inner = this.renderSettingTextList(itemSetting);
                    break;
                case "pinglist":
                    inner = this.renderSettingPingList(itemSetting);
                    break;
                case "timespan":
                    inner = this.renderSettingTimespan(itemSetting.schema);
                    break;
                case "notifroutes":
                    inner = this.renderSettingNotifRoute(itemSetting);
                    break;
                case "select":
                    inner = this.renderSettingSelect(itemSetting);
                    break;
                case "displaytext":
                    inner = this.renderSettingDisplayText(itemSetting);
                    break;
            }

            if (itemSetting.schema.actionButtons && itemSetting.schema.actionButtons.length > 0) {
                const buttonNodes: VNode[] = [];
                for (let ab of itemSetting.schema.actionButtons) {
                    const buttonNode = <button classList={[ "setting-actionbuttons-button", "themed" ]} on={{
                        "click": () => {
                            ab.onClick({
                               appViewModel: vm.parent 
                            });
                        }
                    }}>{ab.title}</button>;
                    buttonNodes.push(buttonNode);
                }
                actionButtonsNode = <div classList={[ "setting-actionbuttons" ]}>
                    { buttonNodes }
                </div>;
            }
        }
        else {
            inner = <div classList={["setting-entry"]}>Unknown Setting Type: {setting.constructor.name}</div>;
        }

        if (setting.isDisabled) {
            settingClasses.push("setting-is-disabled");
        }
        if (setting instanceof SettingsDialogItemViewModel && setting.schema.enableIf) {
            const eiFunc = setting.schema.enableIf;
            const eiOpts: EnableIfOptions = {
                myCharacterName: setting.scope.myCharacter,
                channelCategory: setting.scope.categoryName,
                channelName: setting.scope.targetChannel ?? undefined,
                interlocutorName: setting.scope.pmConvoCharacter,
                getConfigEntryById: (id: string) => {
                    let xx: GetConfigSettingChannelViewModel | undefined;
                    if (setting.scope.categoryName && setting.scope.targetChannel) {
                        xx = { channelCategory: setting.scope.categoryName, channelTitle: setting.scope.targetChannel };
                    }
                    else if (setting.scope.pmConvoCharacter) {
                        xx = { characterName: setting.scope.pmConvoCharacter };
                    }

                    return vm.parent.getConfigSettingById(id,
                        setting.scope.myCharacter ? { characterName: setting.scope.myCharacter } : null,
                        xx
                    );
                }
            };
            if (!eiFunc(eiOpts)) {
                settingClasses.push("setting-is-disabled");
            }
        }

        
        return <div classList={settingClasses} data-sectiontitle={setting.title} props={{ "inert": setting.isDisabled }}>
            <div classList={["setting-title"]}>{setting.title}</div>
            <div classList={["setting-description"]}>{setting.description}</div>
            { this.getInheritedInfoVNode(setting) }
            { inner }
            { actionButtonsNode }
        </div>;
    }

    private getInheritedInfoVNode(setting: ISettingsDialogSettingViewModel): VNode {
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

    private renderSettingDisplayText(setting: ISettingsDialogItemViewModel): VNode {
        return <div classList={["setting-entry", "setting-entry-displaytext"]}>{setting.value}</div>;
    }

    private renderSettingText(setting: ISettingsDialogItemViewModel): VNode {

        const hooks: Hooks = {
            postpatch: (o, n) => {
                const elInput = (n.elm as HTMLInputElement);
                if (elInput.value != setting.value) {
                    elInput.value = setting.value;
                }
            }
        }

        const onValueChange = (e: Event) => {
            const txtValue = (e.target as HTMLInputElement).value;
            if (setting.value != txtValue) {
                setting.value = txtValue;
            }
        };

        const attrs: Attrs = {
            "text": "text"
        };
        if (setting.schema.maxLength != null) {
            attrs["maxlength"] = setting.schema.maxLength.toString();
        }
        if (setting.schema.fieldWidth != null) {
            attrs["style"] = `width: ${setting.schema.fieldWidth}; max-width: 100%;`;
        }

        return <input classList={["setting-entry", "setting-entry-text", "themed"]}
            attrs={attrs}
            hook={hooks}
            props={{ value: setting.value }}
            on={{
                "input": onValueChange,
                "change": onValueChange
            }}></input>
    }

    private renderSettingBoolean(setting: ISettingsDialogItemViewModel): VNode {
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

    private setupValidatingInput(
        elNode: VNode,
        validateFunc: (value: string) => { valid: boolean, validationMessage?: string, result?: any },
        assignFunc: (value: any) => void) {

        const processValue = (e: Event, report: boolean) => {
            const el = (e.target as HTMLInputElement);
            const enteredValue = el.value;
            const valResult = validateFunc(enteredValue);
            if (valResult.valid) {
                if (report) {
                    assignFunc(valResult.result);
                }
                el.title = "";
                el.classList.remove("invalid-value");
            }
            else {
                if (report) {
                    el.title = valResult.validationMessage ?? "Invalid value.";
                    el.classList.add("invalid-value");
                }
            }
        };
        const evts: On = {
            "input": (e: Event) => processValue(e, false),
            "blur": (e: Event) => processValue(e, true)
        }

        elNode.data = elNode.data ?? {};
        elNode.data.on = { ...(elNode.data?.on ?? {}), ...evts };
    }

    private renderSettingInteger(setting: ISettingsDialogItemViewModel): VNode {
        let min: number | undefined = setting.schema.min;
        let max: number | undefined = setting.schema.max;
        const attrs: Attrs = {
            "type": "number",
            "step": "1"
        };
        if (min != null) { attrs.min = min.toString(); }
        if (max != null) { attrs.max = max.toString(); }

        const validateTextboxValue = (x: string) => {
            if (x == "") {
                if (!(setting.schema.allowEmpty ?? false)) { return "A value is required."; }
                setting.value = null;
            }

            const xnum = !StringUtils.isNullOrWhiteSpace(x) ? +x : null;
            if (xnum == null) { return "Invalid value."; }
            if (min != null && xnum < min) { return `Value must be between ${min} and ${max}.`; }
            if (max != null && xnum > max) { return `Value must be between ${min} and ${max}.`; }
            setting.value = xnum;
            return null;
        };
        const vChange = (e: Event) => {
            const tgt = (e.target as HTMLInputElement);
            const x = tgt.value.trim();
            const err = validateTextboxValue(x);
            if (err) {
                tgt.setCustomValidity(err);
            }
            else {
                tgt.setCustomValidity("");
            }
            tgt.reportValidity();
        };

        const evts: On = {
            "change": vChange,
            "input": vChange
        };

        return <input classList={["setting-entry", "setting-entry-integer", "themed"]} attrs={attrs} on={evts} props={{ "value": setting.value?.toString() ?? "" }}></input>
    }

    private renderSettingNumber(setting: ISettingsDialogItemViewModel): VNode {
        let min: number | undefined = setting.schema.min;
        let max: number | undefined = setting.schema.max;
        const attrs: Attrs = {
            "type": "text"
        };
        const styles: VNodeStyle = {
        };
        if (setting.schema.fieldWidth) {
            styles["width"] = setting.schema.fieldWidth;
        }

        const resNode = <input classList={["setting-entry", "setting-entry-integer", "themed"]} 
                attrs={attrs} 
                props={{ "value": setting.value?.toString() ?? "" }} style={styles}></input>
        this.setupValidatingInput(resNode,
            (x: string) => {
                if (x == "") {
                    if (!(setting.schema.allowEmpty ?? false)) { return { valid: false, validationMessage: "A value is required." }; }
                }

                const xnum = !StringUtils.isNullOrWhiteSpace(x) ? +x : null;
                if (xnum == null || isNaN(xnum) || !isFinite(xnum)) { return { valid: false, validationMessage: "Invalid value." }; }
                if (min != null && xnum < min) { return { valid: false, validationMessage: `Value too small. Must be between ${min} and ${max}.`}; }
                if (max != null && xnum > max) { return { valid: false, validationMessage: `Value too large. Must be between ${min} and ${max}.`}; }
                return { valid: true, result: xnum };
            },
            (v) => {
                setting.value = v;
            }
        );

        return resNode;
    }

    private renderSettingColor(setting: ISettingsDialogItemViewModel): VNode {
        return <div classList={["setting-entry", "setting-entry-color"]}>
            <div classList={[ "setting-entry-color-swatch" ]} style={{ "fontWeight": "bold", "backgroundColor": setting.value }}
                on={{ "click": (e) => { this.showColorRGBPicker(setting, e.target as HTMLElement); } }}></div>
            <button classList={[ "setting-entry-color-btn-default", "theme-button" ]}
                on={{ "click": () => { setting.value = null; } }}>Default</button>
        </div>
    }
    private showColorRGBPicker(setting: ISettingsDialogItemViewModel, el: HTMLElement) {
        if (this.viewModel){
            const vm = new ColorRGBSelectPopupViewModel(this.viewModel.parent, el);
            vm.rgbString = setting.value;
            vm.onChange = (value) => {
                setting.value = value;
            };
            this.viewModel.parent.popups.push(vm);
        }
    }

    private renderSettingBgColorControl(setting: ISettingsDialogItemViewModel): VNode {
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

    private renderSettingColorHS(setting: ISettingsDialogItemViewModel): VNode {
        const vparts = (setting.value as string).split(';');
        const cssValue = `hsl(${+vparts[0]}, ${+vparts[1]}%, 50%)`;
        return <div classList={["setting-entry", "setting-entry-color"]}>
            <div classList={[ "setting-entry-color-swatch" ]} style={{ "fontWeight": "bold", "backgroundColor": cssValue }}
                on={{ "click": (e) => { this.showColorHSPicker(setting, false, e.target as HTMLElement); } }}></div>
            <button classList={[ "setting-entry-color-btn-default", "theme-button" ]}
                on={{ "click": () => { setting.value = null; } }}>Default</button>
        </div>
    }
    private showColorHSPicker(setting: ISettingsDialogItemViewModel, includeBrightnessFactor: boolean, el: HTMLElement) {
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

    private renderSettingRadio(setting: ISettingsDialogItemViewModel): VNode {
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
                                    { name: "MP3 Files", extensions: [ "mp3" ] }
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

    private renderSettingPingList(setting: ISettingsDialogItemViewModel): VNode {
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
                optionNodes.push(<x-xcoption key={style.toString()} attrs={{
                    "value": style.toString(),
                    "selected": def.matchStyle == style
                }}>{PingLineItemMatchStyleConvert.toString(style)}</x-xcoption>)
            };
            createOptionNode(PingLineItemMatchStyle.CONTAINS);
            createOptionNode(PingLineItemMatchStyle.WHOLE_WORD);
            createOptionNode(PingLineItemMatchStyle.REGEX);
            return <x-xcselect classList={[ "setting-entry-pinglist-item-type "]}
                props={{
                    value: def.matchStyle.toString()
                }}
                on={{ 
                    "change": (e) => {
                        const elSelect = e.target as HTMLSelectElement;
                        const value = elSelect.value as PingLineItemMatchStyle;
                        onChange(value);
                    }
                }}>{optionNodes}</x-xcselect>
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

    private renderSettingTextList(setting: ISettingsDialogItemViewModel): VNode {
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

    private renderSettingNotifRoute(setting: ISettingsDialogItemViewModel): VNode {
        const settingId = this.getOrCreateSettingId(setting.schema);
        const nr = new NotificationRouting(setting.value as string);

        const makeButton = (title: string, value: NotificationRoutingTargetSetting, id: keyof NotificationRouting,
            availableOptions: NotificationRoutingTargetSetting[]) => {

            // const nextValue = value == "no" ? "yes"
            //     : value == "yes" ? "important"
            //     : "no";

            const noOption = availableOptions.includes("no")
                ? <x-xcoption key="no" attrs={{ value: "no", selected: value=="no" }}>{EMOJI_NO} No</x-xcoption>
                : null;
            const yesOption = availableOptions.includes("yes")
                ? <x-xcoption key="yes" attrs={{ value: "yes", selected: value=="yes" }}>{EMOJI_YES} Yes</x-xcoption>
                : null;
            const importantOption = availableOptions.includes("important")
                ? <x-xcoption key="yesi" attrs={{ value: "important", selected: value=="important" }}>{EMOJI_IMPORTANT} Yes (as Important)</x-xcoption>
                : null;

            const selNode = <x-xcselect classList={[ "notifroute-button", `notifroute-button-${value}`, 'themed' ]} props={{
                "value": value
            }} on={{
                "change": (e) => {
                    const selEl = e.target as HTMLSelectElement;
                    (nr as any)[id] = (selEl.selectedIndex == 0) ? "no"
                        : (selEl.selectedIndex == 1) ? "yes"
                        : (selEl.selectedIndex == 2) ? "important"
                        : "no";
                    setting.value = nr.toString();
                }
            }}>
                {noOption}
                {yesOption}
                {importantOption}
            </x-xcselect>

            return selNode;

            // return <div classList={[ "notifroute-button", `notifroute-button-${value}` ]} on={{
            //         "click": () => { 
            //             (nr as any)[id] = nextValue;
            //             setting.value = nr.toString()
            //         }
            //     }}><span classList={[ "notifroute-button-text" ]}>{title}</span></div>;
        };
        const makeSelect = (title: string, id: keyof NotificationRouting, tooltip: string, availableOptions?: NotificationRoutingTargetSetting[]) => {
            const selId = `sel${settingId}-${id}`;
            const curValue = nr[id] as NotificationRoutingTargetSetting;

            availableOptions ??= [ "no", "yes", "important" ];

            let showButton = true;
            if (!(setting.schema.notifRouteOptions?.hasChannelContext ?? false) && id == "targetChannel") {
                showButton = false;
            }
            if (!(setting.schema.notifRouteOptions?.hasCharacterContext ?? false) && id == "pmConvo") {
                showButton = false;
            }

            return <div classList={["notifroute-button-container"]} attr-title={showButton ? tooltip : ""}>
                <div classList={[ "notifroute-button-container-title" ]}>{title}</div>
                <div classList={[ "notifroute-button-container-description" ]}>{tooltip}</div>
                { showButton ? makeButton(title, curValue, id, availableOptions) : <></> }
            </div>;
        };
        const makeUnavailableSelect = () => {
            return <div classList={["notifroute-button-container"]}>
                <></>
            </div>;
        }

        const characterSelect: (VNode | null) = (setting.schema.notifRouteOptions?.hasCharacterContext ?? false)
            ? makeSelect("Character", "pmConvo", "Send to the PM conversation tab for character (if one exists).")
            : null;

        const channelSelect: (VNode | null) = (setting.schema.notifRouteOptions?.hasChannelContext ?? false)
            ? makeSelect("Channel", "targetChannel", "Send to the channel tab for the channel (if one exists).")
            : null;

        const toastSelect: (VNode | null) = (setting.schema.notifRouteOptions?.canToast ?? false)
            ? makeSelect("Toast", "toast", "Show as an in-app toast popup.", [ "no", "yes"])
            : null;

        const notificationSelect: (VNode | null) = (setting.schema.notifRouteOptions?.canGoToNotifications ?? false)
            ? makeSelect("Notification", "notification", "Add to the \"Recent Notifications\" tab.", [ "no", "yes"])
            : null;

        return <div classList={["setting-entry", "setting-entry-notifroute"]}>
            <div classList={[ "setting-entry-notifroute-group" ]}>
                <div classList={[ "setting-entry-notifroute-group-title" ]}>Chat Tabs</div>
                { makeSelect("Console", "console", "Send to the console.") }
                { makeSelect("Current", "currentTab", "Send to the currently active tab.") }
                { characterSelect }
                { channelSelect }
                { makeSelect("All", "everywhere", "Send to every open tab.") }
            </div>
            <div classList={[ "setting-entry-notifroute-group" ]}>
                <div classList={[ "setting-entry-notifroute-group-title" ]}>Notifications</div>
                { toastSelect }
                { notificationSelect }
            </div>
        </div>
    }

    private renderSettingSelect(setting: ISettingsDialogItemViewModel): VNode {
        const optionNodes: VNode[] = [];

        const valueMap = new Map<number, any>();
        let nextValueNum = 1;

        let selectedValue: string = "";
        for (let o of setting.schema.selectOptions!) {
            const isSelected = setting.value == o.value;
            const thisValueNum = nextValueNum++;
            selectedValue = thisValueNum.toString();
            valueMap.set(thisValueNum, o.value);
            optionNodes.push(<x-xcoption key={thisValueNum.toString()} attrs={{ "value": thisValueNum.toString(), "selected": isSelected }}>{o.displayValue ?? o.value.toString()}</x-xcoption>)
        }

        const onChange = (e: Event) => {
            const elSelect = e.target as HTMLSelectElement;
            setting.value = valueMap.get(+elSelect.value);
        };

        return <div classList={[ "setting-entry", "setting-entry-select" ]}>
            <x-xcselect classList={[ "themed" ]} props={{ "value": selectedValue }} on={{ "change": onChange }}>
                {optionNodes}
            </x-xcselect>
        </div>;
    }
}