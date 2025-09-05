import { jsx, VNode, Fragment, Classes } from "../../snabbdom/index";
import { ConvertibleToDisposable } from "../../util/Disposable";
import { LeftListSelectedPane } from "../../viewmodel/ActiveLoginViewModel";
import { ChatsListTabViewModel } from "../../viewmodel/sidebartabs/ChatsListTabViewModel";
import { SidebarTabViewRenderer, sidebarTabViewRendererFor } from "./SidebarTabContainerView";


@sidebarTabViewRendererFor(ChatsListTabViewModel)
export class ChatsListTabViewRenderer extends SidebarTabViewRenderer<ChatsListTabViewModel> {

    get cssFiles(): string[] { return []; }
    
    renderTitle(vm: ChatsListTabViewModel, isSelectedTab: boolean, addDisposable: (d: ConvertibleToDisposable) => void): (VNode | VNode[] | null) {
        const hasPings = vm.session.hasPings;
        const hasUnseenMessage = vm.session.hasUnseenMessages;

        let klass = "hidden";
        let headerDotNode: VNode =
            (!isSelectedTab && hasPings) ? 
                <><x-iconimage attr-src="assets/ui/channel-ping.svg" classList={["ping-icon"]}></x-iconimage>{" "}</>
            : (!isSelectedTab && hasUnseenMessage) ?
                <>{"\u{2B24}"}</>
            : <></>;

        const hasPingsClasses: Classes = {
            "tab-addtl": true,
            "has-ping-icon": !isSelectedTab && hasPings,
            "has-unseen-dot": !isSelectedTab && !hasPings && hasUnseenMessage
        };

        return <>
            <x-iconimage classList={["tab-icon"]} attr-src="assets/ui/chats-icon.svg"></x-iconimage>
            <div class={hasPingsClasses} id="elHasPings"></div>
        </>;
    }

    renderBody(vm: ChatsListTabViewModel, addDisposable: (d: ConvertibleToDisposable) => void): (VNode | VNode[] | null) {
        return <>Test 1 2 3</>;
    }
    
}