import { OnlineStatus } from "../../shared/OnlineStatus";
import { ObservableValue } from "../../util/Observable";
import { observableProperty } from "../../util/ObservableBase";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { AppViewModel } from "../AppViewModel";
import { DialogButtonStyle, DialogButtonViewModel, DialogViewModel } from "./DialogViewModel";

export class CharacterStatusEditDialogViewModel extends DialogViewModel<StatusEditResult | null> {
    constructor(parent: AppViewModel,
        public readonly activeLoginViewModel: ActiveLoginViewModel,
        statusMessage: string,
        onlineStatus: OnlineStatus) {

        super(parent);

        this.closeBoxResult = null;
        this.title = "Edit Status";

        this._btnUpdate = this.buttons.add(new DialogButtonViewModel({
            title: "Update Status",
            style: DialogButtonStyle.DEFAULT,
            onClick: () => {
                this.close({ statusMessage: this.statusMessage, onlineStatus: this.onlineStatus });
            }
        }));
        // this.buttons.add(new DialogButtonViewModel({
        //     title: "Cancel",
        //     style: DialogButtonStyle.CANCEL,
        //     onClick: () => { this.close(null); }
        // }));

        this.statusMessage = statusMessage;
        this.onlineStatus = onlineStatus;
    }

    private readonly _btnUpdate: DialogButtonViewModel;

    private readonly _statusMessage: ObservableValue<string> = new ObservableValue("");
    get statusMessage(): string { return this._statusMessage.value; }
    set statusMessage(value: string) {
        if (value != this._statusMessage.value) {
            this._statusMessage.value = value;

            this._btnUpdate.enabled = (value.length <= 255);
        }
    }

    @observableProperty
    onlineStatus: OnlineStatus;
}

export interface StatusEditResult {
    statusMessage: string;
    onlineStatus: OnlineStatus;
}