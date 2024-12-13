import { AppViewModel } from "../../viewmodel/AppViewModel";
import { SettingsDialogSectionViewModel, SettingsDialogItemViewModel, SettingsDialogSettingViewModel, SettingsDialogTabViewModel, SettingsDialogViewModel } from "../../viewmodel/dialogs/SettingsDialogViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { RenderingComponentBase } from "../RenderingComponentBase";
import { DialogBorderType, DialogComponentBase, dialogViewFor } from "./DialogFrame";
import { Fragment, init, jsx, VNode, styleModule, toVNode, propsModule, eventListenersModule } from "../../snabbdom/index.js";
import { IterableUtils } from "../../util/IterableUtils";
import { HTMLUtils } from "../../util/HTMLUtils";
import { ConfigSchemaItemDefinitionItem } from "../../configuration/ConfigSchemaItem";
import { ColorHSSelectPopup } from "../popups/ColorHSSelectPopup";
import { ColorHSSelectPopupViewModel } from "../../viewmodel/popups/ColorHSSelectPopupViewModel";

@componentArea("dialogs")
@componentElement("x-settingsdialog")
@dialogViewFor(SettingsDialogViewModel)
export class SettingsDialog extends DialogComponentBase<SettingsDialogViewModel> {
    constructor() {
        super();
        HTMLUtils.assignStaticHTMLFragment(this.elMain, "<x-settingsdialogcontent></x-settingsdialogcontent>");
    }

    override get dialogBorderType() { return DialogBorderType.FULLPAGEWITHTITLEBAR; }
}

@componentArea("dialogs")
@componentElement("x-settingsdialogcontent")
export class SettingsDialogContent extends RenderingComponentBase<SettingsDialogViewModel> {
    constructor() {
        super();
    }

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
                <div classList={["tabpanel"]}>
                    { vm.selectedTab ? this.renderTabPane(vm.selectedTab) : "" }
                </div>
            </div>;
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
                case "color":
                    inner = this.renderSettingColor(setting);
                    break;
                case "color-hs":
                    inner = this.renderSettingColorHS(setting);
                    break;
                case "radio":
                    inner = this.renderSettingRadio(setting.schema);
                    break;
                case "text[]":
                    inner = this.renderSettingTextList(setting.schema);
                    break;
                case "timespan":
                    inner = this.renderSettingTimespan(setting.schema);
                    break;
            }
        }
        else {
            inner = <div classList={["setting-entry"]}>Unknown Setting Type: {setting.constructor.name}</div>;
        }

        if (setting.isDisabled) {
            settingClasses.push("setting-is-disabled");
        }
        return <div classList={settingClasses} props={{ "inert": setting.isDisabled }}>
            <div classList={["setting-title"]}>{setting.title}</div>
            <div classList={["setting-description"]}>{setting.description}</div>
            { inner }
        </div>;
    }

    private renderSettingText(setting: ConfigSchemaItemDefinitionItem): VNode {
        //return <input classList={["setting-entry", "setting-entry-text"]} attr-type="text"></input>
        return <></>;
    }

    private renderSettingBoolean(setting: SettingsDialogItemViewModel): VNode {
        const schema = setting.schema;
        return <x-themetoggle classList={["setting-entry", "setting-entry-boolean"]} 
            props={{ "value": !!setting.value }}
            on={{ "change": (e) => { console.log('on change', (e.target as any).value, setting); setting.value = (e.target as any).value; } }}></x-themetoggle>
    }

    private renderSettingColor(setting: SettingsDialogItemViewModel): VNode {
        return <div classList={["setting-entry", "setting-entry-color"]}>
            <div classList={[ "setting-entry-color-swatch" ]} style={{ "fontWeight": "bold", "backgroundColor": setting.value }}></div>
            <button classList={[ "setting-entry-color-btn-default", "theme-button" ]}
                on={{ "click": () => { setting.value = null; } }}>Default</button>
        </div>
    }

    private renderSettingColorHS(setting: SettingsDialogItemViewModel): VNode {
        const vparts = (setting.value as string).split(';');
        const cssValue = `hsl(${+vparts[0]}, ${+vparts[1]}%, 50%)`;
        return <div classList={["setting-entry", "setting-entry-color"]}>
            <div classList={[ "setting-entry-color-swatch" ]} style={{ "fontWeight": "bold", "backgroundColor": cssValue }}
                on={{ "click": (e) => { this.showColorHSPicker(setting, e.target as HTMLElement); } }}></div>
            <button classList={[ "setting-entry-color-btn-default", "theme-button" ]}
                on={{ "click": () => { setting.value = null; } }}>Default</button>
        </div>
    }
    private showColorHSPicker(setting: SettingsDialogItemViewModel, el: HTMLElement) {
        if (this.viewModel){
            const vparts = (setting.value as string).split(';');
            const vm = new ColorHSSelectPopupViewModel(this.viewModel.parent, el);
            vm.setHueSaturation(+vparts[0], +vparts[1]);
            vm.onChange = (h, s) => {
                const v = `${h.toString()};${s.toString()}`;
                setting.value = v;
            };
            this.viewModel.parent.popups.push(vm);
        }
    }

    private renderSettingRadio(setting: ConfigSchemaItemDefinitionItem): VNode {
        // return <div classList={["setting-entry", "setting-entry-radio-container"]}>
        //     <input attr-type="text"></input>
        // </div>
        return <></>;
    }

    private renderSettingTextList(setting: ConfigSchemaItemDefinitionItem): VNode {
        // return <div classList={["setting-entry", "setting-entry-textlist"]}>
        //     <input attr-type="text"></input>
        // </div>
        return <></>;
    }

    private renderSettingTimespan(setting: ConfigSchemaItemDefinitionItem): VNode {
        // return <div classList={["setting-entry", "setting-entry-timespan"]}>
        //     <input attr-type="text"></input>
        // </div>
        return <></>;
    }
}