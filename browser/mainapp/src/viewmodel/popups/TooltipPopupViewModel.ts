import { IDisposable, asDisposable } from "../../util/Disposable";
import { EventListenerUtil } from "../../util/EventListenerUtil";
import { Logger, Logging } from "../../util/Logger";
import { observableProperty } from "../../util/ObservableBase";
import { AppViewModel } from "../AppViewModel";
import { ContextPopupViewModel, PopupViewModel } from "./PopupViewModel";

export class TooltipPopupViewModel extends ContextPopupViewModel {
    constructor(parent: AppViewModel, contextElement: HTMLElement) {
        super(parent, contextElement);
    }

    @observableProperty
    title: string = "";

    @observableProperty
    text: string = "";

    @observableProperty
    mousePoint: { x: number, y: number } = { x: 0, y: 0 };
}

const setupTooltipHandlingLogger: Logger = Logging.createLogger("setupTooltipHandling");
export function setupTooltipHandling(root: ShadowRoot, appViewModel: AppViewModel): IDisposable {

    let openPopupCleanup: (IDisposable | null) = null;
    let curPopupElement: (HTMLElement | null) = null;

    const mouseOverHandler = EventListenerUtil.addDisposableEventListener(root, "mouseover", (ev: MouseEvent) => {
        if (ev.target instanceof HTMLElement) {
            const containingTooltipElement = ev.target.closest("*[data-tooltip]") as HTMLElement | null;
            if (containingTooltipElement && curPopupElement != containingTooltipElement) {
                if (openPopupCleanup) {
                    openPopupCleanup.dispose();
                    openPopupCleanup = null;
                }

                const mousePoint = { x: ev.clientX, y: ev.clientY };

                const vm = new TooltipPopupViewModel(appViewModel, containingTooltipElement);
                vm.text = containingTooltipElement.getAttribute("data-tooltip")!;
                vm.title = containingTooltipElement.hasAttribute("data-tooltiptitle") ? containingTooltipElement.getAttribute("data-tooltiptitle")! : "";
                vm.mousePoint = mousePoint;

                const moveHandler = EventListenerUtil.addDisposableEventListener(root, "mousemove", (ev: MouseEvent) => {
                    const mousePoint = { x: ev.clientX, y: ev.clientY };
                    vm.mousePoint = mousePoint;
                });

                appViewModel.popups.push(vm);

                const egw = elementGoneWatcher(containingTooltipElement, () => {
                    setupTooltipHandlingLogger.logDebug("tooltip element gone");
                    cleanup.dispose();
                });

                const cleanup = asDisposable(() => {
                    setupTooltipHandlingLogger.logDebug("tooltip cleanup");
                    mouseOutHandler.dispose();
                    moveHandler.dispose();
                    egw.dispose();
                    appViewModel.popups.remove(vm);
                    openPopupCleanup = null;
                    curPopupElement = null;
                });

                const mouseOutHandler = EventListenerUtil.addDisposableEventListener(containingTooltipElement, "mouseleave", (ev2: MouseEvent) => {
                    setupTooltipHandlingLogger.logDebug("tooltip element mouseleave");
                    cleanup.dispose();
                });

                setupTooltipHandlingLogger.logDebug("tooltip element opened", containingTooltipElement);
                openPopupCleanup = cleanup;
                curPopupElement = containingTooltipElement;
            }
        }
    }, true);
    

    return asDisposable(mouseOverHandler, openPopupCleanup);
}

function elementGoneWatcher(el: HTMLElement, onGone: () => any): IDisposable {
    let h: number;
    const cleanup = asDisposable(() => {
        window.clearInterval(h);
    });

    h = window.setInterval(() => { 
        const topLevelDocument = document;
        let checkEl: Node | null = el;
        let isConnected = false;
        while (checkEl) {
            if (checkEl == topLevelDocument) {
                isConnected = true;
            }
            if (checkEl instanceof ShadowRoot) {
                checkEl = checkEl.host;
            }
            checkEl = checkEl.parentNode;
        }
        if (!isConnected) {
            cleanup.dispose();
            onGone();
        }
    }, 250);

    return cleanup;
}