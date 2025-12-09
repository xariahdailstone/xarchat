import { Attrs, Hooks, jsx, VNode } from "../../../../snabbdom/index";
import { ISettingsTypeRenderer, SettingRenderArgs, settingsRendererFor } from "./SettingsTypeRenderer";

@settingsRendererFor("text")
export class TextSettingRenderer implements ISettingsTypeRenderer {

    renderSetting(args: SettingRenderArgs): VNode {
        
        const setting = args.item;

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

}


