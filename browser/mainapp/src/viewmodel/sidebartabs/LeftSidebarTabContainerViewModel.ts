import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { ChatsListTabViewModel } from "./ChatsListTabViewModel";
import { FriendsListTabViewModel } from "./FriendsListTabViewModel";
import { OtherTabsTabViewModel } from "./OtherTabsTabViewModel";
import { SidebarTabViewModel } from "./SidebarTabContainerViewModel";
import { StandardSidebarTabContainerViewModel } from "./StandardSidebarTabContainerViewModel";


export class LeftSidebarTabContainerViewModel extends StandardSidebarTabContainerViewModel {
    constructor(session: ActiveLoginViewModel) {
        super(session);

        this._chatsListTabViewModel = new ChatsListTabViewModel(session);
        this._otherTabsTabViewModel = new OtherTabsTabViewModel(session);
        this.updateTabs();
    }

    private readonly _chatsListTabViewModel: ChatsListTabViewModel;
    private readonly _otherTabsTabViewModel: OtherTabsTabViewModel;

    protected override myFriendsTabsLocation: string | null = "left";

    updateDisplayedTabs() {
        const result: SidebarTabViewModel[] = [];

        const addTabs = (...tabs: SidebarTabViewModel[]) => {
            for (let tab of tabs) {
                result.push(tab);
            }
        }

        addTabs(this._chatsListTabViewModel);

        addTabs(...this.getFriendsListTabs());

        addTabs(this._otherTabsTabViewModel);

        return result;
    }

    protected override getDefaultSelectedTab(): SidebarTabViewModel | null { return this._chatsListTabViewModel; }
}
