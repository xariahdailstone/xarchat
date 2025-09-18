import { ReadOnlyObservableCollection } from "../../util/ObservableCollection";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { FriendsListTabViewModel } from "./FriendsListTabViewModel";
import { SidebarTabViewModel } from "./SidebarTabContainerViewModel";
import { StandardSidebarTabContainerViewModel } from "./StandardSidebarTabContainerViewModel";

export interface IHasRightBarTabs {
    rightBarTabs: ReadOnlyObservableCollection<SidebarTabViewModel>;
}

export class RightSidebarTabContainerViewModel extends StandardSidebarTabContainerViewModel {
    constructor(session: ActiveLoginViewModel) {
        super(session);

        const selTabTabs = () => (session.selectedTab && (session.selectedTab as any as IHasRightBarTabs).rightBarTabs)
            ? (session.selectedTab as any as IHasRightBarTabs).rightBarTabs
            : null;

        this.watchExpr(selTabTabs, stabs => {
            if (stabs) {
                const colObs = stabs.addCollectionObserver(() => this.updateTabs());
                this.updateTabs();
                return colObs;
            }
            else {
                this.updateTabs();
                return null;
            }
        });

        this.updateTabs();
    }

    protected override myFriendsTabsLocation: string | null = "right";

    updateDisplayedTabs() {
        const result: SidebarTabViewModel[] = [];

        const addTabs = (...tabs: SidebarTabViewModel[]) => {
            for (let tab of tabs) {
                result.push(tab);
            }
        }

        const cRightBarTabs = (this.session.selectedTab && (this.session.selectedTab as any as IHasRightBarTabs).rightBarTabs);
        if (cRightBarTabs) {
            for (let tab of cRightBarTabs.iterateValues()) {
                addTabs(tab);
            }
        }

        addTabs(...this.getFriendsListTabs()); 

        return result;
    }    
}
