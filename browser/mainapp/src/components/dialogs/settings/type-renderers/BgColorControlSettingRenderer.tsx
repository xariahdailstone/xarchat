import { jsx } from "../../../../snabbdom/jsx";
import { VNode } from "../../../../snabbdom/vnode";
import { ColorHSSelectPopupViewModel } from "../../../../viewmodel/popups/ColorHSSelectPopupViewModel";
import { settingsRendererFor, SettingRenderArgs } from "./SettingsTypeRenderer";
import { SettingTypeRendererBase } from "./SettingTypeRendererBase";


@settingsRendererFor("bgcolorcontrol")
export class BgColorControlSettingRenderer extends SettingTypeRendererBase {
    renderSetting(args: SettingRenderArgs): VNode {
        const setting = args.item;

        const vparts = (setting.value as string).split(';');
        if (vparts.length == 2) {
            vparts.push("1");
        }

        const cssValue = `hsl(${+vparts[0]}, ${+vparts[1]}%, ${+vparts[2] * 50}%)`;
        return <div classList={["setting-entry", "setting-entry-color"]}>
            <div classList={["setting-entry-color-swatch"]} style={{ "fontWeight": "bold", "backgroundColor": cssValue }}
                on={{ "click": (e) => { this.showColorHSPicker(args, true, e.target as HTMLElement); } }}></div>
            <button classList={["setting-entry-color-btn-default", "theme-button"]}
                on={{ "click": () => { setting.value = null; } }}>Default</button>
        </div>;
    }


}


