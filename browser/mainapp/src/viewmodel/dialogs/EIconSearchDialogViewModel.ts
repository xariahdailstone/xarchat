import { EIconSearchResults, HostInterop } from "../../util/HostInterop";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { AppViewModel } from "../AppViewModel";
import { DialogButtonStyle, DialogButtonViewModel, DialogViewModel } from "./DialogViewModel";
import { ContextPopupViewModel } from "../popups/PopupViewModel";
import { TaskUtils } from "../../util/TaskUtils";
import { StringUtils } from "../../util/StringUtils";
import { CancellationTokenSource } from "../../util/CancellationTokenSource";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { PromiseSource } from "../../util/PromiseSource";
import { asDisposable, ConvertibleToDisposable } from "../../util/Disposable";

export enum EIconSearchStatus {
    WELCOME_PAGE,
    SEARCHING,
    RESULT_DISPLAY
}

export class EIconSearchDialogViewModel extends DialogViewModel<string | null> {
    constructor(
        parent: AppViewModel,
        session: ActiveLoginViewModel | null) {

        super(parent);

        this.title = "EIcon Search";
        this.closeBoxResult = null;

        this.onSearchTextChanged();

        //this.searchResultCount = 20000;

        if (session) {
            this.createFavoriteEIconsSet(session);
        }
        this.recentlyUsedEIcons = session ? this.createRecentlyUsedEIconsSet(session) : null;
        this.mostUsedEIcons = session ? this.createMostUsedEIconsSet(session) : null;
    }

    private createFavoriteEIconsSet(session: ActiveLoginViewModel) {
        const updateFavoriteSet = (v: any) => {
            try {
                const favs = v ?? [];
                this.favoriteEIcons = new EIconResultSetFixed(this, favs as string[]);
                return;
            }
            catch { }
            this.favoriteEIcons =  new EIconResultSetFixed(this, []);
        };
        
        this._disposablesOnClose.push(
            session.appViewModel.configBlock.observe("global.favoriteEIcons", v => {
                updateFavoriteSet(v);
            })
        );
        updateFavoriteSet(session.appViewModel.configBlock.get("global.favoriteEIcons"));
    }

    private createRecentlyUsedEIconsSet(session: ActiveLoginViewModel): EIconResultSet {
        const recentList = session.getRecentlyUsedEIcons();
        return new EIconResultSetFixed(this, recentList);
    }

    private createMostUsedEIconsSet(session: ActiveLoginViewModel): EIconResultSet {
        const recentList = session.getMostUsedEIcons();
        return new EIconResultSetFixed(this, recentList);
    }

    private _searchText: string = "";

    @observableProperty
    get searchText(): string { return this._searchText; }
    set searchText(value: string) {
        if (value !== this._searchText) {
            this._searchText = value;
            this.onSearchTextChanged();
        }
    }

    confirmEntry() {
        this.close(this.searchText);
    }

    private _disposablesOnClose: ConvertibleToDisposable[] = [];

    override close(result: string | null): void {
        asDisposable(...this._disposablesOnClose).dispose();
        this._disposablesOnClose = [];
        super.close(result);
    }

    // confirmKeyboardEntry() {
    //     if (this.currentKeyboardSelectedEIcon) {
    //         this.close(this.currentKeyboardSelectedEIcon);
    //     }
    // }

    returnResult(eiconName: string) {
        this.close(eiconName);
    }

    private _isSearching: boolean = false;
    private setIsSearching(value: boolean) {
        if (value !== this._isSearching) {
            this._isSearching = value;
            this.updateIsSearchState();
        }
    }

    private updateIsSearchState() {
        let resultState: EIconSearchStatus;
        if (this._isSearching) {
            resultState = EIconSearchStatus.SEARCHING;
        }
        else if (this._searchText.trim() == "") {
            resultState = EIconSearchStatus.WELCOME_PAGE;
        }
        else {
            resultState = EIconSearchStatus.RESULT_DISPLAY;
        }
        if (resultState !== this.searchState) {
            this.searchState = resultState;
        }
    }

    @observableProperty
    searchState: EIconSearchStatus = EIconSearchStatus.WELCOME_PAGE;

    @observableProperty
    currentResultSet: EIconResultSetDynamic | null = null;

    @observableProperty
    favoriteEIcons: EIconResultSet | null = null;

    @observableProperty
    recentlyUsedEIcons: EIconResultSet | null = null;

    @observableProperty
    mostUsedEIcons: EIconResultSet | null = null;

    // @observableProperty
    // searchResultCount: number = 0;

    clickedOutside() {
        this.close(null);
    }

    // async getSearchResultsAsync(startAt: number, count: number): Promise<EIconSearchResult[]> {
    //     if (this.searchState != EIconSearchStatus.RESULT_DISPLAY) { return []; }

    //     const searchingOnSearchKey = this._currentSearchKey;

    //     const hiResults = await HostInterop.searchEIconsAsync(this._currentSearchText, startAt, count);
    //     if (searchingOnSearchKey !== this._currentSearchKey) { return []; }

    //     const results: EIconSearchResult[] = [];
    //     for (let hir of hiResults.results) {
    //         results.push({ eiconName: hir });
    //     }
    //     return results;
    // }

    //private _currentSearchText: string = "";
    private _currentSearchKey: object = {};
    private _needsClear: boolean = false;
    private async onSearchTextChanged() {
        const searchText = this.searchText;
        const mySearchKey = {};
        this._currentSearchKey = mySearchKey;

        this.setIsSearching(true);
        try {
            //this.currentKeyboardSelectedEIcon = null;
            if (this._needsClear) {
                await HostInterop.clearEIconSearchAsync();
                this._needsClear = false;
                if (this._currentSearchKey !== mySearchKey) { return; }
            }
            if (this.currentResultSet) {
                this.currentResultSet.dispose();
                this.currentResultSet = null;
            }

            await TaskUtils.delay(100);
            if (this._currentSearchKey !== mySearchKey) { return; }
            if (this.searchText != searchText) { return; }

            let results: EIconSearchResults;
            if (searchText.trim() != "") {
                results = await HostInterop.searchEIconsAsync(searchText, 0, 0);
            }
            else {
                results = { totalCount: 0, results: [] };
            }
            this._needsClear = true;
            if (this._currentSearchKey !== mySearchKey) { return; }

            //this._currentSearchText = searchText;
            // this.searchResultCount = results.totalCount;
            this.currentResultSet = new EIconResultSetDynamic(this, results.totalCount, searchText);
            this.setIsSearching(false);
        }
        finally {
            if (this._currentSearchKey === mySearchKey) {
                this.setIsSearching(false);
            }
        }
    }
}

export interface EIconResultSet {
    readonly parent: EIconSearchDialogViewModel;
    readonly searchResultCount: number;
    getSearchResultsAsync(startAt: number, count: number): Promise<EIconSearchResult[]>;
}
export class EIconResultSetDynamic implements EIconResultSet, Disposable {
    constructor(
        readonly parent: EIconSearchDialogViewModel,
        readonly searchResultCount: number,
        private readonly searchText: string) {

    }

    private _isDisposed: boolean = false;
    get isDisposed() { return this._isDisposed; }

    dispose() {
        if (!this._isDisposed) {
            this._isDisposed = true;
        }
    }
    [Symbol.dispose]() {
        this.dispose();
    }

    async getSearchResultsAsync(startAt: number, count: number): Promise<EIconSearchResult[]> {
        if (this._isDisposed) { return []; }

        const hiResults = await HostInterop.searchEIconsAsync(this.searchText, startAt, count);
        if (this._isDisposed) { return []; }

        const results: EIconSearchResult[] = [];
        for (let hir of hiResults.results) {
            results.push({ eiconName: hir });
        }
        return results;        
    }
}
export class EIconResultSetFixed implements EIconResultSet {
    constructor(
        readonly parent: EIconSearchDialogViewModel,
        private readonly items: string[]) {

    }
    
    get searchResultCount(): number { return this.items.length; }

    getSearchResultsAsync(startAt: number, count: number): Promise<EIconSearchResult[]> {
        const results: EIconSearchResult[] = [];
        for (let i = startAt; i < startAt + count; i++) {
            const item = this.items[i];
            if (item) {
                results.push({ eiconName: item });
            }
        }
        return PromiseSource.resolvedPromise(results);
    }
}


export interface EIconSearchResult {
    readonly eiconName: string;
}

export enum EIconSearchTab {
    SEARCH,
    FAVORITES
}