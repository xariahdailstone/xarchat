import { KeyCodes } from "../../util/KeyCodes";
import { observableProperty } from "../../util/ObservableBase";
import { AppViewModel } from "../AppViewModel";
import { DialogButtonStyle, DialogButtonViewModel, DialogViewModel } from "./DialogViewModel";

export class AlertViewModel extends DialogViewModel<any> {
    constructor(parent: AppViewModel, message: string, title?: string, options?: Partial<AlertOptions>) {
        super(parent);

        this.message = message;
        this.title = title !== undefined ? title : "";
        this.options = { messageAsHtml: false, ...options };

        this.closeBoxResult = true;

        this.buttons.push(new DialogButtonViewModel({
            title: "OK",
            style: DialogButtonStyle.DEFAULT,
            shortcutKeyCode: KeyCodes.RETURN,
            onClick: () => {
                this.close(null);    
            }
        }));
    }

    @observableProperty
    message: string;

    @observableProperty
    options: AlertOptions
}

export interface AlertOptions {
    messageAsHtml: boolean;
}