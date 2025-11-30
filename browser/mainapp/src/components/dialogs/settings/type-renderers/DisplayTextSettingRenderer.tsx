import { jsx } from "../../../../snabbdom/jsx";
import { VNode } from "../../../../snabbdom/vnode";
import { settingsRendererFor, SettingRenderArgs } from "./SettingsTypeRenderer";
import { SettingTypeRendererBase } from "./SettingTypeRendererBase";


@settingsRendererFor("displaytext")
export class DisplayTextSettingRenderer extends SettingTypeRendererBase {

    renderSetting(args: SettingRenderArgs): VNode {
        const setting = args.item;
        return <div classList={["setting-entry", "setting-entry-displaytext"]}>{setting.value}</div>;
    }

}
