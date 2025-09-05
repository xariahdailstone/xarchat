import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { SidebarTabViewModel } from "./SidebarTabContainerViewModel";


export class OtherTabsTabViewModel extends SidebarTabViewModel {
    constructor(public readonly session: ActiveLoginViewModel) {
        super();
    }
}
