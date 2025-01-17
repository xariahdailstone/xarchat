import { FocusMagnet } from "../util/FocusMagnet.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel.js";
import { ChatChannelViewModel } from "../viewmodel/ChatChannelViewModel.js";
import { ConsoleChannelViewModel } from "../viewmodel/ConsoleChannelViewModel.js";
import { PMConvoChannelViewModel } from "../viewmodel/PMConvoChannelViewModel.js";
import { ChannelStream } from "./ChannelStream.js";
import { ChannelTextBox } from "./ChannelTextBox.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
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
            <div class="contentarea" slot="a">
                <x-channelstream class="stream" id="elChannelStream"></x-channelstream>
                <x-splitterhandle class="casplitterhandle" target="elUserList" orientation="horizontal" min="200" max="500" modelpath="userListWidth" invert="true"></x-splitterhandle>
                <x-channeluserlist class="userlist" id="elUserList"></x-channeluserlist>
            </div>
            <x-splitterhandle class="tbsplitterhandle" target="elTextBox" orientation="vertical" min="50" max="200" modelpath="textBoxHeight" invert="true"></x-splitterhandle>
            <x-channeltextbox class="textbox" id="elTextBox" slot="b"></x-channeltextbox>
        `);

        const elChannelStream = this.$("elChannelStream") as ChannelStream;
        const elTextBox = this.$("elTextBox") as ChannelTextBox;

        this.addEventListener("mouseup", () => {
            if (!elChannelStream.hasTextSelection && FocusMagnet.instance.ultimateFocus == null) {
                elTextBox.focusTextBox();
            }    
        });

        this.watchExpr(vm => vm, vm => {
            this.elMain.classList.toggle("is-channel", (vm instanceof ChatChannelViewModel));
            this.elMain.classList.toggle("is-pmconvo", (vm instanceof PMConvoChannelViewModel));
            this.elMain.classList.toggle("is-console", (vm instanceof ConsoleChannelViewModel));
        });
    }

    override viewActivated(): void {
        const elTextBox = this.$("elTextBox") as ChannelTextBox;
        elTextBox.focusTextBox();
    }

    protected override viewModelChanged(): void {
        const shouldHaveUserList = (this.viewModel instanceof ChatChannelViewModel);
        const existingUserList = this.elMain.querySelector("x-channeluserlist");

        if (shouldHaveUserList) {
            if (!existingUserList) {
                const el = document.createElement("x-channeluserlist");
                el.classList.add("userlist");
                this.elMain.appendChild(el);
            }
        }
        else {
            existingUserList?.remove();    
        }
    }
}
