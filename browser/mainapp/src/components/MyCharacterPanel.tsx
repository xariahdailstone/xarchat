import { CharacterName } from "../shared/CharacterName.js";
import { Fragment, jsx, VNode } from "../snabbdom/index.js";
import { URLUtils } from "../util/URLUtils.js";
import { BBCodeParseResult, ChatBBCodeParser } from "../util/bbcode/BBCode.js";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel.js";
import { ComponentBase, ComponentCharacterStatusListener, componentElement } from "./ComponentBase.js";
import { RenderingComponentBase } from "./RenderingComponentBase.js";
import { IDisposable, asDisposable } from "../util/Disposable.js";

@componentElement("x-mycharacterpanel")
class MyCharacterPanel extends RenderingComponentBase<ActiveLoginViewModel> {
    constructor() {
        super();
    }

    override render(): [VNode, IDisposable] {
        const myStatus = this.getCharacterStatus(this.viewModel?.characterName);
        const vm = this.viewModel!;

        const parseCodeResult = ChatBBCodeParser.parse(myStatus.statusMessage.split('\n')[0], {
            parseAsStatus: true,
            activeLoginViewModel: vm,
            addUrlDomains: false,
            appViewModel: vm.appViewModel,
            sink: vm.bbcodeSink,
            imagePreviewPopups: false,
            syncGifs: true
        });

        const el = <>
            <div id="elStatusArea" on={{ click: () => vm.showCharacterStatusPopup(this.$("elStatusArea")!) }}>
                <img id="elAvatar" attr-src={this.viewModel?.characterName ? URLUtils.getAvatarImageUrl(this.viewModel.characterName) : URLUtils.getEmptyImageUrl() } />
                <div id="elName">{this.viewModel?.characterName.value ?? ""}</div>
                <div id="elStatusMessage"><x-bbcodedisplay props={{viewModel: parseCodeResult}}></x-bbcodedisplay></div>
            </div>
            <button id="elConfigButton" on={{ click: () => vm.showMainContextMenu(this.$("elConfigButton")!) }} attr-tabindex="-1">
                <x-iconimage id="elConfigIcon" attr-src={"assets/ui/config-button.svg"}></x-iconimage>
            </button>
        </>;

        return [el, parseCodeResult];
    }

    statusAreaClick() {
        const vm = this.viewModel;
        const elStatusArea = this.$("elStatusArea") as HTMLDivElement;
        if (vm) {
            vm.showCharacterStatusPopup(elStatusArea);
        }
    }
}