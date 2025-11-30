import { jsx, VNode, Fragment } from "../../../../snabbdom/index";
import { HostInterop } from "../../../../util/hostinterop/HostInterop";
import { settingsRendererFor, SettingRenderArgs } from "./SettingsTypeRenderer";
import { SettingTypeRendererBase } from "./SettingTypeRendererBase";


@settingsRendererFor("radio")
export class RadioSettingRenderer extends SettingTypeRendererBase {
    renderSetting(args: SettingRenderArgs): VNode {
        const setting = args.item;
        const logger = args.logger;

        const schema = setting.schema;
        const settingId = schema.id ?? this.getOrCreateSettingId(schema);
        const radioName = `el${schema.id}radio`;

        const curValue = setting.value as (string | undefined | null);

        const optNodes: VNode[] = [];
        for (let opts of schema.options!) {
            const radioOptId = `el${schema.id}radio${opts.id}`;

            let isEnabled: boolean;
            let isChecked: boolean;
            let labelContent: VNode;
            let handleSelected: () => void;

            switch (opts.type) {
                default:
                    labelContent = <>{opts.prompt ?? opts.value ?? "unspecified"}</>;
                    isChecked = (curValue == opts.value);
                    isEnabled = true;
                    handleSelected = () => {
                        logger.logDebug("assigning", opts.value);
                        setting.value = opts.value;
                    };
                    break;
                case "file":
                    {
                        let curFileName: string;
                        if (curValue && (curValue as string).startsWith("file:")) {
                            curFileName = (curValue as string).substring(5);
                            isEnabled = true;
                        }
                        else {
                            curFileName = "";
                            isEnabled = false;
                        }

                        handleSelected = () => {
                            const assignValue = `file:${curFileName}`;
                            logger.logDebug("assigning", assignValue);
                            setting.value = assignValue;
                        };
                        const chooseFile = async () => {
                            const fn = await HostInterop.chooseLocalFileAsync({
                                title: `Choose Audio File`,
                                file: curFileName,
                                filters: [
                                    { name: "MP3 Files", extensions: ["mp3"] }
                                ]
                            });
                            if (fn) {
                                setting.value = `file:${fn}`;
                            }
                        };

                        labelContent = <>
                            <button classList={["theme-button", "theme-button-smaller"]}
                                on={{ "click": (e) => chooseFile() }}>Select File</button>
                            <span>{curFileName}</span>
                        </>;
                        isChecked = isEnabled;
                    }
                    break;
            }

            const optNode = <div classList={["setting-entry-radio-option"]}>
                <input attr-type="radio" id={radioOptId} attr-name={radioName}
                    props={{
                        "checked": isChecked,
                        "disabled": !isEnabled
                    }}
                    on={{
                        "change": (e) => { if (((e.target) as HTMLInputElement).checked) { handleSelected(); } }
                    }} />
                <label attr-for={radioOptId}>{labelContent}</label>
            </div>;
            optNodes.push(optNode);
        }
        return <div classList={["setting-entry", "setting-entry-radio-container"]}>
            {optNodes}
        </div>;
    }

}

