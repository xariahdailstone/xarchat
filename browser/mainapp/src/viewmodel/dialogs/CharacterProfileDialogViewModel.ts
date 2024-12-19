import { FriendsList, ImageInfo, KinkList, KinkListGroupListItem, KinkPrefType, MappingList, ProfileFieldsInfoList, ProfileFieldsSectionListItem, ProfileInfo } from "../../fchat/api/FListApi";
import { CharacterName } from "../../shared/CharacterName";
import { CancellationToken, CancellationTokenSource } from "../../util/CancellationTokenSource";
import { CatchUtils } from "../../util/CatchUtils";
import { StringComparer } from "../../util/Comparer";
import { CompatibilityCalculator } from "../../util/CompatibilityCalculator";
import { HostInterop } from "../../util/HostInterop";
import { IterableUtils } from "../../util/IterableUtils";
//import { CompatibilityCalculator } from "../../util/CompatibilityCalculator";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { Collection, ObservableCollection } from "../../util/ObservableCollection";
import { StringUtils } from "../../util/StringUtils";
import { URLUtils } from "../../util/URLUtils";
import { Profile } from "../../util/profile/Profile";
import { RichInfoTagDefListImpl } from "../../util/profile/RichInfoTagDefList";
import { RichKinkList } from "../../util/profile/RichKinkList";
import { RichMappingDefImpl } from "../../util/profile/RichMappingDef";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { AppViewModel } from "../AppViewModel";
import { DialogCaptionButtonViewModel, DialogViewModel } from "./DialogViewModel";
import { EditMemoViewModel } from "./EditMemoViewModel";

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
}

// export class CharacterProfileDialogTabViewModel extends ObservableBase {
//     constructor(
//         public readonly parent: CharacterProfileDialogViewModel,
//         kind: string,
//         title: string) {

//         super();

//         this.kind = kind;
//         this.title = title;
//     }

//     @observableProperty
//     kind: string;

//     @observableProperty
//     title: string;
// }

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

        return new CharacterProfileDetailViewModel(parent, session, character, await atx, await mlx, await pfx, await klx, await pix, await mypix);
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
        myProfileInfo: ProfileInfo) {

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

export class CharacterProfileDetailSummaryInfoViewModel extends ObservableBase {
    constructor(
        private readonly profileInfo: ProfileInfo,
        private readonly profileFieldsInfoList: ProfileFieldsInfoList,
        private readonly mappingList: MappingList
    ) {
        super();
        this.age = this.getFromInfoTag("Age");
        this.gender = this.getFromInfoTag("Gender");
        this.orientation = this.getFromInfoTag("Orientation");
        this.languagePreference = this.getFromInfoTag("Language Preference");
        this.species = this.getFromInfoTag("Species");
        this.furryPreference = this.getFromInfoTag("Furry preference");
        this.domSubRole = this.getFromInfoTag("Dom/Sub Role");
        this.desiredRpLength = this.getFromInfoTag("Desired RP length");
        
        const createdAt = new Date(profileInfo.created_at * 1000);
        const updatedAt = new Date(profileInfo.updated_at * 1000);
        this.created = StringUtils.dateToString(createdAt, { dateStyle: 'medium', timeStyle: 'short' });
        this.lastUpdated = StringUtils.dateToString(updatedAt, { dateStyle: 'medium', timeStyle: 'short' });
        this.views = StringUtils.numberToString(profileInfo.views, {});
        
        this.memo = profileInfo.memo?.memo;
    }

    private getFromInfoTag(fieldName: string) {
        const profileInfo = this.profileInfo;
        const profileFieldsInfoList = this.profileFieldsInfoList;

        let def: ProfileFieldsSectionListItem | null = null;
        for (let groupId of Object.getOwnPropertyNames(profileFieldsInfoList!)) {
            for (let infoTagDef of profileFieldsInfoList![groupId]!.items) {
                if (infoTagDef.name == fieldName) {
                    def = infoTagDef;
                    break;
                }
            }
            if (def) {
                break;
            }
        }
        if (!def) {
            return null;
        };

        let profileValue: string | null = null;
        if (def.type == "text") {
            const infotags = profileInfo?.infotags;
            profileValue = (infotags && !(infotags instanceof Array)) ? (infotags[def.id.toString()] ?? null) : null;
        }
        else if (def.type == "list") {
            const infotags = profileInfo?.infotags;
            const profileIdxStr = (infotags && !(infotags instanceof Array)) ? (infotags[def.id.toString()] ?? null) : null;

            const lx = this.mappingList.listitems.filter(li => li.id == profileIdxStr);
            if (lx.length > 0) {
                profileValue = lx[0].value;
            }
            else {
                profileValue = profileIdxStr;
            }
        }
        if (profileValue == null) {
            return null;
        };
        return profileValue;
    }

    @observableProperty
    age: string | null = null;

    @observableProperty
    gender: string | null = null;

    @observableProperty
    orientation: string | null = null;

    @observableProperty
    languagePreference: string | null = null;

    @observableProperty
    species: string | null = null;

    @observableProperty
    furryPreference: string | null = null;

    @observableProperty
    domSubRole: string | null = null;

    @observableProperty
    desiredRpLength: string | null = null;

    @observableProperty
    created: string | null = null;

    @observableProperty
    lastUpdated: string | null = null;

    @observableProperty
    views: string | null = null;

    @observableProperty
    memo: string | null = null;
}

export class CharacterProfileDetailSectionInfoViewModel extends ObservableBase {
    constructor(
        private readonly profileInfo: ProfileInfo,
        private readonly profileFieldsInfoList: ProfileFieldsInfoList,
        private readonly mappingList: MappingList,
        detailSection: string
    ) {
        super();

        const groupRows: Collection<CharacterProfileDetailSectionFieldInfoViewModel> = new Collection();

        this.sectionTitle = detailSection;
        this.fields = groupRows;

        if (!(profileInfo.infotags instanceof Array)) {
            const infoTagGroup = this.getInfoTagGroupByName(profileFieldsInfoList, detailSection);
            if (infoTagGroup) {
                const infoTagGroupName = infoTagGroup.group;
                for (let infoTagDef of infoTagGroup.items) {
                    const infoTagDefIdStr = infoTagDef.id.toString();
                    const profileValue = profileInfo.infotags[infoTagDefIdStr];
                    if (!StringUtils.isNullOrWhiteSpace(profileValue)) {
                        let profileValueDisplay: string;
                        switch (infoTagDef.type) {
                            case "text":
                                profileValueDisplay = profileValue;
                                break;
                            case "list":
                                const lx = mappingList.listitems.filter(li => li.id == profileValue);
                                if (lx.length > 0) {
                                    profileValueDisplay = lx[0].value;
                                }
                                else {
                                    profileValueDisplay = profileValue;
                                }
                                break;
                        }
                        const fld = new CharacterProfileDetailSectionFieldInfoViewModel(infoTagDef.name, profileValueDisplay);
                        groupRows.push(fld);
                    }
                }
            }
        }
    }

    private getInfoTagGroupByName(profileFieldsInfoList: ProfileFieldsInfoList, groupName: string) {
        for (let infoTagGroupId of Object.getOwnPropertyNames(profileFieldsInfoList)) {
            const infoTagGroup = profileFieldsInfoList[infoTagGroupId];
            const infoTagGroupName = infoTagGroup.group;
            if (infoTagGroupName == groupName) {
                return infoTagGroup;
            }
        }
        return null;
    }

    @observableProperty
    sectionTitle: string;

    @observableProperty
    fields: Collection<CharacterProfileDetailSectionFieldInfoViewModel>;
}

export class CharacterProfileDetailSectionFieldInfoViewModel extends ObservableBase {
    constructor(label: string, value: string) {
        super();
        this.label = label;
        this.value = value;
    }

    @observableProperty
    label: string;

    @observableProperty
    value: string;
}

export class CharacterProfileDetailImageInfoViewModel extends ObservableBase {
    constructor(
        private readonly activeLoginViewModel: ActiveLoginViewModel, 
        imageInfo: ImageInfo
    ) {
        super();

        const urls = URLUtils.getProfileImageUrls(imageInfo);
        this.thumbnailUrl = urls.thumbnailUrl;
        this.fullUrl = urls.fullUrl;
        this.description = imageInfo.description;
    }

    @observableProperty
    thumbnailUrl: string;

    @observableProperty
    fullUrl: string;

    @observableProperty
    description: string;

    click() {
        this.activeLoginViewModel.bbcodeSink.webpageClick(this.fullUrl, false, {
            rightClick: false,
            channelContext: null,
            targetElement: null
        });
    }
}

export class CharacterProfileDetailKinkSetViewModel extends ObservableBase {
    constructor(
        profileInfo: ProfileInfo, myProfileInfo: ProfileInfo, kinkList: KinkList, profileFieldsInfoList: ProfileFieldsInfoList, mappingList: MappingList
    ) {
        super();

        const kinkSet = new Map<number, KinkListGroupListItem>();
        for (let klkey of Object.getOwnPropertyNames(kinkList)) {
            const klgroup = kinkList[klkey];
            for (let klitem of klgroup.items) {
                const kinkId = klitem.kink_id;
                kinkSet.set(kinkId, klitem);
            }
        }

        const klists: Map<string, CharacterProfileDetailKinkItemViewModel[]> = new Map();
        klists.set("fave", []);
        klists.set("yes", []);
        klists.set("maybe", []);
        klists.set("no", []);

        const rkl = RichKinkList.create(kinkList);
        const rirl = RichInfoTagDefListImpl.create(profileFieldsInfoList);
        const rmd = RichMappingDefImpl.create(mappingList);
        
        const profile = new Profile(profileInfo, rkl, rirl, rmd);
        const myProfile = new Profile(myProfileInfo, rkl, rirl, rmd);

        const seenNestedKinks = new Set<string>();
        if (!(profileInfo.custom_kinks instanceof Array)) {
            for (let ckkey of Object.getOwnPropertyNames(profileInfo.custom_kinks)) {
                const ck = profileInfo.custom_kinks[ckkey];
                klists.get(ck.choice)?.push(new CharacterProfileDetailKinkItemViewModel(
                    ck.name,
                    ck.description ?? "",
                    true,
                    null,
                    (!ck.children || ck.children.length == 0) ? undefined : IterableUtils.asQueryable(ck.children).
                        select(n => {
                            const ksi = kinkSet.get(n);
                            const kitem = new CharacterProfileDetailKinkItemViewModel(
                                ksi?.name ?? n.toString(),
                                StringUtils.unescapeHTMLFull(ksi?.description ?? ksi?.name ?? n.toString()),
                                false,
                                myProfile.kinks.getByName(CompatibilityCalculator.getCounterKinkName(ksi?.name ?? "", rkl))?.prefType ?? null
                            );
                            return kitem;
                        }).
                        orderBy(vm => vm.name, StringComparer.Ordinal)
                ));
                if (!(!ck.children || ck.children.length == 0)) {
                    for (let tc of ck.children) {
                        const ksi = kinkSet.get(tc);
                        const nestedKinkName = ksi?.name ?? tc.toString();
                        seenNestedKinks.add(nestedKinkName);
                    }
                }
            }
        }
        if (!(profileInfo.kinks instanceof Array)) {
            for (let pkkey of Object.getOwnPropertyNames(profileInfo.kinks)) {
                const pk = profileInfo.kinks[pkkey];
                const ksi = kinkSet.get(+pkkey);
                const kinkName = ksi?.name ?? pkkey;
                if (!seenNestedKinks.has(kinkName)) {
                    klists.get(pk)?.push(new CharacterProfileDetailKinkItemViewModel(
                        kinkName,
                        StringUtils.unescapeHTMLFull(ksi?.description ?? pkkey),
                        false,
                        myProfile.kinks.getByName(CompatibilityCalculator.getCounterKinkName(ksi?.name ?? "", rkl))?.prefType ?? null
                    ));
                }
            }
        }

        // insert custom kinks
        for (let klist of klists.values()) {
            if (profileInfo.customs_first) {
                klist.sort((a, b) => {
                    if (a.isCustomKink && !b.isCustomKink) return -1;
                    if (!a.isCustomKink && b.isCustomKink) return 1;

                    return (a.name < b.name) ? -1 : ((a.name == b.name) ? 0 : 1);
                });
            }
            else {
                klist.sort((a, b) => (a.name < b.name) ? -1 : ((a.name == b.name) ? 0 : 1));
            }
        }

        // TODO: insert subkinks

        this.favorites.push(...klists.get("fave")!);
        this.yes.push(...klists.get("yes")!);
        this.maybe.push(...klists.get("maybe")!);
        this.no.push(...klists.get("no")!);
    }

    @observableProperty
    favorites: Collection<CharacterProfileDetailKinkItemViewModel> = new Collection();

    @observableProperty
    yes: Collection<CharacterProfileDetailKinkItemViewModel> = new Collection();

    @observableProperty
    maybe: Collection<CharacterProfileDetailKinkItemViewModel> = new Collection();

    @observableProperty
    no: Collection<CharacterProfileDetailKinkItemViewModel> = new Collection();
}

export class CharacterProfileAltViewModel extends ObservableBase {
    constructor(
        private readonly parent: CharacterProfileDetailViewModel,
        characterName: CharacterName) {

        super();

        this.characterName = characterName;
    }

    @observableProperty
    characterName: CharacterName;

    click(targetElement: HTMLElement) {
        this.parent.activeLoginViewModel.bbcodeSink.userClick(this.characterName, {
            rightClick: false,
            channelContext: null,
            targetElement: targetElement
        });
    }
}

export class CharacterProfileDetailKinkItemViewModel extends ObservableBase {
    constructor(name: string, tooltip: string, isCustomKink: boolean, myKinkRating: KinkPrefType | null, subkinks?: Iterable<CharacterProfileDetailKinkItemViewModel>) {
        super();

        this.name = name;
        this.tooltip = tooltip;
        this.isCustomKink = isCustomKink;
        this.myKinkRating = myKinkRating;
        if (subkinks) {
            this.subkinks = new Collection<CharacterProfileDetailKinkItemViewModel>();
            for (let sk of subkinks) {
                this.subkinks.push(sk);
            }
        }
    }

    @observableProperty
    name: string;

    @observableProperty
    tooltip: string | null = null;

    @observableProperty
    isCustomKink: boolean = false;

    @observableProperty
    myKinkRating: KinkPrefType | null;

    @observableProperty
    subkinks: (Collection<CharacterProfileDetailKinkItemViewModel> | null) = null;
}