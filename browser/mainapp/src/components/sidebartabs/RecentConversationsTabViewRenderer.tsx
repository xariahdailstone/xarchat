import { jsx, Fragment } from "../../snabbdom/index";
import { VNode } from "../../snabbdom/vnode";
import { ConvertibleToDisposable } from "../../util/Disposable";
import { OtherTabsTabViewModel } from "../../viewmodel/sidebartabs/OtherTabsTabViewModel";
import { RecentConversationsTabViewModel } from "../../viewmodel/sidebartabs/RecentConversationsTabViewModel";
import { sidebarTabViewRendererFor, SidebarTabViewRenderer, SidebarTabRenderTitleArgs, SidebarTabRenderTitleResult } from "./SidebarTabContainerView";


@sidebarTabViewRendererFor(RecentConversationsTabViewModel)
export class RecentConversationsTabViewRenderer extends SidebarTabViewRenderer<RecentConversationsTabViewModel> {
    get cssFiles(): string[] { return []; }

    renderTitle(renderArgs: SidebarTabRenderTitleArgs<RecentConversationsTabViewModel>): SidebarTabRenderTitleResult {
        const vnodes = <x-iconimage classList={["title-icon"]} attr-src="assets/ui/history-icon.svg"></x-iconimage>;
        return { vnodes, tabClasses: "standardtabtitle" };
    }

    renderBody(vm: RecentConversationsTabViewModel, addDisposable: (d: ConvertibleToDisposable) => void): (VNode | VNode[] | null) {
        return <></>;
    }
}
