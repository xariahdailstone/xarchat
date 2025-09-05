import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { SidebarTabViewModel } from "./SidebarTabContainerViewModel";

export class FriendsListTabViewModel extends SidebarTabViewModel {
    constructor(public readonly session: ActiveLoginViewModel) {
        super();
    }
}

