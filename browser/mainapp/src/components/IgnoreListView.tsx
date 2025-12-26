import { CharacterName } from "../shared/CharacterName";
import { jsx, Fragment, VNode } from "../snabbdom/index";
import { CharacterLinkUtils } from "../util/CharacterLinkUtils";
import { IDisposable } from "../util/Disposable";
import { VNodeUtils } from "../util/VNodeUtils";
import { IgnoreListViewModel } from "../viewmodel/IgnoreListViewModel";
import { componentElement } from "./ComponentBase";
import { RenderArguments } from "./RenderingComponentBase";
import { RenderingStageViewComponent, stageViewFor } from "./Stage";

@componentElement("x-ignorelistview")
@stageViewFor(IgnoreListViewModel)
export class IgnoreListView extends RenderingStageViewComponent<IgnoreListViewModel> {

    protected render(args: RenderArguments): VNode {
        if (!this.viewModel) { return VNodeUtils.createEmptyFragment(); }
        const vm = this.viewModel;

        const itemNodes: VNode[] = [];
        const ignoredCharsArray = [...vm.ignoredChars.values()];
        ignoredCharsArray.sort(CharacterName.compare);
        for (let char of ignoredCharsArray) {
            const charStatus = vm.session.characterSet.getCharacterStatus(char);
            const charLinkNode = CharacterLinkUtils.createStaticCharacterLinkVNode(vm.session, char, charStatus, null, {
                disallowLeftClick: true,
                suppressIcons: [ "ignore" ]
            });
            const vnode = <div classList={[ "ignorelist-item" ]}>
                <div key={`char-${char.canonicalValue}`} classList={[ "ignorelist-item-name" ]}>{charLinkNode}</div>
                <div classList={[ "ignorelist-item-buttons" ]}>
                    <button classList={[ "ignorelist-item-button-remove", "themed" ]}>Unignore</button>
                </div>
            </div>;

            itemNodes.push(vnode);
        }

        const result = <>
            <div classList={[ "ignorelist-title" ]}>Ignore List</div>
            <div classList={[ "ignorelist-list" ]}>
                {itemNodes}
            </div>
        </>;
        
        return result;
    }

}