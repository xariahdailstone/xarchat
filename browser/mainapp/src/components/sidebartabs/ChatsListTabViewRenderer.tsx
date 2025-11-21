import { jsx, VNode, Fragment, Classes } from "../../snabbdom/index";
import { ConvertibleToDisposable } from "../../util/Disposable";
import { LeftListSelectedPane } from "../../viewmodel/ActiveLoginViewModel";
import { ChatsListTabViewModel } from "../../viewmodel/sidebartabs/ChatsListTabViewModel";
import { SidebarTabRenderTitleArgs, SidebarTabRenderTitleResult, SidebarTabViewRenderer, sidebarTabViewRendererFor } from "./SidebarTabContainerView";


@sidebarTabViewRendererFor(ChatsListTabViewModel)
export class ChatsListTabViewRenderer extends SidebarTabViewRenderer<ChatsListTabViewModel> {

    get cssFiles(): string[] { return [ 'styles/components/sidebartabs/ChatsListTab.css' ]; }
    
    renderTitle(renderArgs: SidebarTabRenderTitleArgs<ChatsListTabViewModel>): SidebarTabRenderTitleResult {
        const vm = renderArgs.viewModel;
        const isSelectedTab = renderArgs.isSelectedTab;

        const hasPings = vm.session.hasPings;
        const hasUnseenMessage = vm.session.hasUnseenMessages;

        let klass = "hidden";
        let headerDotNode: VNode | null =
            (!isSelectedTab && hasPings) ? 
                <x-iconimage attr-src="assets/ui/channel-ping.svg" classList={["ping-icon"]}></x-iconimage>
            : (!isSelectedTab && hasUnseenMessage) ?
                <>{"\u{2B24}"}</>
            : null;

        // if (headerDotNode) {
        //     headerDotNode = <div classList={["title-posticon"]}>{headerDotNode}</div>;
        // }

        const hasPingsClasses: Classes = {
            "title-additionaltext": true,
            "has-ping-icon": !isSelectedTab && hasPings,
            "has-unseen-dot": !isSelectedTab && !hasPings && hasUnseenMessage
        };

        const vnodes = <>
            <x-iconimage classList={["title-icon"]} attr-src="assets/ui/chats-icon.svg"></x-iconimage>
            <div class={hasPingsClasses} id="elHasPings">{headerDotNode}</div>
        </>;

        return { vnodes, tabClasses: "standardtabtitle" };
    }

    renderBody(vm: ChatsListTabViewModel, addDisposable: (d: ConvertibleToDisposable) => void): (VNode | VNode[] | null) {
        return <x-chatslist attrs={{ "ignoreparent": "true" }} props={{ "viewModel": vm.session }}></x-chatslist>;
    }
    
}