import { CharacterName } from "../shared/CharacterName.js";
import { IDisposable } from "../util/Disposable.js";
import { FocusMagnet } from "../util/FocusMagnet.js";
import { HTMLUtils } from "../util/HTMLUtils.js";
import { HostInterop } from "../util/HostInterop.js";
import { TransitionUtils } from "../util/TransitionUtils.js";
import { AppViewModel } from "../viewmodel/AppViewModel.js";
import { DialogViewModel } from "../viewmodel/dialogs/DialogViewModel.js";
import { CharacterDetailPopupViewModel } from "../viewmodel/popups/CharacterDetailPopupViewModel.js";
import { CollectionView2 } from "./CollectionView2.js";
import { CollectionViewLightweight } from "./CollectionViewLightweight.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";
import { TitleBar } from "./TitleBar.js";
import { DialogFrame } from "./dialogs/DialogFrame.js";
import { CharacterDetailPopup } from "./popups/CharacterDetailPopup.js";
import { PopupFrame } from "./popups/PopupFrame.js";

@componentElement("x-maininterface")
export class MainInterface extends ComponentBase<AppViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <x-titlebar class="titlebar" id="elTitleBar"></x-titlebar>
            <div class="clientarea" id="elClientArea">
                <div class="chatui not-loaded" id="elChatUi">
                    <x-leftbar slot="a" class="leftbar" id="elLeftBar"></x-leftbar>
                    <x-splitterhandle class="splitterhandle" target="elLeftBar" orientation="horizontal" min="200" max="500" modelpath="leftBarWidth"></x-splitterhandle>
                    <x-stage slot="b" class="stage" id="elStage" modelpath="currentlySelectedSession"></x-stage>
                </div>
                <x-collectionview2 modelpath="popups" id="elPopupCollectionView">
                    <template>
                        <x-popupframe></x-popupframe>
                    </template>
                    <div slot="container" class="popupframe" id="elPopupFrame"></div>
                </x-collectionview2>

                <x-dialogstackcollectionview modelpath="dialogs" id="elDialogCollectionView">
                    <div class="dialogstack" id="elDialogStack"></div>
                </x-dialogstackcollectionview>
            </div>
        `);
        customElements.upgrade(this.elMain);

        const elTitleBar = this.$("elTitleBar") as TitleBar;
        const elChatUi = this.$("elChatUi") as HTMLDivElement;
        const elDialogCollectionView = this.$("elDialogCollectionView") as DialogStackCollectionView;
        const elPopupFrame = this.$("elPopupFrame") as HTMLDivElement;

        // elDialogCollectionView.oncreateelementcontent = (cel, vm) => {
        //     const elDf = new DialogFrame();
        //     elDf.classList.add("dialogframe");
        //     cel.appendChild(elDf);
        // };
        // elDialogCollectionView.oncreatedelement = (cel, vm) => {
        //     const el = cel.firstElementChild as HTMLElement;
        //     //this.log("createdelement", el);
        //     if (el instanceof DialogFrame) {
        //         //this.log("doing DF animate in");
        //         el.viewModel = vm;
        //         el.animateOpen();
        //     }
        //     else {
        //         //this.log("doing default animate in");
        //         el.classList.add("new");
        //         window.requestIdleCallback(() => {
        //             el.classList.remove("new");
        //         });
        //     }
        //     this.updateDialogsState();
        // };
        // elDialogCollectionView.ontearingdownelement = (cel, vm) => {
        //     const el = cel.firstElementChild as HTMLElement;
        //     if (el instanceof DialogFrame) {
        //         return new Promise<void>(async (resolve) => {
        //             try {
        //                 await el.animateCloseAsync();
        //                 this.updateDialogsState();
        //             }
        //             finally {
        //                 resolve();
        //             }
        //         });
        //     }
        //     else {
        //         return new Promise<void>((resolve) => {
        //             TransitionUtils.onTransitionEndOrTimeout(el, 1000, () => {
        //                 this.updateDialogsState();
        //                 resolve();
        //             });
        //             el.classList.add("closed");
        //         });
        //     }
        // };

        elDialogCollectionView.addEventListener("delayedremovecomplete", (e: Event) => {
            this.updateDialogsState();
        });

        const updateChatUiVisibility = () => {
            const vm = this.viewModel;
            let initialized;
            if (vm) {
                initialized = !!(this.viewModel?.initialized ?? false) && (vm.logins.length > 0);
            }
            else {
                initialized = false;
            }
            elChatUi.classList.toggle("not-loaded", !initialized);
        };
        this.watchExpr(vm => vm.initialized, initialized => {
            updateChatUiVisibility();
        });
        this.watch("logins.length", v => {
            updateChatUiVisibility();
        })

        window.addEventListener("focus", () => {
            this._windowFocused = true;
            this.updateWindowState();
        });
        window.addEventListener("blur", () => {
            this._windowFocused = false;
            this.updateWindowState();
        });

        window.addEventListener("wheel", (e) => {
            if (e.ctrlKey) {
                if (this.viewModel) {
                    if (e.deltaY > 0) {
                        this.viewModel.interfaceZoom = Math.max(0.5, this.viewModel.interfaceZoom - 0.02);
                    }
                    else {
                        this.viewModel.interfaceZoom = Math.min(3.0, this.viewModel.interfaceZoom + 0.02);
                    }
                }
                e.preventDefault();
            }
        }, { passive: false });
        this.watchExpr(vm => vm.interfaceZoom, izoom => {
            if (izoom != null) {
                //document.documentElement.style.zoom = izoom.toString();
                //this.elMain.style.setProperty("--ui-zoom-level", izoom.toString());
                //this.elMain.style.zoom = izoom.toString();
                HostInterop.setZoomLevel(izoom);
            }
        });

        this.watch("showTitlebar", v => {
            if (!!v) {
                elTitleBar.classList.remove("hidden");
            }
            else {
                elTitleBar.classList.add("hidden");
            }
        });
        this.watch("dialogs.length", v => {
            this.updateDialogsState();
        });
        this.watch("popups.length", v => {
            this.updatePopupsState();
        });

        // this.watch("popup", v => {
        //     while (elPopupFrame.firstElementChild) {
        //         elPopupFrame.firstElementChild.remove();
        //     }
        //     if (v) {
        //         //debugger;
        //         const pf = new PopupFrame();
        //         pf.viewModel = v;
        //         elPopupFrame.appendChild(pf);
        //     }
        // });

        this.whenConnected(() => {
            this.updateWindowState();
        });

    }

    private _focusMagnet: FocusMagnet = FocusMagnet.instance;
    private setFocusMagnetScope() {
        if (this.viewModel) {
            const vm = this.viewModel;
            if (this.viewModel.dialogs.length == 0) {
                this._focusMagnet.setScope(this.$("elChatUi"));
            }
            else {
                const elDialogStack = this.$("elDialogStack");
                const lastDialog = elDialogStack?.lastElementChild as (HTMLElement | null);
                this._focusMagnet.setScope(lastDialog ?? this.$("elChatUi"));
            }
        }
        else {
            this._focusMagnet.setScope(null);
        }
    }

    updatePopupsState() {
        const hasPopups = ((this.viewModel?.popups.length ?? 0) > 0);
        this.elMain.classList.toggle("has-popups", hasPopups);
    }

    updateDialogsState() {
        const elDialogCollectionView = this.$("elDialogCollectionView") as CollectionView2<DialogViewModel<any>>;
        const elChatUi = this.$("elChatUi") as HTMLDivElement;

        const elDialogStack = this.$("elDialogStack") as HTMLDivElement;

        let anyDialogsCount = elDialogStack.children.length;
        let unclosedDialogsCount = 0;

        let lastDialog: DialogViewModel<any> | null = null;
        if (this.viewModel) {
            const inactiveDialogs: Set<DialogViewModel<any>> = new Set();
            for (let d of this.viewModel.dialogs) {
                if (!d.closed) {
                    lastDialog = d;
                    inactiveDialogs.add(d);
                    unclosedDialogsCount++;
                }
            }
            if (lastDialog) {
                inactiveDialogs.delete(lastDialog);
            }
            for (let d of this.viewModel.dialogs) {
                const el = elDialogCollectionView.getElementForViewModel(d)!;
                if (d.closed) {
                    el.inert = true;
                }
                else {
                    if (inactiveDialogs.has(d)) {
                        el.inert = true;
                        elDialogCollectionView.getElementForViewModel(d)?.classList.add("inactive");
                    }
                    else {
                        el.inert = false;
                        elDialogCollectionView.getElementForViewModel(d)?.classList.remove("inactive");
                    }
                }
            }
        }
        
        this.logger.logDebug(`anyDialogsCount=${anyDialogsCount}  unclosedDialogsCount=${unclosedDialogsCount}`);
        const hasDialogs = (anyDialogsCount > 0);
        this.elMain.classList.toggle("has-dialogs", hasDialogs);

        const hasUnclosedDialogs = (unclosedDialogsCount > 0);
        this.elMain.classList.toggle("has-unclosed-dialogs", hasUnclosedDialogs);
        this.elMain.classList.toggle("nogpu", this.viewModel?.noGpuMode ?? false);
        elChatUi.inert = hasUnclosedDialogs;
        if (lastDialog) {
            const el = elDialogCollectionView.getElementForViewModel(lastDialog);
            if (el && typeof (el as DialogFrame).setActiveDialog == "function") {
                (el as DialogFrame).setActiveDialog();
            }
        }
    }

    private _windowFocused: boolean = true;

    private updateWindowState() {
        const vm = this.viewModel;
        if (vm) {
            vm.isWindowActive = this._windowFocused;
        }
        this.setFocusMagnetScope();
    }
}

@componentElement("x-dialogstackcollectionview")
class DialogStackCollectionView extends CollectionViewLightweight<DialogViewModel<any>> {
    mainInterface: MainInterface | null = null;

    createUserElement(vm: DialogViewModel<any>): HTMLElement | [HTMLElement, IDisposable] {
        const el = new DialogFrame();
        el.classList.add("dialogframe");
        el.viewModel = vm;
        el.animateOpen();
        if (this.mainInterface) {
            this.mainInterface.updateDialogsState();
        }
        window.requestAnimationFrame(() => {
            el.onShown();
        });
        return el;
    }

    destroyUserElement(vm: DialogViewModel<any>, el: HTMLElement): Promise<void> {
        const dlgEl = el as DialogFrame;

        return new Promise<void>(async (resolve) => {
            try {
                if (this.mainInterface) {
                    this.mainInterface.updateDialogsState();
                }
                await dlgEl.animateCloseAsync();
                if (this.mainInterface) {
                    this.mainInterface.updateDialogsState();
                }
            }
            finally {
                resolve();
            }
        });
    }
}