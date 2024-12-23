import { ChatViewModelSink } from "../../ChatViewModelSink";
import { ChatConnectionFactory } from "../../fchat/ChatConnectionFactory";
import { FListAuthenticatedApi } from "../../fchat/api/FListApi";
import { SavedAccountCredentials, SavedAccountCredentialsMap } from "../../settings/AppSettings";
import { CharacterName } from "../../shared/CharacterName";
import { CancellationToken, CancellationTokenSource } from "../../util/CancellationTokenSource";
import { CatchUtils } from "../../util/CatchUtils";
import { IDisposable, asDisposable } from "../../util/Disposable";
import { IterableUtils } from "../../util/IterableUtils";
import { LoginUtils } from "../../util/LoginUtils";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { Collection } from "../../util/ObservableCollection";
import { ObservableKeyExtractedOrderedDictionary, ObservableOrderedDictionaryImpl } from "../../util/ObservableKeyedLinkedList";
import { StringUtils } from "../../util/StringUtils";
import { KeyValuePair } from "../../util/collections/KeyValuePair";
import { SnapshottableSet } from "../../util/collections/SnapshottableSet";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { AppViewModel } from "../AppViewModel";
import { CharacterNameSet, UnsortedCharacterNameSet } from "../CharacterNameSet";
import { ContextMenuPopupItemViewModel, ContextMenuPopupViewModel } from "../popups/ContextMenuPopupViewModel";
import { DialogButtonStyle, DialogButtonViewModel, DialogViewModel } from "./DialogViewModel";

export class LoginViewModel extends DialogViewModel<boolean> {

    constructor(parent: AppViewModel) {
        super(parent);
        this.title = "Log In to XarChat";
        this.closeBoxResult = false;

        let getCharsCTS = new CancellationTokenSource();
        this._buttonsGetAccount.push(
            new DialogButtonViewModel({
                title: "Next >", 
                onClick: () => this.getCharacters(getCharsCTS.token),
                style: DialogButtonStyle.DEFAULT
            }),
        );
        this._buttonsGettingChars.push(
            new DialogButtonViewModel({
                title: "< Back", 
                onClick: () => {
                    getCharsCTS.cancel();
                    getCharsCTS = new CancellationTokenSource();
                },
                style: DialogButtonStyle.BACKOFF
            })
        );

        let loginCTS = new CancellationTokenSource();
        this._buttonsGetChar.push(
            new DialogButtonViewModel({
                title: "< Back", 
                onClick: () => { this.flowState = LoginState.GET_ACCOUNT; },
                style: DialogButtonStyle.BACKOFF
            }),
            new DialogButtonViewModel({
                title: "Log In", 
                onClick: () => this.logIn(loginCTS.token),
                style: DialogButtonStyle.DEFAULT
            })
        );
        this._buttonsLoggingIn.push(
            new DialogButtonViewModel({
                title: "< Back", 
                onClick: () => {
                    loginCTS.cancel();
                    loginCTS = new CancellationTokenSource();
                },
                style: DialogButtonStyle.BACKOFF
            })
        );

        this.buttons = this._buttonsGetAccount;

        this.assignInitialUsernamePassword();

        this.addCloseListener(() => {
            if (!this.rememberAccountName) {
                this.parent.appSettings.savedAccountCredentials.removeCredentials(this.accountName);
            }
        });
    }

    private assignInitialUsernamePassword() {
        if (this.parent.appSettings.savedAccountCredentials.size == 1) {
            const oneSavedLogin = [...this.parent.appSettings.savedAccountCredentials.values()][0];
            this.accountName = oneSavedLogin.account;
            this.rememberAccountName = true;
            if (!StringUtils.isNullOrWhiteSpace(oneSavedLogin.password)) {
                this.password = oneSavedLogin.password ?? "";
                this.rememberPassword = true;
            }
            else {
                this.password = "";    
                this.rememberPassword = false;
            }
        }
        else {
            this.accountName = "";
            this.password = "";
            this.rememberAccountName = false;
            this.rememberPassword = false;
        }
    }

    private readonly _buttonsGetAccount: Collection<DialogButtonViewModel> = new Collection();
    private readonly _buttonsGettingChars: Collection<DialogButtonViewModel> = new Collection();
    private readonly _buttonsGetChar: Collection<DialogButtonViewModel> = new Collection();
    private readonly _buttonsLoggingIn: Collection<DialogButtonViewModel> = new Collection();

    private _flowState: LoginState = LoginState.GET_ACCOUNT;
    @observableProperty
    get flowState(): LoginState { return this._flowState; }
    set flowState(value: LoginState) {
        if (value !== this._flowState) {
            this._flowState = value;
            switch (value) {
                case LoginState.GET_ACCOUNT:
                    this.buttons = this._buttonsGetAccount;
                    break;
                case LoginState.GETTING_CHARS:
                    this.buttons = this._buttonsGettingChars;
                    break;
                case LoginState.GET_CHAR:
                    this.buttons = this._buttonsGetChar;
                    break;
                case LoginState.LOGGING_IN:
                    this.buttons = this._buttonsLoggingIn;
                    break;
            }
        }
    }

    @observableProperty
    failureMessageSeverity: FailureSeverity = FailureSeverity.NONE;
    @observableProperty
    failureMessage: string = "";

    @observableProperty
    accountName: string = "";
    @observableProperty
    password: string = "";

    @observableProperty
    rememberAccountName: boolean = false;
    @observableProperty
    rememberPassword: boolean = false;

    private authApi: FListAuthenticatedApi | null = null;

    @observableProperty
    characters: ObservableKeyExtractedOrderedDictionary<CharacterName, CharacterName> = new ObservableOrderedDictionaryImpl<CharacterName, CharacterName>(x => x, CharacterName.compare);
    @observableProperty
    selectedCharacter: (CharacterName | null) = null;

    @observableProperty
    selectedRecent: boolean = false;

    @observableProperty
    recentCharacters: Collection<KeyValuePair<CharacterName, CharacterName>> = new UnsortedCharacterNameSet();

    @observableProperty
    get canAutoLogin() {
        return this.rememberAccountName && this.rememberPassword;
    }

    @observableProperty
    autoLogin: boolean = false;

    async getCharacters(cancellationToken: CancellationToken) { 
        if (this.flowState !== LoginState.GET_ACCOUNT) { return; }

        if (StringUtils.isNullOrWhiteSpace(this.accountName) || StringUtils.isNullOrWhiteSpace(this.password)) {
            this.failureMessageSeverity = FailureSeverity.ADVISORY;
            this.failureMessage = "You must provide a username and password.";
            return;
        }

        this.flowState = LoginState.GETTING_CHARS;
        try {
            this.authApi = await this.parent.flistApi.getAuthenticatedApiAsync(this.accountName, this.password, cancellationToken);
            const apiTicket = await this.authApi.getApiTicketAsync(cancellationToken);

            // save username and/or password into settings
            if (this.rememberAccountName) {
                const saveUsername = this.accountName;
                const savePassword = this.rememberPassword ? this.password : null;
                this.parent.appSettings.savedAccountCredentials.updateCredentials(saveUsername, savePassword);
            }

            const hasCharacters = new Set<CharacterName>();

            const isAlreadyLoggedIn = (name: CharacterName) => {
                for (let l of this.parent.logins) {
                    if (l.characterName == name) {
                        return true;
                    }
                }
                return false;
            };

            this.characters = new CharacterNameSet();
            for (let c of Object.getOwnPropertyNames(apiTicket.characters)) {
                const cn = CharacterName.create(c);
                if (!isAlreadyLoggedIn(cn)) {
                    this.characters.add(cn);
                }
                hasCharacters.add(cn);
            }
            // TODO: select default_character

            const recents = IterableUtils.asQueryable(this.parent.appSettings.savedChatStates.values())
                .orderByDescending(scs => scs.lastLogin ?? 0)
                .where(scs => hasCharacters.has(scs.characterName))
                .take(3)
                .toArray();
            this.recentCharacters = new UnsortedCharacterNameSet();
            for (let r of recents) {
                if (!isAlreadyLoggedIn(r.characterName)) {
                    this.recentCharacters.add(new KeyValuePair(r.characterName, r.characterName));
                }
            }

            if (this.recentCharacters.length > 0) {
                this.selectedRecent = true;
                this.selectedCharacter = this.recentCharacters[0]!.key;
            }
            else {
                this.selectedRecent = false;
                this.selectedCharacter = this.characters.minKey()!;
            }

            this.failureMessageSeverity = FailureSeverity.NONE;
            this.failureMessage = "";
            this.flowState = LoginState.GET_CHAR;
        }
        catch (e) {
            this.failureMessageSeverity = FailureSeverity.REJECTED;
            this.failureMessage = CatchUtils.getMessage(e);
            this.flowState = LoginState.GET_ACCOUNT;
        }
    }

    async logIn(cancellationToken: CancellationToken) { 
        if (this.flowState !== LoginState.GET_CHAR) { return; }

        if (this.selectedCharacter == null) {
            this.failureMessageSeverity = FailureSeverity.ADVISORY;
            this.failureMessage = "You must select a character.";
            return;
        }

        try {
            this.flowState = LoginState.LOGGING_IN;

            await LoginUtils.performLoginAsync(this.parent, this.accountName, this.password, this.selectedCharacter, cancellationToken);

            if (this.rememberAccountName) {
                this.parent.appSettings.savedAccountCredentials.updateCredentials(
                    this.accountName,
                    this.rememberPassword ? this.password : null);
            }
            if (this.rememberAccountName && this.rememberPassword && this.autoLogin) {
                this.parent.appSettings.savedLogins.add(this.accountName, this.selectedCharacter);
            }
            else {
                this.parent.appSettings.savedLogins.delete(this.accountName, this.selectedCharacter);
            }

            this.close(true);
        }
        catch (e) {
            this.failureMessageSeverity = FailureSeverity.REJECTED;
            this.failureMessage = CatchUtils.getMessage(e);
            this.flowState = LoginState.GET_ACCOUNT;
        }
    }

    showAccountSelectDropdown(contextElement: HTMLElement) {
        const vm = new ContextMenuPopupViewModel<SavedAccountCredentialsViewModel>(this.parent, contextElement);
        vm.onValueSelected = (value) => {
            this.accountName = value.username;
            this.rememberAccountName = true;
            this.password = value.password ?? "";
            this.rememberPassword = !StringUtils.isNullOrWhiteSpace(value.password);
            vm.dismissed();
            this.setFocus("password");
        };

        for (let creds of this.parent.appSettings.savedAccountCredentials.values()) {
            const n = creds.account;
            const p = creds.password;

            const item = new ContextMenuPopupItemViewModel(n, new SavedAccountCredentialsViewModel(n, p), true);
            vm.items.push(item);
        }
        // for (let creds of [
        //     { account: "asdf", password: "asdf" },
        //     { account: "foob", password: "" },
        //     { account: "zoink zoink", password: "zz" },
        // ]) {
        //     const n = creds.account;
        //     const p = creds.password;
        //     const item = new ContextMenuPopupItemViewModel(n, new SavedAccountCredentialsViewModel(n, p), true);
        //     vm.items.push(item);
        // }

        this.parent.popups.push(vm);
    }

    private setFocus(propertyName: string) {
        this._focusListeners.forEachValueSnapshotted(handler => {
            try {
                handler(propertyName);
            }
            catch { }
        });
    }

    private readonly _focusListeners: SnapshottableSet<FocusListener> = new SnapshottableSet();
    addFocusListener(callback: FocusListener): IDisposable {
        this._focusListeners.add(callback);
        return asDisposable(() => {
            this._focusListeners.delete(callback);
        });
    }
}

export type FocusListener = (propertyName: string) => void;

export class SavedAccountCredentialsViewModel extends ObservableBase {
    constructor(username: string, password: string | null) {
        super();
        this.username = username;
        this.password = password;
    }

    @observableProperty
    username: string;

    @observableProperty
    password: (string | null);
}

export enum LoginState {
    GET_ACCOUNT = "getaccount",
    GETTING_CHARS = "gettingchars",
    GET_CHAR = "getchar",
    LOGGING_IN = "loggingin"
}

export enum FailureSeverity {
    NONE = "none",
    ADVISORY = "advisory",
    REJECTED = "rejected"
}
