import { CharacterName } from "../shared/CharacterName.js";
import { asDisposable } from "../util/Disposable.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { URLUtils } from "../util/URLUtils.js";
import { WhenChangeManager } from "../util/WhenChange.js";
import { ActiveLoginViewModel } from "../viewmodel/ActiveLoginViewModel.js";
import { AppViewModel } from "../viewmodel/AppViewModel.js";
import { LoginViewModel } from "../viewmodel/dialogs/LoginViewModel.js";
import { CollectionView2 } from "./CollectionView2.js";
import { CollectionViewLightweight } from "./CollectionViewLightweight.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";

@componentElement("x-instanceselectpanel")
class InstanceSelectPanel extends ComponentBase<AppViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <x-collectionview2 id="elInnerMain">
                <template>
                    <x-instanceselectpaneltab class="tab"></x-instanceselectpaneltab>
                </template>
                <div slot="container" class="tab-container"></div>
            </x-collectionview2>
            <button class="add-session" id="elAddSession" tabindex="-1">+</button>
        `);

        const elInnerMain = this.$("elInnerMain") as CollectionView2<ActiveLoginViewModel>;
        const elAddSession = this.$("elAddSession") as HTMLButtonElement;

        this.watchExpr(vm => vm.logins, v => {
            elInnerMain.viewModel = v ?? null;
        });
        this.watchExpr(vm => vm.logins.length, v => {
            v = v ?? 0;
            const count = v != null ? +v : 0;
            elAddSession.classList.toggle("hidden", v >= 3);
        });
        elAddSession.addEventListener("click", () => {
            const vm = this.viewModel;
            if (vm) {
                const ld = new LoginViewModel(vm);
                vm.showDialogAsync(ld);
            }
        });
    }
}

@componentElement("x-instanceselectpaneltab")
class InstanceSelectPanelTab extends ComponentBase<ActiveLoginViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <img id="elAvatar" class="tab-avatar" />
            <div class="tab-addtl" id="elAddtl"></div>
        `);
        this.elMain.classList.add("tab");

        const elMain = this.$("elMain") as HTMLDivElement;
        const elAvatar = this.$("elAvatar") as HTMLImageElement;

        const elAddtl = this.$("elAddtl") as HTMLDivElement;

        this.watchExpr(vm => vm.characterName, v => {
            if (v) {
                elAvatar.src = URLUtils.getAvatarImageUrl(v);
            }
            else {
                elAvatar.src = URLUtils.getEmptyImageUrl();
            }
        });
        this.watchExpr(vm => vm.parent.currentlySelectedSession, v => {
            if (this.viewModel != null && v == this.viewModel) {
                elMain.classList.toggle("tab-active", true);
            }
            else {
                elMain.classList.toggle("tab-active", false);
            }
        });

        const headerDotWCM = new WhenChangeManager();
        this.watchExpr(vm => ({ hasPings: vm.hasPings, hasUnseenMessages: vm.hasUnseenMessages, isSelectedSession: vm.isSelectedSession }), vp => {
            let klass = "hidden";
            let headerDotText = "";
            if (!vp?.isSelectedSession) {
                if (vp?.hasPings) {
                    klass = "has-ping-icon";
                    headerDotText = `<x-iconimage src="assets/ui/channel-ping.svg" class="ping-icon"></x-iconimage> `;
                }
                else if (vp?.hasUnseenMessages) {
                    klass = "has-unseen-dot";
                    headerDotText = "<x-litestatusdot></x-litestatusdot>";
                }
            }
            headerDotWCM.assign({ headerDotText }, () => {
                HTMLUtils.assignStaticHTMLFragment(elAddtl, headerDotText);
                elAddtl.classList.add(klass);
                return asDisposable(() => {
                    elAddtl.classList.remove(klass);
                });
            });
        });

        elMain.addEventListener("mousedown", (ev) => {
            if (this.viewModel) {
                this.viewModel.parent.currentlySelectedSession = this.viewModel;
                ev.preventDefault();
            }
        });
    }
}
