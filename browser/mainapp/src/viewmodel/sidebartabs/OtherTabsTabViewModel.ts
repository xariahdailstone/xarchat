import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { StandardSidebarTabViewModel } from "./StandardSidebarTabViewModel";


export class OtherTabsTabViewModel extends StandardSidebarTabViewModel {
    constructor(public readonly session: ActiveLoginViewModel) {
        super();
    }

    readonly tabId = "othertabs";
}
