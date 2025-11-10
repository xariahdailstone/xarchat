import { HostInterop } from "../../util/hostinterop/HostInterop";
import { HTMLUtils } from "../../util/HTMLUtils";
import { StringUtils } from "../../util/StringUtils";
import { FramePanelDialogViewModel } from "../../viewmodel/dialogs/FramePanelDialogViewModel";
import { componentArea, componentElement } from "../ComponentBase";
import { DialogBorderType, DialogComponentBase, dialogViewFor } from "./DialogFrame";

@componentArea("dialogs")
@componentElement("x-framepaneldialog")
@dialogViewFor(FramePanelDialogViewModel)
export class FramePanelDialog extends DialogComponentBase<FramePanelDialogViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="toolbar">
                <input type="text" readonly class="urlbar" id="txtUrlBar" />
            </div>
            <div class="mainclient">
                <iframe id="elFrame" class="mainclientframe" src="about:blank"></iframe>
            </div>
        `);

        const elFrame = this.$("elFrame") as HTMLIFrameElement;
        const txtUrlBar = this.$("txtUrlBar") as HTMLInputElement;

        this.watchExpr(v => v.url, url => {
            this.title = "Loading...";
            if (url) {
                elFrame.src = url;
            }
            else {
                elFrame.src = "about:blank";
            }
        });
        this.watchExpr(v => v.displayUrl, dispUrl => {
            txtUrlBar.value = !StringUtils.isNullOrWhiteSpace(dispUrl) ? dispUrl! : "";
        });

        txtUrlBar.addEventListener("focus", () => {
            txtUrlBar.select();
        })

        let titleChangeWatcherHandle: number | null = null;
        let oldTitle = "";
        this.watchExpr(v => v, v => {
            if (v) {
                if (titleChangeWatcherHandle == null) {
                    titleChangeWatcherHandle = window.setInterval(() => {
                        let newTitle: (string | null | undefined) = "";
                        try {
                            newTitle = elFrame.contentWindow?.document.title
                        }
                        catch { 
                            newTitle = oldTitle;
                        }
                        if (newTitle != oldTitle) {
                            oldTitle = newTitle ?? "";
                            v.title = oldTitle;
                        }
                    }, 250);
                }
            }
            else {
                if (titleChangeWatcherHandle != null) {
                    window.clearInterval(titleChangeWatcherHandle);
                    titleChangeWatcherHandle = null;
                }
            }
        });

        // btnPopout.addEventListener("click", () => {
        //     if (!StringUtils.isNullOrWhiteSpace(this.viewModel?.displayUrl)) {
        //         const url = this.viewModel!.displayUrl!;
        //         HostInterop.launchUrl(this.viewModel!.parent, url, true);
        //         this.viewModel!.close(0);
        //     }
        // });
    }

    override get dialogBorderType(): DialogBorderType { return DialogBorderType.RIGHTPANE; }
}