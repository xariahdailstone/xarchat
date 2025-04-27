import { CancellationToken } from "../../util/CancellationTokenSource";
import { KeyCodes } from "../../util/KeyCodes";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { Collection } from "../../util/ObservableCollection";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { AppViewModel } from "../AppViewModel";
import { ChannelViewModel } from "../ChannelViewModel";
import { SuggestionItem } from "../SuggestTextBoxViewModel";
import { DialogButtonStyle, DialogButtonViewModel, DialogViewModel } from "./DialogViewModel";

export class PromptViewModel<TResult> extends DialogViewModel<TResult> {
    constructor(parent: AppViewModel, options: PromptOptions<TResult>) {
        super(parent);

        this.title = options.title ?? "";
        this.message = options.message;
        this.messageAsHtml = options.messageAsHtml ?? false;
        this.closeBoxResult = options.closeBoxResult;

        for (let btnOptions of options.buttons) {
            const buttonVm = new DialogButtonViewModel({
                title: btnOptions.title,
                shortcutKeyCode: btnOptions.shortcutKeyCode,
                style: btnOptions.style,
                onClick: () => {
                    this.close(btnOptions.resultValue);
                }
            });
            this.buttons.add(buttonVm);
        }
    }

    @observableProperty
    readonly message: string;

    @observableProperty
    readonly messageAsHtml: boolean;
}

export class PromptForStringViewModel extends DialogViewModel<string | null> {
    constructor(parent: AppViewModel, options: PromptForStringOptions) {
        super(parent);

        this._options = options;

        this.title = options.title ?? "";
        this.value = options.initialValue ?? "";

        this.confirmButtonVm = new DialogButtonViewModel({
            title: options.confirmButtonTitle ?? "OK",
            shortcutKeyCode: KeyCodes.RETURN,
            style: DialogButtonStyle.DEFAULT,
            onClick: () => {
                this.close(this.value);
            }
        });
        this.buttons.add(this.confirmButtonVm);

        if (options.cancelButtonTitle) {
            const cancelButtonVm = new DialogButtonViewModel({
                title: options.cancelButtonTitle,
                shortcutKeyCode: KeyCodes.ESCAPE,
                style: DialogButtonStyle.CANCEL,
                onClick: () => {
                    this.close(options.valueOnCancel ?? null)
                } 
            });
            this.buttons.add(cancelButtonVm);
        }

        this.closeBoxResult = options.valueOnCancel ?? null;

        this.validateValue();
    }

    private _options: PromptForStringOptions;

    private confirmButtonVm: DialogButtonViewModel;

    @observableProperty
    get message(): string { return this._options.message; }

    @observableProperty
    get messageAsHtml(): boolean { return this._options.messageAsHtml ?? false; }

    @observableProperty
    get multiline() { return this._options.multiline ?? false; }

    @observableProperty
    get isBBCodeString() { return this._options.isBBCodeString ?? false; }

    @observableProperty
    get maxLength() { return this._options.maxLength; }

    @observableProperty
    get activeLoginViewModel() { return this._options.activeLoginViewModel; }

    @observableProperty
    get channelViewModel() { return this._options.channelViewModel; }

    @observableProperty
    get suggestionFunc() { return this._options.suggestionFunc; }

    private _value: string = null!;
    @observableProperty
    get value(): string { return this._value; }
    set value(value: string) {
        if (value !== this._value) {
            this._value = value;
            this.validateValue();
        }
    }

    private validateValue() {
        if (this.validationFunc) {
            const isValid = this.validationFunc(this._value);
            if (this.confirmButtonVm) {
                this.confirmButtonVm.enabled = isValid;
            }
        }
    }

    @observableProperty
    get validationFunc(): ((value: string) => boolean) | null { return this._options.validationFunc ?? null; }
}

export interface PromptOptions<TResult> {
    title?: string;
    message: string;
    messageAsHtml?: boolean;
    closeBoxResult?: TResult;

    buttons: PromptButtonOptions<TResult>[];
}

export interface PromptButtonOptions<TResult> {
    title: string;
    style: DialogButtonStyle;
    shortcutKeyCode?: number;
    resultValue: TResult;
}

export interface PromptForStringOptions {
    title?: string;
    message: string;
    messageAsHtml?: boolean;

    initialValue?: string;
    valueOnCancel?: string | null;

    confirmButtonTitle?: string;
    cancelButtonTitle?: string;

    multiline?: boolean;
    isBBCodeString?: boolean;
    maxLength?: number;
    activeLoginViewModel?: ActiveLoginViewModel;
    channelViewModel?: ChannelViewModel;

    validationFunc?: (value: string) => boolean;
    suggestionFunc?: (value: string, cancellationToken: CancellationToken) => Promise<SuggestionItem[]>;
}