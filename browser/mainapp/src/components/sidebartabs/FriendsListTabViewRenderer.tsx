import { jsx, VNode, Fragment } from "../../snabbdom/index";
import { ConvertibleToDisposable } from "../../util/Disposable";
import { FriendsListTabViewModel } from "../../viewmodel/sidebartabs/FriendsListTabViewModel";
import { WatchedListShowType } from "../WatchedList";
import { SidebarTabRenderTitleArgs, SidebarTabRenderTitleResult, SidebarTabViewRenderer, sidebarTabViewRendererFor } from "./SidebarTabContainerView";


@sidebarTabViewRendererFor(FriendsListTabViewModel)
export class FriendsListTabViewRenderer extends SidebarTabViewRenderer<FriendsListTabViewModel> {

    get cssFiles(): string[] { return []; }
    
    renderTitle(renderArgs: SidebarTabRenderTitleArgs<FriendsListTabViewModel>): SidebarTabRenderTitleResult {
        switch (renderArgs.viewModel.show) {
            case "both":
                {
                    const watchedCount = renderArgs.viewModel.session.onlineWatchedChars.size.toString();
                    const vnodes = <>
                        <x-iconimage classList={["title-icon"]} attr-src="assets/ui/friends-icon.svg"></x-iconimage>
                        <div classList={["title-additionaltext"]} id="elWatchedCount">{watchedCount}</div>
                    </>;
                    return { vnodes, tabClasses: "standardtabtitle" };
                }
            case "friends":
                {
                    const watchedCount = renderArgs.viewModel.session.onlineFriends.size.toString();
                    const vnodes = <>
                        <x-iconimage classList={["title-icon"]} attr-src="assets/ui/friends-icon.svg"></x-iconimage>
                        <div classList={["title-additionaltext"]} id="elWatchedCount">{watchedCount}</div>
                    </>;
                    return { vnodes, tabClasses: "standardtabtitle" };
                }
            case "bookmarks":
                {
                    const watchedCount = renderArgs.viewModel.session.onlineBookmarks.size.toString();
                    const vnodes = <>
                        <x-iconimage classList={["title-icon"]} attr-src="assets/ui/bookmarks-icon.svg"></x-iconimage>
                        <div classList={["title-additionaltext"]} id="elWatchedCount">{watchedCount}</div>
                    </>;
                    return { vnodes, tabClasses: "standardtabtitle" };
                }
        }
    }

    renderBody(vm: FriendsListTabViewModel, addDisposable: (d: ConvertibleToDisposable) => void): (VNode | VNode[] | null) {
        let showType: WatchedListShowType;
        switch (vm.show) {
            case "both":
                showType = WatchedListShowType.ALL;
                break;
            case "friends":
                showType = WatchedListShowType.FRIENDS;
                break;
            case "bookmarks":
                showType = WatchedListShowType.BOOKMARKS;
                break;
        }
        return <x-watchedlist 
            props={{ 
                "viewModel": vm.session,
                "showType": showType
            }} 
            attrs={{
                "ignoreparent": "true"
            }}></x-watchedlist>;
    }

}
