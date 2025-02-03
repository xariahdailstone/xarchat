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
            this.assignValue(!this.value, true);
            e.preventDefault();
            return false;
        });
        elCheckbox.addEventListener("change", (e) => {
            this.assignValue(!this.value, true);
            e.preventDefault();
            return false;
        });
    }

    readonly _unboundValue: ObservableValue<boolean> = new ObservableValue<boolean>(false);

    private assignValue(value: boolean, isUserInitiated: boolean) {
        const elCheckboxContainer = this.$("elCheckboxContainer") as HTMLLabelElement;
        const elCheckbox = this.$("elCheckbox") as HTMLInputElement;

        this._unboundValue.value = value;
        elCheckbox.checked = value;

        elCheckboxContainer.classList.toggle("is-unchecked", !value);
        elCheckboxContainer.classList.toggle("is-checked", value);
        if (isUserInitiated) {
            elCheckboxContainer.classList.toggle("is-user-initiated", true);
            this.dispatchEvent(new Event("change"));
        }
        else {
            elCheckboxContainer.classList.toggle("is-user-initiated", false);
        }
    }

    get value() {
        return !!(this._unboundValue.value);
    }
    set value(value: boolean) {
        if (value != this._unboundValue.value) {
            this.assignValue(!this.value, false);
        }
    }
}