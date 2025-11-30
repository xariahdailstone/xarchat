import { Hooks } from "../../../../snabbdom/hooks";
import { jsx } from "../../../../snabbdom/jsx";
import { VNode } from "../../../../snabbdom/vnode";
import { ThemeToggle } from "../../../ThemeToggle";
import { settingsRendererFor, ISettingsTypeRenderer, SettingRenderArgs } from "./SettingsTypeRenderer";


@settingsRendererFor("boolean")
export class BooleanSettingRenderer implements ISettingsTypeRenderer {

    renderSetting(args: SettingRenderArgs): VNode {
        const setting = args.item;

        const schema = setting.schema;

        const hooks: Hooks = {
            postpatch: (o, n) => {
                (n.elm as ThemeToggle).value = !!setting.value;
            }
        };
        const onChange = (e: Event) => {
            args.logger.logDebug('on change', (e.target as ThemeToggle).value, setting.schema.id);
            setting.value = (e.target as ThemeToggle).value;
        };

        return <x-themetoggle classList={["setting-entry", "setting-entry-boolean"]}
            props={{ "value": !!setting.value }} hook={hooks}
            on={{ "change": onChange }}></x-themetoggle>;
    }

}
