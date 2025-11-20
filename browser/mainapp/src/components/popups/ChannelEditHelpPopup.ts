import { HTMLUtils } from "../../util/HTMLUtils";
import { PlatformUtils } from "../../util/PlatformUtils";
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

        const shortcutKeyString = PlatformUtils.shortcutKeyCombiningPrefixString;
        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="title">Shortcut Keys</div>
            <table class="commands">
                <tr>
                    <td>${shortcutKeyString}T</td>
                    <td>Toggle Editing Toolbar</td>
                </tr>
                <tr>
                    <td>${shortcutKeyString}W</td>
                    <td>Toggle Editing Status Bar</td>
                </tr>
                <tr>
                    <td>${shortcutKeyString}P</td>
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
                    <td>${shortcutKeyString}B</td>
                    <td>Bold</td>
                </tr>
                <tr>
                    <td>${shortcutKeyString}I</td>
                    <td>Italic</td>
                </tr>
                <tr>
                    <td>${shortcutKeyString}U</td>
                    <td>Underline</td>
                </tr>
                <tr>
                    <td>${shortcutKeyString}S</td>
                    <td>Strikethrough</td>
                </tr>
                <tr>
                    <td>${shortcutKeyString}&#x25BC;</td>
                    <td>Subscript</td>
                </tr>
                <tr>
                    <td>${shortcutKeyString}&#x25B2;</td>
                    <td>Superscript</td>
                </tr>
                <tr>
                    <td>${shortcutKeyString}K</td>
                    <td>Spoiler</td>
                </tr>
                <tr>
                    <td>${shortcutKeyString}D</td>
                    <td>Color</td>
                </tr>
                <tr>
                    <td>${shortcutKeyString}R</td>
                    <td>User Link</td>
                </tr>
                <tr>
                    <td>${shortcutKeyString}O</td>
                    <td>User Icon</td>
                </tr>
                <tr>
                    <td>${shortcutKeyString}E</td>
                    <td id="elCtrlEDescription">Show EIcon Search</td>
                </tr>
                <tr id="elCtrlAltERow">
                    <td>${shortcutKeyString}Alt+E</td>
                    <td>Show EIcon Search</td>
                </tr>
                <tr>
                    <td>${shortcutKeyString}N</td>
                    <td>No Parse</td>
                </tr>
            </table>    
        `);

        const elCtrlEDescription = this.$("elCtrlEDescription") as HTMLElement;
        const elCtrlAltERow = this.$("elCtrlAltERow") as HTMLDivElement;

        this.watchExpr(vm => vm.appViewModel.getConfigSettingById("eiconSearch.enabled"), searchEnabled => {
            if (!!searchEnabled) {
                elCtrlEDescription.innerText = "Show EIcon Search";
                elCtrlAltERow.style.display = "none";
            }
            else {
                elCtrlEDescription.innerText = "EIcon";
                elCtrlAltERow.style.display = "table-row";
            }
        });
    }
}