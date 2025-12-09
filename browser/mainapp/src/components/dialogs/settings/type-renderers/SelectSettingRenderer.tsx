import { jsx } from "../../../../snabbdom/jsx";
import { VNode } from "../../../../snabbdom/vnode";
import { settingsRendererFor, SettingRenderArgs } from "./SettingsTypeRenderer";
import { SettingTypeRendererBase } from "./SettingTypeRendererBase";


@settingsRendererFor("select")
export class SelectSettingRenderer extends SettingTypeRendererBase {

    renderSetting(args: SettingRenderArgs): VNode {
        const setting = args.item;
        const optionNodes: VNode[] = [];

        const valueMap = new Map<number, any>();
        let nextValueNum = 1;

        let selectedValue: string = "";
        for (let o of setting.schema.selectOptions!) {
            const isSelected = setting.value == o.value;
            const thisValueNum = nextValueNum++;
            selectedValue = thisValueNum.toString();
            valueMap.set(thisValueNum, o.value);
            optionNodes.push(<x-xcoption key={thisValueNum.toString()} attrs={{ "value": thisValueNum.toString(), "selected": isSelected }}>{o.displayValue ?? o.value.toString()}</x-xcoption>);
        }

        const onChange = (e: Event) => {
            const elSelect = e.target as HTMLSelectElement;
            setting.value = valueMap.get(+elSelect.value);
        };

        return <div classList={["setting-entry", "setting-entry-select"]}>
            <x-xcselect classList={["themed"]} props={{ "value": selectedValue }} on={{ "change": onChange }}>
                {optionNodes}
            </x-xcselect>
        </div>;
    }

}

