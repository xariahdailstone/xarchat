import { jsx } from "../../../../snabbdom/jsx";
import { VNode } from "../../../../snabbdom/vnode";
import { settingsRendererFor, SettingRenderArgs } from "./SettingsTypeRenderer";
import { SettingTypeRendererBase } from "./SettingTypeRendererBase";


@settingsRendererFor("text[]")
export class TextListSettingRenderer extends SettingTypeRendererBase {

    renderSetting(args: SettingRenderArgs): VNode {
        const setting = args.item;
        const v = setting.value as string[];
        return <div classList={["setting-entry", "setting-entry-textlist"]}>
            {v.map((str, idx) => <div classList={["setting-entry-textlist-item-container"]}>
                <input classList={["setting-entry-textlist-item-input", "theme-textbox"]} attr-type="text" attr-value={str} value-sync="true"
                    on={{
                        "change": (e) => { const newV = v.slice(); newV[idx] = (e.target as any).value; setting.value = newV; },
                        "input": (e) => { const newV = v.slice(); newV[idx] = (e.target as any).value; setting.value = newV; }
                    }} />
                <button classList={["setting-entry-textlist-item-btnremove", "theme-button", "theme-button-smaller"]}
                    on={{ "click": (e) => { const newV = v.slice(); newV.splice(idx, 1); setting.value = newV; } }}>Remove</button>
            </div>
            )}
            <div classList={["setting-entry-textlist-item-container-add"]}>
                <input classList={["setting-entry-textlist-item-input", "theme-textbox"]} attr-type="text" prop-value="" value-sync="true"
                    on={{
                        "change": (e) => { const newV = v.slice(); newV.push((e.target as any).value); setting.value = newV; },
                        "input": (e) => { const newV = v.slice(); newV.push((e.target as any).value); setting.value = newV; }
                    }} />
            </div>
        </div>;
    }
}

