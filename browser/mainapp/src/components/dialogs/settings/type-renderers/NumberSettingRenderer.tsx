import { Attrs, VNodeStyle } from "../../../../snabbdom/index";
import { jsx } from "../../../../snabbdom/jsx";
import { VNode } from "../../../../snabbdom/vnode";
import { StringUtils } from "../../../../util/StringUtils";
import { settingsRendererFor, ISettingsTypeRenderer, SettingRenderArgs } from "./SettingsTypeRenderer";
import { SettingTypeRendererBase } from "./SettingTypeRendererBase";

@settingsRendererFor("number")
export class NumberSettingRenderer extends SettingTypeRendererBase {

    renderSetting(args: SettingRenderArgs): VNode {
        const setting = args.item;

        let min: number | undefined = setting.schema.min;
        let max: number | undefined = setting.schema.max;
        const attrs: Attrs = {
            "type": "text"
        };
        const styles: VNodeStyle = {};
        if (setting.schema.fieldWidth) {
            styles["width"] = setting.schema.fieldWidth;
        }

        const resNode = <input classList={["setting-entry", "setting-entry-integer", "themed"]}
            attrs={attrs}
            props={{ "value": setting.value?.toString() ?? "" }} style={styles}></input>;
        this.setupValidatingInput(resNode,
            (x: string) => {
                if (x == "") {
                    if (!(setting.schema.allowEmpty ?? false)) { return { valid: false, validationMessage: "A value is required." }; }
                }

                const xnum = !StringUtils.isNullOrWhiteSpace(x) ? +x : null;
                if (xnum == null || isNaN(xnum) || !isFinite(xnum)) { return { valid: false, validationMessage: "Invalid value." }; }
                if (min != null && xnum < min) { return { valid: false, validationMessage: `Value too small. Must be between ${min} and ${max}.` }; }
                if (max != null && xnum > max) { return { valid: false, validationMessage: `Value too large. Must be between ${min} and ${max}.` }; }
                return { valid: true, result: xnum };
            },
            (v) => {
                setting.value = v;
            }
        );

        return resNode;
    }
}

