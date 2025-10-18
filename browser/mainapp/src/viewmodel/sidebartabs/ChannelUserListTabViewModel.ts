import { ChatChannelViewModel } from "../ChatChannelViewModel";
import { SidebarTabViewModel } from "./SidebarTabContainerViewModel";
import { StandardSidebarTabViewModel } from "./StandardSidebarTabViewModel";


export class ChannelUserListTabViewModel extends StandardSidebarTabViewModel {
    constructor(public readonly channel: ChatChannelViewModel) {
        super();
    }

    tabId: string = "channeluserlist";
    canHideTabStripWhenAlone: boolean = true;
}
