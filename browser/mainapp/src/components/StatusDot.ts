import { CharacterName } from "../shared/CharacterName.js";
import { CharacterSet, CharacterStatus } from "../shared/CharacterSet.js";
import { OnlineStatus, OnlineStatusConvert } from "../shared/OnlineStatus.js";
import { asDisposable, IDisposable } from "../util/Disposable.js";
import { WhenChangeManager } from "../util/WhenChange.js";
import { ComponentBase, componentElement } from "./ComponentBase.js";

@componentElement("x-statusdot")
export class StatusDot extends ComponentBase<CharacterSet> {

    static get observedAttributes() { return [...super.observedAttributes, "character", "status", "statusmessage" ] }

    constructor() {
        super();

        this.elMain.appendChild(document.createTextNode("\u2B24"));
    }

    protected override attributeChangedCallback(name: string, oldValue?: string | undefined, newValue?: string | undefined): void {
        if (name == "character") {
            this.character = newValue;
        }
        else if (name == "status") {
            if (newValue != null && OnlineStatusConvert.isValid(newValue)) {
                this.status = OnlineStatusConvert.toOnlineStatus(newValue);
            }
            else {
                this.status = null;
            }
        }
        else if (name == "statusmessage") {
            this.statusMessage = newValue;
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
    }

    protected override disconnectedFromDocument(): void {
        this.updateState();
    }

    private _character: (CharacterName | null) = null;
    get character(): (CharacterName | null) { return this._character; }
    set character(value: (CharacterName | string | null | undefined)) {
        if (typeof value == "string") {
            value = CharacterName.create(value);
        }
        if (!CharacterName.equals(this._character, value)) {
            this._character = value ? value : null;
            if (value == null) {
                this.removeAttribute("character");
            } 
            else {
                this.setAttribute("character", value.value);
            }
            this.updateState();
        }
    }

    private _status: (OnlineStatus | null) = null;
    get status(): (OnlineStatus | null) { return this._status; }
    set status(value: (OnlineStatus | null | undefined)) {
        if (value != this._status) {
            this._status = (value != null) ? value : null;
            if (value == null) {
                this.removeAttribute("status");
            }
            else {
                this.setAttribute("status", OnlineStatusConvert.toString(value)!.toLowerCase());
            }
            this.updateState();
        }
    }

    private _statusMessage: (string | null) = null;
    get statusmessage(): (string | null) { return this._statusMessage; }
    set statusMessage(value: (string | null | undefined)) {
        if (value != this._statusMessage) {
            this._statusMessage = (value != null) ? value : null;
            if (value == null) {
                this.removeAttribute("statusmessage");
            }
            else {
                this.setAttribute("statusmessage", value);
            }
            this.updateState();
        }
    }

    private readonly _charBindingWC: WhenChangeManager = new WhenChangeManager();
    private readonly _statusWC: WhenChangeManager = new WhenChangeManager();

    private updateState() {
        const effectiveCharacter = this._character != null ? this._character : null;

        const needsCharacterBinding = 
            this.isComponentConnected && effectiveCharacter != null && 
            this.viewModel instanceof CharacterSet &&
            (this._status == null || this._statusMessage == null);

        this._charBindingWC.assign({ needsCharacterBinding, effectiveCharacter, vm: this.viewModel }, () => {
            if (needsCharacterBinding) {
                const characterBinding = (this.viewModel as CharacterSet).addStatusListenerDebug(
                    [ "StatusDot.charBinding", effectiveCharacter ],
                    effectiveCharacter, () => {
                        this.updateState();
                    });
                return asDisposable(() => { characterBinding.dispose(); });
            }
        });

        const characterSet = needsCharacterBinding ? this.viewModel as CharacterSet : null;
        const gcstatus = characterSet?.getCharacterStatus(effectiveCharacter!);

        const rawEffectiveStatus = this._status != null ? this._status : gcstatus?.status;
        const rawEffectiveStatusMessage = this._statusMessage != null ? this._statusMessage : gcstatus?.statusMessage;

        const effectiveStatus = rawEffectiveStatus != null ? rawEffectiveStatus : OnlineStatus.OFFLINE;
        const effectiveStatusMessage = rawEffectiveStatusMessage != null ? rawEffectiveStatusMessage : "";

        this._statusWC.assign({ effectiveStatus }, () => {
            const neededClass = `status-${OnlineStatusConvert.toString(effectiveStatus)?.toLowerCase()}`;
            this.elMain.classList.add(neededClass);
            this.elMain.title = OnlineStatusConvert.toString(effectiveStatus);

            return asDisposable(() => {
                this.elMain.classList.remove(neededClass);
            });
        });
    }
}

export class StatusDotLightweight implements IDisposable {
    constructor() {
        const result = document.createElement("span");
        result.classList.add("statusdot");

        result.appendChild(document.createTextNode("\u2B24"));

        this.element = result;
        this.updateState();
    }

    dispose() {
        if (!this._disposed) {
            this._disposed = true;
            this._wcm.dispose();
            //this.updateState();
        }
    }

    [Symbol.dispose]() {
        this.dispose();
    }

    readonly element: HTMLElement;

    private readonly _wcm: WhenChangeManager = new WhenChangeManager();

    private _disposed: boolean = false;
    private _characterSet: (CharacterSet | null) = null;
    private _character: (CharacterName | null) = null;
    private _status: (OnlineStatus | null) = null;

    get characterSet(): (CharacterSet | null) { return this._characterSet; }
    set characterSet(value: (CharacterSet | null)) {
        if (value !== this._characterSet) {
            this._characterSet = value;
            this.updateState();
        }
    }

    get character(): (CharacterName | null) { return this._character; }
    set character(value: (CharacterName | null)) {
        if (value !== this._character) {
            this._character = value;
            this.updateState();
        }
    }

    get status(): (OnlineStatus | null) { return this._status; }
    set status(value: (OnlineStatus | null)) {
        if (value !== this._status) {
            this._status = value;
            this.updateState();
        }
    }

    private updateState() {
        const characterSet = this.characterSet;
        const character = this.character;
        const status = this.status ?? OnlineStatus.OFFLINE;
        const disposed = this._disposed;

        this._wcm.assign({ characterSet, character, status, disposed }, () => {
            if (!disposed) {
                let assignStatus: OnlineStatus;
                if (character != null && characterSet != null) {
                    let assignedClass: string | null = null;
                    const updateAssignedClass = (cs: CharacterStatus) => {
                        const cl = "onlinestatus-" + OnlineStatusConvert.toString(cs.status).toLowerCase();
                        if (!assignedClass || cl != assignedClass) {
                            if (assignedClass) {
                                this.element.classList.remove(assignedClass);
                            }
                            assignedClass = cl;
                            this.element.classList.add(cl);
                            this.element.title = OnlineStatusConvert.toString(cs.status);
                        }
                    };

                    const ccReg = characterSet.addStatusListenerDebug(
                        [ "StatusDotLightweight.updateState", character ],
                        character, cs => {
                            updateAssignedClass(cs);
                        });

                    const cs = characterSet.getCharacterStatus(character);
                    updateAssignedClass(cs);

                    return asDisposable(() => {
                        ccReg.dispose();
                        if (assignedClass) {
                            this.element.classList.remove(assignedClass);
                        }
                    });
                }
                else {
                    const cl = "onlinestatus-" + OnlineStatusConvert.toString(status).toLowerCase();
                    this.element.classList.add(cl);
                    this.element.title = OnlineStatusConvert.toString(status);
                    return asDisposable(() => {
                        this.element.classList.remove(cl);
                    });
                }
            }
        });
    }
}

