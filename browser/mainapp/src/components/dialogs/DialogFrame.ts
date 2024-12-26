import { asDisposable } from "../../util/Disposable";
import { EventListenerUtil } from "../../util/EventListenerUtil";
import { HTMLUtils } from "../../util/HTMLUtils";
import { KeyCodes } from "../../util/KeyCodes";
import { PromiseSource } from "../../util/PromiseSource";
import { TransitionUtils } from "../../util/TransitionUtils";
import { WhenChangeManager } from "../../util/WhenChange";
import { DialogButtonViewModel, DialogCaptionButtonViewModel, DialogViewModel } from "../../viewmodel/dialogs/DialogViewModel";
import { ComponentBase, componentArea, componentElement } from "../ComponentBase";
import { IconImage } from "../IconImage";

export interface ConstructorOf<T> {
    new (...params: any[]): T;
}

@componentArea("dialogs")
@componentElement("x-dialogframe")
export class DialogFrame extends ComponentBase<DialogViewModel<any>> {
    private static _registeredDialogTypes: Map<ConstructorOf<DialogViewModel<any>>, ConstructorOf<DialogComponentBase<DialogViewModel<any>>>> = new Map();
    static registerDialogType<TResult, TViewModel extends DialogViewModel<TResult>>(viewModelType: ConstructorOf<TViewModel>, elementClass: ConstructorOf<DialogComponentBase<TViewModel>>) {
        this._registeredDialogTypes.set(viewModelType, elementClass);
    }

    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="dialogcontents">
                <div class="titlebar" id="elTitleBar">
                    <div class="titlebar-title" id="elTitlebarTitle"></div>
                    <div class="titlebar-captionbuttons" id="elTitlebarCaptionButtons">
                        <x-collectionview2 modelpath="captionButtons">
                            <template>
                                <x-dialogcaptionbutton></x-dialogcaptionbutton>
                            </template>
                            <div slot="container" class="captionbuttonbar" id="elCaptionButtonBar"></div>
                        </x-collectionview2>
                    </div>
                    <button class="titlebar-close" id="elTitlebarClose">
                        <x-iconimage class="titlebar-close-icon" src="assets/ui/close-icon.svg"></x-iconimage>
                    </button>
                </div>
                <div class="contentarea" id="elContentArea">
                </div>
                <x-collectionview2 modelpath="buttons">
                    <template>
                        <x-dialogbutton></x-dialogbutton>
                    </template>
                    <div slot="container" class="buttonbar" id="elButtonBar"></div>
                </x-collectionview2>
            </div>
        `);

        const elTitlebarTitle = this.$("elTitlebarTitle") as HTMLDivElement;
        const elTitlebarClose = this.$("elTitlebarClose") as HTMLButtonElement;
        const elContentArea = this.$("elContentArea") as HTMLDivElement;
        const elButtonBar = this.$("elButtonBar") as HTMLDivElement;

        const frameClassWCM = new WhenChangeManager();
        this.watch(".", v => {
            if (v) {
                while (elContentArea.firstElementChild) {
                    elContentArea.firstElementChild.remove();
                }
                frameClassWCM.cleanup();

                for (let k of DialogFrame._registeredDialogTypes.keys()) {
                    if (v instanceof k) {
                        const dlgEl = new (DialogFrame._registeredDialogTypes.get(k)!)();
                        dlgEl.viewModel = v;
                        elContentArea.appendChild(dlgEl);

                        frameClassWCM.assign({ frameClass: dlgEl.dialogBorderType.frameClass }, (args) => {
                            if (args.frameClass) {
                                //this.log("FRAMECLASS", args.frameClass);
                                for (let x of args.frameClass.split(' ')) {
                                    this.elMain.classList.add(x);
                                }
                                return asDisposable(() => {
                                    for (let x of args.frameClass.split(' ')) {
                                        this.elMain.classList.remove(x);
                                    }
                                });
                            }
                        });
                    }
                }
            }
        });
        this.watch("title", v => {
            elTitlebarTitle.innerText = v != null ? v : "";
        });
        this.watch("closeBoxResult", v => {
            elTitlebarClose.classList.toggle("hidden", v === undefined);
        });
        this.watch("buttons.length", v => {
            const showButtonBar = (v != null && v > 0);
            elButtonBar.classList.toggle("hidden", !showButtonBar);
        });

        this.whenConnected(() => {
            //this.log("CONNECTED");
            const keydownListener = EventListenerUtil.addDisposableEventListener(window, "keydown", (ev: KeyboardEvent) => {
                const btn = this.getButtonForKeyboardEvent(ev);
                if (btn) {
                    btn.onClick();
                    ev.preventDefault();
                    ev.stopPropagation();
                }
            }, true);

            return asDisposable(() => {
                keydownListener.dispose();
            });
        });

        elTitlebarClose.addEventListener("click", () => {
            if (this.viewModel) {
                this.viewModel.close(this.viewModel.closeBoxResult);
            }
        });

        let clickedInDialog = false;
        this.elMain.addEventListener("click", (ev: MouseEvent) => {
            clickedInDialog = true;
            window.requestIdleCallback(() => clickedInDialog = false);
        });
        this.addEventListener("click", (ev: MouseEvent) => {
            if (!clickedInDialog) {
                if (this.viewModel && typeof (this.viewModel as any).clickedOutside == "function") {
                    (this.viewModel as any).clickedOutside();
                }
            }
        });
    }

    private getButtonForKeyboardEvent(ev: KeyboardEvent): (DialogButtonViewModel | null) {
        const vm = this.viewModel;
        if (!vm) { return null; }

        for (let tbtn of vm.buttons) {
            if (tbtn.shortcutKeyCode == ev.keyCode) {
                return tbtn;
            }
        }
        if (ev.keyCode == KeyCodes.ESCAPE && vm.closeBoxResult !== undefined) {
            vm.close(vm.closeBoxResult);
        }

        return null;
    }

    onShown() {
        const elContentArea = this.$("elContentArea");
        if (elContentArea && elContentArea.firstElementChild && (elContentArea.firstElementChild as any).onShown) {
            (elContentArea.firstElementChild as any).onShown();
        }
    }

    animateOpen() {
        //this.log("ADDING NEW CLASS");
        this.elMain.classList.add("new");
        window.requestIdleCallback(() => {
            //this.log("REMOVING NEW CLASS");
            this.elMain.classList.remove("new");
        });
    }

    animateCloseAsync() {
        const ps = new PromiseSource<void>();
        const lh = TransitionUtils.onTransitionEndOrTimeout(this.elMain, 1000, () => {
            lh.dispose();
            ps.resolve();
        });
        //this.log("ADDING CLOSED CLASS");
        this.elMain.classList.add("closed");
        return ps.promise;
    }
}

@componentArea("dialogs")
@componentElement("x-dialogbutton")
class DialogButton extends ComponentBase<DialogButtonViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <button class="dialogbutton theme-button" id="elButton">
            </button>
        `);

        const elButton = this.$("elButton") as HTMLButtonElement;

        this.watch("title", (v) => {
            elButton.innerText = v != null ? v : "";
        });
        this.watch("style", (v) => {
            if (v) {
                const className = `style-${v.toLowerCase()}`;
                elButton.classList.add(className);
                return asDisposable(() => {
                    elButton.classList.remove(className);
                });
            }
        });

        elButton.addEventListener("click", () => {
            if (this.viewModel) {
                this.viewModel.onClick();
            }
        });
    }
}

@componentArea("dialogs")
@componentElement("x-dialogcaptionbutton")
class DialogCaptionButton extends ComponentBase<DialogCaptionButtonViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <button class="dialogcaptionbutton" id="elButton">
                <x-iconimage class="dialogcaptionbutton-image" id="elIconImage"></x-iconimage>
            </button>
        `);

        const elButton = this.$("elButton") as HTMLButtonElement;
        const elIconImage = this.$("elIconImage") as IconImage;

        this.watch("imageUrl", (v) => {
            elIconImage.src = v != null ? v : null;
        });

        elButton.addEventListener("click", () => {
            if (this.viewModel) {
                this.viewModel.onClick();
            }
        });
    }
}

export abstract class DialogComponentBase<TViewModel> extends ComponentBase<TViewModel> {
    constructor() {
        super();
    }

     get dialogBorderType(): DialogBorderType { return DialogBorderType.NORMAL; }

     onShown() { }
}

export class DialogBorderType {
    static readonly NORMAL: DialogBorderType = new DialogBorderType("frame-normal");
    static readonly FULLPAGENOENTRYANIM: DialogBorderType = new DialogBorderType("frame-fullpage frame-fullpage-noentryanim");
    static readonly FULLPAGE: DialogBorderType = new DialogBorderType("frame-fullpage");
    static readonly FULLPAGEWITHTITLEBAR: DialogBorderType = new DialogBorderType("frame-fullpage frame-fullpagewithtitlebar");
    static readonly RIGHTPANE: DialogBorderType = new DialogBorderType("frame-rightpane");

    private constructor(
        public readonly frameClass: string) {
    }
}

export function dialogViewFor<TViewModel extends DialogViewModel<any>>(vm: ConstructorOf<TViewModel>) {
    return function(target: ConstructorOf<DialogComponentBase<TViewModel>>) {
        DialogFrame.registerDialogType(vm, target);
    }
}