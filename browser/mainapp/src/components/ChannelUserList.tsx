import { CharacterGenderConvert } from "../shared/CharacterGender.js";
import { CharacterName } from "../shared/CharacterName.js";
import { CharacterStatus, CharacterSubSet } from "../shared/CharacterSet.js";
import { OnlineStatusConvert } from "../shared/OnlineStatus.js";
import { jsx, Fragment, VNode } from "../snabbdom/index.js";
import { AutohideElementsManager } from "../util/AutohideElementsManager.js";
import { CharacterLinkUtils, MassCharacterLinkManager } from "../util/CharacterLinkUtils.js";
import { getEffectiveCharacterName, getEffectiveCharacterNameWatcher } from "../util/CharacterNameIcons.js";
import { StringComparer } from "../util/Comparer.js";
import { asDisposable, ConvertibleToDisposable, IDisposable } from "../util/Disposable.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { IterableUtils } from "../util/IterableUtils.js";
import { ObservableValue } from "../util/Observable.js";
import { CollectionChangeEvent, CollectionChangeType, ReadOnlyObservableCollection } from "../util/ObservableCollection.js";
import { DictionaryChangeEvent, DictionaryChangeType, ObservableKeyExtractedOrderedDictionary, ObservableOrderedDictionary } from "../util/ObservableKeyedLinkedList.js";
import { Scheduler } from "../util/Scheduler.js";
import { VNodeUtils } from "../util/VNodeUtils.js";
import { WhenChangeManager } from "../util/WhenChange.js";
import { KeyValuePair } from "../util/collections/KeyValuePair.js";
import { StdObservableCollectionChangeType } from "../util/collections/ReadOnlyStdObservableCollection.js";
import { ChannelViewModel } from "../viewmodel/ChannelViewModel.js";
import { ChatChannelUserViewModel, ChatChannelViewModel } from "../viewmodel/ChatChannelViewModel.js";
import { CharacterStatusListener } from "./CharacterStatusListener.js";
import { CollectionViewLightweight } from "./CollectionViewLightweight.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { RenderingComponentBase } from "./RenderingComponentBase.js";
import { StatusDot, StatusDotVNodeBuilder } from "./StatusDot.js";

interface RenderUserNodeCacheEntry {
    vnode: VNode;
    characterStatus: CharacterStatus;
}
type RenderUserNodeCache = Map<CharacterName, RenderUserNodeCacheEntry>;

const ATTR_SHOWTOTALCOUNT = "showtotalcount";

@componentElement("x-channeluserlist")
export class ChannelUserList extends RenderingComponentBase<ChatChannelViewModel> {
    static get observedAttributes() { return [...super.observedAttributes, ATTR_SHOWTOTALCOUNT ]}

    constructor() {
        super();

        this.whenConnectedWithViewModel(vm => {
            const disposables: ConvertibleToDisposable[] = [];

            for (let x of [
                { coll: vm.usersModerators, subsetAssigner: (x: CharacterSubSet | null) => this._characterSubSetModerators.value = x },
                { coll: vm.usersWatched, subsetAssigner: (x: CharacterSubSet | null) => this._characterSubSetWatched.value = x },
                { coll: vm.usersLooking, subsetAssigner: (x: CharacterSubSet | null) => this._characterSubSetLooking.value = x },
                { coll: vm.usersOther, subsetAssigner: (x: CharacterSubSet | null) => this._characterSubSetOther.value = x },
                { coll: vm.searchExactMatch, subsetAssigner: (x: CharacterSubSet | null) => this._characterSubSetSearchExact.value = x },
                { coll: vm.searchInitialMatch, subsetAssigner: (x: CharacterSubSet | null) => this._characterSubSetSearchInitial.value = x },
                { coll: vm.searchAnywhereMatch, subsetAssigner: (x: CharacterSubSet | null) => this._characterSubSetSearchAnywhere.value = x },
            ]) {

                const iterable = IterableUtils.asQueryable(x.coll.iterateValues()).select(kvp => kvp.key);
                const subset = vm.parent.characterSet.createSubSet(iterable);
                x.subsetAssigner(subset);

                disposables.push(() => {
                    x.subsetAssigner(null);
                    subset.dispose();
                });

                disposables.push(
                    x.coll.addCollectionObserver(changes => {
                        for (let change of changes) {
                            switch (change.changeType) {
                                case StdObservableCollectionChangeType.ITEM_ADDED:
                                    subset.addChar(change.item.key);
                                    break;
                                case StdObservableCollectionChangeType.ITEM_REMOVED:
                                    subset.removeChar(change.item.key);
                                    break;
                                case StdObservableCollectionChangeType.CLEARED:
                                    throw new Error("Not Implemented!");
                                    break;
                            }
                        }
                    })
                );

            }

            return asDisposable(...disposables);
        });

        this.whenConnectedWithViewModel(vm => {
            const hem = new AutohideElementsManager({
                name: "ChannelUserList",
                rootEl: this.elMain,
                includePredicate: (el) => el.classList.contains("useritem"),
                watchAttributes: ["class"],
                intersectionMargin: "100% 0px 100% 0px"
            });
            return asDisposable(() => {
                hem.dispose();
            });
        });
    }

    private _characterSubSetModerators: ObservableValue<CharacterSubSet | null> = new ObservableValue(null);
    private _characterSubSetWatched: ObservableValue<CharacterSubSet | null> = new ObservableValue(null);
    private _characterSubSetLooking: ObservableValue<CharacterSubSet | null> = new ObservableValue(null);
    private _characterSubSetOther: ObservableValue<CharacterSubSet | null> = new ObservableValue(null);

    private _characterSubSetSearchExact: ObservableValue<CharacterSubSet | null> = new ObservableValue(null);
    private _characterSubSetSearchInitial: ObservableValue<CharacterSubSet | null> = new ObservableValue(null);
    private _characterSubSetSearchAnywhere: ObservableValue<CharacterSubSet | null> = new ObservableValue(null);

    protected override attributeChangedCallback(name: string, oldValue?: string, newValue?: string) {
        super.attributeChangedCallback(name, oldValue, newValue);
        if (name == ATTR_SHOWTOTALCOUNT) {
            this.showTotalCount = (newValue == "true");
        }
    }

    get showTotalCount() { return this.getAttribute(ATTR_SHOWTOTALCOUNT) == "true"; }
    set showTotalCount(value: boolean) {
        if (value !== this.showTotalCount) {
            if (value) {
                this.setAttribute(ATTR_SHOWTOTALCOUNT, "true");
            }
            else {
                this.removeAttribute(ATTR_SHOWTOTALCOUNT);
            }
            this.refreshDOM();
        }
    }

    protected render(): (VNode | [VNode, IDisposable]) {
        const vm = this.viewModel;
        if (!vm) return VNodeUtils.createEmptyFragment();

        const disposables: ConvertibleToDisposable[] = [];
        const addDisposable = (d: ConvertibleToDisposable) => disposables.push(d);

        const charLinkMgr = new MassCharacterLinkManager(vm.activeLoginViewModel, vm);
        addDisposable(charLinkMgr);

        const totalUserCount = vm.usersModerators.length + vm.usersWatched.length + vm.usersLooking.length + vm.usersOther.length;
        const joinFriendsAndBookmarks = vm.getConfigSettingById("joinFriendsAndBookmarks");

        const isSearching = vm.userListSearchOpen && vm.userListSearchText != "";

        const sectionNodes: (VNode | null)[] = [];

        if (!isSearching) {
            sectionNodes.push(this.renderSection(vm, charLinkMgr, "sec-mods", "elMods", "Moderators", this._characterSubSetModerators.value));

            if (joinFriendsAndBookmarks) {
                sectionNodes.push(this.renderSection(vm, charLinkMgr, "sec-watched", "elWatched", "Friends/Bookmarks", this._characterSubSetWatched.value));
            }
            else {
                sectionNodes.push(this.renderSection(vm, charLinkMgr, "sec-friends", "elFriends", "Friends", this._characterSubSetWatched.value, cs => cs.isFriend));
                sectionNodes.push(this.renderSection(vm, charLinkMgr, "sec-bookmarks", "elBookmarks", "Bookmarks", this._characterSubSetWatched.value, cs => !cs.isFriend));
            }
            sectionNodes.push(this.renderSection(vm, charLinkMgr, "sec-looking", "elLooking", "Looking", this._characterSubSetLooking.value));

            const othersTitle = (sectionNodes.filter(x => x != null).length == 0) ? "Everyone" : "Others";
            sectionNodes.push(this.renderSection(vm, charLinkMgr, "sec-others", "elOthers", othersTitle, this._characterSubSetOther.value));
        }
        else {
            sectionNodes.push(this.renderSection(vm, charLinkMgr, "sec-exactmatch", "elExactMatch", "Exact Match", this._characterSubSetSearchExact.value));
            sectionNodes.push(this.renderSection(vm, charLinkMgr, "sec-initialmatch", "elInitialMatch", "Initial Match", this._characterSubSetSearchInitial.value));
            sectionNodes.push(this.renderSection(vm, charLinkMgr, "sec-anywherematch", "elAnywhereMatch", "Anywhere Match", this._characterSubSetSearchAnywhere.value));
        }

        let totalCountNode: VNode | null;
        if (!isSearching) {
            totalCountNode = this.showTotalCount
                ? <div key="sec-usercount" id="elUserCountContainer" classList={["usercount"]}>
                    {totalUserCount.toLocaleString()} in channel
                </div>
                : null;
        }
        else {
            const matchCount = vm.searchExactMatch.size + vm.searchInitialMatch.size + vm.searchAnywhereMatch.size;
            totalCountNode =
                <div key="sec-usercount" id="elUserCountContainer" classList={["usercount"]}>
                    {matchCount} of {totalUserCount.toLocaleString()} matches
                </div>;
        }

        const userListSearchTextbox = vm.userListSearchOpen
            ? <input classList={[ "search-textbox" ]} id="elSearchTextbox" attr-type="text" attr-value={vm.userListSearchText} value-sync="true" data-canhavefocus="true" on={{
                "change": (e) => { vm.userListSearchText = (e.target as HTMLInputElement).value; },
                "input": (e) => { vm.userListSearchText = (e.target as HTMLInputElement).value; }
            }}/>
            : null;

        return [<>
            <div classList={[ "search-container" ]}>
                <div classList={[ "search-toggle-icon" ]} on={{
                    "click": () => {
                        vm.userListSearchOpen = !vm.userListSearchOpen;
                        if (vm.userListSearchOpen) {
                            //console.log("scheduling AFTERFRAME search box show");
                            Scheduler.scheduleCallback("afternextframe", () => {
                                //console.log("AFTERFRAME search box shown");
                                const searchTextbox = this._sroot.getElementById("elSearchTextbox");
                                if (searchTextbox) {
                                    searchTextbox.focus();
                                }
                            });
                        }
                    }
                }}><x-iconimage classList={[ "search-toggle-icon-image" ]} attr-src="assets/ui/search-icon.svg"></x-iconimage></div>
                {userListSearchTextbox}
            </div>
            {totalCountNode}
            {sectionNodes}
        </>, asDisposable(...disposables)];
    }
    
    private renderSection(vm: ChatChannelViewModel,
        charLinkMgr: MassCharacterLinkManager,
        key: string, id: string, title: string, 
        userList: CharacterSubSet | null,
        statusFilter?: (cs: CharacterStatus) => boolean): (VNode | null) {

        if (userList == null || userList.length == 0) {
            return null;
        }

        let userCount = 0;
        const userNodes: VNode[] = [];
        const newUserNodeCache: RenderUserNodeCache = new Map();
        for (let cs of userList.iterateStatuses()) {
            if (statusFilter && !statusFilter(cs)) {
                continue;
            }

            const charLinkVNode = charLinkMgr.getCharacterLinkVNodes(cs);

            const userVNode = <div key={`user-${cs.characterName.canonicalValue}`} classList={["useritem"]}>
                { StatusDotVNodeBuilder.getStatusDotVNode(cs) }
                { charLinkVNode }
            </div>;
            userNodes.push(userVNode);
            userCount++;
        }
        if (userNodes.length == 0) {
            return null;
        }

        userNodes.sort((a, b) => StringComparer.Ordinal.compare((a.key as string)!, (b.key as string)!));

        return <div key={key} id={id} classList={["section"]}>
            <div key={`${key}-title`} classList={["sectiontitle"]}>{title} ({userCount.toLocaleString()})</div>
            <div key={`${key}-items`} classList={["sectionitems"]}>
                {userNodes}
            </div>
        </div>;
    }
}