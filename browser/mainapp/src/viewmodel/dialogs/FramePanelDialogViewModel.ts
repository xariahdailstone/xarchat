import { HostInterop } from "../../util/hostinterop/HostInterop";
import { observableProperty } from "../../util/ObservableBase";
import { AppViewModel } from "../AppViewModel";
import { DialogCaptionButtonViewModel, DialogViewModel } from "./DialogViewModel";

export class FramePanelDialogViewModel extends DialogViewModel<number> {
    constructor(parent: AppViewModel, url: string, displayUrl: string) {
        super(parent);
        this.url = url;
        this.displayUrl = displayUrl;
        this.closeBoxResult = 1;

        this.captionButtons.push(new DialogCaptionButtonViewModel("assets/ui/openexternal-icon.svg", () => {
            HostInterop.launchUrl(parent, this.displayUrl, true);
            this.close(0);
        }));
    }

    @observableProperty
    url: string;

    @observableProperty
    displayUrl: string;

    clickedOutside() {
        this.close(0);
    }
}