import { asDisposable } from "../util/Disposable.js";
import { ValueReference } from "../util/ValueReference.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";

@componentElement("x-splitterhandle")
export class SplitterHandle extends ComponentBase<ValueReference<number>> {

    static get observedAttributes() { return [...super.observedAttributes, "orientation", "min", "max", "target", "othertarget", "othermin", "invert" ]};

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

        this.whenConnectedWithViewModel(vm => {
            this._resizeObserver = new ResizeObserver(entries => {
                this.updateState();
            });
            if (this.target) {
                this._resizeObserver.observe(this.target);
            }
            if (this.othertarget) {
                this._resizeObserver.observe(this.othertarget);
            }
            return asDisposable(() => {
                this._resizeObserver?.disconnect();
                this._resizeObserver = null;
            })
        });
    }

    private _resizeObserver: ResizeObserver | null = null;

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
        else if (name == "othermin") {
            if (newValue != null && !isNaN(+newValue)) {
                this.othermin = +newValue;
            }
            else {
                this.othermin = null;
            }
        }
        else if (name == "target") {
            this.setTargetInternal(newValue ? (this.getRoot()?.getElementById(newValue) ?? null) : null, true);
        }
        else if (name == "othertarget") {
            this.setOtherTargetInternal(newValue ? (this.getRoot()?.getElementById(newValue) ?? null) : null, true);
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

    private _othermin: number | null = null;
    get othermin(): number | null { return this._othermin ?? null; };
    set othermin(value: number | null) {
        if (value != this._othermin) {
            this._othermin = value;
            if (value !== null) {
                this.setAttribute("othermin", value.toString());
            }
            else {
                this.removeAttribute("othermin");
            }
            //this.updateState();
        }
    }

    private _target: HTMLElement | null = null;
    get target(): (HTMLElement | null) { return this._target; }
    set target(value: (HTMLElement | null)) {
        this.setTargetInternal(value, false);
    }

    private _othertarget: HTMLElement | null = null;
    get othertarget(): (HTMLElement | null) { return this._othertarget; }
    set othertarget(value: (HTMLElement | null)) {
        this.setOtherTargetInternal(value, false);
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
                if (this._resizeObserver && this._target) {
                    this._resizeObserver.unobserve(this._target);
                }
                this._target = value;
                if (!settingFromAttribute) {
                    this.removeAttribute("target");
                }
                if (this._resizeObserver && this._target) {
                    this._resizeObserver.observe(this._target);
                }
                this.updateState();
            }
        }
        finally {
            this._inSettingTargetFromAttribute = false;
        }
    }

    private _inSettingOtherTargetFromAttribute = false;
    private setOtherTargetInternal(value: HTMLElement | null, settingFromAttribute: boolean) {
        if (this._inSettingOtherTargetFromAttribute) { return; }

        this._inSettingOtherTargetFromAttribute = true;
        try
        {
            if (value != this._othertarget) {
                if (this._resizeObserver && this._othertarget) {
                    this._resizeObserver.unobserve(this._othertarget);
                }
                this._othertarget = value;
                if (!settingFromAttribute) {
                    this.removeAttribute("othertarget");
                }
                if (this._resizeObserver && this._othertarget) {
                    this._resizeObserver.observe(this._othertarget);
                }
                this.updateState();
            }
        }
        finally {
            this._inSettingOtherTargetFromAttribute = false;
        }
    }

    protected override connectedToDocument(): void {
        if (this.hasAttribute("target")) {
            const targetValue = this.getAttribute("target")!;
            this.setTargetInternal(targetValue ? (this.getRoot()?.getElementById(targetValue) ?? null) : null, true);
        }
        if (this.hasAttribute("othertarget")) {
            const otherTargetValue = this.getAttribute("othertarget")!;
            this.setOtherTargetInternal(otherTargetValue ? (this.getRoot()?.getElementById(otherTargetValue) ?? null) : null, true);
        }
    }

    protected override disconnectedFromDocument(): void {
        if (this.hasAttribute("target")) {
            this.setTargetInternal(null, true);
        }
        if (this.hasAttribute("othertarget")) {
            this.setOtherTargetInternal(null, true);
        }
    }

    protected override viewModelChanged(): void {
        this.updateState();
    }

    private _nonBoundValue: number = SplitterHandle.DEFAULT_MIN;
    get value() {
        if (this.viewModel) {
            return +this.viewModel.read();
        }
        else {
            return this._nonBoundValue;
        }
    }
    set value(value: number) {
        value = this.clampPotentialValue(value);
        if (value != this.value) {
            // TODO: add writing to viewModel
            if (this.viewModel) {
                this.viewModel.write(value);
            }
            else {
                this._nonBoundValue = value;
            }
            this.updateState();
        }
    }

    private clampPotentialValue(value: number) {
        return Math.max(Math.min(value, this.max), this.min);
    }

    private _startMouseAt: (number | null) = null;
    private _startValue: (number | null) = null;

    private startDrag(e: PointerEvent) {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        this._startMouseAt = (this.orientation != "vertical") ? e.clientX : e.clientY;

        let startValue = this.value;
        if (this.target) {
            startValue = (this.orientation != "vertical") ? this.target.offsetWidth : this.target.offsetHeight;
        }
        this._startValue = startValue;
    }
    private stopDrag(e: PointerEvent) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        this._startMouseAt = null;
        this._startValue = null;

        if (this.target) {
            this.value = (this.orientation != "vertical") ? this.target.offsetWidth : this.target.offsetHeight;
        }
    }
    private updateDrag(e: PointerEvent) {
        if (this._startMouseAt != null && this._startValue != null) {
            const curAt = (this.orientation != "vertical") ? e.clientX : e.clientY;
            const atDiff = curAt - this._startMouseAt;
            this.value = (!this.invert) ? (this._startValue + atDiff) : (this._startValue - atDiff);
        }
    }

    private _lastStyledWidth: number | null = null;
    private updateState() {
        this.elMain.classList.toggle("horizontal", (this.orientation != "vertical"));
        this.elMain.classList.toggle("vertical", (this.orientation == "vertical"));

        if (this.target) {
            let effectiveValue = this.value;
            if (this.othertarget && this.othermin !== null) {
                const curTargetDim = (this.orientation != "vertical") ? this.target.offsetWidth : this.target.offsetHeight;
                const otherTargetDim = (this.orientation != "vertical") ? this.othertarget.offsetWidth : this.othertarget.offsetHeight;
                const valDelta = effectiveValue - curTargetDim;
                const otherTargetWillHaveDim = otherTargetDim - valDelta;
                if (otherTargetWillHaveDim < this.othermin) {
                    effectiveValue -= (this.othermin - otherTargetWillHaveDim);
                }
            }

            this._lastStyledWidth = effectiveValue;
            const newTargetSize = `${effectiveValue.toString()}px`;
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
