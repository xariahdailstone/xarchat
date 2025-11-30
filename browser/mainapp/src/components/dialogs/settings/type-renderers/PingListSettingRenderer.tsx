import { PingLineItemDefinition, PingLineItemMatchStyle, PingLineItemMatchStyleConvert } from "../../../../configuration/ConfigSchemaItem";
import { jsx } from "../../../../snabbdom/jsx";
import { VNode } from "../../../../snabbdom/vnode";
import { settingsRendererFor, SettingRenderArgs } from "./SettingsTypeRenderer";
import { SettingTypeRendererBase } from "./SettingTypeRendererBase";


@settingsRendererFor("pinglist")
export class PingListSettingRenderer extends SettingTypeRendererBase {

    renderSetting(args: SettingRenderArgs): VNode {
        const setting = args.item;
        const rawv = setting.value as (string | PingLineItemDefinition)[];
        const v: PingLineItemDefinition[] = [];
        for (let item of rawv) {
            if (typeof item == "string") {
                v.push({ text: item, matchStyle: PingLineItemMatchStyle.CONTAINS });
            }
            else {
                v.push(item);
            }
        }

        const scratchValue: PingLineItemDefinition = setting.scratchValue
            ? setting.scratchValue as PingLineItemDefinition
            : { text: "", matchStyle: PingLineItemMatchStyle.CONTAINS };

        const getTypeSelectVNode = (def: PingLineItemDefinition, onChange: (style: PingLineItemMatchStyle) => any) => {
            const optionNodes: VNode[] = [];
            const createOptionNode = (style: PingLineItemMatchStyle) => {
                optionNodes.push(<x-xcoption key={style.toString()} attrs={{
                    "value": style.toString(),
                    "selected": def.matchStyle == style
                }}>{PingLineItemMatchStyleConvert.toString(style)}</x-xcoption>);
            };
            createOptionNode(PingLineItemMatchStyle.CONTAINS);
            createOptionNode(PingLineItemMatchStyle.WHOLE_WORD);
            createOptionNode(PingLineItemMatchStyle.REGEX);
            return <x-xcselect classList={["setting-entry-pinglist-item-type "]}
                props={{
                    value: def.matchStyle.toString()
                }}
                on={{
                    "change": (e) => {
                        const elSelect = e.target as HTMLSelectElement;
                        const value = elSelect.value as PingLineItemMatchStyle;
                        onChange(value);
                    }
                }}>{optionNodes}</x-xcselect>;
        };
        const addFromScratchValue = (text: string) => {
            const addValue = { ...scratchValue, text: text };
            setting.scratchValue = null;

            const newV = v.slice();
            newV.push(addValue);
            setting.value = newV;
        };

        return <div classList={["setting-entry", "setting-entry-pinglist"]}>
            {v.map((def, idx) => {
                return <div classList={["setting-entry-pinglist-item-container"]}>
                    {getTypeSelectVNode(def, (newStyle) => {
                        const newV = v.slice(); newV[idx].matchStyle = newStyle; setting.value = newV;
                    })}
                    <input classList={["setting-entry-pinglist-item-input", "theme-textbox"]} attr-type="text" attr-value={def.text} value-sync="true"
                        on={{
                            "change": (e) => { const newV = v.slice(); newV[idx].text = (e.target as HTMLInputElement).value; setting.value = newV; },
                            "input": (e) => { const newV = v.slice(); newV[idx].text = (e.target as HTMLInputElement).value; setting.value = newV; }
                        }} />
                    <button classList={["setting-entry-pinglist-item-btnremove", "theme-button", "theme-button-smaller"]}
                        on={{ "click": (e) => { const newV = v.slice(); newV.splice(idx, 1); setting.value = newV; } }}>Remove</button>
                </div>;
            })}
            <div classList={["setting-entry-pinglist-item-container-add"]}>
                {getTypeSelectVNode(scratchValue, (newStyle) => {
                    setting.scratchValue = { ...scratchValue, matchStyle: newStyle };
                })}
                <input classList={["setting-entry-pinglist-item-input", "theme-textbox"]} attr-type="text" prop-value="" value-sync="true"
                    on={{
                        "change": (e) => { addFromScratchValue((e.target as HTMLInputElement).value); },
                        "input": (e) => { addFromScratchValue((e.target as HTMLInputElement).value); }
                    }} />
            </div>
        </div>;
    }

}

