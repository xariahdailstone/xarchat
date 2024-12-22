import { FriendsList, MappingList, ProfileFieldsInfoList, KinkList, ProfileInfo, ProfileFriendsInfo } from "../../../fchat/api/FListApi";
import { CharacterName } from "../../../shared/CharacterName";
import { CancellationToken } from "../../../util/CancellationTokenSource";
import { ObservableBase, observableProperty } from "../../../util/ObservableBase";
import { Collection } from "../../../util/ObservableCollection";
import { ActiveLoginViewModel } from "../../ActiveLoginViewModel";
import { EditMemoViewModel } from "../EditMemoViewModel";
import { CharacterProfileDialogViewModel } from "./CharacterProfileDialogViewModel";
import { CharacterProfileFriendsViewModel } from "./CharacterProfileFriendsViewModel";
import { CharacterProfileAltViewModel } from "./CharacterProfileAltViewModel";
import { CharacterProfileDetailKinkSetViewModel } from "./CharacterProfileDetailKinkSetViewModel";
import { CharacterProfileDetailImageInfoViewModel } from "./CharacterProfileDetailImageInfoViewModel";
import { CharacterProfileDetailSectionInfoViewModel } from "./CharacterProfileDetailSectionInfoViewModel";
import { CharacterProfileDetailSummaryInfoViewModel } from "./CharacterProfileDetailSummaryInfoViewModel";
import { CharacterGuestbookPostViewModel, CharacterGuestbookViewModel } from "./CharacterGuestbookViewModel";


export class CharacterProfileDetailViewModel extends ObservableBase {
    static async createAsync(
        parent: CharacterProfileDialogViewModel,
        session: ActiveLoginViewModel,
        character: CharacterName,
        cancellationToken: CancellationToken) {

        const atx = session.getMyFriendsListInfo(cancellationToken);
        const mlx = session.authenticatedApi.getMappingListAsync(cancellationToken);
        const pfx = session.authenticatedApi.getProfileFieldsInfoListAsync(cancellationToken);
        const klx = session.authenticatedApi.getKinksListAsync(cancellationToken);

        let pix;
        let mypix;
        if (character != session.characterName) {
            pix = session.authenticatedApi.getCharacterProfileAsync(character, cancellationToken);
            mypix = session.getMyProfileInfo(cancellationToken);
        }
        else {
            pix = session.getMyProfileInfo(cancellationToken);
            mypix = pix;
        }

        const frx = session.authenticatedApi.getCharacterFriendsAsync(character, cancellationToken);

        return new CharacterProfileDetailViewModel(parent, session, character, await atx, await mlx, await pfx, await klx, await pix, await mypix, await frx);
    }

    private constructor(
        private readonly parent: CharacterProfileDialogViewModel,
        public readonly activeLoginViewModel: ActiveLoginViewModel,
        public readonly character: CharacterName,
        public readonly friendsList: FriendsList,
        mappingList: MappingList,
        profileFieldsInfo: ProfileFieldsInfoList,
        kinksList: KinkList,
        public readonly profileInfo: ProfileInfo,
        myProfileInfo: ProfileInfo,
        profileFriendsInfo: ProfileFriendsInfo | null) {

        super();

        this.summaryInfo = new CharacterProfileDetailSummaryInfoViewModel(profileInfo, profileFieldsInfo, mappingList);
        this.description = profileInfo.description;

        const sectionsToShow = [
            "General details",
            "RPing preferences",
            "Sexual details"
        ];
        if (!(profileInfo.infotags instanceof Array)) {
            for (let wantedGroup of sectionsToShow) {
                const sec = new CharacterProfileDetailSectionInfoViewModel(profileInfo, profileFieldsInfo, mappingList, wantedGroup);
                if (sec.fields.length > 0) {
                    this.detailSections.push(sec);
                }
            }
        }

        for (let imageInfo of profileInfo.images) {
            const i = new CharacterProfileDetailImageInfoViewModel(activeLoginViewModel, imageInfo);
            this.images.push(i);
        }

        this.kinks = new CharacterProfileDetailKinkSetViewModel(profileInfo, myProfileInfo, kinksList, profileFieldsInfo, mappingList);

        for (let altName of profileInfo.character_list) {
            const altVm = new CharacterProfileAltViewModel(this, CharacterName.create(altName.name));
            this.alts.push(altVm);
        }

        if (profileFriendsInfo && profileFriendsInfo.friends) {
            for (let friendInfo of profileFriendsInfo.friends) {
                const friendVm = new CharacterProfileFriendsViewModel(this, CharacterName.create(friendInfo.name));
                this.friends.push(friendVm);
            }
        }

        if (profileInfo.settings.guestbook) {
            this.guestbook = new CharacterGuestbookViewModel(activeLoginViewModel, character);
        }
    }

    // @observableProperty
    // openInFList: (() => void) | null = null;
    openInFList() {
        this.activeLoginViewModel.bbcodeSink.webpageClick(`https://f-list.net/c/${encodeURIComponent(this.character.value)}`, true, {
            rightClick: false,
            channelContext: null,
            targetElement: null
        });
        this.parent.close(0);
    }

    @observableProperty
    openPrivateMessageTab: (() => void) | null = null;

    // @observableProperty
    // addEditMemo: (() => void) | null = null;
    async addEditMemo() {
        const dlg = new EditMemoViewModel(this.parent, this.profileInfo?.memo?.memo ?? "");
        const dlgResult = await this.activeLoginViewModel.appViewModel.showDialogAsync(dlg);
        if (dlgResult) {
            // TODO: update/delete memo
        }
    }

    // @observableProperty
    // addBookmark: (() => void) | null = null;
    // @observableProperty
    // removeBookmark: (() => void) | null = null;
    @observableProperty
    report: (() => void) | null = null;

    @observableProperty
    summaryInfo: CharacterProfileDetailSummaryInfoViewModel | null = null;

    @observableProperty
    description: string | null = null;

    @observableProperty
    detailSections: Collection<CharacterProfileDetailSectionInfoViewModel> = new Collection();

    @observableProperty
    images: Collection<CharacterProfileDetailImageInfoViewModel> = new Collection();

    @observableProperty
    kinks: CharacterProfileDetailKinkSetViewModel;

    @observableProperty
    alts: Collection<CharacterProfileAltViewModel> = new Collection();

    @observableProperty
    canBookmark: boolean = true;

    @observableProperty
    friends: Collection<CharacterProfileFriendsViewModel> = new Collection();

    @observableProperty
    guestbook: CharacterGuestbookViewModel | null = null;

    get isBookmarked() { return this.activeLoginViewModel.bookmarks.has(this.character); }

    async toggleBookmark() {
        if (this.canBookmark) {
            this.canBookmark = false;
            try {
                if (this.isBookmarked) {
                    await this.activeLoginViewModel.authenticatedApi.removeBookmarkAsync(CharacterName.create(this.profileInfo.name), CancellationToken.NONE);
                }
                else {
                    await this.activeLoginViewModel.authenticatedApi.addBookmarkAsync(CharacterName.create(this.profileInfo.name), CancellationToken.NONE);
                }
            }
            finally {
                this.canBookmark = true;
            }
        }
    }
}
