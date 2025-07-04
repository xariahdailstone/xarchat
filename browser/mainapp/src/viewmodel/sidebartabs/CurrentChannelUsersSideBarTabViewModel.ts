import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { SideBarTabViewModel } from "./SideBarTabViewModel";


export class CurrentChannelUsersSideBarTabViewModel extends SideBarTabViewModel {
    constructor(session: ActiveLoginViewModel) {
        super(session, {
            tabCode: "currentchannelusers",
            tooltipTitle: "Current Channel Characters",
            iconUrl: "",
            iconText: "0"
        });
    }
}
