import { jsx, VNode, Fragment } from "../../snabbdom/index";
import { ConvertibleToDisposable } from "../../util/Disposable";
import { FriendsListTabViewModel } from "../../viewmodel/sidebartabs/FriendsListTabViewModel";
import { SidebarTabViewRenderer, sidebarTabViewRendererFor } from "./SidebarTabContainerView";


@sidebarTabViewRendererFor(FriendsListTabViewModel)
export class FriendsListTabViewRenderer extends SidebarTabViewRenderer<FriendsListTabViewModel> {

    get cssFiles(): string[] { return []; }
    
    renderTitle(vm: FriendsListTabViewModel, isSelectedTab: boolean, addDisposable: (d: ConvertibleToDisposable) => void): (VNode | VNode[] | null) {
        const watchedCount = vm.session.onlineWatchedChars.size.toString();

        return <>
            <x-iconimage classList={["tab-icon"]} attr-src="assets/ui/friends-icon.svg"></x-iconimage>
            <div classList={["tab-addtl"]} id="elWatchedCount">{watchedCount}</div>
        </>;
    }

    renderBody(vm: FriendsListTabViewModel, addDisposable: (d: ConvertibleToDisposable) => void): (VNode | VNode[] | null) {
        return <>Test 1 2 3</>;
    }

}
