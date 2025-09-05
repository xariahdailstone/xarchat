import { jsx, VNode, Fragment } from "../../snabbdom/index";
import { ConvertibleToDisposable } from "../../util/Disposable";
import { OtherTabsTabViewModel } from "../../viewmodel/sidebartabs/OtherTabsTabViewModel";
import { SidebarTabViewRenderer, sidebarTabViewRendererFor } from "./SidebarTabContainerView";


@sidebarTabViewRendererFor(OtherTabsTabViewModel)
export class OtherTabsTabViewRenderer extends SidebarTabViewRenderer<OtherTabsTabViewModel> {

    get cssFiles(): string[] { return []; }
    
    renderTitle(vm: OtherTabsTabViewModel, isSelectedTab: boolean, addDisposable: (d: ConvertibleToDisposable) => void): (VNode | VNode[] | null) {
        return <x-iconimage classList={["tab-icon"]} attr-src="assets/ui/other-icon.svg"></x-iconimage>;
    }

    renderBody(vm: OtherTabsTabViewModel, addDisposable: (d: ConvertibleToDisposable) => void): (VNode | VNode[] | null) {
        return <>Test 1 2 3</>;
    }

}
