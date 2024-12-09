import { HTMLUtils } from "../util/HTMLUtils";
import { ComponentBase, componentElement } from "./ComponentBase";

@componentElement("x-bindingselect")
export class BindingSelect extends ComponentBase<string> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <select class="main-select" id="elSelect"></select>
            <div class="arrow-layout">
                <x-iconimage src="assets/ui/dropdown-arrow.svg" class="arrow-layout-image"></x-iconimage>
            </div>
        `);

        const elSelect = this.$("elSelect") as HTMLSelectElement;
        this.elSelect = elSelect;

        this.watchExpr(vm => vm, vm => {
            elSelect.value = vm ?? "";
        });

        elSelect.addEventListener("change", () => {
            if (this.canAssignToViewModel()) {
                const v = elSelect.value;
                this.assignToViewModel(v);
            }
        });
    }

    private readonly elSelect: HTMLSelectElement;

    get value(): string { return this.elSelect.value; }
    set value(v: string) { this.elSelect.value = v; }

    private _optionsObserver: MutationObserver | null = null;

    protected override connectedToDocument(): void {
        const oo = new MutationObserver(entries => {
            this.refreshOptions();
        });
        oo.observe(this, { subtree: true, childList: true });
        this._optionsObserver = oo;
        this.refreshOptions();
    }

    protected override disconnectedFromDocument(): void {
        this._optionsObserver?.disconnect();
        this._optionsObserver = null;
    }

    private refreshOptions() {
        const targetFrag = new DocumentFragment();

        for (let idx = 0; idx < this.children.length; idx++) {
            const srcEl = this.children.item(idx)!;
            if (srcEl instanceof HTMLOptionElement) {
                const targetEl = document.createElement("option");
                const srcValue = srcEl.getAttribute("value");
                if (srcValue != null) {
                    targetEl.setAttribute("value", srcValue);
                }
                targetEl.innerText = srcEl.innerText;
                targetFrag.appendChild(targetEl);
            }
        }

        HTMLUtils.clearChildren(this.elSelect);
        this.elSelect.appendChild(targetFrag);
    }
}

