import { CharacterGenderConvert } from "../shared/CharacterGender.js";
import { CharacterName } from "../shared/CharacterName.js";
import { CharacterSet, CharacterStatus } from "../shared/CharacterSet.js";
import { asDisposable, IDisposable } from "../util/Disposable.js";
import { WhenChangeManager } from "../util/WhenChange.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";

@componentElement("x-characterstatuslistener")
export class CharacterStatusListener extends ComponentBase<CharacterSet> {

    static get observedAttributes() { return [...super.observedAttributes, "character", "assignclasselement" ]; }

    constructor() {
        super();
    }

    private _character: (CharacterName | null) = null;
    get character(): (CharacterName | null) { return this._character; }
    set character(value: CharacterName | null) { 
        if (!CharacterName.equals(value, this._character)) {
            this._character = value;
            if (value) {
                this.setAttribute("character", value.value);
            }
            else {
                this.removeAttribute("character");
            }
            this.updateState();
        }
    }

    private _assigningClassElementFromAttribute: boolean = false;
    private _assignClassElement: (HTMLElement | null) = null;
    get assignClassElement(): (HTMLElement | null) { return this._assignClassElement; }
    set assignClassElement(value: (HTMLElement | null)) {
        if (value != this._assignClassElement) {
            this._assignClassElement = value;
            if (!this._assigningClassElementFromAttribute) {
                this.removeAttribute("assignclasselement");
            }
            this.assignClass();
        }
    }

    private get containingRoot(): (ShadowRoot | Document | null) {
        let el: (Node | null) = this;
        while (el) {
            if (el instanceof ShadowRoot) {
                return el;
            }
            else if (el instanceof Document) {
                return el;
            }
            el = el.parentNode;
        }
        return el;
    }

    protected override attributeChangedCallback(name: string, oldValue?: string | undefined, newValue?: string | undefined): void {
        if (name == "character") {
            this.character = newValue ? CharacterName.create(newValue) : null;
        }
        else if (name == "assignclasselement") {
            this.findAssignClassElementFromAttribute();
        }
        else {
            super.attributeChangedCallback(name, oldValue, newValue);
        }
    }

    protected override viewModelChanged(): void {
        this.updateState();
    }

    protected override connectedToDocument(): void {
        this.updateState();
        this.findAssignClassElementFromAttribute();
    }

    protected override disconnectedFromDocument(): void {
        this.updateState();
        this.findAssignClassElementFromAttribute();
    }

    private findAssignClassElementFromAttribute() {
        const newValue = this.getAttribute("assignclasselement");
        this._assigningClassElementFromAttribute = true;
        try {
            const r = this.containingRoot;
            if (r && newValue) {
                this.assignClassElement = r.getElementById(newValue);
            }
            else {
                this.assignClassElement = null;
            }
        }
        finally {
            this._assigningClassElementFromAttribute = false;
        }

    }

    private readonly _statusListenerWC: WhenChangeManager = new WhenChangeManager();

    private updateState() {
        this._statusListenerWC.assign({ c: this.character, vm: this.viewModel, ace: this._assignClassElement }, () => {
            if (this.viewModel instanceof CharacterSet && this.character) {
                const statusListener = this.viewModel.addStatusListenerDebug(
                    ["CharacterStatusListener.UpdateState", this.character], 
                    this.character, (cs) => {
                    this.characterStatusUpdated(cs);
                });
                this.characterStatusUpdated(this.viewModel.getCharacterStatus(this.character));
                return asDisposable(() => { statusListener.dispose(); });
            }
            else {
                this.characterStatusUpdated(CharacterSet.emptyStatus(CharacterName.create("")));
            }
        });
    }

    private _lastCharacterStatus: CharacterStatus = CharacterSet.emptyStatus(CharacterName.create(""));

    private characterStatusUpdated(cs: CharacterStatus) {
        if (!cs.equals(this._lastCharacterStatus)) {
            this._lastCharacterStatus = cs;
            //this.dispatchEvent(new Event("characterstatuschange"));
            this.assignClass();
        }
    }

    get characterStatus(): CharacterStatus { return this._lastCharacterStatus; }

    private readonly _assignClassWC: WhenChangeManager = new WhenChangeManager();

    private assignClass() {
        const ace = this._assignClassElement;
        const gclass = 'gender-' + (CharacterGenderConvert.toString(this._lastCharacterStatus.gender) ?? "none");

        this._assignClassWC.assign({ ace, gclass }, () => {
            if (ace) {
                if (this.extraLogging) {
                    this.logInfo(`class -> ${gclass}`);
                }
                ace.classList.add(gclass);
                return asDisposable(() => { ace.classList.remove(gclass); });
            }
        });
    }

    extraLogging: boolean = false;
}
