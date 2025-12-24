import { jsx, VNode, Fragment } from "../snabbdom/index.js";
import { IDisposable } from "../util/Disposable.js";
import { FocusMagnet, FocusUtil } from "../util/FocusMagnet.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { getValueReference } from "../util/ValueReference.js";
import { VNodeUtils } from "../util/VNodeUtils.js";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel.js";
import { ChatChannelViewModel } from "../viewmodel/ChatChannelViewModel.js";
import { ConsoleChannelViewModel } from "../viewmodel/ConsoleChannelViewModel.js";
import { PMConvoChannelViewModel } from "../viewmodel/PMConvoChannelViewModel.js";
import { ChannelStream } from "./ChannelStream.js";
import { ChannelTextBox } from "./ChannelTextBox.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { makeRenderingComponent, RenderArguments } from "./RenderingComponentBase.js";
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

        makeRenderingComponent(this, {
            render: (rargs) => this.render(rargs),
            afterRender: () => this.afterRender()
        });

        this.addEventListener("mouseup", () => {
            const elChannelStream = this.$("elChannelStream") as ChannelStream;
            if (elChannelStream && !elChannelStream.hasTextSelection && FocusMagnet.instance.ultimateFocus == null) {
                const elTextBox = this.$("elTextBox") as ChannelTextBox;
                if (elTextBox) {
                    elTextBox.focusTextBox(false);
                }
            }    
        });

        // this.watchExpr(vm => vm.getConfigSettingById("friendsTabLocation"), ftl => {

        // });
    }

    render(rargs: RenderArguments): (VNode | [VNode, IDisposable]) {
        try {
            this.logger.logDebug("ChannelView rendering");
            
            const vm = this.viewModel;
            if (!vm) { return VNodeUtils.createEmptyFragment(); }

            const shouldHaveUserList = vm.activeLoginViewModel.rightTabs != null && vm.activeLoginViewModel.rightTabs.tabs.length > 0;
            const userListNodes = shouldHaveUserList
                ? <>
                    <x-splitterhandle id="elUserListSplitter" classList={["casplitterhandle"]}
                        attr-target="elUserList" attr-orientation="horizontal" attr-min="200" attr-max="500" attr-invert="true"
                        props={{ "viewModel": getValueReference(vm, "userListWidth") }} attr-ignoreparent="true"></x-splitterhandle>
                    <x-sidebartabcontainer classList={["userlist"]} id="elUserList" attr-ignoreparent="true"
                        props={{
                            "viewModel": vm.activeLoginViewModel.rightTabs ?? null
                        }}></x-sidebartabcontainer>
                </>
                : null;

            this.elMain.classList.toggle("is-channel", (vm instanceof ChatChannelViewModel));
            this.elMain.classList.toggle("is-pmconvo", (vm instanceof PMConvoChannelViewModel));
            this.elMain.classList.toggle("is-console", (vm instanceof ConsoleChannelViewModel));

            const chatFontSize = +(vm.getConfigSettingById("chatFontSize") ?? 12);
            this.elMain.style.setProperty("--chat-font-size", `${chatFontSize}px`);

            const eiconDisplaySize = vm.getConfigSettingById("eiconDisplaySize");
            this.elMain.classList.toggle(`bbcode-eicons-small`, eiconDisplaySize == "small");
            this.elMain.classList.toggle(`bbcode-eicons-normal`, eiconDisplaySize == "normal");
            this.elMain.classList.toggle(`bbcode-eicons-large`, eiconDisplaySize == "large");

            return <>
                <x-channelheader classList={["header"]} props={{ "viewModel": vm }} attr-ignoreparent="true"></x-channelheader>
                <div classList={["contentarea"]} attr-slot="a" id="elContentArea">
                    <x-channelstream classList={["stream"]} id="elChannelStream"
                        props={{ "viewModel": vm }} attr-ignoreparent="true"></x-channelstream>
                    {userListNodes}
                </div>
                <x-splitterhandle id="elTextBoxSplitter" classList={["tbsplitterhandle"]} attr-target="elTextBox"
                    attr-othertarget="elContentArea" attr-othermin="100"
                    attr-orientation="vertical" attr-min="90" attr-max="99999" attr-invert="true"
                    props={{ "viewModel": getValueReference(vm, "textBoxHeight") }} attr-ignoreparent="true"></x-splitterhandle>
                <x-channeltextbox classList={["textbox"]} id="elTextBox" attr-slot="b"
                    props={{ "viewModel": vm }} attr-ignoreparent="true"></x-channeltextbox>
            </>;
        }
        catch (e) {
            this.logger.logError("channelview rendering error", e);
            return VNodeUtils.createEmptyFragment();
        }
    }

    private _focusTextBox = false;

    afterRender() {
        if (this._focusTextBox) {
            this._focusTextBox = false;
            this.viewActivated();
        }
    }

    override viewActivated(): void {
        const elTextBox = this.$("elTextBox") as ChannelTextBox;
        if (elTextBox) {
            this._focusTextBox = false;
            elTextBox.focusTextBox(true);
        }
        else {
            this._focusTextBox = true;
        }
    }
}

export class OLDChannelView extends StageViewComponent<ChannelViewModel> {
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
            //if (!elChannelStream.hasTextSelection && FocusMagnet.instance.ultimateFocus == null) {
            if (!elChannelStream.hasTextSelection && FocusUtil.instance.ultimateFocus == null) {
                elTextBox.focusTextBox(false);
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

        this.watchExpr(vm => vm.getConfigSettingById("friendsTabLocation"), ftl => {

        });
    }

    override viewActivated(): void {
        const elTextBox = this.$("elTextBox") as ChannelTextBox;
        elTextBox.focusTextBox(true);
    }

    protected override viewModelChanged(): void {
        const elContentArea = this._sroot.getElementById("elContentArea") as HTMLDivElement;
        const shouldHaveUserList = this.viewModel?.activeLoginViewModel.rightTabs != null;
        const existingUserList = this._sroot.getElementById("elUserList") as (SidebarTabContainerView | null);

        if (shouldHaveUserList) {
            if (!existingUserList) {
                const el = new SidebarTabContainerView();
                el.ignoreParent = true;
                el.viewModel = this.viewModel?.activeLoginViewModel.rightTabs ?? null;

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
