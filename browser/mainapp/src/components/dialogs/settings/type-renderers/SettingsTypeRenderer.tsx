import { ConfigSchemaItemType } from "../../../../configuration/ConfigSchemaItem";
import { jsx, VNode } from "../../../../snabbdom/index";
import { ConvertibleToDisposable } from "../../../../util/Disposable";
import { Logger } from "../../../../util/Logger";
import { ISettingsDialogItemViewModel, SettingsDialogViewModel } from "../../../../viewmodel/dialogs/SettingsDialogViewModel";
import { ConstructorOf } from "../../DialogFrame";

export interface ISettingsTypeRenderer {
    renderSetting(args: SettingRenderArgs): VNode;
}

export interface SettingRenderArgs {
    readonly dialogViewModel: SettingsDialogViewModel;
    readonly item: ISettingsDialogItemViewModel;
    readonly logger: Logger;
    readonly addDisposable: (d: ConvertibleToDisposable) => void;
}

const _registeredSettingsRenderers: Map<ConfigSchemaItemType, ConstructorOf<ISettingsTypeRenderer>> = new Map();

export function getSettingsRendererFor(type: ConfigSchemaItemType): ISettingsTypeRenderer {
    const klass = _registeredSettingsRenderers.get(type);
    if (klass) {
        return new klass();
    }
    else {
        return new NullSettingsTypeRenderer();
    }
}

export function settingsRendererFor(type: ConfigSchemaItemType) {
    return (target: ConstructorOf<ISettingsTypeRenderer>) => {
        _registeredSettingsRenderers.set(type, target);
    };
}

class NullSettingsTypeRenderer implements ISettingsTypeRenderer {
    renderSetting(args: SettingRenderArgs): VNode {
        return <div attrs={{ "data-note": "null settings renderer"}}></div>;
    }

}