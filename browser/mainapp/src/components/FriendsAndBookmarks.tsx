import { CharacterName } from "../shared/CharacterName";
import { jsx, Fragment, VNode } from "../snabbdom/index";
import { CharacterLinkUtils } from "../util/CharacterLinkUtils";
import { FriendsAndBookmarksViewModel, LoadingOrValueOrError } from "../viewmodel/FriendsAndBookmarksViewModel";
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
        if (!vm) { return <></>; }

        return <>
            <div classList={[ "friends-column" ]}>
                <div classList={[ "friendrequests-section" ]}></div>
                <div classList={[ "section", "friends-section" ]}>
                    <div classList={[ "section-title", "friends-section-title" ]}>Friends</div>
                    { this.renderLoadable(args, vm.friends, this.renderFriendsSection.bind(this)) }
                </div>
            </div>
            <div classList={[ "bookmarks-column" ]}>
                <div classList={[ "section", "bookmarks-section" ]}>
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

    renderFriendsSection(args: RenderArguments, friendMap: Map<CharacterName, CharacterName[]>): VNode {
        const vm = this.viewModel;
        if (!vm) { return <></>; }

        const fgroupNodes: VNode[] = [];
        const fkeys = [...friendMap.keys()];
        fkeys.sort(CharacterName.compare)
        for (let k of fkeys) {
            const children = friendMap.get(k)!;
            const childNodes: VNode[] = [];

            for (let c of children) {
                const isSelected = vm.selectedFriend?.myCharacterName == k && vm.selectedFriend?.interlocutorCharacterName == c;
                const cstatus = vm.session.characterSet.getCharacterStatus(c);
                const charVNode = CharacterLinkUtils.createStaticCharacterLinkVNode(vm.session, c, cstatus, null);

                childNodes.push(<div class={{
                    "friends-list-item": true,
                    "selected": isSelected
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
                    "disabled": (vm.selectedFriend == null)
                }}>Remove Friend</button>
            </div>
        </>;
    }

    renderBookmarksSection(args: RenderArguments, bookmarksList: CharacterName[]): VNode {
        const vm = this.viewModel;
        if (!vm) { return <></>; }

        const bmNodes: VNode[] = [];
        for (let bm of bookmarksList) {
            const isSelected = vm.selectedBookmark == bm;
            const cstatus = vm.session.characterSet.getCharacterStatus(bm);
            const charVNode = CharacterLinkUtils.createStaticCharacterLinkVNode(vm.session, bm, cstatus, null);
            bmNodes.push(<div class={{
                "bookmarks-list-item": true,
                "selected": isSelected
            }}>{charVNode}</div>);
        }

        return <>
            <div classList={[ "section-list", "bookmarks-list" ]}>
                {bmNodes}
            </div>
            <div classList={[ "section-buttons", "bookmarks-buttons" ]}>
                <button classList={[ "bookmarks-buttons-button", "button-removebookmark", "themed" ]} attrs={{
                    "disabled": (vm.selectedBookmark == null)
                }}>Remove Bookmark</button>
            </div>
        </>;
    }
}