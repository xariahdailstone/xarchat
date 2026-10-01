import { jsx, VNode, Fragment } from "../snabbdom/index.js";
import { IDisposable } from "../util/Disposable.js";
import { FocusMagnet, FocusUtil } from "../util/FocusMagnet.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { getValueReference } from "../util/ValueReference.js";
import { VNodeUtils } from "../util/VNodeUtils.js";
import { ChannelActivePanel, ChannelViewModel } from "../viewmodel/ChannelViewModel.js";
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

            const textboxNodes: VNode[] = [];
            if (vm.activePanel == ChannelActivePanel.MESSAGE_STREAM) {
                textboxNodes.push(<div classList={["contentarea"]} attr-slot="a" id="elContentArea">
                        <x-channelstream classList={["stream"]} id="elChannelStream"
                            props={{ "viewModel": vm }} attr-ignoreparent="true"></x-channelstream>
                        {userListNodes}
                    </div>);
            }
            else if (vm.activePanel == ChannelActivePanel.AD_MANAGER) {
                if (vm instanceof ChatChannelViewModel) {
                    textboxNodes.push(<div classList={["contentarea"]} attr-slot="a" id="elContentArea">
                            <div classList={[ "stream", "stream-admanager" ]}>
                                <x-channelfiltersbar classList={["filtersbar"]} props={{ "viewModel": vm }}></x-channelfiltersbar>
                                <x-admanagerview props={{ "viewModel": vm.channelAdManager }}></x-admanagerview>
                            </div>
                            {userListNodes}
                        </div>);
                }
                else {
                    textboxNodes.push(<div classList={["contentarea"]} attr-slot="a" id="elContentArea">
                            <div classList={[ "stream", "stream-admanager" ]}>
                                <x-channelfiltersbar classList={["filtersbar"]} props={{ "viewModel": vm }}></x-channelfiltersbar>
                            </div>
                            {userListNodes}
                        </div>);
                }
            }
            textboxNodes.push(<x-splitterhandle id="elTextBoxSplitter" classList={["tbsplitterhandle"]} attr-target="elTextBox"
                attr-othertarget="elContentArea" attr-othermin="100"
                attr-orientation="vertical" attr-min="90" attr-max="99999" attr-invert="true"
                props={{ "viewModel": getValueReference(vm, "textBoxHeight") }} attr-ignoreparent="true"></x-splitterhandle>);
            textboxNodes.push(<x-channeltextbox classList={["textbox"]} id="elTextBox" attr-slot="b"
                props={{ "viewModel": vm }} attr-ignoreparent="true"></x-channeltextbox>);

            return <>
                <x-channelheader classList={["header"]} props={{ "viewModel": vm }} attr-ignoreparent="true"></x-channelheader>
                {textboxNodes}
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
