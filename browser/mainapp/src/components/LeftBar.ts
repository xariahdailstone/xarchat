import { asDisposable } from "../util/Disposable.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { LeftListSelectedPane } from "../viewmodel/ActiveLoginViewModel.js";
import { AppViewModel } from "../viewmodel/AppViewModel.js";
import { ChatsList } from "./ChatsList.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { MiscTabsList } from "./MiscTabsList.js";
import { WatchedList } from "./WatchedList.js";

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

        this.watch("currentlySelectedSession.leftListSelectedPane", v => {
            switch (v) {
                case LeftListSelectedPane.CHATS:
                    {
                        const el = new ChatsList();
                        el.id = "elChatsList";
                        el.modelPath = "currentlySelectedSession";
                        el.classList.add("mainsection");
                        this.elMain.appendChild(el);
                        return asDisposable(() => { el.remove(); });
                    }
                case LeftListSelectedPane.WATCHLIST:
                    {
                        const el = new WatchedList();
                        el.id = "elWatchedList";
                        el.modelPath = "currentlySelectedSession";
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
        });
    }
}