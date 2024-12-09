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

    // @observableProperty
    // readonly title: string;

    @observableProperty
    readonly message: string;

    @observableProperty
    readonly messageAsHtml: boolean;
}

export interface PromptOptions<TResult> {
    title?: string;
    message: string;
    messageAsHtml?: boolean;

    buttons: PromptButtonOptions<TResult>[];
}

export interface PromptButtonOptions<TResult> {
    title: string;
    style: DialogButtonStyle;
    shortcutKeyCode?: number;
    resultValue: TResult;
}