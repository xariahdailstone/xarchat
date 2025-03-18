import { HTMLUtils } from "../../util/HTMLUtils";
import { ChannelEditHelpPopupViewModel } from "../../viewmodel/popups/ChannelEditHelpPopupViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { ContextPopupBase } from "./ContextPopupBase";
import { popupViewFor } from "./PopupFrame";

@componentArea("popups")
@componentElement("x-channeledithelppopup")
@popupViewFor(ChannelEditHelpPopupViewModel)
export class ChannelEditHelpPopup extends ContextPopupBase<ChannelEditHelpPopupViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="title">Shortcut Keys</div>
            <table class="commands">
                <tr>
                    <td>Ctrl+T</td>
                    <td>Toggle Editing Toolbar</td>
                </tr>
                <tr>
                    <td>Ctrl+W</td>
                    <td>Toggle Editing Status Bar</td>
                </tr>
                <tr>
                    <td>Ctrl+P</td>
                    <td>Show Message Preview</td>
                </tr>
                <tr>
                    <td>F1</td>
                    <td>Show This Help</td>
                </tr>
                <tr>
                    <td class="separator" colspan="2"></td>
                </tr>
                <tr>
                    <td>Ctrl+B</td>
                    <td>Bold</td>
                </tr>
                <tr>
                    <td>Ctrl+I</td>
                    <td>Italic</td>
                </tr>
                <tr>
                    <td>Ctrl+U</td>
                    <td>Underline</td>
                </tr>
                <tr>
                    <td>Ctrl+S</td>
                    <td>Strikethrough</td>
                </tr>
                <tr>
                    <td>Ctrl+&#x25BC;</td>
                    <td>Subscript</td>
                </tr>
                <tr>
                    <td>Ctrl+&#x25B2;</td>
                    <td>Superscript</td>
                </tr>
                <tr>
                    <td>Ctrl+K</td>
                    <td>Spoiler</td>
                </tr>
                <tr>
                    <td>Ctrl+R</td>
                    <td>User Link</td>
                </tr>
                <tr>
                    <td>Ctrl+O</td>
                    <td>User Icon</td>
                </tr>
                <tr>
                    <td>Ctrl+E</td>
                    <td id="elCtrlEDescription">Show EIcon Search</td>
                </tr>
                <tr>
                    <td>Ctrl+N</td>
                    <td>No Parse</td>
                </tr>
            </table>    
        `);

        const elCtrlEDescription = this.$("elCtrlEDescription") as HTMLElement;
        this.watchExpr(vm => vm.appViewModel.getConfigSettingById("eiconSearch.enabled"), searchEnabled => {
            if (!!searchEnabled) {
                elCtrlEDescription.innerText = "Show EIcon Search";
            }
            else {
                elCtrlEDescription.innerText = "EIcon";
            }
        });
    }
}