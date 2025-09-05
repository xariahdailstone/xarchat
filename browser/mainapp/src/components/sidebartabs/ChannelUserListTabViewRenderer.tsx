import { jsx, VNode, Fragment } from "../../snabbdom/index";
import { ConvertibleToDisposable } from "../../util/Disposable";
import { StringUtils } from "../../util/StringUtils";
import { ChannelUserListTabViewModel } from "../../viewmodel/sidebartabs/ChannelUserListTabViewModel";
import { SidebarTabViewRenderer, sidebarTabViewRendererFor } from "./SidebarTabContainerView";


@sidebarTabViewRendererFor(ChannelUserListTabViewModel)
export class ChannelUserListTabViewRenderer extends SidebarTabViewRenderer<ChannelUserListTabViewModel> {

    get cssFiles(): string[] { return []; }

    renderTitle(vm: ChannelUserListTabViewModel, isSelectedTab: boolean, addDisposable: (d: ConvertibleToDisposable) => void): (VNode | VNode[] | null) {
        const channel = vm.channel;
        return <>
            <x-iconimage attr-src="assets/ui/chatchannel-icon.svg" classList={["channeluserlist-title-icon"]}></x-iconimage>
            <div classList={["channeluserlist-title-usercount"]}>
                {(channel.usersModerators.size + channel.usersWatched.size + channel.usersLooking.size + channel.usersOther.size).toLocaleString()}
            </div>
        </>;
    }

    renderBody(vm: ChannelUserListTabViewModel, addDisposable: (d: ConvertibleToDisposable) => void): (VNode | VNode[] | null) {
        return <x-channeluserlist props={{ "viewModel": vm.channel }} attr-ignoreparent="true"></x-channeluserlist>;
    }

}
