import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { SideBarTabViewModel } from "./SideBarTabViewModel";


export class ChannelsAndPMsSideBarTabViewModel extends SideBarTabViewModel {
    constructor(session: ActiveLoginViewModel) {
        super(session, {
            tabCode: "channellist",
            tooltipTitle: "Channels and PMs",
            iconUrl: "",
            iconText: ""
        });
    }
}


