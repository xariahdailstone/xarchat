import { asDisposable } from "../util/Disposable";
import { testEquality } from "../util/Equality";
import { HTMLUtils } from "../util/HTMLUtils";
import { setStylesheetAdoption } from "../util/StyleSheetPolyfill";
import { WhenChangeManager } from "../util/WhenChange";
import { BooleanComponentAttribute, ComponentAttribute, ComponentAttributeAssignmentArgs, ComponentAttributeChangeHandler, ComponentAttributeValueChangeResult, ComponentBase, StyleLoader, componentElement } from "./ComponentBase";

const ATTR_TARGET = "target";
const ATTR_COLLAPSECLASS = "collapseclass";
const ATTR_DISABLEANIMATION = "disableanimation";    

@componentElement("x-collapsebutton")
export class CollapseButton extends ComponentBase<boolean> {

    static get observedAttributes() { return [...super.observedAttributes, ATTR_TARGET, ATTR_COLLAPSECLASS, ATTR_DISABLEANIMATION ]; }

    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `<button id="elCollapseButton" class="collapsebutton" tabindex="-1"><x-iconimage id="elCollapseArrow" 
            class="collapsearrow" src="assets/ui/collapse.svg"></x-iconimage></button>`);

        this._targetRef = new ComponentElementReference({
            owner: this,
            attributeName: ATTR_TARGET,
            onChange: (el) => this.updateState()
        });
        this._collapseClassAttr = new ComponentAttribute<string | null>({
            owner: this,
            attributeName: ATTR_COLLAPSECLASS,
            initialValue: "collapsed",
            onAssignmentFunc: (assignArgs) => {
                const v = assignArgs.via == "attribute" ? assignArgs.attributeValue : assignArgs.propertyValue;
                return { propertyValue: v ?? null, attributeValue: v != "" ? v! : null };
            },
            onChange: (v) => this.updateState()
        });
        this._disableAnimation = new BooleanComponentAttribute({
            owner: this,
            attributeName: ATTR_DISABLEANIMATION,
            defaultValue: false,
            onChange: (v) => this.updateState()
        });

        this.$("elCollapseButton")?.addEventListener("click", () => {
            this.collapsed = !this.collapsed;
        });
    }

    private readonly _targetRef: ComponentElementReference;
    private readonly _collapseClassAttr: ComponentAttribute<string | null>;
    private readonly _disableAnimation: BooleanComponentAttribute;
    private readonly _wcm: WhenChangeManager = new WhenChangeManager();

    get target() { return this._targetRef.propertyValue; }
    set target(value) { this._targetRef.propertyValue = value; }

    get collapseClass() { return this._collapseClassAttr.propertyValue; }
    set collapseClass(value) { this._collapseClassAttr.propertyValue = value; }

    get disableAnimation() { return this._disableAnimation.propertyValue; }
    set disableAnimation(value) { this._disableAnimation.propertyValue = value; }

    private _noVmValue: boolean = false;
    get collapsed(): boolean {
        if (this.viewModel != null) {
            return !!this.viewModel;
        }
        else {
            return this._noVmValue;
        }
    }
    set collapsed(value: boolean) {
        //debugger;
        if (value != this.collapsed) {
            if (this.canAssignToViewModel()) {
                this.assignToViewModel(value);
            }
            else {
                this._noVmValue = !!value;
            }
            this.updateState();
        }
    }

    protected override viewModelChanged(): void {
        this.updateState();
    }

    protected override connectedToDocument(): void {
        this.updateState();
    }

    protected override disconnectedFromDocument(): void {
        this.updateState();
    }

    private updateState() {
        const target = this.target;
        const cc = this.collapseClass ?? "";
        const isCollapsed = this.collapsed;
        const fec = this.firstElementChild;
        const connected = this.isComponentConnected;
        const disableAnim = this.disableAnimation;
    
        this._wcm.assign({ target, cc, isCollapsed, fec, connected, disableAnim }, () => {

            this.elMain.classList.toggle("noanimation", disableAnim);
            if (target instanceof CollapseBody) {
                target.animated = !disableAnim;
            }

            if (connected && (isCollapsed || target instanceof CollapseBody) && target && cc != "") {

                if (target instanceof CollapseBody) {
                    target.collapsed = isCollapsed;
                }
                else {
                    target.classList.add(cc);
                }
                if (isCollapsed) {
                    this.$("elCollapseArrow")!.classList.add("collapsed");
                }

                return asDisposable(() => {
                    if (target instanceof CollapseBody) {
                    }
                    else {
                        target!.classList.remove(cc);
                    }
                    if (isCollapsed) {
                        this.$("elCollapseArrow")!.classList.remove("collapsed");
                    }
                });
            }
        });
    }
}

@componentElement("x-collapsebody")
export class CollapseBody extends HTMLElement {
    constructor() {
        super();
        this._sroot = this.attachShadow({ mode: 'closed' });
        this._elMain = document.createElement("div");
        this._elMain.id = "elMain";
        this._elMain.style.display = "none";
        this._sroot.appendChild(this._elMain);

        this._elMainInner = document.createElement("div");
        this._elMainInner.id = "elMainInner";
        this._elMainInner.appendChild(document.createElement("slot"));
        this._elMain.appendChild(this._elMainInner);

        StyleLoader.loadAsync("styles/components/CollapseBody.css")
            .then(ss => {
                this._elMain.style.display = "block";
                setStylesheetAdoption(this._sroot, [ ss ]);
                //this._sroot.adoptedStyleSheets = [ ss ];
            });
            
        this.updateState(false);
    }

    connectedCallback() {
        this._ro = new ResizeObserver(entries => this.resizeObserverCallback(entries));
        this._ro.observe(this._elMainInner);
    }

    disconnectedCallback() {
        this._ro?.disconnect();
        this._ro = null;
    }

    private readonly _sroot: ShadowRoot;
    private readonly _elMain: HTMLDivElement;
    private readonly _elMainInner: HTMLDivElement;

    private _ro: ResizeObserver | null = null;

    private _collapsed: boolean = true;
    get collapsed() { return this._collapsed; }
    set collapsed(value: boolean) {
        if (!!value != this._collapsed) {
            this._collapsed = !!value;
            this.updateState(true);
        }
    }

    private _animated: boolean = true;
    get animated() { return this._animated; }
    set animated(value: boolean) {
        if (!!value != this._animated) {
            this._animated = !!value;
            this.updateState(false);
        }
    }

    private resizeObserverCallback(entries: ResizeObserverEntry[]) {
        for (let entry of entries) {
            if (entry.target == this._elMainInner) {
                const height = entry.borderBoxSize[0].blockSize
                this._elMain.style.setProperty("--expandedHeight", `${height}px`);
            }
        }
    }

    private updateState(collapsedChanged: boolean) {
        this._elMain.classList.toggle("collapsed", this.collapsed);

        if (this.animated && collapsedChanged) {
            this._elMain.classList.toggle("expand-animate", !this.collapsed);
            this._elMain.classList.toggle("collapse-animate", this.collapsed);
        }
        else {
            this._elMain.classList.toggle("expand-animate", false);
            this._elMain.classList.toggle("collapse-animate", false);
        }
    }
}


interface ComponentElementReferenceConstructorOptions {
    owner: ComponentBase<unknown>;
    attributeName: string;
    onChange: ComponentAttributeChangeHandler<HTMLElement | null>;
}
class ComponentElementReference extends ComponentAttribute<HTMLElement | null> {
    constructor(
        args: ComponentElementReferenceConstructorOptions)
    {
        super({ 
            owner: args.owner,
            attributeName: args.attributeName,
            initialValue: null,
            onAssignmentFunc: (assignArgs) => this.performAssignment(assignArgs), 
            onChange: args.onChange
        });

        args.owner.addEventListener("connected", () => {
            this.recalcTarget();
        });
        args.owner.addEventListener("disconnected", () => {
            this.recalcTarget();
        });
    }

    private recalcTarget() {
        if (this.attributeValue) {
            const el = this.findTarget();
            this._assigningFromRecalcTarget++;
            try {
                this.propertyValue = el;
            }
            finally {
                this._assigningFromRecalcTarget--;
            }
        }
    }

    private getRoot(): (ShadowRoot | Document | null) {
        let el: (Node | null) = this.owner;
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

    private findTarget(attr?: string): (HTMLElement | null) {
        const root = this.getRoot();
        const el = (root?.getElementById(attr ?? this.attributeValue!) ?? null)
        return el;
    }

    private _assigningFromRecalcTarget: number = 0;

    private performAssignment(args: ComponentAttributeAssignmentArgs<HTMLElement | null>): ComponentAttributeValueChangeResult<HTMLElement | null> {
        if (args.via == "property") {
            if (this._assigningFromRecalcTarget > 0) {
                return { attributeValue: this.attributeValue, propertyValue: args.propertyValue ?? null };
            }
            else {
                return { attributeValue: null, propertyValue: args.propertyValue ?? null };
            }
        }
        else {
            if (args.attributeValue == null) {
                return { attributeValue: null, propertyValue: null };
            }
            else {
                return { attributeValue: args.attributeValue, propertyValue: this.findTarget(args.attributeValue) };
            }
        }
    }
}



type ReferencedElementChangeHandler = (el: (HTMLElement | null)) => void;
