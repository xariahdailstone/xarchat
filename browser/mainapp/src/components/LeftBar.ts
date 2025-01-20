import { asDisposable } from "../util/Disposable.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { LeftListSelectedPane } from "../viewmodel/ActiveLoginViewModel.js";
import { AppViewModel } from "../viewmodel/AppViewModel.js";
import { ChatsList } from "./ChatsList.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { MiscTabsList } from "./MiscTabsList.js";
import { WatchedList, WatchedListShowType } from "./WatchedList.js";

@componentElement("x-leftbar")
export class LeftBar extends ComponentBase<AppViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <x-leftlistselectpanel id="elListSelectPanel" modelpath="currentlySelectedSession"></x-leftlistselectpanel>
            <x-mycharacterpanel id="elCharPanel" modelpath="currentlySelectedSession"></x-mycharacterpanel>
            <x-disconnectedwarning id="elDisconnectedWarning" modelpath="currentlySelectedSession"></x-disconnectedwarning>
            <x-instanceselectpanel id="elInstanceSelectPanel"></x-instanceselectpanel>
        `);

        this.watchExpr(vm => [vm.currentlySelectedSession?.leftListSelectedPane, !!vm.currentlySelectedSession?.getConfigSettingById("joinFriendsAndBookmarks")], v => {
            if (v) {
                let selectedPane = v[0];
                const joinFriendsAndBookmarks = v[1];

                if (joinFriendsAndBookmarks) {
                    if (selectedPane == LeftListSelectedPane.FRIENDS || selectedPane == LeftListSelectedPane.BOOKMARKS) {
                        selectedPane = LeftListSelectedPane.WATCHED;
                    }
                }
                else {
                    if (selectedPane == LeftListSelectedPane.WATCHED) {
                        selectedPane = LeftListSelectedPane.FRIENDS;
                    }
                }

                switch (selectedPane) {
                    case LeftListSelectedPane.CHATS:
                        {
                            const el = new ChatsList();
                            el.id = "elChatsList";
                            el.modelPath = "currentlySelectedSession";
                            el.classList.add("mainsection");
                            this.elMain.appendChild(el);
                            return asDisposable(() => { el.remove(); });
                        }
                    case LeftListSelectedPane.WATCHED:
                        {
                            const el = new WatchedList();
                            el.id = "elWatchedList";
                            el.modelPath = "currentlySelectedSession";
                            el.showType = WatchedListShowType.ALL;
                            el.classList.add("mainsection");
                            this.elMain.appendChild(el);
                            return asDisposable(() => { el.remove(); });
                        }
                    case LeftListSelectedPane.FRIENDS:
                        {
                            const el = new WatchedList();
                            el.id = "elWatchedList";
                            el.modelPath = "currentlySelectedSession";
                            el.showType = WatchedListShowType.FRIENDS;
                            el.classList.add("mainsection");
                            this.elMain.appendChild(el);
                            return asDisposable(() => { el.remove(); });
                        }
                    case LeftListSelectedPane.BOOKMARKS:
                        {
                            const el = new WatchedList();
                            el.id = "elWatchedList";
                            el.modelPath = "currentlySelectedSession";
                            el.showType = WatchedListShowType.BOOKMARKS;
                            el.classList.add("mainsection");
                            this.elMain.appendChild(el);
                            return asDisposable(() => { el.remove(); });
                        }
                    case LeftListSelectedPane.OTHER:
                        {
                            const el = new MiscTabsList();
                            el.id = "elMiscTabsList";
                            el.modelPath = "currentlySelectedSession";
                            el.classList.add("mainsection");
                            this.elMain.appendChild(el);
                            return asDisposable(() => { el.remove(); });
                        }
                }
            }
        });
    }
}