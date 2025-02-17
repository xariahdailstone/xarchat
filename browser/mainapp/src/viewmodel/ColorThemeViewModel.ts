import { OnlineStatus, OnlineStatusConvert } from "../shared/OnlineStatus";
import { ObservableExpression } from "../util/ObservableExpression";
import { AppViewModel } from "./AppViewModel";

export class ColorThemeViewModel {
    constructor(
        public readonly appViewModel: AppViewModel) {

        appViewModel.configBlock.observe("global.bgColor", (v: string) => {
            if (!v) {
                v = "225;7";
            }
            const parts = v.split(';');
            const hue = +parts[0];
            const sat = +parts[1];
            document.body.style.setProperty("--bg-base-hue", hue.toString());
            document.body.style.setProperty("--bg-base-sat", sat.toString() + "%");
        });

        const setupGenderColor = (gender: string) => {
            const oe = new ObservableExpression(
                () => [ 
                    appViewModel.getConfigSettingById(`color.gender.${gender}`), 
                    appViewModel.getConfigSettingById(`useFriendColor`),
                    appViewModel.getConfigSettingById(`color.friend`)
                ],
                (v) => {
                    if (v) {
                        const rawColor = v[0] as string;
                        const useFriendColor = v[1] as boolean;
                        const friendColor = v[2] as string;

                        document.body.style.setProperty(`--fg-gender-${gender}`, rawColor);
                        document.body.style.setProperty(`--fg-friend-gender-${gender}`, useFriendColor ? friendColor : rawColor);
                    }
                },
                (err) => {}
            );
        };

        setupGenderColor("male");
        setupGenderColor("female");
        setupGenderColor("herm");
        setupGenderColor("male-herm");
        setupGenderColor("shemale");
        setupGenderColor("cunt-boy");
        setupGenderColor("transgender");
        setupGenderColor("none");

        const setupStatusColor = (status: OnlineStatus) => {
            const statusStr = OnlineStatusConvert.toString(status).toLowerCase();
            const oe = new ObservableExpression(
                () => appViewModel.getConfigSettingById(`color.status.${statusStr}`),
                (v) => {
                    if (v) {
                        document.body.style.setProperty(`--fg-status-${statusStr}`, v as string);
                    }
                },
                (err) => {}
            );
        };

        setupStatusColor(OnlineStatus.OFFLINE);
        setupStatusColor(OnlineStatus.ONLINE);
        setupStatusColor(OnlineStatus.IDLE);
        setupStatusColor(OnlineStatus.AWAY);
        setupStatusColor(OnlineStatus.DND);
        setupStatusColor(OnlineStatus.BUSY);
        setupStatusColor(OnlineStatus.LOOKING);
        setupStatusColor(OnlineStatus.CROWN);

        const ssz = new ObservableExpression(
            () => appViewModel.getConfigSettingById("subtextSize"),
            (v) => {
                if (v) {
                    document.body.style.setProperty("--subtext-size", v as string);
                }
            },
            (err) => {}
        );
    }
}