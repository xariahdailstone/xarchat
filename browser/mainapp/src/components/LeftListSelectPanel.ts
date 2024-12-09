import { asDisposable } from "../util/Disposable.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { WhenChangeManager } from "../util/WhenChange.js";
import { ActiveLoginViewModel, LeftListSelectedPane } from "../viewmodel/ActiveLoginViewModel.js";
import { AppViewModel } from "../viewmodel/AppViewModel.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";

@componentElement("x-leftlistselectpanel")
class LeftListSelectPanel extends ComponentBase<ActiveLoginViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="tab" id="elChats">
                <x-iconimage class="tab-icon" src="assets/ui/chats-icon.svg"></x-iconimage>
                <div class="tab-addtl" id="elHasPings"></div>
            </div>
            <div class="tab" id="elFriends">
                <x-iconimage class="tab-icon" src="assets/ui/friends-icon.svg"></x-iconimage>
                <div class="tab-addtl" id="elWatchedCount">0</div>
            </div>
            <div class="tab" id="elOther">
                <x-iconimage class="tab-icon" src="assets/ui/other-icon.svg"></x-iconimage>
            </div>
        `);

        const elChats = this.$("elChats")!;
        const elFriends = this.$("elFriends")!;
        const elOther = this.$("elOther")!;

        const elHasPings = this.$("elHasPings") as HTMLDivElement;
        const elWatchedCount = this.$("elWatchedCount") as HTMLDivElement;

        this.watch("leftListSelectedPane", v => {
            if (v) {
                let activeEl: (HTMLElement | null) = null;
                switch (v) {
                    case LeftListSelectedPane.CHATS:
                        activeEl = elChats;
                        break;
                    case LeftListSelectedPane.WATCHLIST:
                        activeEl = elFriends;
                        break;
                    case LeftListSelectedPane.OTHER:
                        activeEl = elOther;
                        break;
                }
                if (activeEl) {
                    activeEl.classList.add("tab-active");
                    return asDisposable(() => {
                        activeEl!.classList.remove("tab-active");
                    });
                }
            }
        });

        this.watchExpr(vm => vm.onlineWatchedChars.size, v => {
            elWatchedCount.innerText = (v != null) ? v.toString() : "0";
        });

        const headerDotWCM = new WhenChangeManager();
        this.watchExpr(vm => ({ hasPings: vm.hasPings, hasUnseenMessages: vm.hasUnseenMessages, LeftListSelectedPane: vm.leftListSelectedPane }), vp => {
            let klass = "hidden";
            let headerDotText = "";
            if (vp?.LeftListSelectedPane != LeftListSelectedPane.CHATS) {
                if (vp?.hasPings) {
                    klass = "has-ping-icon";
                    headerDotText = `<x-iconimage src="assets/ui/channel-ping.svg" class="ping-icon"></x-iconimage> `;
                }
                else if (vp?.hasUnseenMessages) {
                    klass = "has-unseen-dot";
                    headerDotText = "\u{2B24}";
                }
            }
            headerDotWCM.assign({ headerDotText }, () => {
                HTMLUtils.assignStaticHTMLFragment(elHasPings, headerDotText);
                elHasPings.classList.add(klass);
                return asDisposable(() => {
                    elHasPings.classList.remove(klass);
                });
            });
        });

        // this.watch("onlineWatchedChars.size", (v: (number | null)) => {
        //     elWatchedCount.innerText = (v != null) ? v.toString() : "0";
        // });

        const setActivePane = (p: LeftListSelectedPane) => {
            const vm = this.viewModel;
            if (vm) {
                vm.leftListSelectedPane = p;
            }
        }
        elChats.addEventListener("click", () => setActivePane(LeftListSelectedPane.CHATS));
        elFriends.addEventListener("click", () => setActivePane(LeftListSelectedPane.WATCHLIST));
        elOther.addEventListener("click", () => setActivePane(LeftListSelectedPane.OTHER));
    }
}