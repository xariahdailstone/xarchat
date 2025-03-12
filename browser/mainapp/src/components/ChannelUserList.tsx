import { CharacterGenderConvert } from "../shared/CharacterGender.js";
import { CharacterName } from "../shared/CharacterName.js";
import { CharacterStatus } from "../shared/CharacterSet.js";
import { OnlineStatusConvert } from "../shared/OnlineStatus.js";
import { jsx, Fragment, VNode } from "../snabbdom/index.js";
import { CharacterLinkUtils } from "../util/CharacterLinkUtils.js";
import { getEffectiveCharacterName, getEffectiveCharacterNameWatcher } from "../util/CharacterNameIcons.js";
import { asDisposable, IDisposable } from "../util/Disposable.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { CollectionChangeEvent, CollectionChangeType, ReadOnlyObservableCollection } from "../util/ObservableCollection.js";
import { DictionaryChangeEvent, DictionaryChangeType, ObservableKeyExtractedOrderedDictionary, ObservableOrderedDictionary } from "../util/ObservableKeyedLinkedList.js";
import { WhenChangeManager } from "../util/WhenChange.js";
import { KeyValuePair } from "../util/collections/KeyValuePair.js";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel.js";
import { ChatChannelUserViewModel, ChatChannelViewModel } from "../viewmodel/ChatChannelViewModel.js";
import { CharacterStatusListener } from "./CharacterStatusListener.js";
import { CollectionViewLightweight } from "./CollectionViewLightweight.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { RenderingComponentBase } from "./RenderingComponentBase.js";
import { StatusDot, StatusDotVNodeBuilder } from "./StatusDot.js";

@componentElement("x-channeluserlist")
export class ChannelUserList extends RenderingComponentBase<ChatChannelViewModel> {

    protected render(): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        if (!vm) return <></>;

        const totalUserCount = (vm.usersModerators.length + vm.usersWatched.length + vm.usersLooking.length + vm.usersOther.length);
        const joinFriendsAndBookmarks = vm.getConfigSettingById("joinFriendsAndBookmarks");

        const sectionNodes: (VNode | null)[] = [];

        sectionNodes.push(this.renderSection(vm, "sec-mods", "elMods", "Moderators", vm.usersModerators));

        if (joinFriendsAndBookmarks) {
            sectionNodes.push(this.renderSection(vm, "sec-watched", "elWatched", "Friends/Bookmarks", vm.usersWatched));
        }
        else {
            sectionNodes.push(this.renderSection(vm, "sec-friends", "elFriends", "Friends", vm.usersWatched, cs => cs.isFriend));
            sectionNodes.push(this.renderSection(vm, "sec-bookmarks", "elBookmarks", "Bookmarks", vm.usersWatched, cs => !cs.isFriend));
        }
        sectionNodes.push(this.renderSection(vm, "sec-looking", "elLooking", "Looking", vm.usersLooking));

        const othersTitle = (sectionNodes.filter(x => x != null).length == 0) ? "Everyone" : "Others";
        sectionNodes.push(this.renderSection(vm, "sec-others", "elOthers", othersTitle, vm.usersOther));

        return <>
            <div key="sec-usercount" id="elUserCountContainer" classList={["usercount"]}>
                {totalUserCount.toLocaleString()} in channel
            </div>
            {sectionNodes}
        </>;
    }
    
    private renderSection(vm: ChatChannelViewModel,
        key: string, id: string, title: string, 
        userList: ObservableKeyExtractedOrderedDictionary<CharacterName, ChatChannelUserViewModel>,
        statusFilter?: (cs: CharacterStatus) => boolean): (VNode | null) {

        if (userList.length == 0) {
            return null;
        }

        let userCount = 0;
        const userNodes: VNode[] = [];
        for (let v of userList.values()) {
            const cs = vm.activeLoginViewModel.characterSet.getCharacterStatus(v.character);

            if (statusFilter && !statusFilter(cs)) {
                continue;
            }

            userNodes.push(<div key={`user-${v.character.canonicalValue}`} classList={["useritem"]}>
                { StatusDotVNodeBuilder.getStatusDotVNode(cs) }
                { CharacterLinkUtils.createStaticCharacterLinkVNode(vm.activeLoginViewModel, cs.characterName, cs, vm) }
            </div>);
            userCount++;
        }
        if (userNodes.length == 0) {
            return null;
        }

        return <div key={key} id={id} classList={["section"]}>
            <div key={`${key}-title`} classList={["sectiontitle"]}>{title} ({userCount.toLocaleString()})</div>
            <div key={`${key}-items`} classList={["sectionitems"]}>
                {userNodes}
            </div>
        </div>;
    }
}