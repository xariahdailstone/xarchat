import { jsx } from "../../../snabbdom/jsx";
import { VNode } from "../../../snabbdom/vnode";
import { BBCodeParseResult, ProfileBBCodeParser } from "../../../util/bbcode/BBCode";
import { getEffectiveCharacterNameVNodes } from "../../../util/CharacterNameIcons";
import { asDisposable } from "../../../util/Disposable";
import { ObservableValue } from "../../../util/Observable";
import { Collection } from "../../../util/ObservableCollection";
import { StringUtils } from "../../../util/StringUtils";
import { URLUtils } from "../../../util/URLUtils";
import { WhenChangeManager } from "../../../util/WhenChange";
import { CharacterProfileDetailKinkItemViewModel } from "../../../viewmodel/dialogs/character-profile/CharacterProfileDetailKinkItemViewModel";
import { CharacterProfileDialogViewModel } from "../../../viewmodel/dialogs/character-profile/CharacterProfileDialogViewModel";
import { setupTooltipHandling } from "../../../viewmodel/popups/TooltipPopupViewModel";
import { componentArea, componentElement } from "../../ComponentBase";
import { RenderingComponentBase } from "../../RenderingComponentBase";
import { ViewTabInfo } from "./ViewTabInfo";


@componentArea("dialogs/character-profile")
@componentElement("x-characterprofiledialoginner")
export class CharacterProfileDialogInner extends RenderingComponentBase<CharacterProfileDialogViewModel> {
    constructor() {
        super();

        this.whenConnectedWithViewModel(vm => {
            return setupTooltipHandling(this._sroot, vm.activeLoginViewModel.appViewModel);
        });
    }

    private readonly _selectedTab: ObservableValue<string> = new ObservableValue("overview");
    get selectedTab(): string { return this._selectedTab.value; }
    set selectedTab(value: string) { this._selectedTab.value = value; }

    private readonly _expandedKinksets: ObservableValue<CharacterProfileDetailKinkItemViewModel[]> = new ObservableValue([]);
    get expandedKinksets(): CharacterProfileDetailKinkItemViewModel[] { return this._expandedKinksets.value; }
    set expandedKinksets(value) { this._expandedKinksets.value = value; }

    private parseResultWCM: WhenChangeManager = new WhenChangeManager();
    private lastParseResult: BBCodeParseResult = null!;

    override disconnectedFromDocument() {
        super.disconnectedFromDocument();
        this.parseResultWCM.cleanup();
    }

    render(): VNode {
        const vm = this.viewModel;
        const summaryInfo = vm?.profileDetails?.summaryInfo;

        if (vm == null || vm.loading) {
            return <div classList="loading-display"><x-loadingicon></x-loadingicon></div>;
        }
        else if (!StringUtils.isNullOrWhiteSpace(vm.failureMessage)) {
            return <div classList="failure-display"><div classList="failure-message" id="elFailureMessage">{vm.failureMessage}</div></div>;
        }
        else if (vm.profileDetails) {
            const hasMemo = !(summaryInfo?.memo == null || StringUtils.isNullOrWhiteSpace(summaryInfo.memo));

            this.parseResultWCM.assign({
                desc: vm.profileDetails.description,
                sink: vm.activeLoginViewModel.bbcodeSink,
                inlines: (!(vm.profileDetails.profileInfo.inlines instanceof Array)) ? vm.profileDetails.profileInfo.inlines : {}
            }, (x) => {
                const parseResult = ProfileBBCodeParser.parse(x.desc ?? "", {
                    appViewModel: vm.activeLoginViewModel.appViewModel,
                    activeLoginViewModel: vm.activeLoginViewModel,
                    sink: x.sink,
                    syncGifs: true,
                    inlineImageData: x.inlines
                });
                this.lastParseResult = parseResult;
                return asDisposable(() => parseResult.dispose());
            });

            const vtiTabs: (ViewTabInfo | null)[] = [];
            vtiTabs.push(this.renderOverview(vm));
            vtiTabs.push(this.renderDetails(vm));
            vtiTabs.push(this.renderImages(vm));
            vtiTabs.push(this.renderKinks(vm));
            vtiTabs.push(this.renderAlts(vm));
            vtiTabs.push(this.renderFriends(vm));
            vtiTabs.push(this.renderGuestbook(vm));

            const createTabElement = (tabId: string, title: string) => {
                const el = <div classList={{ "profile-tabstrip-tab": true, "selected": (this.selectedTab == tabId) }}
                    on={{
                        "click": () => {
                            this.log("tab click", tabId);
                            this.selectedTab = tabId;
                        }
                    }}>
                    {title}
                </div>;
                return el;
            };
            const createTabElement2 = (vti: ViewTabInfo | null) => {
                if (vti == null) {
                    return null;
                }
                else {
                    return createTabElement(vti.id, vti.title);
                }
            };
            const createTabElements = (vtis: (ViewTabInfo | null)[]) => {
                const results: VNode[] = [];
                for (let vti of vtis) {
                    if (vti) {
                        const vnode = createTabElement(vti.id, vti.title);
                        if (vnode) {
                            results.push(vnode);
                        }
                    }
                }
                return results;
            };
            const createTabBodies = (vtis: (ViewTabInfo | null)[]) => {
                const vnodes: VNode[] = [];
                for (let vti of vtis) {
                    if (vti && vti.vnode) {
                        const vn = vti.vnode;
                        vn.data!["class-hidden"] = (this.selectedTab != vti.id);
                        vnodes.push(vn);
                    }
                }
                return vnodes;
            };

            const elProfile = <div classList={{ "profile-display": true, "has-memo": hasMemo }} id="elProfile">
                {this.renderInfoCard(vm)}
                {this.renderSummaryInfo(vm)}
                {this.renderMemo(vm)}
                <div classList="profile-tabstrip">
                    {createTabElements(vtiTabs)}
                </div>
                <div classList="profile-main" id="elProfileMain">
                    {createTabBodies(vtiTabs)}
                </div>
            </div>;

            return elProfile;
        }
        else {
            return <div>unknown state</div>;
        }
    }

    private renderInfoCard(vm: CharacterProfileDialogViewModel): VNode {
        if (vm.profileDetails == null) {
            return <div classList="profile-infocard"></div>;
        }
        else {
            const isBookmarked = vm.profileDetails.isBookmarked;

            return <div classList="profile-infocard">
                <img classList="profile-avatar" id="elProfileAvatar" src={URLUtils.getAvatarImageUrl(vm.profileDetails.character)}></img>
                <div classList="profile-name" id="elProfileName">{vm.profileDetails.character.value}</div>
                <div classList="profile-title" id="elProfileTitle">{vm.profileDetails.profileInfo.custom_title ?? ""}</div>
                <div classList="profile-buttons">
                    <button classList="profile-button profile-button-openexternal" data-tooltip="Open in F-List" id="elBtnOpenExternal"
                        on={{ "click": () => { vm.profileDetails!.openInFList(); } }}>
                        <x-iconimage src="assets/ui/openexternal-icon.svg"></x-iconimage>
                    </button>
                    <button classList="profile-button profile-button-openpm" data-tooltip="Open Private Message Tab" id="elBtnOpenPM">
                        <x-iconimage src="assets/ui/openpm-icon.svg"></x-iconimage>
                    </button>
                    <button classList="profile-button profile-button-memo" data-tooltip="Add/Edit Memo" id="elBtnEditMemo"
                        on={{ "click": () => { vm.profileDetails!.addEditMemo(); } }}>
                        <x-iconimage src="assets/ui/memo-icon.svg"></x-iconimage>
                    </button>
                    <button classList={{ "profile-button": true, "profile-button-bookmark": true, "isbookmarked": isBookmarked }}
                        data-tooltip={isBookmarked ? "Remove Bookmark" : "Add Bookmark"} id="elBtnBookmark" on={{ "click": () => { vm.profileDetails!.toggleBookmark(); } }}>
                        <x-iconimage src={isBookmarked ? "assets/ui/bookmark-remove-icon.svg" : "assets/ui/bookmark-add-icon.svg"} id="elBookmarkIcon"></x-iconimage>
                    </button>
                    <button classList="profile-button profile-button-report" data-tooltip="Report" id="elBtnReport">
                        <x-iconimage src="assets/ui/report-icon.svg"></x-iconimage>
                    </button>
                </div>
            </div>;
        }
    }

    private renderSummaryInfo(vm: CharacterProfileDialogViewModel): VNode {
        const addSummaryInfoRow = (title: string, value: string | null | undefined): VNode => {
            return <tr classList={{ "hidden": StringUtils.isNullOrWhiteSpace(value) }}>
                <td>{title + ":"}</td>
                <td>{value}</td>
            </tr>;
        };

        const pd = vm.profileDetails?.summaryInfo;
        return <div classList="profile-summaryinfo">
            <table>
                {addSummaryInfoRow("Age", pd?.age)}
                {addSummaryInfoRow("Gender", pd?.gender)}
                {addSummaryInfoRow("Orientation", pd?.orientation)}
                {addSummaryInfoRow("Language Pref.", pd?.languagePreference)}
                {addSummaryInfoRow("Species", pd?.species)}
                {addSummaryInfoRow("Furry Pref.", pd?.furryPreference)}
            </table>
            <table>
                {addSummaryInfoRow("Dom/Sub Role", pd?.domSubRole)}
                {addSummaryInfoRow("Desired RP Length", pd?.desiredRpLength)}
                {addSummaryInfoRow("Created", pd?.created)}
                {addSummaryInfoRow("Last Updated", pd?.lastUpdated)}
                {addSummaryInfoRow("Views", pd?.views)}
            </table>
        </div>;
    }

    private renderMemo(vm: CharacterProfileDialogViewModel): VNode {
        const hasMemo = !StringUtils.isNullOrWhiteSpace(vm.profileDetails?.summaryInfo?.memo);

        return <div classList={{ "profile-memo": true, "hidden": !hasMemo }} id="elProfileMemo">
            <span classList="profile-memo-label">Memo:</span>
            <span classList="profile-memo-text" id="elProfileMemoText">{hasMemo ? vm.profileDetails?.summaryInfo!.memo : ""}</span>
        </div>;
    }

    private renderOverview(vm: CharacterProfileDialogViewModel): ViewTabInfo {
        const vtiOverview: ViewTabInfo = {
            id: "overview",
            title: "Overview",
            vnode: <div classList="profile-main-description" id="elProfileDescription">
                <x-bbcodedisplay props={{ "viewModel": this.lastParseResult }}></x-bbcodedisplay>
            </div>
        };
        return vtiOverview;
    }

    private renderDetails(vm: CharacterProfileDialogViewModel): ViewTabInfo | null {
        if (vm.profileDetails == null || (vm.profileDetails.detailSections.length == 0)) {
            return null;
        }
        else {
            const elDetails = <div classList="profile-main-details" id="elProfileDetail"></div>;
            for (let detailSection of vm.profileDetails.detailSections) {
                const tblClasses: any = { "detail-infotag-group": true };
                tblClasses["detail-infotag-group-" + detailSection.sectionTitle.toLowerCase().replace(" ", "-")] = true;
                const elTable = <table class={tblClasses}>
                    <tr>
                        <td classList="detail-infotag-group-title">{detailSection.sectionTitle}</td>
                    </tr>
                </table>;
                for (let fld of detailSection.fields) {
                    const elRow = <tr>
                        <td classList="detail-infotag-label">{fld.label + ":"}</td>
                        <td classList="detail-infotag-value">{fld.value}</td>
                    </tr>;
                    elTable.children!.push(elRow);
                }
                elDetails.children!.push(elTable);
            }
            return {
                id: "details",
                title: "Details",
                vnode: elDetails
            };
        }
    }

    private renderImages(vm: CharacterProfileDialogViewModel): ViewTabInfo | null {
        if (vm.profileDetails == null || (vm.profileDetails.images.length == 0)) {
            return null;
        }
        else {
            const elImages = <div classList="profile-main-images" id="elProfileImages"></div>;
            for (let imageInfo of vm.profileDetails.images) {
                const elImage = <div classList="image-thumbnail" style={{ "backgroundImage": `url(${imageInfo.thumbnailUrl})` }} title={imageInfo.description}
                    on={{ "click": () => imageInfo.click() }}></div>;
                elImages.children!.push(elImage);
            }
            return {
                id: "images",
                title: `Images (${vm.profileDetails.images.length})`,
                vnode: elImages
            };
        }
    }

    private renderKinks(vm: CharacterProfileDialogViewModel): ViewTabInfo | null {
        if (vm.profileDetails == null || (vm.profileDetails.kinks.favorites.length +
            vm.profileDetails.kinks.yes.length +
            vm.profileDetails.kinks.maybe.length +
            vm.profileDetails.kinks.no.length == 0)) {
            return null;
        }
        else {
            const elFavKinks = <div classList="kinks-column-content" id="elKinksFavorites"></div>;
            const elYesKinks = <div classList="kinks-column-content" id="elKinksYes"></div>;
            const elMaybeKinks = <div classList="kinks-column-content" id="elKinksMaybe"></div>;
            const elNoKinks = <div classList="kinks-column-content" id="elKinksNo"></div>;

            const populateKinks = (elContainer: VNode, kinkList: Collection<CharacterProfileDetailKinkItemViewModel>) => {
                for (let k of kinkList) {
                    const arrowClasses: any = { "kink-list-item-arrow": true };
                    if (!StringUtils.isNullOrWhiteSpace(k.myKinkRating)) {
                        arrowClasses[`kink-list-item-arrow-mypref-${k.myKinkRating}`] = true;
                    }

                    const isGroup = (k.subkinks && k.subkinks.length > 0);
                    const isExpanded = (isGroup && this.expandedKinksets.indexOf(k) != -1) ? true : false;
                    const elSubkinks = !isGroup ? null : <x-collapsebody classList="kink-sublist"
                        props={{ "collapsed": !isExpanded }}
                        data-collapsed={!isExpanded ? "true" : "false"}></x-collapsebody>;

                    let elArrow;
                    if (isGroup) {
                        elArrow = <x-iconimage classList={["collapsearrow", (!isExpanded ? "collapsed" : "expanded")]} src="assets/ui/collapse.svg"></x-iconimage>;
                    }
                    else {
                        elArrow = <div classList={arrowClasses}>{"\u{1F846}"}</div>;
                    }

                    const tooltipText = !StringUtils.isNullOrWhiteSpace(k.tooltip) ? k.tooltip : "No description available.";
                    const elKink = <div classList={{ "kink-list-item": true, "kink-list-iscustom": k.isCustomKink }} data-tooltiptitle={k.name} data-tooltip={tooltipText}>
                        {elArrow}
                        <div classList="kink-list-item-name" props={{ innerHTML: k.name }}></div>
                    </div>;
                    elContainer.children!.push(elKink);

                    if (isGroup) {
                        elKink.data!.on = {
                            "click": () => {
                                let newExpandedKinksets = [...this.expandedKinksets];
                                if (isExpanded) {
                                    newExpandedKinksets = newExpandedKinksets.filter(v => v != k);
                                }
                                else {
                                    newExpandedKinksets.push(k);
                                }
                                this.expandedKinksets = newExpandedKinksets;
                            }
                        };
                        populateKinks(elSubkinks!, k.subkinks!);
                        elContainer.children!.push(elSubkinks!);
                    }
                }
            };
            populateKinks(elFavKinks, vm.profileDetails.kinks.favorites);
            populateKinks(elYesKinks, vm.profileDetails.kinks.yes);
            populateKinks(elMaybeKinks, vm.profileDetails.kinks.maybe);
            populateKinks(elNoKinks, vm.profileDetails.kinks.no);

            const vnode = <div classList="profile-main-kinks">
                <div classList="kinks-column kinks-column-favorite">
                    <div classList="kinks-column-title">Favorite</div>
                    {elFavKinks}
                </div>
                <div classList="kinks-column kinks-column-yes">
                    <div classList="kinks-column-title">Yes</div>
                    {elYesKinks}
                </div>
                <div classList="kinks-column kinks-column-maybe">
                    <div classList="kinks-column-title">Maybe</div>
                    {elMaybeKinks}
                </div>
                <div classList="kinks-column kinks-column-no">
                    <div classList="kinks-column-title">No</div>
                    {elNoKinks}
                </div>
            </div>;
            return {
                id: "kinks",
                title: "Kinks",
                vnode: vnode
            };
        }
    }

    private renderAlts(vm: CharacterProfileDialogViewModel): ViewTabInfo | null {
        if (vm.profileDetails == null || vm.profileDetails.alts.length == 0) {
            return null;
        }
        else {
            const elAlts = <div classList="profile-main-alts"></div>;
            for (let talt of vm.profileDetails.alts) {
                const elThisAlt = <div classList="profile-main-alts-item"
                    on={{ "click": (e) => { talt.click(e.target as HTMLElement); } }}>
                    <img classList="profile-main-alts-item-image" src={URLUtils.getAvatarImageUrl(talt.characterName)} />
                    <div classList="profile-main-alts-item-name">{getEffectiveCharacterNameVNodes(talt.characterName, vm.activeLoginViewModel)}</div>
                </div>;
                elAlts.children!.push(elThisAlt);
            }
            return {
                id: "alts",
                title: `Alts (${vm.profileDetails.alts.length})`,
                vnode: elAlts
            };
        }
    }

    private renderFriends(vm: CharacterProfileDialogViewModel): ViewTabInfo | null {
        if (vm.profileDetails == null || vm.profileDetails.friends.length == 0) {
            return null;
        }
        else {
            const elFriends = <div classList="profile-main-friends"></div>;
            for (let tfriend of vm.profileDetails.friends) {
                const elThisFriend = <div classList="profile-main-friends-item"
                    on={{ "click": (e) => { tfriend.click(e.target as HTMLElement); } }}>
                    <img classList="profile-main-friends-item-image" src={URLUtils.getAvatarImageUrl(tfriend.characterName)} />
                    <div classList="profile-main-friends-item-name">{getEffectiveCharacterNameVNodes(tfriend.characterName, vm.activeLoginViewModel)}</div>
                </div>;
                elFriends.children!.push(elThisFriend);
            }
            return {
                id: "friends",
                title: `Friends (${vm.profileDetails.friends.length})`,
                vnode: elFriends
            };
        }
    }

    private renderGuestbook(vm: CharacterProfileDialogViewModel): ViewTabInfo | null {
        if (vm.profileDetails == null || vm.profileDetails.guestbook == null) {
            return null;
        }
        else {
            const elGuestbook = <div classList="profile-main-guestbook">
                <x-characterguestbookpane props={{ "viewModel": vm.profileDetails.guestbook }}></x-characterguestbookpane>
            </div>;
            return {
                id: "guestbook",
                title: `Guestbook`,
                vnode: elGuestbook
            };
        }
    }
}
