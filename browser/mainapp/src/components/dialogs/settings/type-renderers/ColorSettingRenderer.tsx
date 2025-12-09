import { jsx } from "../../../../snabbdom/jsx";
import { VNode } from "../../../../snabbdom/vnode";
import { ISettingsDialogItemViewModel } from "../../../../viewmodel/dialogs/SettingsDialogViewModel";
import { ColorRGBSelectPopupViewModel } from "../../../../viewmodel/popups/ColorRGBSelectPopupViewModel";
import { settingsRendererFor, SettingRenderArgs } from "./SettingsTypeRenderer";
import { SettingTypeRendererBase } from "./SettingTypeRendererBase";

@settingsRendererFor("color")
export class ColorSettingRenderer extends SettingTypeRendererBase {

    renderSetting(args: SettingRenderArgs): VNode {
        const setting = args.item;

        return <div classList={["setting-entry", "setting-entry-color"]}>
            <div classList={["setting-entry-color-swatch"]} style={{ "fontWeight": "bold", "backgroundColor": setting.value }}
                on={{ "click": (e) => { this.showColorRGBPicker(args, e.target as HTMLElement); } }}></div>
            <button classList={["setting-entry-color-btn-default", "theme-button"]}
                on={{ "click": () => { setting.value = null; } }}>Default</button>
        </div>;
    }

    private showColorRGBPicker(args: SettingRenderArgs, el: HTMLElement) {
        const viewModel = args.dialogViewModel;
        const setting = args.item;

        if (viewModel) {
            const vm = new ColorRGBSelectPopupViewModel(viewModel.parent, el);
            vm.rgbString = setting.value;
            vm.onChange = (value) => {
                setting.value = value;
            };
            viewModel.parent.popups.push(vm);
        }
    }
}

