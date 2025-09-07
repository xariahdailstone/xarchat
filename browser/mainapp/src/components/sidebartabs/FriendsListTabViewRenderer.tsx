import { jsx, VNode, Fragment } from "../../snabbdom/index";
import { ConvertibleToDisposable } from "../../util/Disposable";
import { FriendsListTabViewModel } from "../../viewmodel/sidebartabs/FriendsListTabViewModel";
import { SidebarTabRenderTitleArgs, SidebarTabRenderTitleResult, SidebarTabViewRenderer, sidebarTabViewRendererFor } from "./SidebarTabContainerView";


@sidebarTabViewRendererFor(FriendsListTabViewModel)
export class FriendsListTabViewRenderer extends SidebarTabViewRenderer<FriendsListTabViewModel> {

    get cssFiles(): string[] { return []; }
    
    renderTitle(renderArgs: SidebarTabRenderTitleArgs<FriendsListTabViewModel>): SidebarTabRenderTitleResult {
        const watchedCount = renderArgs.viewModel.session.onlineWatchedChars.size.toString();
        const vnodes = <>
            <x-iconimage classList={["title-icon"]} attr-src="assets/ui/friends-icon.svg"></x-iconimage>
            <div classList={["title-additionaltext"]} id="elWatchedCount">{watchedCount}</div>
        </>;
        return { vnodes, tabClasses: "standardtabtitle" };
    }

    renderBody(vm: FriendsListTabViewModel, addDisposable: (d: ConvertibleToDisposable) => void): (VNode | VNode[] | null) {
        return <x-watchedlist props={{ "viewModel": vm.session, }} attr-ignoreparent="true"></x-watchedlist>;
    }

}
