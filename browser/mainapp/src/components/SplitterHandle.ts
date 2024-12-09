import { ComponentBase, componentElement } from "./ComponentBase.js";

@componentElement("x-splitterhandle")
export class SplitterHandle extends ComponentBase<number> {

    static get observedAttributes() { return [...super.observedAttributes, "orientation", "min", "max", "target", "invert" ]};

    static readonly DEFAULT_MIN = 200;
    static readonly DEFAULT_MAX = 500;

    constructor() {
        super();

        // this.watch(".", v => {
        //     if (v != null) {
        //         this.value = +v;
        //     }
        // });

        this.elMain.addEventListener("pointerdown", e => {
            this.startDrag(e);
        });
        this.elMain.addEventListener("pointerup", e => {
            this.stopDrag(e);
        });
        this.elMain.addEventListener("lostpointercapture", e => {
            this.stopDrag(e);
        });
        this.elMain.addEventListener("pointermove", e => {
            this.updateDrag(e);
        });
    }

    protected override attributeChangedCallback(name: string, oldValue?: string | undefined, newValue?: string | undefined): void {
        if (name == "orientation") {
            if (newValue == "horizontal" || newValue == "vertical") {
                this.orientation = newValue;            
            }
            else {
                this.orientation = null;
            }
        }
        else if (name == "min") {
            if (newValue != null && !isNaN(+newValue)) {
                this.min = +newValue;
            }
            else {
                this.min = null;
            }
        }
        else if (name == "max") {
            if (newValue != null && !isNaN(+newValue)) {
                this.max = +newValue;
            }
            else {
                this.max = null;
            }
        }
        else if (name == "target") {
            this.setTargetInternal(newValue ? (this.getRoot()?.getElementById(newValue) ?? null) : null, true);
        }
        else if (name == "invert") {
            this.invert = (newValue != null);
        }
        else {
            super.attributeChangedCallback(name, oldValue, newValue);
        }
    }

    private getRoot(): (ShadowRoot | Document | null) {
        let el: (Node | null) = this;
        while (el) {
            if (el instanceof ShadowRoot) {
                return el;
            }
            else if (el instanceof Document) {
                return el;
            }
            else {
                el = el.parentNode;
            }
        }
        return null;
    }

    private _orientation: SplitterHandleOrientation | null = null;
    get orientation(): SplitterHandleOrientation { return this._orientation ? this._orientation : "horizontal"; }
    set orientation(value: SplitterHandleOrientation | null) {
        if (value !== this._orientation) {
            this._orientation = value;
            if (value !== null) {
                this.setAttribute("orientation", value);
            }
            else {
                this.removeAttribute("orientation");
            }
            this.updateState();
        }
    }

    private _min: number | null = null;
    get min(): number { return this._min != null ? this._min : SplitterHandle.DEFAULT_MIN; };
    set min(value: number | null) {
        if (value != this._min) {
            this._min = value;
            if (value !== null) {
                this.setAttribute("min", value.toString());
            }
            else {
                this.removeAttribute("min");
            }
            //this.updateState();
        }
    }

    private _max: number | null = null;
    get max(): number { return this._max != null ? this._max : SplitterHandle.DEFAULT_MAX; };
    set max(value: number | null) {
        if (value != this._max) {
            this._max = value;
            if (value !== null) {
                this.setAttribute("max", value.toString());
            }
            else {
                this.removeAttribute("max");
            }
            //this.updateState();
        }
    }

    private _target: HTMLElement | null = null;
    get target(): (HTMLElement | null) { return this._target; }
    set target(value: (HTMLElement | null)) {
        this.setTargetInternal(value, false);
    }

    private _invert: boolean = false;
    get invert() { return this._invert; }
    set invert(value: boolean) {
        if (value !== this._invert) {
            this._invert = value;
            if (this._invert) {
                this.setAttribute("invert", "invert");
            }
            else {
                this.removeAttribute("invert");
            }
        }
    }

    private _inSettingTargetFromAttribute = false;
    private setTargetInternal(value: HTMLElement | null, settingFromAttribute: boolean) {
        if (this._inSettingTargetFromAttribute) { return; }

        this._inSettingTargetFromAttribute = true;
        try
        {
            if (value != this._target) {
                this._target = value;
                if (!settingFromAttribute) {
                    this.removeAttribute("target");
                }
                this.updateState();
            }
        }
        finally {
            this._inSettingTargetFromAttribute = false;
        }
    }

    protected override connectedToDocument(): void {
        if (this.hasAttribute("target")) {
            const targetValue = this.getAttribute("target")!;
            this.setTargetInternal(targetValue ? (this.getRoot()?.getElementById(targetValue) ?? null) : null, true);
        }
    }

    protected override disconnectedFromDocument(): void {
        if (this.hasAttribute("target")) {
            this.setTargetInternal(null, true);
        }
    }

    protected override viewModelChanged(): void {
        this.updateState();
    }

    private _nonBoundValue: number = SplitterHandle.DEFAULT_MIN;
    get value() {
        if (this.viewModel) {
            return +this.viewModel;
        }
        else {
            return this._nonBoundValue;
        }
    }
    set value(value: number) {
        value = Math.max(Math.min(value, this.max), this.min);
        if (value != this.value) {
            // TODO: add writing to viewModel
            if (this.canAssignToViewModel()) {
                this.assignToViewModel(value);
            }
            else {
                this._nonBoundValue = value;
            }
            this.updateState();
        }
    }

    private _startMouseAt: (number | null) = null;
    private _startValue: (number | null) = null;

    private startDrag(e: PointerEvent) {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        this._startMouseAt = (this.orientation != "vertical") ? e.clientX : e.clientY;
        this._startValue = this.value;
    }
    private stopDrag(e: PointerEvent) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        this._startMouseAt = null;
        this._startValue = null;
    }
    private updateDrag(e: PointerEvent) {
        if (this._startMouseAt != null && this._startValue != null) {
            const curAt = (this.orientation != "vertical") ? e.clientX : e.clientY;
            const atDiff = curAt - this._startMouseAt;
            this.value = (!this.invert) ? (this._startValue + atDiff) : (this._startValue - atDiff);
        }
    }

    private updateState() {
        this.elMain.classList.toggle("horizontal", (this.orientation != "vertical"));
        this.elMain.classList.toggle("vertical", (this.orientation == "vertical"));

        if (this.target) {
            const newTargetSize = `${this.value.toString()}px`;
            if (this.orientation != "vertical") {
                this.target.style.width = newTargetSize;
                this.target.style.removeProperty("height");
            }
            else {
                this.target.style.height = newTargetSize;
                this.target.style.removeProperty("width");
            }
        }
        else {
            //this.log("no target to resize");
        }
    }
}

export type SplitterHandleOrientation = "horizontal" | "vertical";
