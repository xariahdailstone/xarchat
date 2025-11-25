import { CallbackSet } from "../util/CallbackSet";
import { IDisposable } from "../util/Disposable";
import { HTMLUtils } from "../util/HTMLUtils";
import { KeyCodes } from "../util/KeyCodes";
import { Scheduler } from "../util/Scheduler";
import { ShadowRootsManager } from "../util/ShadowRootsManager";
import { StringUtils } from "../util/StringUtils";
import { setStylesheetAdoption } from "../util/StyleSheetPolyfill";
import { AppViewModel } from "../viewmodel/AppViewModel";
import { ContextMenuPopupViewModel } from "../viewmodel/popups/ContextMenuPopupViewModel";
import { componentElement, StyleLoader } from "./ComponentBase";
import { IconImage } from "./IconImage";

const commonStylesheetTask = StyleLoader.loadAsync("styles/common.css");
const selectStylesheetTask = StyleLoader.loadAsync("styles/components/XCSelect.css");

@componentElement("x-xcselect")
export class XCSelectElement extends HTMLElement {
    constructor() {
        super();
        this._sroot = ShadowRootsManager.elementAttachShadow(this, { mode: 'closed', delegatesFocus: true });
        HTMLUtils.assignStaticHTMLFragment(this._sroot, `
            <div class="container" id="elContainer">
                <div class="title" id="elTitle"><slot name="selected"></slot></div>
                <div class="title-invis" id="elTitleInvis"><slot></slot></div>
                <div class="icon" id="elIcon"><x-iconimage src="assets/ui/dropdown-arrow.svg" id="elIconInner" tabindex="-1"></x-iconimage></div>
                <input type="text" class="focus-btn" id="elFocusBtn" />
            </div>
        `);
        this.elContainer = this._sroot.getElementById("elContainer") as HTMLDivElement;
        this.elIcon = this._sroot.getElementById("elIcon") as HTMLDivElement;
        this.elIconInner = this._sroot.getElementById("elIconInner") as IconImage;
        this.elFocusBtn = this._sroot.getElementById("elFocusBtn") as HTMLInputElement;

        selectStylesheetTask.then(sss => {
            commonStylesheetTask.then(css => {
                setStylesheetAdoption(this._sroot, [ css, sss ]);
            });
        });

        this.options.forEach(option => {
            this.handleAddedOptionChild(option);
        });

        this.addEventListener("focus", () => {
            console.log("x-xcselect focus");
        });
        this.addEventListener("blur", () => {
            console.log("x-xcselect blur");
        });

        this.elIconInner.addEventListener("focus", () => {
            console.log("elIconInner focus");
        });
        this.elIconInner.addEventListener("blur", () => {
            console.log("elIconInner blur");
        });

        this.elContainer.addEventListener("click", () => {
            this.elFocusBtn.focus();
            this.toggleDropdown();
        });
        this.elFocusBtn.addEventListener("focus", () => {
            console.log("elFocusBtn focus");
        });
        this.elFocusBtn.addEventListener("blur", () => {
            console.log("elFocusBtn blur");
            this.toggleDropdown(false, false);
        });
        this.elFocusBtn.addEventListener("keydown", (e) => {
            if (e.keyCode != KeyCodes.TAB) {
                this.handleKeypress(e.keyCode, e.key);
                e.preventDefault();
            }
        });
    }

    private handleKeypress(keyCode: number, key: string) {
        switch (keyCode) {
            case KeyCodes.UP_ARROW:
                {
                    if (this.selectedIndex > 0) {
                        this.withRaisingValueChangeEvent(() => {
                            this.selectedIndex--;
                        });
                    }
                }
                break;
            case KeyCodes.DOWN_ARROW:
                {
                    if (this.selectedIndex < this.options.length - 1) {
                        this.withRaisingValueChangeEvent(() => {
                            this.selectedIndex++;
                        });
                    }
                }
                break;
            case KeyCodes.SPACE:
                this.toggleDropdown(true);
                break;
            case KeyCodes.RETURN:
                this.toggleDropdown(false, true);
                break;
            default:
                {
                    if (key.length == 1) {
                        this.addTypeFindCharacter(key);
                    }
                }
                break;
        }
    }

    private _typeFindValue: string = "";
    private _typeFindClearEvent: IDisposable | null = null;

    private addTypeFindCharacter(key: string) {
        this._typeFindValue += key.toLowerCase();

        if (this._typeFindClearEvent) {
            this._typeFindClearEvent.dispose();
            this._typeFindClearEvent = null;
        }
        this._typeFindClearEvent = Scheduler.scheduleNamedCallback("XCSelect typefind clear", 2000, () => {
            this._typeFindClearEvent = null;
            this._typeFindValue = "";
        });

        for (let opt of this.options.values()) {
            if (opt.displayValue) {
                if (opt.displayValue.toLowerCase().startsWith(this._typeFindValue)) {
                    this.withRaisingValueChangeEvent(() => {
                        this.value = opt.effectiveValue!;
                    });
                    break;
                }
            }
        }
    }

    private _raiseValueChangeCount: number = 0;
    private withRaisingValueChangeEvent<T>(callback: () => T): T {
        this._raiseValueChangeCount++;
        try {
            const result = callback();
            return result;
        }
        finally {
            this._raiseValueChangeCount--;
        }
    }

    private _dropdownShowing: ContextMenuPopupViewModel<string> | null = null;
    private toggleDropdown(forceState?: boolean, commitSelection?: boolean) {
        if (forceState === undefined) {
            forceState = !this._dropdownShowing;
        }
        
        if (forceState) {
            if (!this._dropdownShowing) {
                const appViewModel: AppViewModel = (window as any)["__vm"];
                const ddvm = new ContextMenuPopupViewModel<string>(appViewModel, this);
                this.options.forEach(opt => {
                    const mi = ddvm.addMenuItem(opt.displayValue, opt.effectiveValue ?? "", opt.effectiveValue != null);
                    if (this.value == opt.effectiveValue) {
                        ddvm.highlightedItem = mi;
                    }
                });
                ddvm.onValueSelected = (v) => {
                    if (this._dropdownShowing == ddvm) {
                        this.withRaisingValueChangeEvent(() => {
                            this.value = v;
                        });
                        ddvm.dismissed();
                    }
                };

                this._dropdownShowing = ddvm;
                appViewModel.popups.add(ddvm);

                (async () => {
                    await ddvm.waitForDismissalAsync();
                    if (this._dropdownShowing == ddvm) {
                        this._dropdownShowing = null;
                    }
                })();
                
            }
        }
        else {
            if (this._dropdownShowing) {
                if (commitSelection && this._dropdownShowing.highlightedItem) {
                    this.withRaisingValueChangeEvent(() => {
                        this.value = this._dropdownShowing!.highlightedItem!.value;
                    });
                }
                this._dropdownShowing.dismissed();
            }
        }
    }

    private _sroot: ShadowRoot;

    private readonly elContainer: HTMLDivElement;
    private readonly elIcon: HTMLDivElement;
    private readonly elIconInner: IconImage;
    private readonly elFocusBtn: HTMLInputElement;

    private _mutatingValue: boolean = false;

    private _selectedOption: (XCOptionElement | null) = null;

    get value(): (string) {
        return this._selectedOption?.effectiveValue ?? "";
    }
    set value(v: (string)) {
        if (this._mutatingValue) { return; }

        this._mutatingValue = true;
        try {
            if (v != this.value) {
                let newSelectedOption: XCOptionElement | null = null;
                if (v == null) {
                    newSelectedOption = null;
                }
                else {
                    const option = this.options.getByValue(v);
                    if (option) {
                        newSelectedOption = option;
                    }
                    else {
                        newSelectedOption = null;
                    }
                }

                if (newSelectedOption != this._selectedOption) {
                    if (this._selectedOption) {
                        this._selectedOption.selected = false;
                    }
                    this._selectedOption = newSelectedOption;
                    if (this._selectedOption) {
                        this._selectedOption.selected = true;
                    }

                    if (this._raiseValueChangeCount > 0) {
                        try { this.dispatchEvent(new Event("input")); } catch { }
                        try { this.dispatchEvent(new Event("change")); } catch { }
                    }
                }
            }
        }
        finally {
            this._mutatingValue = false;
            this.fixupDropdownHighlight();
        }
    }

    private fixupDropdownHighlight() {
        if (this._dropdownShowing) {
            const value = this.value;
            const ddvm = this._dropdownShowing;
            for (let mi of ddvm.items.iterateValues()) {
                if (mi.value == value) {
                    ddvm.highlightedItem = mi;
                    break;
                }
            }
        }
    }

    private readonly _options = new XCOptionElementCollectionImpl(this);
    get options(): XCOptionElementCollection { return this._options; }

    get selectedOption(): XCOptionElement | null { return this._selectedOption; }

    get selectedIndex(): number {
        const selectedOption = this.selectedOption;
        if (selectedOption) {
            const idx = this.options.indexOf(selectedOption);
            return idx;
        }
        else {
            return -1;
        }
    }
    set selectedIndex(v: number) {
        if (v == -1) {
            this.value = "";
        }
        else {
            this.value = this.options.item(v)?.effectiveValue ?? "";
        }
    }

    private _mo: MutationObserver | null = null;

    private handleAddedOptionChild(n: XCOptionElement) {
        n.parent = this;
        if (n.selected) {
            this.value = n.effectiveValue ?? "";
        }
    }

    private _connectDisconnectCallbackSet: CallbackSet<() => void> = new CallbackSet(this.constructor.name);
    addConnectDisconnectHandler(callback: () => void): IDisposable {
        return this._connectDisconnectCallbackSet.add(callback);
    }
    removeConnectDisconnectHandler(callback: () => void): void {
        this._connectDisconnectCallbackSet.delete(callback);
    }   
        
    private connectedCallback() {
        this._mo = new MutationObserver(entries => {
            for (let entry of entries) {
                entry.removedNodes.forEach(n => {
                    if (n instanceof XCOptionElement) {
                        n.parent = null;
                    }
                });
                entry.addedNodes.forEach(n => {
                    if (n instanceof XCOptionElement) {
                        this.handleAddedOptionChild(n);
                    }
                });
            }
        });
        this._mo.observe(this, { childList: true });

        this.options.forEach(option => {
            this.handleAddedOptionChild(option);
        });

        this._connectDisconnectCallbackSet.invoke();
    }

    private disconnectedCallback() {
        if (this._mo) {
            this._mo.disconnect();
            this._mo =null;
        }
        this.toggleDropdown(false, false);

        this._connectDisconnectCallbackSet.invoke();
    }

    childSetSelected(option: XCOptionElement) {
        if (!this._mutatingValue) {
            this.value = option.effectiveValue ?? "";
        }
    }
    childRemovedSelected(option: XCOptionElement) {
        if (!this._mutatingValue) {
            this.value = "";
        }
    }
}

export interface XCOptionElementCollection {
    length: number;
    item(index: number): XCOptionElement | undefined;
    getByValue(value: string): XCOptionElement | undefined;

    indexOf(option: XCOptionElement): number;
    add(option: XCOptionElement): XCOptionElement;
    addAt(option: XCOptionElement, index: number): XCOptionElement;
    remove(option: XCOptionElement): boolean;
    removeAt(index: number): boolean;

    forEach(callback: (option: XCOptionElement) => void): void;

    values(): Iterable<XCOptionElement>;
}

class XCOptionElementCollectionImpl implements XCOptionElementCollection {
    constructor(private readonly selectElement: XCSelectElement) {
    }

    get length(): number {
        let result = 0;

        const children = this.selectElement.children;
        for (let i = 0; i < children.length; i++) {
            const tchild = children.item(i);
            if (tchild instanceof XCOptionElement) {
                result++;
            }
        }

        return result;
    }

    item(index: number): XCOptionElement | undefined {
        let seenCount = 0;

        const children = this.selectElement.children;
        for (let i = 0; i < children.length; i++) {
            const tchild = children.item(i);
            if (tchild instanceof XCOptionElement) {
                if (seenCount == index) {
                    return tchild;
                }
                seenCount++;
            }
        }

        return undefined;
    }

    getByValue(value: string): XCOptionElement | undefined {
        const children = this.selectElement.children;
        for (let i = 0; i < children.length; i++) {
            const tchild = children.item(i);
            if (tchild instanceof XCOptionElement) {
                if (tchild.effectiveValue == value) {
                    return tchild;
                }
            }
        }
        return undefined;
    }

    indexOf(option: XCOptionElement): number {
        let seenCount = 0;

        const children = this.selectElement.children;
        for (let i = 0; i < children.length; i++) {
            const tchild = children.item(i);
            if (tchild instanceof XCOptionElement) {
                if (tchild == option) {
                    return seenCount;
                }
                seenCount++;
            }
        }

        return -1;
    }

    add(option: XCOptionElement): XCOptionElement {
        this.selectElement.appendChild(option);
        return option;
    }

    addAt(option: XCOptionElement, index: number): XCOptionElement {
        let seenCount = 0;

        const children = this.selectElement.children;
        for (let i = 0; i < children.length; i++) {
            const tchild = children.item(i);
            if (tchild instanceof XCOptionElement) {
                if (seenCount == index) {
                    this.selectElement.insertBefore(option, tchild);
                    return option;
                }
                seenCount++;
            }
        }

        this.selectElement.appendChild(option);
        return option;
    }

    remove(option: XCOptionElement): boolean {
        const idx = this.indexOf(option);
        if (idx != -1) {
            this.selectElement.removeChild(option);
            return true;
        }
        else {
            return false;
        }
    }

    removeAt(index: number): boolean {
        let seenCount = 0;

        const children = this.selectElement.children;
        for (let i = 0; i < children.length; i++) {
            const tchild = children.item(i);
            if (tchild instanceof XCOptionElement) {
                if (seenCount == index) {
                    this.selectElement.removeChild(tchild);
                    return true;
                }
                seenCount++;
            }
        }

        return false;
    }

    forEach(callback: (option: XCOptionElement) => void): void {
        const children = this.selectElement.children;
        for (let i = 0; i < children.length; i++) {
            const tchild = children.item(i);
            if (tchild instanceof XCOptionElement) {
                try { callback(tchild); }
                catch { }
            }
        }
    }

    *values(): Iterable<XCOptionElement> {
        const children = this.selectElement.children;
        for (let i = 0; i < children.length; i++) {
            const tchild = children.item(i);
            if (tchild instanceof XCOptionElement) {
                yield tchild;
            }
        }
    }
}

@componentElement("x-xcoption")
export class XCOptionElement extends HTMLElement {
    static get observedAttributes() { return [ "value", "selected" ] };

    constructor() {
        super();
    }

    private attributeChangedCallback(attrName: string, oldValue: string | null, newValue: string | null) {
        if (attrName == "value") {
            this.value = newValue;
        }
        else if (attrName == "selected") {
            this.selected = newValue != null;
        }
    }

    parent: XCSelectElement | null = null;

    private _value: (string | null) = null;
    private _selected: boolean = false;

    get selected(): boolean { return this._selected; }
    set selected(v: boolean) {
        if (v != this._selected) {
            this._selected = v;
            if (v) {
                if (this.parent) {
                    this.parent.childSetSelected(this);
                }
                this.setAttribute("selected", "");
                this.setAttribute("slot", "selected");
            }
            else {
                this.removeAttribute("selected");
                this.removeAttribute("slot");
                if (this.parent) {
                    this.parent.childRemovedSelected(this);
                }
            }
        }
    }

    get value(): (string | null) {
        return this._value ?? null;
    }
    set value(v: string | null)  {
        if (v != this._value) {
            this._value = v;
            if (v != null) {
                this.setAttribute("value", v);
            }
            else {
                this.removeAttribute("value");
            }
        }
    }

    get effectiveValue(): (string | null) {
        const v = this.value;
        if (v) { return v; }
        const i = this.innerHTML;
        return i;
    }

    get displayValue(): string {
        return this.innerHTML;
    }
}