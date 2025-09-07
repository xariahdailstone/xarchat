import { jsx, VNode, Fragment } from "../../snabbdom/index";
import { ConvertibleToDisposable } from "../../util/Disposable";
import { StringUtils } from "../../util/StringUtils";
import { ChannelUserListTabViewModel } from "../../viewmodel/sidebartabs/ChannelUserListTabViewModel";
import { SidebarTabRenderTitleArgs, SidebarTabRenderTitleResult, SidebarTabViewRenderer, sidebarTabViewRendererFor } from "./SidebarTabContainerView";


@sidebarTabViewRendererFor(ChannelUserListTabViewModel)
export class ChannelUserListTabViewRenderer extends SidebarTabViewRenderer<ChannelUserListTabViewModel> {

    get cssFiles(): string[] { return []; }

    renderTitle(renderArgs: SidebarTabRenderTitleArgs<ChannelUserListTabViewModel>): SidebarTabRenderTitleResult {
        const vm = renderArgs.viewModel;

        const channel = vm.channel;
        const vnodes = <>
            <x-iconimage attr-src="assets/ui/chatchannel-icon.svg" classList={["title-icon"]}></x-iconimage>
            <div classList={["title-additionaltext"]}>
                {(channel.usersModerators.size + channel.usersWatched.size + channel.usersLooking.size + channel.usersOther.size).toLocaleString()}
            </div>
        </>;

        return { 
            vnodes,
            tabClasses: "standardtabtitle"
        };
    }

    renderBody(vm: ChannelUserListTabViewModel, addDisposable: (d: ConvertibleToDisposable) => void): (VNode | VNode[] | null) {
        return <x-channeluserlist props={{ "viewModel": vm.channel }} attr-ignoreparent="true"></x-channeluserlist>;
    }

}
