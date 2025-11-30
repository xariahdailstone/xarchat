import { Attrs, On } from "../../../../snabbdom/index";
import { jsx } from "../../../../snabbdom/jsx";
import { VNode } from "../../../../snabbdom/vnode";
import { StringUtils } from "../../../../util/StringUtils";
import { settingsRendererFor, ISettingsTypeRenderer, SettingRenderArgs } from "./SettingsTypeRenderer";

@settingsRendererFor("integer")
export class IntegerSettingRenderer implements ISettingsTypeRenderer {

    renderSetting(args: SettingRenderArgs): VNode {
        const setting = args.item;

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

        return <input classList={["setting-entry", "setting-entry-integer", "themed"]} attrs={attrs} on={evts} props={{ "value": setting.value?.toString() ?? "" }}></input>;
    }
}


