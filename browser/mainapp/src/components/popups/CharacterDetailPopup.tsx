import { CharacterStatus, CharacterStatusWithLastChangedInfo } from "../../shared/CharacterSet";
import { OnlineStatusConvert } from "../../shared/OnlineStatus";
import { BBCodeParseResult, ChatBBCodeParser } from "../../util/bbcode/BBCode";
import { DisposableOwnerField, IDisposable, asDisposable } from "../../util/Disposable";
import { URLUtils } from "../../util/URLUtils";
import { WhenChangeManager } from "../../util/WhenChange";
import { AlsoInChannelLineItem, CharacterDetailPopupViewModel } from "../../viewmodel/popups/CharacterDetailPopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { StatusDotLightweight, StatusDotVNodeBuilder } from "../StatusDot";
import { PopupBase, PopupFrame, popupViewFor } from "./PopupFrame";
import { ContextPopupBase } from "./ContextPopupBase";
import { CharacterGenderConvert } from "../../shared/CharacterGender";
import { CollectionViewLightweight } from "../CollectionViewLightweight";
import { DialogButtonStyle } from "../../viewmodel/dialogs/DialogViewModel";
import { ChatChannelViewModel } from "../../viewmodel/ChatChannelViewModel";
import { HTMLUtils } from "../../util/HTMLUtils";
import { StringUtils } from "../../util/StringUtils";
import { makeRenderingComponent, RenderArguments } from "../RenderingComponentBase";
import { jsx, Fragment, VNode } from "../../snabbdom/index";
import { setupTooltipHandling } from "../../viewmodel/popups/TooltipPopupViewModel";
import { CharacterProfileDialogViewModel } from "../../viewmodel/dialogs/character-profile/CharacterProfileDialogViewModel";

@componentArea("popups")
@componentElement("x-characterdetailpopup")
@popupViewFor(CharacterDetailPopupViewModel)
export class CharacterDetailPopup extends ContextPopupBase<CharacterDetailPopupViewModel> {
    constructor() {
        super();
        makeRenderingComponent(this, {
            render: (args) => this.render(args)
        });

        this.clickable = true;

        this.whenConnectedWithViewModel(() => {
            this.logInfo("connected");
            const ttdisposable = setupTooltipHandling(this._sroot, this.viewModel!.appViewModel);
            return asDisposable(() => {
                this.logInfo("no longer connected");
                this._currentBBCodeParseResult.value = null;
            }, ttdisposable);
            
        });
    }

    private readonly _statusMessageTextWCM: WhenChangeManager = new WhenChangeManager();
    private _currentBBCodeParseResult: DisposableOwnerField<BBCodeParseResult> = new DisposableOwnerField();

    protected render(args: RenderArguments): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        if (vm) {
            const disposables: IDisposable[] = [];
            const character = vm.char;
            const charSet = vm.session.characterSet;
            const reportContext = vm.session.selectedChannel;
            const cs = charSet.getCharacterStatus(character);

            const charNameClasses: string[] = [];
            charNameClasses.push(`gender-${CharacterGenderConvert.toString(cs.gender).toLowerCase()}`);
            if (vm.session.bookmarks.has(character)) {
                charNameClasses.push("char-is-bookmark");
            }
            if (vm.session.friends.has(character)) {
                charNameClasses.push("char-is-friend");
            }

            const mainClasses: string[] = [];
            if ((vm.channelViewModel?.isEffectiveOp(vm.session.characterName)) ?? false) {
                mainClasses.push("is-chanop");
            }
            if ((vm.channelViewModel?.isEffectiveOwner(vm.session.characterName)) ?? false) {
                mainClasses.push("is-chanowner");
            }
            if ((vm.session.isServerOp(vm.session.characterName)) ?? false) {
                mainClasses.push("is-serverop");
            }

            const hasStatusMessage = cs.statusMessage.trim() != "";

            let statusMessageForInnerText: string;
            if (hasStatusMessage && cs.statusMessageLastChanged != null && cs.statusMessageLastChanged != "login") {
                const effectiveMs = (new Date()).getTime() - cs.statusMessageLastChanged.getTime();
                const effChgMsg = StringUtils.msToVeryShortString(effectiveMs, "% ago", "just now");
                statusMessageForInnerText = `(Last changed ${effChgMsg})`;
            }
            else {
                statusMessageForInnerText = "";
            }

            let statusMessageParseResult: BBCodeParseResult | null = null;
            if (hasStatusMessage) {
                mainClasses.push("has-statusmessage");
                this._statusMessageTextWCM.assign({ statusMessage: cs.statusMessage }, (sm) => {
                    this.logInfo("render statusmessage");
                    const bbcodeParse = ChatBBCodeParser.parse(cs.statusMessage, { 
                        sink: vm.session.bbcodeSink, 
                        addUrlDomains: true, 
                        appViewModel: vm.session.appViewModel, 
                        activeLoginViewModel: vm.session,
                        channelViewModel: vm.channelViewModel ?? undefined,
                        imagePreviewPopups: true,
                        syncGifs: true
                    });
                    this._currentBBCodeParseResult.value = bbcodeParse;
                });
            }
            else {
                this._statusMessageTextWCM.assign({ statusMessage: null }, (sm) => {
                    this.logInfo("blanked statusmessage");
                    this._currentBBCodeParseResult.value = null;
                });
            }
            statusMessageParseResult = this._currentBBCodeParseResult.value;

            const statusDotVNode = StatusDotVNodeBuilder.getStatusDotVNode(cs);

            const hasNoteNode = (vm.memoText != null && vm.memoText != "" && vm.memoText.trim() != "")
                ? <span classList="has-memo-icon" title={vm.memoText}> {"\u{1F4C4}"}</span>
                : null;

            const isSelf = vm.char == vm.session.characterName;
            const resNode = <div classList={[ "main-container", ...mainClasses ]}>
                <img classList="character-icon" id="elCharacterIcon" attr-src={URLUtils.getAvatarImageUrl(character)} />
                <div classList={["character-name", ...charNameClasses]} id="elCharacterName">{character.value}{hasNoteNode}</div>
                <div classList="character-onlinestatus" id="elCharacterOnlineStatus">
                    <div classList="statusdotcontainer" id="elStatusDotContainer">{statusDotVNode}</div>
                    <div classList="onlinestatustext" id="elStatusText">{OnlineStatusConvert.toStringWithFor(cs.status, cs.statusLastChanged)}</div>
                </div>

                <div classList="character-settings" id="elConfigIconContainer" on={{
                        "click": () => { 
                            vm.showSettings();
                            vm.dismissed();
                        }
                    }}>
                    <x-iconimage id="elConfigIcon" attr-src="assets/ui/config-button.svg"></x-iconimage>
                </div>

                <div classList="character-statusmessage" id="elCharacterStatusMessage">{statusMessageParseResult?.asVNode()}</div>
                <div classList="character-statusmessage-for" id="elCharacterStatusMessageFor">{statusMessageForInnerText}</div>

                <div classList={["character-alsoinchannels", ((vm.alsoInChannels.length > 0 && !isSelf) ? "shown": "not-shown")]} id="elCharacterAlsoInChannels">
                    <div classList="character-alsoinchannels-title">Mutual Channels:</div>
                    <div classList="character-alsoinchannels-list">{this.renderAlsoInChannels(vm)}</div>
                </div>

                <div classList="character-buttonbar">
                    { this.renderPMButton(args, vm) }
                    { this.renderProfileButton(args, vm) }
                    { this.renderBookmarkButton(args, vm) }
                    { this.renderIgnoreButton(args, vm, cs) }
                    { this.renderReportButton(args, vm) }
                </div>

                <div classList="channelop-buttonbar">
                    <div classList="channelop-buttonbar-title" id="elChannelOpButtonbarTitle">Channel Moderator Options</div>
                    <button classList="theme-button char-detail-button character-button-chankick" id="elChanKick" on={{
                            "click": () => { vm.kick(); }
                        }}>Kick</button>
                    <button classList="theme-button char-detail-button character-button-chantimeout" id="elChanTimeout" on={{
                            "click": () => { vm.timeout(); }
                        }}>Timeout</button>
                    <button classList="theme-button theme-button-warning char-detail-button character-button-chanban" id="elChanBan" on={{
                            "click": () => { vm.ban(); }
                        }}>Ban</button>
                </div>

                <div classList="channelowner-buttonbar">
                    <div classList="channelowner-buttonbar-title" id="elChannelOpButtonbarTitle">Channel Owner Options</div>
                    <button classList="theme-button char-detail-button character-button-chanmod" id="elChanMakeMod" on={{
                            "click": () => { vm.makeMod(); }
                        }}>Make Mod</button>
                    <button classList="theme-button char-detail-button character-button-chandemod" id="elChanDeMod" on={{
                            "click": () => { vm.removeMod(); }
                        }}>Remove Mod</button>
                    <button classList="theme-button char-detail-button character-button-chanmakeowner" id="elChanMakeOwner" on={{
                            "click": () => { vm.makeOwner(); }
                        }}>Give Ownership</button>
                </div>
            </div>;
            return [resNode, asDisposable(...disposables)];
        }
        else {
            return <></>;
        }
    }

    private renderPMButton(args: RenderArguments, vm: CharacterDetailPopupViewModel): VNode {
        return <button classList="theme-button char-detail-button character-button-pm" id="elPrivateMessage" on={{
                "click": () => { vm.session.activatePMConvo(vm.char); vm.dismissed(); }
            }} data-tooltip="Private Message"><x-iconimage src="assets/ui/openpm-icon.svg"></x-iconimage><div classList={["button-label"]}>PM</div></button>
    }

    private renderProfileButton(args: RenderArguments, vm: CharacterDetailPopupViewModel): VNode {
        return <button classList="theme-button char-detail-button character-button-flist" id="elFList" on={{
                "click": (e: Event) => {
                    const pd = new CharacterProfileDialogViewModel(vm.session.appViewModel, vm.session, vm.char, vm.charProfileInfoPromise);
                    vm.session.appViewModel.showDialogAsync(pd);
                    vm.dismissed();
                }
            }} data-tooltip="Profile"><x-iconimage src="assets/ui/profile-icon.svg"></x-iconimage><div classList={["button-label"]}>Profile</div></button>
    }

    private renderBookmarkButton(args: RenderArguments, vm: CharacterDetailPopupViewModel): VNode {
        let node: VNode;

        if (vm.isBookmark.isValue && vm.isBookmark.value) {
            node = <button classList="theme-button char-detail-button character-button-bookmark is-bookmark" attrs={{ "disabled": false }} id="elBookmark" on={{
                    "click": () => vm.toggleBookmarkAsync()
                }}
                data-tooltip="Unbookmark"><x-iconimage src="assets/ui/bookmark-remove-icon.svg"></x-iconimage></button>
        }
        else {
            if (vm.isBookmark.isLoading || vm.canBookmark.isLoading) {
                node = <button classList="theme-button char-detail-button character-button-bookmark is-loading" attrs={{ "disabled": true }} id="elBookmark" on={{}}
                    data-tooltip="..."><x-iconimage src="assets/ui/loading-anim.svg"></x-iconimage></button>
            }
            else if (vm.canBookmark.value) {
                node = <button classList="theme-button char-detail-button character-button-bookmark is-not-bookmark" attrs={{ "disabled": false }} id="elBookmark" on={{
                        "click": () => vm.toggleBookmarkAsync()
                    }}
                    data-tooltip="Bookmark"><x-iconimage src="assets/ui/bookmark-add-icon.svg"></x-iconimage></button>
            }
            else {
                node = <button classList="theme-button char-detail-button character-button-bookmark cant-bookmark" attrs={{ "disabled": true }} id="elBookmark" on={{}}
                    data-tooltip="Bookmarks Disabled"><x-iconimage src="assets/ui/bookmarks-icon.svg"></x-iconimage></button>                
            }
        }

        return node;
    }

    private renderIgnoreButton(args: RenderArguments, vm: CharacterDetailPopupViewModel, cs: CharacterStatus): VNode {
        return <button classList="theme-button char-detail-button character-button-ignore" id="elIgnore" on={{
                    "click": () => {
                        vm.toggleIgnore();
                    }
                }} data-tooltip={cs.ignored ? "Unignore" : "Ignore"}><x-iconimage src={cs.ignored ? "assets/ui/unignore-icon.svg" : "assets/ui/ignore-icon.svg"}></x-iconimage></button>
    }

    private renderReportButton(args: RenderArguments, vm: CharacterDetailPopupViewModel): VNode {
        return <button classList="theme-button theme-button-warning char-detail-button character-button-report" id="elReport" on={{
                "click": () => {
                    vm.submitReport();
                    vm.dismissed();
                }
            }} data-tooltip="Report"><x-iconimage src="assets/ui/report-icon.svg"></x-iconimage></button>;
    }

    protected renderAlsoInChannels(vm: CharacterDetailPopupViewModel): VNode {
        const children: VNode[] = [];
        for (let li of vm.alsoInChannels.iterateValues()) {
            children.push(<div classList="character-alsoinchannels-list-item">{li.title}</div>);
        }

        return <div classList="character-alsoinchannels-list">{children}</div>;
    }
}