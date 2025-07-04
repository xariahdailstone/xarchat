import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { SideBarTabViewModel } from "./SideBarTabViewModel";


export class OtherTabsSideBarTabViewModel extends SideBarTabViewModel {
    constructor(session: ActiveLoginViewModel) {
        super(session, {
            tabCode: "othertabs",
            tooltipTitle: "Other Tabs",
            iconUrl: "",
            iconText: ""
        });
    }
}
