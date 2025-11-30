import { NotificationRouting, NotificationRoutingTargetSetting } from "../../../../configuration/NotificationRouting";
import { jsx, VNode, Fragment } from "../../../../snabbdom/index";
import { settingsRendererFor, SettingRenderArgs } from "./SettingsTypeRenderer";
import { SettingTypeRendererBase } from "./SettingTypeRendererBase";

const EMOJI_NO = "\u274C";
const EMOJI_YES = "\u2705";
const EMOJI_IMPORTANT = "\u26A0\uFE0F";

@settingsRendererFor("notifroutes")
export class NotifRoutesSettingRenderer extends SettingTypeRendererBase {

    renderSetting(args: SettingRenderArgs): VNode {
        const setting = args.item;
        
        const settingId = this.getOrCreateSettingId(setting.schema);
        const nr = new NotificationRouting(setting.value as string);

        const makeButton = (title: string, value: NotificationRoutingTargetSetting, id: keyof NotificationRouting,
            availableOptions: NotificationRoutingTargetSetting[]) => {
            // const nextValue = value == "no" ? "yes"
            //     : value == "yes" ? "important"
            //     : "no";

            const noOption = availableOptions.includes("no")
                ? <x-xcoption key="no" attrs={{ value: "no", selected: value == "no" }}>{EMOJI_NO} No</x-xcoption>
                : null;
            const yesOption = availableOptions.includes("yes")
                ? <x-xcoption key="yes" attrs={{ value: "yes", selected: value == "yes" }}>{EMOJI_YES} Yes</x-xcoption>
                : null;
            const importantOption = availableOptions.includes("important")
                ? <x-xcoption key="yesi" attrs={{ value: "important", selected: value == "important" }}>{EMOJI_IMPORTANT} Yes (as Important)</x-xcoption>
                : null;

            const selNode = <x-xcselect classList={["notifroute-button", `notifroute-button-${value}`, 'themed']} props={{
                "value": value
            }} on={{
                "change": (e) => {
                    const selEl = e.target as HTMLSelectElement;
                    (nr as any)[id] = (selEl.selectedIndex == 0) ? "no"
                        : (selEl.selectedIndex == 1) ? "yes"
                            : (selEl.selectedIndex == 2) ? "important"
                                : "no";
                    setting.value = nr.toString();
                }
            }}>
                {noOption}
                {yesOption}
                {importantOption}
            </x-xcselect>;

            return selNode;

            // return <div classList={[ "notifroute-button", `notifroute-button-${value}` ]} on={{
            //         "click": () => { 
            //             (nr as any)[id] = nextValue;
            //             setting.value = nr.toString()
            //         }
            //     }}><span classList={[ "notifroute-button-text" ]}>{title}</span></div>;
        };
        const makeSelect = (title: string, id: keyof NotificationRouting, tooltip: string, availableOptions?: NotificationRoutingTargetSetting[]) => {
            const selId = `sel${settingId}-${id}`;
            const curValue = nr[id] as NotificationRoutingTargetSetting;

            availableOptions ??= ["no", "yes", "important"];

            let showButton = true;
            if (!(setting.schema.notifRouteOptions?.hasChannelContext ?? false) && id == "targetChannel") {
                showButton = false;
            }
            if (!(setting.schema.notifRouteOptions?.hasCharacterContext ?? false) && id == "pmConvo") {
                showButton = false;
            }

            return <div classList={["notifroute-button-container"]} attr-title={showButton ? tooltip : ""}>
                <div classList={["notifroute-button-container-title"]}>{title}</div>
                <div classList={["notifroute-button-container-description"]}>{tooltip}</div>
                {showButton ? makeButton(title, curValue, id, availableOptions) : <></>}
            </div>;
        };
        const makeUnavailableSelect = () => {
            return <div classList={["notifroute-button-container"]}>
                <></>
            </div>;
        };

        const characterSelect: (VNode | null) = (setting.schema.notifRouteOptions?.hasCharacterContext ?? false)
            ? makeSelect("Character", "pmConvo", "Send to the PM conversation tab for character (if one exists).")
            : null;

        const channelSelect: (VNode | null) = (setting.schema.notifRouteOptions?.hasChannelContext ?? false)
            ? makeSelect("Channel", "targetChannel", "Send to the channel tab for the channel (if one exists).")
            : null;

        const toastSelect: (VNode | null) = (setting.schema.notifRouteOptions?.canToast ?? false)
            ? makeSelect("Toast", "toast", "Show as an in-app toast popup.", ["no", "yes"])
            : null;

        const notificationSelect: (VNode | null) = (setting.schema.notifRouteOptions?.canGoToNotifications ?? false)
            ? makeSelect("Notification", "notification", "Add to the \"Recent Notifications\" tab.", ["no", "yes"])
            : null;

        return <div classList={["setting-entry", "setting-entry-notifroute"]}>
            <div classList={["setting-entry-notifroute-group"]}>
                <div classList={["setting-entry-notifroute-group-title"]}>Chat Tabs</div>
                {makeSelect("Console", "console", "Send to the console.")}
                {makeSelect("Current", "currentTab", "Send to the currently active tab.")}
                {characterSelect}
                {channelSelect}
                {makeSelect("All", "everywhere", "Send to every open tab.")}
            </div>
            <div classList={["setting-entry-notifroute-group"]}>
                <div classList={["setting-entry-notifroute-group-title"]}>Notifications</div>
                {toastSelect}
                {notificationSelect}
            </div>
        </div>;
    }

}

