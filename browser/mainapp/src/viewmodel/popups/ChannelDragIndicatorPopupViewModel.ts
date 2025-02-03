import { observableProperty } from "../../util/ObservableBase";
import { PopupViewModel } from "./PopupViewModel";

export class ChannelDragIndicatorPopupViewModel extends PopupViewModel {
    @observableProperty
    position: ("before" | "after") = "before";
    
    @observableProperty
    targetElement: HTMLElement | null = null;
}