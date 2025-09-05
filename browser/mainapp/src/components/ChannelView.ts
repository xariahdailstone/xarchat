import { FocusMagnet } from "../util/FocusMagnet.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { getValueReference } from "../util/ValueReference.js";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel.js";
import { ChatChannelViewModel } from "../viewmodel/ChatChannelViewModel.js";
import { ConsoleChannelViewModel } from "../viewmodel/ConsoleChannelViewModel.js";
import { PMConvoChannelViewModel } from "../viewmodel/PMConvoChannelViewModel.js";
import { ChannelStream } from "./ChannelStream.js";
import { ChannelTextBox } from "./ChannelTextBox.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { SidebarTabContainerView } from "./sidebartabs/SidebarTabContainerView.js";
import { SplitterHandle } from "./SplitterHandle.js";
import { StageViewComponent, stageViewFor } from "./Stage.js";

@componentElement("x-channelview")
@stageViewFor(ChatChannelViewModel)
@stageViewFor(PMConvoChannelViewModel)
@stageViewFor(ConsoleChannelViewModel)
export class ChannelView extends StageViewComponent<ChannelViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <x-channelheader class="header"></x-channelheader>
            <div class="contentarea" slot="a" id="elContentArea">
                <x-channelstream class="stream" id="elChannelStream"></x-channelstream>
                <x-splitterhandle id="elUserListSplitter" class="casplitterhandle" target="elUserList" orientation="horizontal" min="200" max="500" invert="true"></x-splitterhandle>
                <!-- <x-sidebartabcontainer class="userlist" id="elUserList"></x-sidebartabcontainer> -->
            </div>
            <x-splitterhandle id="elTextBoxSplitter" class="tbsplitterhandle" target="elTextBox"
                othertarget="elContentArea" othermin="100"
                orientation="vertical" min="90" max="99999" invert="true"></x-splitterhandle>
            <x-channeltextbox class="textbox" id="elTextBox" slot="b"></x-channeltextbox>
        `);

        const elChannelStream = this.$("elChannelStream") as ChannelStream;
        const elTextBox = this.$("elTextBox") as ChannelTextBox;
        const elUserListSplitter = this.$("elUserListSplitter") as SplitterHandle;
        const elTextBoxSplitter = this.$("elTextBoxSplitter") as SplitterHandle;

        this.addEventListener("mouseup", () => {
            if (!elChannelStream.hasTextSelection && FocusMagnet.instance.ultimateFocus == null) {
                elTextBox.focusTextBox();
            }    
        });

        this.watchViewModel(vm => {
            this.elMain.classList.toggle("is-channel", (vm instanceof ChatChannelViewModel));
            this.elMain.classList.toggle("is-pmconvo", (vm instanceof PMConvoChannelViewModel));
            this.elMain.classList.toggle("is-console", (vm instanceof ConsoleChannelViewModel));
            elUserListSplitter.viewModel = vm ? getValueReference(vm, "userListWidth") : null;
            elTextBoxSplitter.viewModel = vm ? getValueReference(vm, "textBoxHeight") : null;
        });

        this.watchExpr(vm => vm.getConfigSettingById("chatFontSize"), cfs => {
            let ncfs = +((cfs) ? cfs : "12");
            if (ncfs <= 0) {
                ncfs = 12;
            }
            this.elMain.style.setProperty("--chat-font-size", `${ncfs}px`);
        });

        this.watchExpr(vm => vm.getConfigSettingById("eiconDisplaySize"), dsize => {
            this.elMain.classList.toggle(`bbcode-eicons-small`, dsize == "small");
            this.elMain.classList.toggle(`bbcode-eicons-normal`, dsize == "normal");
            this.elMain.classList.toggle(`bbcode-eicons-large`, dsize == "large");
        });
    }

    override viewActivated(): void {
        const elTextBox = this.$("elTextBox") as ChannelTextBox;
        elTextBox.focusTextBox();
    }

    protected override viewModelChanged(): void {
        const elContentArea = this._sroot.getElementById("elContentArea") as HTMLDivElement;
        const shouldHaveUserList = this.viewModel?.sidebarTabContainer != null;
        const existingUserList = this._sroot.getElementById("elUserList") as (SidebarTabContainerView | null);

        if (shouldHaveUserList) {
            if (!existingUserList) {
                const el = new SidebarTabContainerView();
                el.ignoreParent = true;
                el.viewModel = this.viewModel?.sidebarTabContainer ?? null;

                el.classList.add("userlist");
                el.id = "elUserList";
                elContentArea.appendChild(el);
            }
        }
        else {
            existingUserList?.remove();    
        }
    }
}
