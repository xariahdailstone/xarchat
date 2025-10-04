import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { StandardSidebarTabViewModel } from "./StandardSidebarTabViewModel";


export class RecentConversationsTabViewModel extends StandardSidebarTabViewModel {
    constructor(public readonly session: ActiveLoginViewModel) {
        super();
    }

    readonly tabId = "recentconversations";
}
