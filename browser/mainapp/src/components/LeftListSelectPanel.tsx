import { jsx, Fragment, VNode } from "../snabbdom/index.js";
import { asDisposable, IDisposable } from "../util/Disposable.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { VNodeUtils } from "../util/VNodeUtils.js";
import { WhenChangeManager } from "../util/WhenChange.js";
import { ActiveLoginViewModel, LeftListSelectedPane } from "../viewmodel/ActiveLoginViewModel.js";
import { AppViewModel } from "../viewmodel/AppViewModel.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { RenderingComponentBase } from "./RenderingComponentBase.js";

@componentElement("x-leftlistselectpanel")
export class LeftListSelectPanel extends RenderingComponentBase<ActiveLoginViewModel> {

    render(): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        if (vm) {
            const llSelPane = vm.leftListSelectedPane;
            const hasPings = vm.hasPings;
            const hasUnseenMessages = vm.hasUnseenMessages;

            let hasPingsNode: (VNode | string) = "";
            let hasPingsClass: string = "hidden";
            if (llSelPane != LeftListSelectedPane.CHATS) {
                if (hasPings) {
                    hasPingsNode = <x-iconimage attr-src="assets/ui/channel-ping.svg" classList={["ping-icon"]}></x-iconimage>;
                    hasPingsClass = "has-ping-icon";
                }
                else if (hasUnseenMessages) {
                    hasPingsNode = <x-litestatusdot></x-litestatusdot>;
                    hasPingsClass = "has-unseen-dot";
                }
            }

            const getTabEvents = (sp: LeftListSelectedPane) => {
                return {
                    "click": () => { vm.leftListSelectedPane = sp; }
                }
            };

            const joinFriendsAndBookmarks = !!vm.getConfigSettingById("joinFriendsAndBookmarks");

            let watchListTabsNodes: VNode[] = [];
            if (joinFriendsAndBookmarks) {
                const isActive = llSelPane == LeftListSelectedPane.WATCHED || llSelPane == LeftListSelectedPane.FRIENDS || llSelPane == LeftListSelectedPane.BOOKMARKS;
                watchListTabsNodes.push(<div classList={[ "tab", (isActive ? "tab-active" : "tab-inactive") ]}
                        id="elFriends" on={getTabEvents(LeftListSelectedPane.WATCHED)}>
                    <x-iconimage classList={[ "tab-icon" ]} attr-src="assets/ui/friends-icon.svg"></x-iconimage>
                    <div classList={[ "tab-addtl" ]} id="elWatchedCount">{ vm.onlineWatchedChars?.size.toString() ?? "-" }</div>
                </div>);
            }
            else {
                const friendsIsActive = llSelPane == LeftListSelectedPane.WATCHED || llSelPane == LeftListSelectedPane.FRIENDS;
                watchListTabsNodes.push(<div classList={[ "tab", (friendsIsActive ? "tab-active" : "tab-inactive") ]}
                        id="elFriends" on={getTabEvents(LeftListSelectedPane.FRIENDS)}>
                    <x-iconimage classList={[ "tab-icon" ]} attr-src="assets/ui/friends-icon.svg"></x-iconimage>
                    <div classList={[ "tab-addtl" ]} id="elWatchedCount">{ vm.onlineFriends?.size.toString() ?? "-" }</div>
                </div>);
                watchListTabsNodes.push(<div classList={[ "tab", (llSelPane == LeftListSelectedPane.BOOKMARKS ? "tab-active" : "tab-inactive") ]}
                        id="elBookmarks" on={getTabEvents(LeftListSelectedPane.BOOKMARKS)}>
                    <x-iconimage classList={[ "tab-icon" ]} attr-src="assets/ui/bookmarks-icon.svg"></x-iconimage>
                    <div classList={[ "tab-addtl" ]} id="elWatchedCount">{ vm.onlineBookmarks?.size.toString() ?? "-" }</div>
                </div>);
            }

            return <div classList={[ "tab-container", (joinFriendsAndBookmarks ? "join-watched" : "split-watched") ]}>
                <div classList={[ "tab", (llSelPane == LeftListSelectedPane.CHATS ? "tab-active" : "tab-inactive") ]}
                        id="elChats" on={getTabEvents(LeftListSelectedPane.CHATS)}>
                    <x-iconimage classList={[ "tab-icon" ]} attr-src="assets/ui/chats-icon.svg"></x-iconimage>
                    <div classList={[ "tab-addtl", hasPingsClass ]} id="elHasPings">{hasPingsNode}</div>
                </div>
                { watchListTabsNodes }
                <div classList={[ "tab", (llSelPane == LeftListSelectedPane.OTHER ? "tab-active" : "tab-inactive") ]}
                        id="elOther" on={getTabEvents(LeftListSelectedPane.OTHER)}>
                    <x-iconimage classList={["tab-icon"]} attr-src="assets/ui/other-icon.svg"></x-iconimage>
                </div>
            </div>;
        }
        else {
            return VNodeUtils.createEmptyFragment();
        }
    }
}

@componentElement("x-leftlistselectpanelold")
class LeftListSelectPanelOld extends ComponentBase<ActiveLoginViewModel> {
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

        this.watchExpr(vm => vm.leftListSelectedPane, v => {
            if (v) {
                let activeEl: (HTMLElement | null) = null;
                switch (v) {
                    case LeftListSelectedPane.CHATS:
                        activeEl = elChats;
                        break;
                    case LeftListSelectedPane.FRIENDS:
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
                    headerDotText = "<x-litestatusdot></x-litestatusdot>";
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
        elFriends.addEventListener("click", () => setActivePane(LeftListSelectedPane.FRIENDS));
        elOther.addEventListener("click", () => setActivePane(LeftListSelectedPane.OTHER));
    }
}