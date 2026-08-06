import { HostInterop, HostWindowState } from "../util/hostinterop/HostInterop.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { UpdateCheckerState } from "../util/UpdateCheckerClient.js";
import { AppViewModel } from "../viewmodel/AppViewModel.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { IconImage } from "./IconImage.js";

@componentElement("x-titlebar")
export class TitleBar extends ComponentBase<AppViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="topsizer"></div>
            <div id="elTitle" class="title"></div>
            <div id="elBrandTag" class="brandtag"></div>
            <div id="elStatusMessage" class="status-message"></div>
            <button id="elMinimize" class="titlebarbutton" tabindex="-1"><x-iconimage src="assets/ui/iconify-window-minimize.svg"></x-iconimage></button>
            <button id="elMaximize" class="titlebarbutton" tabindex="-1"><x-iconimage id="elMaximizeIcon" src="assets/ui/iconify-window-maximize.svg"></x-iconimage></button>
            <button id="elClose" class="titlebarbutton" tabindex="-1"><x-iconimage src="assets/ui/iconify-window-close.svg"></x-iconimage></button>
        `);

        const buttonSrcMaximize = "assets/ui/iconify-window-maximize.svg";
        const buttonSrcRestore = "assets/ui/iconify-window-restore.svg";

        const elTitle = this.$("elTitle") as HTMLDivElement;
        const elBrandTag = this.$("elBrandTag") as HTMLDivElement;
        const elStatusMessage = this.$("elStatusMessage") as HTMLDivElement;
        const elMinimize = this.$("elMinimize") as HTMLButtonElement;
        const elMaximize = this.$("elMaximize") as HTMLButtonElement;
        const elClose = this.$("elClose") as HTMLButtonElement;
        const elMaximizeIcon = this.$("elMaximizeIcon") as IconImage;

        this.watchExpr(vm => vm.windowTitle, title => {
            elTitle.innerText = title ?? "Untitled";
        });
        this.watchExpr(vm => vm.appWindowState, aws => {
            if (aws != null && aws == HostWindowState.MAXIMIZED) {
                elMaximizeIcon.src = buttonSrcRestore;
            }
            else {
                elMaximizeIcon.src = buttonSrcMaximize;
            }
        });
        this.watchExpr(vm => vm.statusMessage, sm => {
            if (sm != null) {
                this.elMain.classList.add("status-message-shown");
                elStatusMessage.innerText = sm;
            }
            else {
                this.elMain.classList.remove("status-message-shown");
            }
        });

        if (HostInterop.devMode) {
            elBrandTag.classList.add("devmode");
            elBrandTag.innerText = "DEV";
        }

        elMinimize.addEventListener("click", () => HostInterop.minimizeWindow());
        elMinimize.addEventListener("contextmenu", (ev) => {
            HostInterop.showDevTools();
            ev.preventDefault();
            return false;
        });
        elMaximize.addEventListener("click", () => {
            const vm = this.viewModel;
            if (vm) {
                if (vm.appWindowState == HostWindowState.NORMAL) {
                    HostInterop.maximizeWindow();
                }
                else {
                    HostInterop.restoreWindow();
                }
            }
        });
        elClose.addEventListener("click", () => this.viewModel?.closeApplicationAsync());
    }
}
