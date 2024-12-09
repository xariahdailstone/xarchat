import { ComponentBase, componentElement } from "./ComponentBase.js";

@componentElement("x-spantext")
export class SpanText extends ComponentBase<any> {

    static get observedAttributes() { return [...super.observedAttributes, "nulltext" ]};

    constructor() {
        super();
    }

    get nulltext() {
        if (this.hasAttribute("nulltext")) {
            return this.getAttribute("nulltext")!;
        }
        else {
            return null;
        }
    }

    set nulltext(value: (string | null)) {
        if (value !== this.nulltext) {
            if (value !== null) {
                this.setAttribute("nulltext", value);
            }
            else {
                this.removeAttribute("nulltext");
            }
            this.updateDisplay();
        }
    }

    protected override viewModelChanged(): void {
        this.updateDisplay();
    }

    protected override attributeChangedCallback(name: string, oldValue?: string | undefined, newValue?: string | undefined): void {
        if (name == "nulltext") {
            this.updateDisplay();
        }
        else {
            super.attributeChangedCallback(name, oldValue, newValue);
        }
    }

    private updateDisplay() {
        const vm = this.viewModel;
        let txt: string;
        if (vm != null) {
            txt = vm.toString();
        }
        else {
            const nulltext = this.nulltext;
            if (nulltext != null) {
                txt = nulltext;
            }
            else {
                txt = "";
            }
        }

        this.elMain.innerText = txt;
    }
}
