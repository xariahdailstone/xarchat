import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { StandardSidebarTabViewModel } from "./StandardSidebarTabViewModel";

export class ChatsListTabViewModel extends StandardSidebarTabViewModel {
    constructor(public readonly session: ActiveLoginViewModel) {
        super();
    }

    readonly tabId = "chatslist";
}