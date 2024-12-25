import { CharacterName } from "../../shared/CharacterName";
import { CancellationTokenSource } from "../../util/CancellationTokenSource";
import { IDisposable, asDisposable } from "../../util/Disposable";
import { HTMLUtils } from "../../util/HTMLUtils";
import { StringUtils } from "../../util/StringUtils";
import { URLUtils } from "../../util/URLUtils";
import { WhenChangeManager } from "../../util/WhenChange";
import { KeyValuePair } from "../../util/collections/KeyValuePair";
import { LoginViewModel } from "../../viewmodel/dialogs/LoginViewModel";
import { CollectionViewLightweight } from "../CollectionViewLightweight";
import { componentArea, componentElement } from "../ComponentBase";
import { DialogComponentBase, DialogFrame, dialogViewFor } from "./DialogFrame";

@componentArea("dialogs")
@componentElement("x-logindialog")
@dialogViewFor(LoginViewModel)
export class LoginDialog extends DialogComponentBase<LoginViewModel> {
    constructor() {
        super();

        HTMLUtils.assignStaticHTMLFragment(this.elMain, `
            <div class="state-getaccount">
                <div class="message-display hidden" id="elMessageDisplay"></div>
                <div class="instructions">
                    Enter your account name and password.
                </div>
                <input class="username theme-textbox" type="text" id="elUsername" placeholder="Account Name" />
                <button id="btnUsernameDD" class="username-dropdown-btn">
                    <x-svgicon class="username-dropdown-btn-icon" src="assets/ui/dropdown-arrow.svg"><x-svgicon>
                </button>
                <input class="password theme-textbox" type="password" id="elPassword" placeholder="Password" />
                <div class="rememberusername">
                    <label>
                        <input type="checkbox" id="elRememberUsername" />
                        <div>Remember Account Name</div>
                    </label>
                </div>
                <div class="rememberpassword">
                    <label>
                        <input type="checkbox" id="elRememberPassword" />
                        <div>Remember Password</div>
                    </label>
                </div>
            </div>
            <div class="state-gettingchars">
                <div class="instructions">
                    Getting character list...
                </div>
            </div>
            <div class="state-getchar">
                <div class="message-display hidden" id="elMessageDisplay2"></div>
                <div class="instructions">
                    Select a character.
                </div>
                <div class="charslist">
                    <div id="elCharsViewRecentContainer">
                        <div class="charslist-heading">Recently Used Characters</div>
                        <x-charslist id="elCharsViewRecent" modelpath="recentCharacters" isrecent="true">
                            <div id="elCharsListRecent"></div>
                        </x-charslist>
                        <div class="charslist-heading">All Characters</div>
                    </div>
                    <x-charslist id="elCharsView" modelpath="characters">
                        <div id="elCharsList"></div>
                    </x-charslist>
                </div>
                <div class="autologincharacter" id="elAutoLoginCharacterContainer">
                    <label>
                        <input type="checkbox" id="elAutoLoginCharacter" />
                        <div>Automatically sign in as this character</div>
                    </label>
                </div>
            </div>
            <div class="state-loggingin">
                <div class="instructions">
                    Logging in...
                </div>
            </div>
        `);

        const elMessageDisplay = this.$("elMessageDisplay") as HTMLDivElement;
        const elMessageDisplay2 = this.$("elMessageDisplay2") as HTMLDivElement;
        const elUsername = this.$("elUsername") as HTMLInputElement;
        const elPassword = this.$("elPassword") as HTMLInputElement;
        const btnUsernameDD = this.$("btnUsernameDD") as HTMLButtonElement;
        const elRememberUsername = this.$("elRememberUsername") as HTMLInputElement;
        const elRememberPassword = this.$("elRememberPassword") as HTMLInputElement;

        const elCharsView = this.$("elCharsView") as CharsList;
        const elCharsList = this.$("elCharsList") as HTMLDivElement;
        const elCharsViewRecent = this.$("elCharsViewRecent") as CharsList;
        const elCharsViewRecentContainer = this.$("elCharsViewRecentContainer") as HTMLDivElement;

        const elAutoLoginCharacterContainer = this.$("elAutoLoginCharacterContainer") as HTMLDivElement;
        const elAutoLoginCharacter = this.$("elAutoLoginCharacter") as HTMLInputElement;

        this.setupTwoWayBinding(elUsername, "accountName");
        this.setupTwoWayBinding(elPassword, "password");
        this.setupCheckboxTwoWayBinding(elRememberUsername, "rememberAccountName");
        this.setupCheckboxTwoWayBinding(elRememberPassword, "rememberPassword");
        this.setupCheckboxTwoWayBinding(elAutoLoginCharacter, "autoLogin");

        this.watch(".", v => {
            elCharsView.loginViewModel = v;
            elCharsViewRecent.loginViewModel = v;
        });
        let flowStateCTS = new WhenChangeManager();
        this.watch("flowState", v => {
            flowStateCTS.assign({ flowState: v }, args => {
                const className = `state-${args.flowState}`;
                this.elMain.classList.add(className);
                return asDisposable(() => {
                    this.elMain.classList.remove(className);
                });
            });
        });
        this.watch("failureMessage", v => {
            const msg = v != null ? v : "";
            elMessageDisplay.innerText = msg;
            elMessageDisplay2.innerText = msg;
            if (StringUtils.isNullOrWhiteSpace(msg)) {
                elMessageDisplay.classList.add("hidden");
                elMessageDisplay2.classList.add("hidden");
            }
            else {
                elMessageDisplay.classList.remove("hidden");
                elMessageDisplay2.classList.remove("hidden");
            }
        });
        let failureMessageSeverityWCM = new WhenChangeManager();
        this.watch("failureMessageSeverity", v => {
            failureMessageSeverityWCM.assign({ severity: v }, (args) => {
                if (args.severity) {
                    const className = `severity-${args.severity}`;
                    elMessageDisplay.classList.add(className);
                    elMessageDisplay2.classList.add(className);
                    return asDisposable(() => {
                        elMessageDisplay.classList.remove(className);
                        elMessageDisplay2.classList.remove(className);
                    });
                }
            });
        });

        this.watchExpr(vm => vm.canAutoLogin, canAutoLogin => {
            canAutoLogin = !!canAutoLogin;
            elAutoLoginCharacterContainer.classList.toggle("hidden", !canAutoLogin);
            if (!canAutoLogin) {
                elAutoLoginCharacter.checked = false;
                if (this.viewModel) {
                    this.viewModel.autoLogin = false;
                }
            }
        });

        this.watchExpr(vm => vm.recentCharacters.length, rccount => {
            elCharsViewRecentContainer.classList.toggle("hidden", (rccount == null || rccount == 0));
        });

        btnUsernameDD.addEventListener("click", () => {
            if (this.viewModel) {
                this.viewModel.showAccountSelectDropdown(btnUsernameDD);
            }
        });
        this.whenConnectedWithViewModel(vm => {
            const handler = vm.addFocusListener((fieldName: string) => {
                switch (fieldName) {
                    case "password":
                        elPassword.focus();
                        elPassword.selectionStart = elPassword.value.length;
                        elPassword.selectionEnd = elPassword.value.length;
                        break;
                }
            });
        });
    }

    private setupTwoWayBinding(el: HTMLInputElement, propertyPath: string) {
        this.watch(propertyPath, v => {
            el.value = v != null ? v : "";
        });
        const changeOrInput = () => {
            if (this.viewModel) {
                (this.viewModel as any)[propertyPath] = el.value;
            }
        };
        el.addEventListener("change", changeOrInput);
        el.addEventListener("input", changeOrInput);
    }

    private setupCheckboxTwoWayBinding(el: HTMLInputElement, propertyPath: string) {
        this.watch(propertyPath, v => {
            el.checked = !!v;
        });
        const changeOrInput = () => {
            if (this.viewModel) {
                (this.viewModel as any)[propertyPath] = el.checked;
            }
        };
        el.addEventListener("change", changeOrInput);
        el.addEventListener("input", changeOrInput);
    }
}

@componentArea("dialogs")
@componentElement("x-charslist")
export class CharsList extends CollectionViewLightweight<KeyValuePair<any, CharacterName>> {
    constructor() {
        super();
    }

    private _loginViewModelWCM: WhenChangeManager = new WhenChangeManager();
    private _selectedCharWCM: WhenChangeManager = new WhenChangeManager();

    private _loginViewModel: (LoginViewModel | null) = null;
    get loginViewModel() { return this._loginViewModel; }
    set loginViewModel(value) {
        this._loginViewModel = value;
        this._loginViewModelWCM.assign({ loginViewModel: this._loginViewModel }, (args) => {
            return args.loginViewModel?.addPropertyListener("selectedCharacter", () => {
                this._selectedCharWCM.assign({ char: args.loginViewModel!.selectedCharacter, charRecent: args.loginViewModel!.selectedRecent }, (args) => {
                    const isRecent = !!this.getAttribute("isRecent");
                    for (let vv of this.values()) {
                        const el = vv[0];
                        const vm = vv[1];
                        if (vm.value == args.char && isRecent == args.charRecent) {
                            el.classList.add("selected");
                            return asDisposable(() => {
                                el.classList.remove("selected");
                            });
                        }
                    }
                });
            });
        });
    }

    createUserElement(kvm: KeyValuePair<any, CharacterName>): HTMLElement {
        const vm = kvm.value;
        const el = document.createElement("div");
        el.classList.add("character-entry");

        const img = document.createElement("img");
        img.classList.add("character-image");
        img.src = URLUtils.getAvatarImageUrl(vm);
        el.appendChild(img);

        const name = document.createElement("div");
        name.classList.add("character-name");
        name.innerText = vm.value;
        el.appendChild(name);

        el.addEventListener("click", () => {
            const isRecent = !!this.getAttribute("isRecent");

            const lvm = this.loginViewModel;
            if (lvm) {
                lvm.selectedRecent = isRecent;
                lvm.selectedCharacter = vm;
            }
        });

        return el;
    }

    destroyUserElement(kvm: KeyValuePair<any, CharacterName>, el: HTMLElement): void {
    }
}