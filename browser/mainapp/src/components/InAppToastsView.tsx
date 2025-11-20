import { VNode, jsx, Fragment, On, Classes, VNodeStyle, Hooks } from "../snabbdom/index";
import { asDisposable, ConvertibleToDisposable, IDisposable } from "../util/Disposable";
import { EventListenerUtil } from "../util/EventListenerUtil";
import { ObjectUniqueId } from "../util/ObjectUniqueId";
import { StringUtils } from "../util/StringUtils";
import { InAppToastsViewModel, InternalToastInfo, ToastCloseReason } from "../viewmodel/InAppToastsViewModel";
import { ComponentBase, componentElement } from "./ComponentBase";
import { RenderingComponentBase } from "./RenderingComponentBase";

@componentElement("x-inapptoastsview")
export class InAppToastsView extends RenderingComponentBase<InAppToastsViewModel> {
    constructor() {
        super();
    }

    private readonly SYM_ALREADYSHOWN = Symbol();

    protected render(): (VNode | [VNode, IDisposable]) {
        if (!this.viewModel) { return <></>; }
        const vm = this.viewModel;

        // if (vm.toasts.length == 0) {
        //     return <></>;
        // }

        const disposables: ConvertibleToDisposable[] = [];
        const addDisposable = (d: ConvertibleToDisposable) => { disposables.push(d); };

        const toastNodes: VNode[] = [];
        for (let t of vm.toasts.iterateValues()) {
            const closeNode = (t.canClose ?? true)
                ? <button classList={[ "toasts-toast-close" ]} on={{ "click": (e) => { 
                    vm.removeToast(t, ToastCloseReason.CloseButtonClicked); e.stopPropagation(); 
                } }}><x-iconimage classList={[ "toasts-toast-close-icon" ]} src="assets/ui/iconify-window-close.svg"></x-iconimage></button>
                : null;

            const buttonNodes: VNode[] = [];
            for (let btn of t.buttons ?? []) {
                buttonNodes.unshift(<button classList={[ "toasts-toast-button" ]} on={{ "click": (e) => { btn.onClick(t, vm); e.stopPropagation(); } }}>{btn.title}</button>);
            }
            const buttonNodesContainer = buttonNodes.length > 0
                ? <div classList={[ "toasts-toast-buttons" ]}>{buttonNodes}</div>
                : null;

            const toastClasses: Classes = { "toasts-toast": true };
            if (t.cssClasses) {
                for (let cc of t.cssClasses) {
                    toastClasses[cc] = true;
                }
            }

            const toastStyles: VNodeStyle = {};
            if (t.color) {
                toastStyles["color"] = t.color;
            }
            if (t.backgroundColor) {
                toastStyles["background-color"] = t.backgroundColor;
            }

            const toastOn: On = {};
            if (t.onClick) {
                toastOn["click"] = (e) => { t.onClick!(t, vm); e.stopPropagation(); };
                toastClasses["clickable"] = true;
            }

            const nodeAlreadyShown = !!(t as any)[this.SYM_ALREADYSHOWN];
            if (nodeAlreadyShown) {
                toastClasses["alreadyshown"] = true;
            }
            else {
                toastClasses["newshow"] = true;
            }

            const toastHooks: Hooks = {
                "insert": (vnode) => {
                    if (!nodeAlreadyShown) {
                        const elm = (vnode.elm! as HTMLElement);    
                        const elistener = EventListenerUtil.addAnimationEndOrTimedEvent(elm, () => {
                            (t as any)[this.SYM_ALREADYSHOWN] = true;
                            elistener.dispose();
                            this.refreshDOM();
                        });
                    }
                },
                "remove": (vnode, callback) => {
                    const elm = (vnode.elm! as HTMLElement);
                    const elistener = EventListenerUtil.addAnimationEndOrTimedEvent(elm, () => {
                        callback();
                        elistener.dispose();
                    });
                    elm.classList.add("removing");
                }
            };

            const titleNode = !StringUtils.isNullOrWhiteSpace(t.title)
                ? <div classList={[ "toasts-toast-title" ]}>{t.title}</div>
                : null;

            const it: InternalToastInfo = t;
            const descriptionNode = (it.descriptionBBCode || it.description)
                ? <div classList={[ "toasts-toast-description" ]}>{it.descriptionBBCode ? it.descriptionBBCode.asVNode() : it.description}</div>
                : null;

            toastNodes.unshift(<div class={toastClasses} style={toastStyles} on={toastOn} hook={toastHooks}
                    key={`toast-${ObjectUniqueId.get(t)}`}>
                {closeNode}
                {titleNode}
                {descriptionNode}
                {buttonNodesContainer}
            </div>);
        }
        
        return [<div classList={[ "toasts-container" ]}>{toastNodes}</div>, asDisposable(...disposables)];
    }
}