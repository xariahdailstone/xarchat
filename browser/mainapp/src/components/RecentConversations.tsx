import { CharacterGenderConvert } from "../shared/CharacterGender";
import { CharacterName } from "../shared/CharacterName";
import { jsx, VNode, Fragment, Classes } from "../snabbdom/index";
import { asDisposable, ConvertibleToDisposable, IDisposable } from "../util/Disposable";
import { StringUtils } from "../util/StringUtils";
import { URLUtils } from "../util/URLUtils";
import { RecentConversationsViewModel } from "../viewmodel/RecentConversationsViewModel";
import { componentElement } from "./ComponentBase";
import { RenderingStageViewComponent, stageViewFor } from "./Stage";
import { StatusDotVNodeBuilder } from "./StatusDot";

@componentElement("x-recentconversations")
@stageViewFor(RecentConversationsViewModel)
export class RecentConversations extends RenderingStageViewComponent<RecentConversationsViewModel> {

    constructor() {
        super();

        this.whenConnectedWithViewModel(vm => {
            vm.refreshAsync();
            return asDisposable(() => {
                vm.clear();
            });
        });
    }

    protected render(): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        if (!vm) { return <></>; }

        const disposables: ConvertibleToDisposable[] = [];
        const addDisposable = (d: ConvertibleToDisposable) => { disposables.push(d); };

        let contentNodes: VNode[];
        if (vm.isLoading) {
            contentNodes = [ <div>Loading, please wait...</div> ];
        }
        else {
            contentNodes = [];
            for (let rc of vm.recentConversations) {
                const charStatus = vm.session.characterSet.getCharacterStatus(rc.interlocutor);
                const charStatusDot = StatusDotVNodeBuilder.getStatusDotVNode(charStatus);

                const xnickname = charStatus.nickname; //vm.session.nicknameSet.get(rc.interlocutor);
                const nicknameNode = (StringUtils.isNullOrWhiteSpace(xnickname))
                    ? <></>
                    : <span classList={[ "recentconversations-item-nickname" ]}> ({xnickname})</span>
                
                const nameNode = <span classList={[ "recentconversations-item-name" ]}>{rc.interlocutor.value}</span>

                 
                const nameClasses: Classes = {
                    "recentconversations-item-namecontainer": true,
                    "char-is-bookmark": charStatus.isBookmark,
                    "char-is-friend": charStatus.isFriend
                };
                const gClass = "gender-" + CharacterGenderConvert.toString(charStatus.gender);
                nameClasses[gClass] = true;

                const itemClasses: Classes = {
                    "recentconversations-item": true,
                    "selected-item": vm.selectedConversation != null && CharacterName.equals(vm.selectedConversation.interlocutor, rc.interlocutor)
                }
                
                contentNodes.push(<div class={itemClasses} on={{
                        "click": () => { vm.selectedConversation = rc; }
                    }}>
                    <img classList={[ "recentconversations-item-avatarimage" ]} attrs={{ "src": URLUtils.getAvatarImageUrl(rc.interlocutor) }}></img>
                    <div classList={[ "recentconversations-item-statusdotcontainer" ]}>{charStatusDot}</div>
                    <div class={nameClasses}>{nameNode}{nicknameNode}</div>
                </div>);
            }
        }

        const previewNodes: VNode[] = [];
        if (vm.selectedConversation) {
            if (vm.isLoadingSelectedConversationItems) {
                previewNodes.push(
                    <div classList={[ "recentconversations-preview-stream" ]}>Loading, please wait...</div>
                );
            }
            else {
                previewNodes.push(
                    <x-channelstream 
                        classList={[ "recentconversations-preview-stream" ]} 
                        props={{ "viewModel": vm.selectedConversationItems }}></x-channelstream>
                );
            }
            previewNodes.push(
                <div classList={[ "recentconversations-preview-buttonscontainer" ]}>
                    <button classList={[ "recentconversations-preview-buttons-open", "themed" ]} on={{
                        "click": () => {
                            vm.openPMTab();
                        }
                    }}>Open PM Tab</button>
                </div>
            )
        }

        const vnode = <div classList={[ "recentconversations-outer" ]}>
            <x-iconimage classList={[ "recentconversations-icon" ]} attrs={{
                "src": "assets/ui/history-icon.svg"
            }}></x-iconimage>
            <div classList={[ "recentconversations-heading" ]}>Recent Conversations</div>
            <div classList={[ "recentconversations-description" ]}>
                The most recent private messages you've been involved with are shown below.
            </div>
            <div classList={[ "recentconversations-listcontainer" ]}>{contentNodes}</div>
            <div classList={[ "recentconversations-previewcontainer" ]}>{previewNodes}</div>
        </div>;

        return [vnode, asDisposable(...disposables)];
    }

}