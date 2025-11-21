import { CharacterName } from "../../../shared/CharacterName";
import { CancellationTokenSource } from "../../../util/CancellationTokenSource";
import { CatchUtils } from "../../../util/CatchUtils";
import { HostInterop } from "../../../util/hostinterop/HostInterop";
import { KeyCodes } from "../../../util/KeyCodes";
//import { CompatibilityCalculator } from "../../util/CompatibilityCalculator";
import { observableProperty } from "../../../util/ObservableBase";
import { ObservableCollection } from "../../../util/ObservableCollection";
import { ActiveLoginViewModel } from "../../ActiveLoginViewModel";
import { AppViewModel } from "../../AppViewModel";
import { DialogButtonStyle, DialogCaptionButtonViewModel, DialogViewModel } from "../DialogViewModel";
import { EditMemoViewModel } from "../EditMemoViewModel";
import { ReportSource, ReportViewModel } from "../ReportViewModel";
import { CharacterProfileDetailViewModel } from "./CharacterProfileDetailViewModel";

export class CharacterProfileDialogViewModel extends DialogViewModel<number> {
    constructor(
        parent: AppViewModel,
        public readonly activeLoginViewModel: ActiveLoginViewModel,
        name: CharacterName) {

        super(parent);

        this.closeBoxResult = 1;
        this.title = `Profile for ${name.value}`;

        this.captionButtons.push(new DialogCaptionButtonViewModel("assets/ui/openexternal-icon.svg", () => {
            HostInterop.launchUrl(parent, `https://f-list.net/c/${encodeURIComponent(name.value.toLowerCase())}`, true);
            this.close(0);
        }));

        this.loading = true;
        (async () => {
            try {
                const detailInfo =  await CharacterProfileDetailViewModel.createAsync(this, activeLoginViewModel, name, this._cts.token);
                this.profileDetails = detailInfo;

                // let isBookmarked = false;
                // for (let bm of detailInfo.friendsList.bookmarklist) {
                //     if (bm.toLowerCase() == name.value.toLowerCase()) {
                //         isBookmarked = true;
                //         break;
                //     }
                // }
                // this.isBookmarked = isBookmarked;

                this.failureMessage = null;
            }
            catch (e) {
                this.profileDetails = null;
                this.failureMessage = CatchUtils.getMessage(e);
            }
            this.loading = false;
        })();
    }

    private _cts: CancellationTokenSource = new CancellationTokenSource();

    @observableProperty
    loading: boolean = true;

    @observableProperty
    failureMessage: (string | null) = null;

    //@observableProperty
    //profileInfo: ProfileInfo | null = null;

    //@observableProperty
    //myProfileInfo: ProfileInfo | null = null;

    //@observableProperty
    //mappingList: MappingList | null = null;

    //@observableProperty
    //profileFieldsInfoList: ProfileFieldsInfoList | null = null;

    //@observableProperty
    //kinkList: KinkList | null = null;

    @observableProperty
    profileDetails: CharacterProfileDetailViewModel | null = null;

    //@observableProperty
    //tabs: ObservableCollection<CharacterProfileDialogTabViewModel> = new Collection<CharacterProfileDialogTabViewModel>();

    //@observableProperty
    //selectedTab: CharacterProfileDialogTabViewModel;

    // @observableProperty
    // isBookmarked: boolean = false;

    // @observableProperty
    // canBookmark: boolean = true;

    // async bookmarkCharacterAsync(cancellationToken: CancellationToken) {
    //     if (this.profileDetails?.profileInfo) {
    //         this.canBookmark = false;
    //         try {
    //             await this.activeLoginViewModel.authenticatedApi.addBookmarkAsync(CharacterName.create(this.profileDetails.profileInfo.name), cancellationToken);
    //             this.isBookmarked = true;
    //         }
    //         finally {
    //             this.canBookmark = true;
    //         }
    //     }
    // }

    // async unbookmarkCharacterAsync(cancellationToken: CancellationToken) {
    //     if (this.profileDetails?.profileInfo) {
    //         this.canBookmark = false;
    //         try {
    //             await this.activeLoginViewModel.authenticatedApi.removeBookmarkAsync(CharacterName.create(this.profileDetails.profileInfo.name), cancellationToken);
    //             this.isBookmarked = false;
    //         }
    //         finally {
    //             this.canBookmark = true;
    //         }
    //     }
    // }

    override close(result: number): void {
        this._cts.cancel();
        super.close(result);
    }

    clickedOutside() {
        this.close(0);
    }

    async editMemoAsync() {
        const dlg = new EditMemoViewModel(this, this.profileDetails?.profileInfo?.memo?.memo ?? "");
        const dlgResult = await this.parent.showDialogAsync(dlg);
        if (dlgResult) {
            // TODO: update/delete memo
        }
    }

    async reportProfile() {
        if (this.profileDetails) {
            const shouldContinue = await this.activeLoginViewModel.appViewModel.promptAsync<boolean>({
                message: "To report a character profile, you must file a ticket on the f-list.net website.  Click 'Continue' below to go there.",
                title: "Report Profile",
                buttons: [
                    {
                        title: "Cancel",
                        shortcutKeyCode: KeyCodes.ESCAPE,
                        resultValue: false,
                        style: DialogButtonStyle.CANCEL
                    },
                    {
                        title: "Continue",
                        shortcutKeyCode: KeyCodes.RETURN,
                        resultValue: true,
                        style: DialogButtonStyle.DEFAULT
                    },
                ]
            });
            if (shouldContinue) {
                HostInterop.launchCharacterReport(this.activeLoginViewModel.appViewModel, this.profileDetails.character);
            }
        }
    }
}

