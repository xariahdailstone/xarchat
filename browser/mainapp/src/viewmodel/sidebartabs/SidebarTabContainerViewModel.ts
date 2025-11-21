import { IDisposable, isDisposable } from "../../util/Disposable";
import { ReadOnlyObservableCollection } from "../../util/ObservableCollection";

export interface SidebarTabContainerViewModel extends IDisposable {
    readonly containerClasses: ReadonlyArray<string>;

    readonly tabs: ReadOnlyObservableCollection<SidebarTabViewModel>;

    selectedTab: SidebarTabViewModel | null;
}

export interface SidebarTabViewModel extends IDisposable {
    readonly tabId: string;

    readonly canHideTabStripWhenAlone: boolean;
}


