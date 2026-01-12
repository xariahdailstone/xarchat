import { KeyCodes } from "../../util/KeyCodes";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { AppViewModel } from "../AppViewModel";
import { DialogButtonStyle, DialogButtonViewModel, DialogViewModel } from "./DialogViewModel";

export class UpdateInfoDialogViewModel extends DialogViewModel<number> {
    constructor(appViewModel: AppViewModel) {
        super(appViewModel);

        this.title = "XarChat Update";
        this.closeBoxResult = -1;

        this._btnRemindMe = this.buttons.add(new DialogButtonViewModel({ 
            title: "Remind Me Later",
            shortcutKeyCode: KeyCodes.ESCAPE,
            style: DialogButtonStyle.CANCEL,
            onClick: () => {
            }
        }));
        this.buttons.add(new DialogButtonViewModel({ 
            title: "Download Update",
            shortcutKeyCode: KeyCodes.RETURN,
            style: DialogButtonStyle.DEFAULT,
            onClick: () => {
            }
        }));
    }

    private readonly _btnRemindMe: DialogButtonViewModel;

    private _newVersion: string = "";
    @observableProperty
    get newVersion(): string { return this._newVersion; }
    set newVersion(value: string) {
        if (value !== this._newVersion) {
            this._newVersion = value;
            this.title = `XarChat Update [${value}]`;
        }
    }

    @observableProperty
    currentVersion: string = "";

    @observableProperty
    changelogBBCode: string = "";

    private _mustUpdate: boolean = false;
    @observableProperty
    get mustUpdate(): boolean { return this._mustUpdate; }
    set mustUpdate(value: boolean) {
        if (value != this._mustUpdate) {
            this._mustUpdate = value;
            this.closeBoxResult = value ? undefined : -1;
            this._btnRemindMe.visible = !value;
        }
    }
}