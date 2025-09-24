import { asDisposable } from "../util/Disposable.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { LeftListSelectedPane } from "../viewmodel/ActiveLoginViewModel.js";
import { AppViewModel } from "../viewmodel/AppViewModel.js";
import { ChatsList } from "./ChatsList.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { DisconnectedWarning } from "./DisconnectedWarning.js";
import { LeftListSelectPanel } from "./LeftListSelectPanel.js";
import { MiscTabsList } from "./MiscTabsList.js";
import { MyCharacterPanel } from "./MyCharacterPanel.js";
import { SidebarTabContainerView } from "./sidebartabs/SidebarTabContainerView.js";
import { WatchedList, WatchedListShowType } from "./WatchedList.js";

@componentElement("x-leftbar")
export class LeftBar extends ComponentBase<AppViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <x-sidebartabcontainer id="elSidebarTabContainer" ignoreparent="true"></x-sidebartabcontainer>
            <x-mycharacterpanel id="elCharPanel"></x-mycharacterpanel>
            <x-disconnectedwarning id="elDisconnectedWarning"></x-disconnectedwarning>
            <x-instanceselectpanel id="elInstanceSelectPanel"></x-instanceselectpanel>
        `);

        const elSidebarTabContainer = this.$("elSidebarTabContainer") as SidebarTabContainerView;
        const elCharPanel = this.$("elCharPanel") as MyCharacterPanel;
        const elDisconnectedWarning = this.$("elDisconnectedWarning") as DisconnectedWarning;

        this.watchExpr(vm => vm.currentlySelectedSession, v => { 
            //elListSelectPanel.viewModel = v ?? null; 
            elCharPanel.viewModel = v ?? null;
            elDisconnectedWarning.viewModel = v ?? null;
        });

        this.watchExpr(vm => vm.currentlySelectedSession?.leftTabs, lt => {
            elSidebarTabContainer.viewModel = lt ?? null;
        });

        // this.watchExpr(vm => [
        //     vm.currentlySelectedSession,
        //     vm.currentlySelectedSession?.leftListSelectedPane, 
        //     !!vm.currentlySelectedSession?.getConfigSettingById("joinFriendsAndBookmarks")],
        // v => {
        //     if (v) {
        //         const currentlySelectedSession = v[0];
        //         let selectedPane = v[1];
        //         const joinFriendsAndBookmarks = v[2];

        //         if (joinFriendsAndBookmarks) {
        //             if (selectedPane == LeftListSelectedPane.FRIENDS || selectedPane == LeftListSelectedPane.BOOKMARKS) {
        //                 selectedPane = LeftListSelectedPane.WATCHED;
        //             }
        //         }
        //         else {
        //             if (selectedPane == LeftListSelectedPane.WATCHED) {
        //                 selectedPane = LeftListSelectedPane.FRIENDS;
        //             }
        //         }

        //         switch (selectedPane) {
        //             case LeftListSelectedPane.CHATS:
        //                 {
        //                     const el = new ChatsList();
        //                     el.id = "elChatsList";
        //                     el.viewModel = currentlySelectedSession;
        //                     el.classList.add("mainsection");
        //                     this.elMain.appendChild(el);
        //                     return asDisposable(() => { el.remove(); });
        //                 }
        //             case LeftListSelectedPane.WATCHED:
        //                 {
        //                     const el = new WatchedList();
        //                     el.id = "elWatchedList";
        //                     el.viewModel = currentlySelectedSession;
        //                     el.showType = WatchedListShowType.ALL;
        //                     el.classList.add("mainsection");
        //                     this.elMain.appendChild(el);
        //                     return asDisposable(() => { el.remove(); });
        //                 }
        //             case LeftListSelectedPane.FRIENDS:
        //                 {
        //                     const el = new WatchedList();
        //                     el.id = "elWatchedList";
        //                     el.viewModel = currentlySelectedSession;
        //                     el.showType = WatchedListShowType.FRIENDS;
        //                     el.classList.add("mainsection");
        //                     this.elMain.appendChild(el);
        //                     return asDisposable(() => { el.remove(); });
        //                 }
        //             case LeftListSelectedPane.BOOKMARKS:
        //                 {
        //                     const el = new WatchedList();
        //                     el.id = "elWatchedList";
        //                     el.viewModel = currentlySelectedSession;
        //                     el.showType = WatchedListShowType.BOOKMARKS;
        //                     el.classList.add("mainsection");
        //                     this.elMain.appendChild(el);
        //                     return asDisposable(() => { el.remove(); });
        //                 }
        //             case LeftListSelectedPane.OTHER:
        //                 {
        //                     const el = new MiscTabsList();
        //                     el.id = "elMiscTabsList";
        //                     el.viewModel = currentlySelectedSession;
        //                     el.classList.add("mainsection");
        //                     this.elMain.appendChild(el);
        //                     return asDisposable(() => { el.remove(); });
        //                 }
        //         }
        //     }
        // });
    }
}