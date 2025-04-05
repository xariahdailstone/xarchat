import { KeyCodes } from "../../util/KeyCodes";
import { ObservableBase } from "../../util/ObservableBase";
import { XarChatUtils } from "../../util/XarChatUtils";
import { AppViewModel } from "../AppViewModel";
import { DialogButtonStyle, DialogButtonViewModel, DialogViewModel } from "./DialogViewModel";

export class AboutViewModel extends DialogViewModel<boolean> {
    constructor(parent: AppViewModel) {
        super(parent);

        this.title = "About XarChat";

        this.buttons.add(new DialogButtonViewModel({
            title: "OK",
            shortcutKeyCode: KeyCodes.RETURN,
            onClick: () => { this.close(false); },
            style: DialogButtonStyle.DEFAULT
        }));
        
        this.closeBoxResult = false;
    }

    readonly productName = "XarChat";

    get clientVersion() { return XarChatUtils.clientVersion; }
    get clientPlatform() { return XarChatUtils.clientPlatform; }
    get clientBranch() { return XarChatUtils.clientBranch; }

    get fullClientVersion() { return XarChatUtils.getFullClientVersionString(); }
}