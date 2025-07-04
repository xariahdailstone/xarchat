import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { SideBarTabViewModel } from "./SideBarTabViewModel";


export class FriendsAndBookmarksSideBarTabViewModel extends SideBarTabViewModel {
    constructor(session: ActiveLoginViewModel) {
        super(session, {
            tabCode: "watched",
            tooltipTitle: "Friends and Bookmarks",
            iconUrl: "",
            iconText: "0"
        });
    }
}
