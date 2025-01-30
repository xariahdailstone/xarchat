import { HTMLUtils } from "../util/HTMLUtils";
import { ObservableValue } from "../util/Observable";
import { ComponentBase, componentElement } from "./ComponentBase";

@componentElement("x-themetoggle")
export class ThemeToggle extends ComponentBase<boolean> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <label class="cb-container" for="elCheckbox" id="elCheckboxContainer">
                <input type="checkbox" id="elCheckbox" class="cb" />
                <div class="cb-dot"></div>
            </label>
        `);

        const elCheckboxContainer = this.$("elCheckboxContainer") as HTMLLabelElement;
        const elCheckbox = this.$("elCheckbox") as HTMLInputElement;

        elCheckboxContainer.addEventListener("click", (e) => {
            this.value = !this.value;
            e.preventDefault();
            return false;
        });
        elCheckbox.addEventListener("change", (e) => {
            this.value = elCheckbox.checked;
            e.preventDefault();
            return false;
        });

        this.watchExpr(() => this.value, (ev) => {
            ev = !!ev;
            elCheckboxContainer.classList.toggle("is-checked", ev);
            elCheckbox.checked = ev;
        });
    }

    readonly _unboundValue: ObservableValue<boolean> = new ObservableValue<boolean>(false);

    get value() {
        return !!(this._unboundValue.value);
    }
    set value(value: boolean) {
        if (value != this._unboundValue.value) {
            this._unboundValue.value = value;
            //this.dispatchEvent(new Event("change"));
        }
    }
}