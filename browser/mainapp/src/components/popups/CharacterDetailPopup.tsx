import { CharacterStatus, CharacterStatusWithLastChangedInfo } from "../../shared/CharacterSet";
import { OnlineStatusConvert } from "../../shared/OnlineStatus";
import { BBCodeParseResult, ChatBBCodeParser } from "../../util/bbcode/BBCode";
import { IDisposable, asDisposable } from "../../util/Disposable";
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
import { makeRenderingComponent } from "../RenderingComponentBase";
import { jsx, Fragment, VNode } from "../../snabbdom/index";

@componentArea("popups")
@componentElement("x-characterdetailpopup")
@popupViewFor(CharacterDetailPopupViewModel)
export class CharacterDetailPopup extends ContextPopupBase<CharacterDetailPopupViewModel> {
    constructor() {
        super();
        makeRenderingComponent(this, {
            render: () => this.render()
        });

        this.clickable = true;
    }

    protected render(): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        if (vm) {
            const disposables: IDisposable[] = [];
            const character = vm.char;
            const charSet = vm.session.characterSet;
            const reportContext = vm.session.selectedChannel;
            const cs = charSet.getCharacterStatus(character);

            const charNameClasses: string[] = [];
            charNameClasses.push(`gender-${CharacterGenderConvert.toString(cs.gender).toLowerCase()}`);
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
                const bbcodeParse = ChatBBCodeParser.parse(cs.statusMessage, {
                    sink: vm.session.bbcodeSink
                });
                disposables.push(bbcodeParse);
                statusMessageParseResult = bbcodeParse;
            }

            const statusDotVNode = StatusDotVNodeBuilder.getStatusDotVNode(cs);

            const hasNoteNode = (vm.memoText != null && vm.memoText != "" && vm.memoText.trim() != "")
                ? <span classList="has-memo-icon" title={vm.memoText}> {"\u{1F4C4}"}</span>
                : null;

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

                <div classList={["character-alsoinchannels", (vm.alsoInChannels.length > 0 ? "shown": "not-shown")]} id="elCharacterAlsoInChannels">
                    <div classList="character-alsoinchannels-title">Mutual Channels:</div>
                    <div classList="character-alsoinchannels-list">{this.renderAlsoInChannels(vm)}</div>
                </div>

                <div classList="character-buttonbar">
                    <button classList="theme-button char-detail-button character-button-pm" id="elPrivateMessage" on={{
                            "click": () => { vm.session.activatePMConvo(vm.char); vm.dismissed(); }
                        }}>Private Message</button>
                    <button classList="theme-button char-detail-button character-button-flist" id="elFList" on={{
                            "click": (e: Event) => {
                                vm.session.bbcodeSink.userClick(vm.char, {
                                    rightClick: false,
                                    channelContext: vm.channelViewModel,
                                    targetElement: e.target as HTMLElement
                                });
                                vm.dismissed();
                            }
                        }}>Profile</button>
                    <button classList="theme-button char-detail-button character-button-ignore" id="elIgnore" on={{
                            "click": () => {
                                vm.toggleIgnore();
                            }
                        }}>{cs.ignored ? "Unignore" : "Ignore"}</button>
                    <button classList="theme-button theme-button-warning char-detail-button character-button-report" id="elReport" on={{
                            "click": () => {
                                vm.appViewModel.alertAsync("Not Yet Implemented");
                                vm.dismissed();
                            }
                        }}>Report</button>
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

    protected renderAlsoInChannels(vm: CharacterDetailPopupViewModel): VNode {
        const children: VNode[] = [];
        for (let li of vm.alsoInChannels.iterateValues()) {
            children.push(<div classList="character-alsoinchannels-list-item">{li.title}</div>);
        }

        return <div classList="character-alsoinchannels-list">{children}</div>;
    }
}