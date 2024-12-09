import { AppViewModel } from "../../viewmodel/AppViewModel";
import { SettingsDialogSettingViewModel, SettingsDialogStandardTabViewModel, SettingsDialogStringSettingViewModel, SettingsDialogTabViewModel, SettingsDialogViewModel } from "../../viewmodel/dialogs/SettingsDialogViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { RenderingComponentBase } from "../RenderingComponentBase";
import { DialogBorderType, DialogComponentBase, dialogViewFor } from "./DialogFrame";
import { Fragment, init, jsx, VNode, styleModule, toVNode, propsModule, eventListenersModule } from "../../snabbdom/index.js";
import { IterableUtils } from "../../util/IterableUtils";
import { HTMLUtils } from "../../util/HTMLUtils";

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
        let contents: VNode | null = null;
        if (tab instanceof SettingsDialogStandardTabViewModel) {
            return this.renderTabPaneStandard(tab);
        }
        else {
            return <div classList={["tabpane"]}>Unknown Pane Type: {tab.constructor.name}</div>;
        }
    }

    private renderTabPaneStandard(tab: SettingsDialogStandardTabViewModel): VNode {
        return <div classList={["tabpane", "tabpane-standard"]}>
            { IterableUtils.asQueryable(tab.settings).select(x => this.renderSetting(x)).toArray() }
        </div>;
    }

    private renderSetting(setting: SettingsDialogSettingViewModel): VNode {
        let inner: VNode;
        if (setting instanceof SettingsDialogStringSettingViewModel) {
            inner = this.renderSettingString(setting);
        }
        else {
            inner = <div classList={["setting-entry"]}>Unknown Setting Type: {setting.constructor.name}</div>;
        }

        return <div classList={["setting"]}>
            <div classList={["setting-title"]}>{setting.title}</div>
            <div classList={["setting-description"]}>{setting.description}</div>
            { inner }
        </div>;
    }

    private renderSettingString(setting: SettingsDialogStringSettingViewModel): VNode {
        return <div classList={["setting-entry", "setting-entry-text"]}>
            <input attr-type="text"></input>
        </div>
    }
}