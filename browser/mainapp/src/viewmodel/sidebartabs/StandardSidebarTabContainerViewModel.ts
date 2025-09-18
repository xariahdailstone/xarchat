import { asDisposable, ConvertibleToDisposable, IDisposable, DisposableOwnerField } from "../../util/Disposable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { Collection } from "../../util/ObservableCollection";
import { ObservableExpression } from "../../util/ObservableExpression";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { FriendsListTabViewModel } from "./FriendsListTabViewModel";
import { SidebarTabContainerViewModel, SidebarTabViewModel } from "./SidebarTabContainerViewModel";


export class StandardSidebarTabContainerViewModel extends ObservableBase implements SidebarTabContainerViewModel {
    constructor(public readonly session: ActiveLoginViewModel) {
        super();

        this.watchExpr(() => this.selectedTab, st => {
            if (st) {
                const tabId = st.tabId;
                const newRs = [tabId, ...this._rankedSelections.filter(i => i != tabId)];
                this._rankedSelections = newRs;
            }
        });
    }

    private _isDisposed = false;
    get isDisposed() { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            for (let tab of this.tabs) {
                tab.dispose();
            }
            asDisposable(...this._onDispose).dispose();
            this._onDispose = [];
        }
    }
    [Symbol.dispose](): void {
        this.dispose();
    }

    private _onDispose: ConvertibleToDisposable[] = [];
    protected onDispose(d: ConvertibleToDisposable) {
        if (this._isDisposed) {
            asDisposable(d).dispose();
        }
        else {
            this._onDispose.push(d);
        }
    }

    private readonly _watchExprs: Map<object, ObservableExpression<any>> = new Map();
    protected watchExpr<T>(expr: () => T, callback: (value: T | undefined) => (ConvertibleToDisposable | void | null | undefined)): IDisposable {
        const myKey = {};

        let isDisposed = false;
        let previousValue: T | undefined = undefined;
        let previousValueDisposable: DisposableOwnerField = new DisposableOwnerField();
        const valueChanged = (value: T | undefined) => {
            if (!isDisposed && value !== previousValue) {
                previousValueDisposable.value = null;
                previousValue = value;

                try {
                    const cbRes = callback(value);
                    if (cbRes) {
                        previousValueDisposable.value = asDisposable(cbRes);
                    }
                }
                catch { }
            }
        };

        const obsExpr = new ObservableExpression<T>(expr,
            (v) => valueChanged(v),
            (err) => valueChanged(undefined)
        );
        this._watchExprs.set(myKey, obsExpr);

        return asDisposable(() => {
            valueChanged(undefined);
            isDisposed = true;
            obsExpr.dispose();
            this._watchExprs.delete(myKey);
            previousValueDisposable.dispose();
        });
    }

    private _rankedSelections: string[] = [];
    selectTabById(tabId: string) {
        for (let tab of this.tabs) {
            if (tab.tabId == tabId) {
                this.selectedTab = tab;
                return;
            }
        }
    }

    private updateSelectedTab() {
        for (let tabId of this._rankedSelections) {
            for (let tab of this.tabs) {
                if (tab.tabId == tabId) {
                    this.selectedTab = tab;
                    return;
                }
            }
        }
        this.selectedTab = this.getDefaultSelectedTab();
        return;
    }

    protected getDefaultSelectedTab(): SidebarTabViewModel | null {
        if (this.tabs.length > 0) {
            return this.tabs[0] ?? null;
        }
        else {
            return null;
        }
    }

    private _updatingTabs: boolean = false;
    protected updateTabs() {
        if (!this._updatingTabs) {
            this._updatingTabs = true;
            try {
                const shouldHaveTabs = this.updateDisplayedTabs();
                for (let i = 0; i < shouldHaveTabs.length; i++) {
                    const tshouldBe = shouldHaveTabs[i];
                    if (this.tabs[i] !== tshouldBe) {
                        this.tabs.remove(tshouldBe);
                        this.tabs.addAt(tshouldBe, i);
                    }
                }
                while (this.tabs.length > shouldHaveTabs.length) {
                    this.tabs.removeAt(shouldHaveTabs.length);
                }
            }
            finally {
                this._updatingTabs = false;
            }
            this.updateSelectedTab();
        }
    }

    protected updateDisplayedTabs(): SidebarTabViewModel[] { return []; }

    private _watchingFriendsProps: boolean = false;
    private _friendsTabViewModel: FriendsListTabViewModel | null = null;
    private _friendsTabViewModel2: FriendsListTabViewModel | null = null;

    protected myFriendsTabsLocation: string | null = null;

    protected getFriendsListTabs(): SidebarTabViewModel[] {
        const results: SidebarTabViewModel[] = [];

        if (!this._watchingFriendsProps) {
            this.watchExpr(() => this.session.getConfigSettingById("friendsTabLocation") as string, ftl => {
                if (this._watchingFriendsProps) {
                    this.updateTabs();
                }
            });
            this.watchExpr(() => this.session.getConfigSettingById("joinFriendsAndBookmarks") as boolean, ftl => {
                if (this._watchingFriendsProps) {
                    this.updateTabs();
                }
            });
            this._watchingFriendsProps = true;
        }

        const showFriendsTab = ((this.session.getConfigSettingById("friendsTabLocation") as string) == this.myFriendsTabsLocation);
        const joinFriendsAndBookmarks = !!(this.session.getConfigSettingById("joinFriendsAndBookmarks"));

        if (showFriendsTab) {
            this._friendsTabViewModel = this._friendsTabViewModel ?? new FriendsListTabViewModel(this.session);
            results.push(this._friendsTabViewModel);
            if (joinFriendsAndBookmarks) {
                this._friendsTabViewModel.show = "both";
            }
            else {
                this._friendsTabViewModel.show = "friends";
                this._friendsTabViewModel2 = this._friendsTabViewModel2 ?? new FriendsListTabViewModel(this.session);
                this._friendsTabViewModel2.show = "bookmarks";
                results.push(this._friendsTabViewModel2);
            }
        }

        return results;
    }

    @observableProperty
    containerClasses: ReadonlyArray<string> = [];

    @observableProperty
    tabs: Collection<SidebarTabViewModel> = new Collection();

    @observableProperty
    selectedTab: SidebarTabViewModel | null = null;
}
