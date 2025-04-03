import { OnlineStatus, OnlineStatusConvert } from "../shared/OnlineStatus";
import { IDisposable } from "../util/Disposable";
import { ObservableBase } from "../util/ObservableBase";
import { ObservableExpression } from "../util/ObservableExpression";
import { AppViewModel } from "./AppViewModel";

export class ColorThemeViewModel extends ObservableBase {
    constructor(
        public readonly appViewModel: AppViewModel) {

        super();

        this._disposables.push(appViewModel.configBlock.observe("global.bgColor", (v: string) => {
            if (!v) {
                v = "225;7";
            }
            this.logger.logDebug("global.bgColor", v);
            const parts = v.split(';');
            const hue = +parts[0];
            const sat = +parts[1];
            const bf = parts.length > 2 ? +parts[2] : 1;
            document.body.style.setProperty("--bg-base-hue", hue.toString());
            document.body.style.setProperty("--bg-base-sat", sat.toString() + "%");
            document.body.style.setProperty("--bg-brightness-scale", bf.toString());
        }));

        this._disposables.push(appViewModel.configBlock.observe("global.unseenIndicatorHighlightColor", (v: string) => {
            if (!v) {
                v = "246;36;1";
            }
            const parts = v.split(';');
            const hue = +parts[0];
            const sat = +parts[1];
            const bf = parts.length > 2 ? +parts[2] : 1;
            document.body.style.setProperty("--unseen-highlight", `hsl(${hue}, ${sat}%, ${Math.round(21 * bf)}%)`);
        }));

        const setupGenderColor = (gender: string) => {
            this._disposables.push(new ObservableExpression(
                () => [ 
                    appViewModel.getConfigSettingById(`color.gender.${gender}`), 
                    appViewModel.getConfigSettingById(`useFriendColor`),
                    appViewModel.getConfigSettingById(`color.friend`),
                    appViewModel.getConfigSettingById(`useBookmarkColor`),
                    appViewModel.getConfigSettingById(`color.bookmark`),
                ],
                (v) => {
                    if (v) {
                        const rawColor = v[0] as string;
                        const useFriendColor = v[1] as boolean;
                        const friendColor = v[2] as string;
                        const useBookmarkColor = v[3] as boolean;
                        const bookmarkColor = v[4] as string;

                        document.body.style.setProperty(`--fg-gender-${gender}`, rawColor);
                        document.body.style.setProperty(`--fg-friend-gender-${gender}`, useFriendColor ? friendColor : rawColor);
                        document.body.style.setProperty(`--fg-bookmark-gender-${gender}`, useBookmarkColor ? bookmarkColor : rawColor);
                    }
                },
                (err) => {}
            ));
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
            this._disposables.push(new ObservableExpression(
                () => appViewModel.getConfigSettingById(`color.status.${statusStr}`),
                (v) => {
                    if (v) {
                        document.body.style.setProperty(`--fg-status-${statusStr}`, v as string);
                    }
                },
                (err) => {}
            ));
        };

        setupStatusColor(OnlineStatus.OFFLINE);
        setupStatusColor(OnlineStatus.ONLINE);
        setupStatusColor(OnlineStatus.IDLE);
        setupStatusColor(OnlineStatus.AWAY);
        setupStatusColor(OnlineStatus.DND);
        setupStatusColor(OnlineStatus.BUSY);
        setupStatusColor(OnlineStatus.LOOKING);
        setupStatusColor(OnlineStatus.CROWN);

        this._disposables.push(new ObservableExpression(
            () => appViewModel.getConfigSettingById("subtextSize"),
            (v) => {
                if (v) {
                    document.body.style.setProperty("--subtext-size", v as string);
                }
            },
            (err) => {}
        ));
    }

    private readonly _disposables: IDisposable[] = [];
}