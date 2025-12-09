import { ConfigSchemaItemDefinitionItem } from "../../../../configuration/ConfigSchemaItem";
import { On } from "../../../../snabbdom/index";
import { VNode } from "../../../../snabbdom/vnode";
import { ColorHSSelectPopupViewModel } from "../../../../viewmodel/popups/ColorHSSelectPopupViewModel";
import { ColorRGBSelectPopupViewModel } from "../../../../viewmodel/popups/ColorRGBSelectPopupViewModel";
import { ISettingsTypeRenderer, SettingRenderArgs } from "./SettingsTypeRenderer";


export abstract class SettingTypeRendererBase implements ISettingsTypeRenderer {

    abstract renderSetting(args: SettingRenderArgs): VNode;

    protected setupValidatingInput(
        elNode: VNode,
        validateFunc: (value: string) => { valid: boolean; validationMessage?: string; result?: any; },
        assignFunc: (value: any) => void) {

        const processValue = (e: Event, report: boolean) => {
            const el = (e.target as HTMLInputElement);
            const enteredValue = el.value;
            const valResult = validateFunc(enteredValue);
            if (valResult.valid) {
                if (report) {
                    assignFunc(valResult.result);
                }
                el.title = "";
                el.classList.remove("invalid-value");
            }
            else {
                if (report) {
                    el.title = valResult.validationMessage ?? "Invalid value.";
                    el.classList.add("invalid-value");
                }
            }
        };
        const evts: On = {
            "input": (e: Event) => processValue(e, false),
            "blur": (e: Event) => processValue(e, true)
        };

        elNode.data = elNode.data ?? {};
        elNode.data.on = { ...(elNode.data?.on ?? {}), ...evts };
    }

    protected showColorHSPicker(args: SettingRenderArgs, includeBrightnessFactor: boolean, el: HTMLElement) {
        const setting = args.item;
        const viewModel = args.dialogViewModel;

        if (viewModel) {
            const vparts = (setting.value as string).split(';');
            const vm = new ColorHSSelectPopupViewModel(viewModel.parent, el, includeBrightnessFactor);
            if (!includeBrightnessFactor) {
                vm.setHueSaturation(+vparts[0], +vparts[1]);
            }
            else {
                vm.setHueSaturation(+vparts[0], +vparts[1], +vparts[2]);
            }
            vm.onChange = (h, s, b) => {
                let v: string;
                if (!includeBrightnessFactor) {
                    v = `${h.toString()};${s.toString()}`;
                }
                else {
                    v = `${h.toString()};${s.toString()};${b.toString()}`;
                }
                setting.value = v;
            };
            viewModel.parent.popups.push(vm);
        }
    }    

    private static _nextGeneratedIdNum = 1;
    private static readonly ItemGeneratedIdSym = Symbol("ItemGeneratedIdSym");

    protected getOrCreateSettingId(setting: ConfigSchemaItemDefinitionItem): string {
        let id = (setting as any)[SettingTypeRendererBase.ItemGeneratedIdSym] as (string | undefined | null);
        if (!id) {
            id = `gen${SettingTypeRendererBase._nextGeneratedIdNum++}`;
            (setting as any)[SettingTypeRendererBase.ItemGeneratedIdSym] = id;
        }
        return id;
    }    
}
