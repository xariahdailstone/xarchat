import { KeyCodes } from "../../util/KeyCodes";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { Collection } from "../../util/ObservableCollection";
import { AppViewModel } from "../AppViewModel";
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

        this.title = options.title ?? "";
        this.message = options.message;
        this.messageAsHtml = options.messageAsHtml ?? false;
        this.value = options.initialValue ?? "";

        const confirmButtonVm = new DialogButtonViewModel({
            title: options.confirmButtonTitle ?? "OK",
            shortcutKeyCode: KeyCodes.RETURN,
            style: DialogButtonStyle.DEFAULT,
            onClick: () => {
                this.close(this.value);
            }
        });
        this.buttons.add(confirmButtonVm);

        this.closeBoxResult = options.valueOnCancel ?? null;
    }

    @observableProperty
    readonly message: string;

    @observableProperty
    readonly messageAsHtml: boolean;

    @observableProperty
    value: string;
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
}