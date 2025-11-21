import { jsx, VNode, Fragment } from "../../snabbdom/index";
import { ConvertibleToDisposable } from "../../util/Disposable";
import { OtherTabsTabViewModel } from "../../viewmodel/sidebartabs/OtherTabsTabViewModel";
import { SidebarTabRenderTitleArgs, SidebarTabRenderTitleResult, SidebarTabViewRenderer, sidebarTabViewRendererFor } from "./SidebarTabContainerView";


@sidebarTabViewRendererFor(OtherTabsTabViewModel)
export class OtherTabsTabViewRenderer extends SidebarTabViewRenderer<OtherTabsTabViewModel> {

    get cssFiles(): string[] { return []; }
    
    renderTitle(renderArgs: SidebarTabRenderTitleArgs<OtherTabsTabViewModel>): SidebarTabRenderTitleResult {
        const vnodes = <x-iconimage classList={["title-icon"]} attr-src="assets/ui/other-icon.svg"></x-iconimage>;
        return { vnodes, tabClasses: "standardtabtitle" };
    }

    renderBody(vm: OtherTabsTabViewModel, addDisposable: (d: ConvertibleToDisposable) => void): (VNode | VNode[] | null) {
        return <x-misctabslist props={{ "ignoreParent": true, "viewModel": vm.session }}></x-misctabslist>;
    }

}

