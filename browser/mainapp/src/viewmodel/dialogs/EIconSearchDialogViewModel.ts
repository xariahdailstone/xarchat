import { EIconSearchResults, HostInterop } from "../../util/HostInterop";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { AppViewModel } from "../AppViewModel";
import { DialogButtonStyle, DialogButtonViewModel, DialogViewModel } from "./DialogViewModel";
import { ContextPopupViewModel } from "../popups/PopupViewModel";
import { TaskUtils } from "../../util/TaskUtils";
import { StringUtils } from "../../util/StringUtils";

export enum EIconSearchStatus {
    WELCOME_PAGE,
    SEARCHING,
    RESULT_DISPLAY
}

export class EIconSearchDialogViewModel extends DialogViewModel<string | null> {
    constructor(parent: AppViewModel) {
        super(parent);

        this.title = "EIcon Search";
        this.closeBoxResult = null;

        this.onSearchTextChanged();

        //this.searchResultCount = 20000;
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

    confirmKeyboardEntry() {
        if (this.currentKeyboardSelectedEIcon) {
            this.close(this.currentKeyboardSelectedEIcon);
        }
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
    searchResultCount: number = 0;

    @observableProperty
    currentKeyboardSelectedEIcon: string | null = null;

    clickedOutside() {
        this.close(null);
    }

    // async getSearchResultsAsync(startAt: number, count: number): Promise<EIconSearchResult[]> {
    //     const results = [];

    //     for (let idx = 0; idx < count; idx++) {
    //         results.push({ eiconName: "xarwink" });
    //     }

    //     return results;
    // }

    async getSearchResultsAsync(startAt: number, count: number): Promise<EIconSearchResult[]> {
        if (this.searchState != EIconSearchStatus.RESULT_DISPLAY) { return []; }

        const searchingOnSearchKey = this._currentSearchKey;

        const hiResults = await HostInterop.searchEIconsAsync(this._currentSearchText, startAt, count);
        if (searchingOnSearchKey !== this._currentSearchKey) { return []; }

        const results: EIconSearchResult[] = [];
        for (let hir of hiResults.results) {
            results.push({ eiconName: hir });
        }
        return results;
    }

    private _currentSearchText: string = "";
    private _currentSearchKey: object = {};
    private _needsClear: boolean = false;
    private async onSearchTextChanged() {
        const searchText = this.searchText;
        const mySearchKey = {};
        this._currentSearchKey = mySearchKey;

        this.setIsSearching(true);
        try {
            this.currentKeyboardSelectedEIcon = null;
            if (this._needsClear) {
                await HostInterop.clearEIconSearchAsync();
                this._needsClear = false;
                if (this._currentSearchKey !== mySearchKey) { return; }
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

            this._currentSearchText = searchText;
            this.searchResultCount = results.totalCount;
            this.setIsSearching(false);
        }
        finally {
            if (this._currentSearchKey === mySearchKey) {
                this.setIsSearching(false);
            }
        }
    }
}

export interface EIconSearchResult {
    readonly eiconName: string;
}

export enum EIconSearchTab {
    SEARCH,
    FAVORITES
}