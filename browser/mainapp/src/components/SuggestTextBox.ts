import { asDisposable, ConvertibleToDisposable, IDisposable } from "../util/Disposable";
import { EventListenerUtil } from "../util/EventListenerUtil";
import { HTMLUtils } from "../util/HTMLUtils";
import { KeyCodes } from "../util/KeyCodes";
import { ObservableValue } from "../util/Observable";
import { ObservableExpression } from "../util/ObservableExpression";
import { SuggestTextBoxPopupViewModel } from "../viewmodel/popups/SuggestTextBoxPopupViewModel";
import { SuggestionItem, SuggestTextBoxViewModel } from "../viewmodel/SuggestTextBoxViewModel";
import { ComponentBase, componentElement } from "./ComponentBase";

(window as any)["__suggesttextbox_keepopen"] = false;

@componentElement("x-suggesttextbox")
export class SuggestTextBox extends ComponentBase<SuggestTextBoxViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `<input type="text" id="elText" />`);

        const elText = this.$("elText") as HTMLInputElement;
        this.elText = elText;

        this.whenConnected(() => {
            const syncClasses = () => {
                const kl = this.getAttribute("class");
                if (kl) {
                    elText.setAttribute("class", kl);
                }
                else {
                    elText.removeAttribute("class");
                }
            };

            const mutObs = new MutationObserver(entries => {
                syncClasses();
            });
            mutObs.observe(this, { attributes: true });
            syncClasses();
    
            return asDisposable(() => {
                mutObs.disconnect();
                elText.removeAttribute("class");
            });
        });

        this.watchExpr(vm => vm.value, value => {
            const v = value ?? "";
            elText.value = v;
        });

        this.watchExpr(vm => [vm, vm.currentSuggestions], cs => {
            if (cs) {
                this.onSuggestionsChanged(cs[0], cs[1]);
            }
            else {
                this.closeSuggestionPopup();
            }
        });

        elText.addEventListener("change", () => {
            this._popupSavedText = null;
            this.valueChanged("elText change event");
            //this.dispatchEvent(new Event("change"));
        });
        elText.addEventListener("input", () => {
            this.valueChanged("elText input event");
            //this.dispatchEvent(new Event("input"));
        });

        elText.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.keyCode == KeyCodes.DOWN_ARROW) {
                this.navigatePopupDown();
                e.preventDefault();
                e.stopPropagation();
            }
            else if (e.keyCode == KeyCodes.UP_ARROW) {
                this.navigatePopupUp();
                e.preventDefault();
                e.stopPropagation();
            }
            else if (e.keyCode == KeyCodes.ESCAPE) {
                if (this._currentSuggestionPopup) {
                    this.closeSuggestionPopup();
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
            else if (e.keyCode == KeyCodes.RETURN) {
                if (this._currentSuggestionPopup && this._currentSuggestionPopup.selectedIndex > -1) {
                    this._currentSuggestionPopup.selectCurrentItem(true);
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
            else if (e.keyCode == KeyCodes.TAB) {
                if (this._currentSuggestionPopup && this._currentSuggestionPopup.selectedIndex > -1) {
                    this._currentSuggestionPopup.selectCurrentItem(false);
                }
            }
        });
        elText.addEventListener("focus", (e) => {
            this._popupSavedText = null;
            this.logger.logInfo("elText focus");
            if (this.viewModel) {
                this.viewModel.suggestionsEnabled = true;
            }
        });
        elText.addEventListener("blur", (e) => {
            if (!(window as any)["__suggesttextbox_keepopen"]) {
                this.logger.logInfo("elText blur");
                if (this.viewModel) {
                    this.viewModel.suggestionsEnabled = false;
                }
                this._popupSavedText = null;
                if (this._currentSuggestionPopup) {
                    if (this._currentSuggestionPopup.selectedIndex > -1) {
                        this._currentSuggestionPopup.selectCurrentItem(false);
                    }
                    else {
                        this._popupSavedText = null;
                        this.closeSuggestionPopup();
                    }
                }
                // window.requestIdleCallback(() => {
                //     if (this._currentSuggestionPopup) {
                //         this._popupSavedText = null;
                //         this.closeSuggestionPopup();
                //     }
                // });
            }
        });
    }

    focus() {
        super.focus();
        this.elText.focus();
    }

    private valueChanged(reason: string, noSuggest?: boolean) {
        const v = this.elText.value;
        if (this.viewModel && this.viewModel.value != v) {
            this.logger.logInfo("valueChanged", reason, noSuggest, v);
            if (noSuggest == true) {
                this.viewModel.assignValueNoSuggest(v);
            }
            else {
                this.viewModel.value = v;
            }
            this.dispatchEvent(new Event("change"));
        }
    }

    private readonly elText: HTMLInputElement;

    private _currentSuggestionPopup: SuggestTextBoxPopupViewModel | null = null;

    private closeSuggestionPopup() {
        if (this._currentSuggestionPopup) {
            this._currentSuggestionPopup.dismissed();
            this.logger.logInfo("closing suggestion popup");
            this._currentSuggestionPopup = null;

            if (this._popupSavedText != null) {
                this.elText.value = this._popupSavedText;
                this._popupSavedText = null;
            }
        }
    }

    private onSuggestionsChanged(vm: SuggestTextBoxViewModel, value: SuggestionItem[] | null) {
        this.closeSuggestionPopup();
        if (value && value.length > 0) {
            this.logger.logInfo("showing suggestion popup", vm.currentSuggestions);
            const popupvm = new SuggestTextBoxPopupViewModel(vm.appViewModel, this, this, vm.currentSuggestions ?? []);
            this._currentSuggestionPopup = popupvm;
            vm.appViewModel.popups.push(popupvm);
        }
    }

    selectItem(item: string, assignFocus: boolean) {
        this.logger.logInfo("selectItem", item);
        this._popupSavedText = null;
        this.elText.value = item;
        this.elText.setSelectionRange(0, item.length);
        this.closeSuggestionPopup();
        if (assignFocus) {
            this.elText.focus();
        }
        this.valueChanged("selectItem", true);
        this.dispatchEvent(new Event("change"));
    }

    private _popupSavedText: string | null = null;

    private navigatePopupDown() {
        if (this._currentSuggestionPopup) {
            let wasNoSelection = false;
            if (this._currentSuggestionPopup.selectedIndex == -1) {
                wasNoSelection = true;
            }

            this._currentSuggestionPopup.moveSelectionDown();

            if (wasNoSelection && this._currentSuggestionPopup.selectedIndex > -1) {
                this._popupSavedText = this.elText.value;
            }
            if (this._currentSuggestionPopup.selectedIndex > -1) {
                this.updateValueToMatchPopupSelection();
            }
        }
    }

    private navigatePopupUp() {
        if (this._currentSuggestionPopup) {
            this._currentSuggestionPopup.moveSelectionUp();

            if (this._currentSuggestionPopup.selectedIndex > -1) {
                this.updateValueToMatchPopupSelection();
            }
            else if (this._currentSuggestionPopup.selectedIndex == -1 && this._popupSavedText != null) {
                this.elText.value = this._popupSavedText;
                this._popupSavedText = null;
            }
        }
    }

    private updateValueToMatchPopupSelection() {
        if (this._currentSuggestionPopup && this._currentSuggestionPopup.selectedIndex >= 0) {
            const selectedValue = this._currentSuggestionPopup.items[this._currentSuggestionPopup.selectedIndex];
            if (typeof selectedValue == "string") {
                const savedText = this._popupSavedText ?? "";
                if (selectedValue.toLowerCase().startsWith(savedText.toLowerCase())) {
                    const svalue = selectedValue.substring(0, savedText.length);
                    const avalue = selectedValue.substring(savedText.length);
                    this.elText.value = selectedValue;
                    this.elText.setSelectionRange(svalue.length, selectedValue.length);
                }
            }
        }
    }
}