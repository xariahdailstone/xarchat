import { ChatChannelViewModel } from "../ChatChannelViewModel";
import { SidebarTabViewModel } from "./SidebarTabContainerViewModel";


export class ChannelUserListTabViewModel extends SidebarTabViewModel {
    constructor(public readonly channel: ChatChannelViewModel) {
        super();
    }
}
