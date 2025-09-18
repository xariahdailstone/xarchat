import { observableProperty } from "../../util/ObservableBase";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { StandardSidebarTabViewModel } from "./StandardSidebarTabViewModel";

export class FriendsListTabViewModel extends StandardSidebarTabViewModel {
    constructor(public readonly session: ActiveLoginViewModel) {
        super();
    }

    get tabId() { 
        switch (this.show) {
            case "friends":
            case "both":
                return "friendslist";
            case "bookmarks":
                return "bookmarkslist";
        }
    }

    @observableProperty
    show: ("both" | "friends" | "bookmarks") = "both";
}

