import { jsx } from "../../../../snabbdom/jsx";
import { VNode } from "../../../../snabbdom/vnode";
import { settingsRendererFor, SettingRenderArgs } from "./SettingsTypeRenderer";
import { SettingTypeRendererBase } from "./SettingTypeRendererBase";



@settingsRendererFor("color-hs")
export class ColorHSSettingRenderer extends SettingTypeRendererBase {

    renderSetting(args: SettingRenderArgs): VNode {
        const setting = args.item;

        const vparts = (setting.value as string).split(';');
        const cssValue = `hsl(${+vparts[0]}, ${+vparts[1]}%, 50%)`;
        return <div classList={["setting-entry", "setting-entry-color"]}>
            <div classList={["setting-entry-color-swatch"]} style={{ "fontWeight": "bold", "backgroundColor": cssValue }}
                on={{ "click": (e) => { this.showColorHSPicker(args, false, e.target as HTMLElement); } }}></div>
            <button classList={["setting-entry-color-btn-default", "theme-button"]}
                on={{ "click": () => { setting.value = null; } }}>Default</button>
        </div>;
    }

}

