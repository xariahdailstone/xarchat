import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { SidebarTabViewModel } from "./SidebarTabContainerViewModel";

export class ChatsListTabViewModel extends SidebarTabViewModel {
    constructor(public readonly session: ActiveLoginViewModel) {
        super();
    }

    override dispose() {
        super.dispose();
    }
}