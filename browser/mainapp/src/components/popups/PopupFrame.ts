import { IDisposable, asDisposable } from "../../util/Disposable";
import { EventListenerUtil } from "../../util/EventListenerUtil";
import { Scheduler } from "../../util/Scheduler";
import { WhenChangeManager } from "../../util/WhenChange";
import { DialogButtonViewModel, DialogViewModel } from "../../viewmodel/dialogs/DialogViewModel";
import { PopupViewModel } from "../../viewmodel/popups/PopupViewModel";
import { ComponentBase, componentArea, componentElement } from "../ComponentBase";

export interface ConstructorOf<T> {
    new (...params: any[]): T;
}

@componentArea("popups")
@componentElement("x-popupframe")
export class PopupFrame extends ComponentBase<PopupViewModel> {
    private static _registeredPopupTypes: Map<ConstructorOf<PopupViewModel>, ConstructorOf<ComponentBase<PopupViewModel>>> = new Map();
    static registerPopupType<TResult, TViewModel extends PopupViewModel>(viewModelType: ConstructorOf<TViewModel>, elementClass: ConstructorOf<ComponentBase<TViewModel>>) {
        this._registeredPopupTypes.set(viewModelType, elementClass);
    }

    constructor() {
        super();

        //this.elMain.innerHTML = ``;

        let view: PopupBase<any> | null = null;
        this.watchViewModel(v => {
            while (this.elMain.firstElementChild) {
                this.elMain.firstElementChild.remove();
            }
            if (v) {
                for (let k of PopupFrame._registeredPopupTypes.keys()) {
                    if (v instanceof k) {
                        const dlgEl = new (PopupFrame._registeredPopupTypes.get(k)!)();
                        view = dlgEl as PopupBase<any>;
                        dlgEl.viewModel = v;
                        this.elMain.appendChild(dlgEl);
                    }
                }
            }
        });

        this.whenConnected(() => {
            let justConnected = true;
            let clickInPopup = false;
            Scheduler.scheduleNamedCallback("PopupFrame.whenConnected", ["frame", "idle", 250], () => justConnected = false);

            const clickHandler = (ev: MouseEvent) => {
                if (this.viewModel && !justConnected && !clickInPopup) {
                    this.viewModel.dismissed();
                }
                clickInPopup = false;
            };

            const disposables: IDisposable[] = [];
            disposables.push(EventListenerUtil.addDisposableEventListener(window, "click", clickHandler));
            disposables.push(EventListenerUtil.addDisposableEventListener(window, "contextmenu", clickHandler));
            disposables.push(EventListenerUtil.addDisposableEventListener(window, "dblclick", clickHandler));

            if (view) {
                disposables.push(EventListenerUtil.addDisposableEventListener(view, "popupclicked", () => {
                    clickInPopup = true;
                }));
            }

            return asDisposable(...disposables);
        });
    }

    private isInClickablePopup(ev: MouseEvent) {
        let el: (Node | null) = ev.target as (Node | null);
        while (el) {
            if (el instanceof PopupBase) {
                return el.clickable;
            }
            
            if (el instanceof ShadowRoot) {
                el = el.host;
            }
            else if (el instanceof Element) {
                el = el.parentNode;
            }
            else {
                el = null;
            }
        }
        return false;
    }
}

export abstract class PopupBase<TViewModel> extends ComponentBase<TViewModel> {
    constructor() {
        super();
        this.clickableUpdated();
    }

    private _clickable: boolean = true;
    get clickable(): boolean { return this._clickable; }
    set clickable(value) {
        if (value !== this._clickable) {
            this._clickable = value;
            this.clickableUpdated();
        }
    }

    private _clickableWCM: WhenChangeManager = new WhenChangeManager();
    private clickableUpdated() {
        const clickable = this.clickable;
        this._clickableWCM.assign({ clickable }, () => {
            if (clickable) {
                const disposables: IDisposable[] = [];
                disposables.push(EventListenerUtil.addDisposableEventListener(this.elMain, "click", () => {
                    this.dispatchEvent(new Event("popupclicked"));
                }));
                disposables.push(EventListenerUtil.addDisposableEventListener(this.elMain, "contextmenu", () => {
                    this.dispatchEvent(new Event("popupclicked"));
                }));
                disposables.push(EventListenerUtil.addDisposableEventListener(this.elMain, "dblclick", () => {
                    this.dispatchEvent(new Event("popupclicked"));
                }));
                return asDisposable(...disposables);
            }
        });
    }
}

export function popupViewFor<TViewModel extends PopupViewModel>(vm: ConstructorOf<TViewModel>) {
    return function(target: ConstructorOf<PopupBase<TViewModel>>) {
        PopupFrame.registerPopupType(vm, target);
    }   
}
