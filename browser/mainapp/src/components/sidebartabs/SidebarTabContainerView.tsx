import { SidebarTabContainerViewModel, SidebarTabViewModel } from "../../viewmodel/sidebartabs/SidebarTabContainerViewModel";
import { componentArea, componentElement, StyleLoader } from "../ComponentBase";
import { RenderingComponentBase } from "../RenderingComponentBase";
import { jsx, Fragment, VNode, On, Classes } from "../../snabbdom/index";
import { asDisposable, ConvertibleToDisposable, IDisposable } from "../../util/Disposable";
import { getStylesheetAdoption, setStylesheetAdoption, SharedStyleSheet } from "../../util/StyleSheetPolyfill";
import { StringUtils } from "../../util/StringUtils";
import { VNodeUtils } from "../../util/VNodeUtils";

@componentArea("sidebartabs")
@componentElement("x-sidebartabcontainer")
export class SidebarTabContainerView extends RenderingComponentBase<SidebarTabContainerViewModel> {

    private static _registeredRendererTypes: Map<ConstructorOf<SidebarTabViewModel>, ConstructorOf<SidebarTabViewRenderer<any>>> = new Map();
    static registerTabViewRenderer(vm: ConstructorOf<SidebarTabViewModel>, renderer: ConstructorOf<SidebarTabViewRenderer<any>>) {
        this._registeredRendererTypes.set(vm, renderer);
    }

    constructor() {
        super();
    }

    override render(): VNode | [VNode, IDisposable] {
        const vm = this.viewModel;
        if (!vm) { return VNodeUtils.createEmptyFragment(); }

        const disposables: ConvertibleToDisposable[] = [];
        const addDisposable = (d: ConvertibleToDisposable) => { disposables.push(d); };

        const needsTabStrip =
            vm.tabs.length > 1
            || (vm.tabs.length == 1 && vm.selectedTab != vm.tabs[0])
            || (vm.tabs.length > 0 && !vm.tabs[0]!.canHideTabStripWhenAlone);

        const tabStripNode = needsTabStrip
            ? <div classList={[ "tabstrip" ]}>{this.renderTabTitles(vm, addDisposable)}</div>
            : VNodeUtils.createEmptyFragment();
        const tabBodyNode = this.renderTabBody(vm, addDisposable, needsTabStrip);

        const node = <div classList={[ "tabcontainer", ...vm.containerClasses]}>
            {tabStripNode}
            {tabBodyNode}
        </div>;

        return [node, asDisposable(...disposables) ];
    }

    private _createdRenderers: Map<object, SidebarTabViewRenderer<any>> = new Map();

    private getRendererForTab(vm: SidebarTabViewModel): SidebarTabViewRenderer<any> {
        let renderer = this._createdRenderers.get(vm.constructor);
        if (!renderer) {
            for (let k of SidebarTabContainerView._registeredRendererTypes.keys()) {
                if (vm instanceof k) {
                    renderer = new (SidebarTabContainerView._registeredRendererTypes.get(k)!)();
                    break;
                }
            }
            if (!renderer) {
                renderer = new MissingSidebarTabViewRenderer();
            }
            this._createdRenderers.set(vm.constructor, renderer);
            this.initializeCssFilesAsync(renderer);
        }
        return renderer;
    }

    private async initializeCssFilesAsync(renderer: SidebarTabViewRenderer<any>) {
        const cssFilesNeeded = renderer.cssFiles;
        const newAdopted: Set<SharedStyleSheet> = new Set(getStylesheetAdoption(this._sroot));
        for (let cssFile of cssFilesNeeded) {
            const ss = await StyleLoader.loadAsync(cssFile)
            newAdopted.add(ss);
        }
        this.logger.logDebug("setStylesheetAdoption", newAdopted);
        setStylesheetAdoption(this._sroot, [...newAdopted]);
    }

    renderTabTitles(vm: SidebarTabContainerViewModel, addDisposable: (d: ConvertibleToDisposable) => void) {
        const results: VNode[] = [];

        for (let tab of vm.tabs) {
            const isSelectedTab = vm.selectedTab == tab;

            const vr = this.getRendererForTab(tab);
            const result = vr.renderTitle({
                viewModel: tab, 
                isSelectedTab, 
                addDisposable
            });
            
            const tabClasses: Classes = {
                "tab-title": true,
                "tab-title-selected": isSelectedTab
            };
            for (let tc of ((typeof result.tabClasses == "string") ? [result.tabClasses] : (result.tabClasses ?? []))) {
                for (let tcp of tc.split(' ')) {
                    if (!StringUtils.isNullOrWhiteSpace(tcp)) {
                        tabClasses[tcp] = true;
                    }
                }
            }

            const tabOn: On = {};
            if (!isSelectedTab) {
                tabOn["click"] = (e) => {
                    vm.selectedTab = tab;
                };
            }

            results.push(<div class={tabClasses} on={tabOn}>{result.vnodes}</div>);
        }

        return results;
    }

    renderTabBody(
        vm: SidebarTabContainerViewModel,
        addDisposable: (d: ConvertibleToDisposable) => void,
        hasVisibleTabStrip: boolean) {

        if (!vm.selectedTab) { return VNodeUtils.createEmptyFragment(); }

        const vr = this.getRendererForTab(vm.selectedTab);
        const result = vr.renderBody(vm.selectedTab, addDisposable, hasVisibleTabStrip);

        const bodyClasses: Classes = {
            "tabbody": true
        };

        return <div class={bodyClasses}>{result}</div>;
    }
}

export interface SidebarTabRenderTitleArgs<TViewModel extends SidebarTabViewModel> {
    readonly viewModel: TViewModel;
    readonly isSelectedTab: boolean;
    readonly addDisposable: (d: ConvertibleToDisposable) => void;
}

export interface SidebarTabRenderTitleResult {
    vnodes: (VNode | VNode[]);
    tabClasses?: (string | string[] | null);
}

export abstract class SidebarTabViewRenderer<TViewModel extends SidebarTabViewModel> {
    abstract get cssFiles(): string[];

    abstract renderTitle(renderArgs: SidebarTabRenderTitleArgs<TViewModel>): SidebarTabRenderTitleResult;

    abstract renderBody(vm: TViewModel, addDisposable: (d: ConvertibleToDisposable) => void, hasVisibleTabStrip: boolean): (VNode | VNode[] | null);
}

class MissingSidebarTabViewRenderer extends SidebarTabViewRenderer<any> {
    get cssFiles(): string[] { return []; }

    renderTitle(renderArgs: SidebarTabRenderTitleArgs<any>): SidebarTabRenderTitleResult {
        return { vnodes: <>Renderer Missing</> };
    }
    renderBody(vm: any, addDisposable: (d: ConvertibleToDisposable) => void): (VNode | VNode[] | null) {
        return <>Renderer Missing</>;
    }
}

export interface ConstructorOf<T> {
    new (...params: any[]): T;
}

export function sidebarTabViewRendererFor<TViewModel extends SidebarTabViewModel>(vm: ConstructorOf<SidebarTabViewModel>) {
    return function(target: ConstructorOf<SidebarTabViewRenderer<TViewModel>>) {
        SidebarTabContainerView.registerTabViewRenderer(vm, target);
    }
}