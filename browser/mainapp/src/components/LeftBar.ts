import { asDisposable } from "../util/Disposable.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { LeftListSelectedPane } from "../viewmodel/ActiveLoginViewModel.js";
import { AppViewModel } from "../viewmodel/AppViewModel.js";
import { ChatsList } from "./ChatsList.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { DisconnectedWarning } from "./DisconnectedWarning.js";
import { InAppToastsView } from "./InAppToastsView.js";
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
            <x-sidebartabcontainer class="main-sidebartabcontainer" id="elSidebarTabContainer" ignoreparent="true"></x-sidebartabcontainer>
            <x-inapptoastsview class="main-inapptoastsview" id="elInAppToasts" ignoreparent="true"></x-inapptoastsview>
            <x-mycharacterpanel class="mycharacterpanel" id="elCharPanel"></x-mycharacterpanel>
            <x-disconnectedwarning class="disconnectedwarning" id="elDisconnectedWarning"></x-disconnectedwarning>
            <x-instanceselectpanel class="instanceselect" id="elInstanceSelectPanel"></x-instanceselectpanel>
        `);

        const elSidebarTabContainer = this.$("elSidebarTabContainer") as SidebarTabContainerView;
        const elInAppToasts = this.$("elInAppToasts") as InAppToastsView;
        const elCharPanel = this.$("elCharPanel") as MyCharacterPanel;
        const elDisconnectedWarning = this.$("elDisconnectedWarning") as DisconnectedWarning;

        this.watchExpr(vm => vm.toasts, t => {
            elInAppToasts.viewModel = t ?? null;
        });
        this.watchExpr(vm => vm.currentlySelectedSession, v => { 
            elCharPanel.viewModel = v ?? null;
            elDisconnectedWarning.viewModel = v ?? null;
        });

        this.watchExpr(vm => vm.currentlySelectedSession?.leftTabs, lt => {
            elSidebarTabContainer.viewModel = lt ?? null;
        });
    }
}