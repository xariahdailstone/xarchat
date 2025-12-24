import { CharacterName } from "../shared/CharacterName";
import { jsx, Fragment, VNode } from "../snabbdom/index";
import { CharacterLinkUtils } from "../util/CharacterLinkUtils";
import { VNodeUtils } from "../util/VNodeUtils";
import { FriendRequestSet, FriendsAndBookmarksViewModel } from "../viewmodel/FriendsAndBookmarksViewModel";
import { LoadingOrValueOrError } from "../viewmodel/LoadingOrValueOrError";
import { componentElement } from "./ComponentBase";
import { makeRenderingComponent, RenderArguments } from "./RenderingComponentBase";
import { StageViewComponent, stageViewFor } from "./Stage";

@componentElement("x-friendsandbookmarks")
@stageViewFor(FriendsAndBookmarksViewModel)
export class FriendsAndBookmarks extends StageViewComponent<FriendsAndBookmarksViewModel> {
    constructor() {
        super();

        makeRenderingComponent(this, {
            render: (args) => this.render(args)
        })
    }

    render(args: RenderArguments): VNode {
        const vm = this.viewModel;
        if (!vm) { return VNodeUtils.createEmptyFragment(); }

        return <>
            <div classList={[ "friends-column" ]}>
                { this.renderFriendRequestsSection(args, vm, vm.incomingRequests) }
                <div key="friends-section" classList={[ "section", "friends-section" ]}>
                    <div classList={[ "section-title", "friends-section-title" ]}>Friends</div>
                    { this.renderLoadable(args, vm.friends, this.renderFriendsSection.bind(this)) }
                </div>
            </div>
            <div classList={[ "bookmarks-column" ]}>
                <div key="bookmarks-section" classList={[ "section", "bookmarks-section" ]}>
                    <div classList={[ "section-title", "bookmarks-section-title" ]}>Bookmarks</div>
                    { this.renderLoadable(args, vm.bookmarks, this.renderBookmarksSection.bind(this)) }
                </div>
            </div>
        </>;
    }

    renderLoadable<T>(args: RenderArguments, mvalue: LoadingOrValueOrError<T>, innerRender: (args: RenderArguments, value: T) => VNode) : VNode {
        if (mvalue.isLoading) {
            return <>Loading...</>;
        }
        else if (mvalue.isError) {
            return <>Failed to load.</>;
        }
        else {
            return innerRender(args, mvalue.value!);
        }
    }

    renderFriendRequestsSection(args: RenderArguments, vm: FriendsAndBookmarksViewModel, mvalue: LoadingOrValueOrError<FriendRequestSet>): VNode {
        if (mvalue.isLoading || mvalue.isError) { return <div key="friendrequests-section" classList={[ "hidden", "section", "friendrequests-section" ]}></div>; }

        const v = mvalue.value!;

        const freqNodes: VNode[] = [];
        for (let myChar of v.keys()) {
            const children = v.get(myChar)!;

            const childNodes: VNode[] = [];
            for (let c of children) {
                const cstatus = vm.session.characterSet.getCharacterStatus(c.interlocutorCharacterName);
                const charVNode = CharacterLinkUtils.createStaticCharacterLinkVNode(vm.session, c.interlocutorCharacterName, cstatus, null, { disallowLeftClick: true });

                childNodes.push(<div key={`req-${c.myCharacterName.canonicalValue}#${c.interlocutorCharacterName.canonicalValue}`} classList={[ "friendrequests-list-item"]}>
                    <div classList={[ "friendrequests-list-item-name" ]}>{charVNode}</div>
                    <button classList={[ "friendrequests-list-item-accept", "themed" ]} on={{ "click": () => { vm.acceptIncomingRequest(c); } }}>Accept</button>
                    <button classList={[ "friendrequests-list-item-reject", "themed" ]} on={{ "click": () => { vm.rejectIncomingRequest(c); } }}>Ignore</button>
                </div>);
            }

            const tnode =
                <div key={`group-${myChar.canonicalValue}`} classList={[ "friendrequests-list-group" ]}>
                    <div classList={[ "friendrequests-list-group-title" ]}>
                        <div classList={[ "friendrequests-list-group-title-text"]}>{myChar.value}</div>
                        <div classList={[ "friendrequests-list-group-title-line"]}></div>
                    </div>
                    <div classList={[ "friendrequests-list-group-items" ]}>{childNodes}</div>
                </div>
            freqNodes.push(tnode);
        }

        const result = <div key="friendrequests-section" classList={[ "section", "friendrequests-section" ]}>
            <div classList={[ "section-title", "friends-section-title" ]}>Incoming Friend Requests</div>
            <div classList={[ "section-list", "friends-list" ]}>
                {freqNodes}
            </div>
        </div>;
        return result;
    }

    renderFriendsSection(args: RenderArguments, friendMap: Map<CharacterName, CharacterName[]>): VNode {
        const vm = this.viewModel;
        if (!vm) { return VNodeUtils.createEmptyFragment(); }

        const fgroupNodes: VNode[] = [];
        const fkeys = [...friendMap.keys()];
        fkeys.sort(CharacterName.compare)
        for (let k of fkeys) {
            const children = friendMap.get(k)!;
            const childNodes: VNode[] = [];

            for (let c of children) {
                const isSelected = vm.selectedFriend?.myCharacterName == k && vm.selectedFriend?.interlocutorCharacterName == c;
                const cstatus = vm.session.characterSet.getCharacterStatus(c);
                const charVNode = CharacterLinkUtils.createStaticCharacterLinkVNode(vm.session, c, cstatus, null, { disallowLeftClick: true });

                childNodes.push(<div class={{
                    "friends-list-item": true,
                    "selected": isSelected
                }} on={{
                    "click": (e: PointerEvent) => {
                        if (e.button == 0) {
                            vm.selectedFriend = { myCharacterName: k, interlocutorCharacterName: c };
                        }
                    }
                }}>{charVNode}</div>)
            }

            const tnode =
                <div classList={[ "friends-list-group" ]}>
                    <div classList={[ "friends-list-group-title" ]}>
                        <div classList={[ "friends-list-group-title-text"]}>{k.value}</div>
                        <div classList={[ "friends-list-group-title-line"]}></div>
                    </div>
                    <div classList={[ "friends-list-group-items" ]}>{childNodes}</div>
                </div>
            fgroupNodes.push(tnode);
        }

        return <>
            <div classList={[ "section-list", "friends-list" ]}>
                {fgroupNodes}
            </div>
            <div classList={[ "section-buttons", "friends-buttons" ]}>
                <button classList={[ "friends-buttons-button", "button-removefriend", "themed" ]} attrs={{
                    "disabled": (!vm.isValidSelectedFriend())
                }} on={{
                    "click": () => {
                        vm.removeSelectedFriend();
                    }
                }}>Remove Friend</button>
            </div>
        </>;
    }

    renderBookmarksSection(args: RenderArguments, bookmarksList: CharacterName[]): VNode {
        const vm = this.viewModel;
        if (!vm) { return VNodeUtils.createEmptyFragment(); }

        const bmNodes: VNode[] = [];
        for (let bm of bookmarksList) {
            const isSelected = vm.selectedBookmark == bm;
            const cstatus = vm.session.characterSet.getCharacterStatus(bm);
            const charVNode = CharacterLinkUtils.createStaticCharacterLinkVNode(vm.session, bm, cstatus, null, { disallowLeftClick: true });
            bmNodes.push(<div class={{
                    "bookmarks-list-item": true,
                    "selected": isSelected
                }} on={{
                    "click": (e: PointerEvent) => {
                        if (e.button == 0) {
                            vm.selectedBookmark = bm;
                        }
                    }
                }}>{charVNode}</div>);
        }

        return <>
            <div classList={[ "section-list", "bookmarks-list" ]}>
                {bmNodes}
            </div>
            <div classList={[ "section-buttons", "bookmarks-buttons" ]}>
                <button classList={[ "bookmarks-buttons-button", "button-removebookmark", "themed" ]} attrs={{
                    "disabled": (!vm.isValidSelectedBookmark())
                }} on={{
                    "click": () => {
                        vm.removeSelectedBookmark();
                    }
                }}>Remove Bookmark</button>
            </div>
        </>;
    }
}