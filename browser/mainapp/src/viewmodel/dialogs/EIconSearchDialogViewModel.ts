import { HostInterop } from "../../util/HostInterop";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { AppViewModel } from "../AppViewModel";
import { ChannelViewModel } from "../ChannelViewModel";
import { DialogButtonStyle, DialogButtonViewModel, DialogViewModel } from "./DialogViewModel";
import { ContextPopupViewModel } from "../popups/PopupViewModel";
import { TaskUtils } from "../../util/TaskUtils";

export class EIconSearchDialogViewModel extends DialogViewModel<string | null> {
    constructor(parent: ChannelViewModel) {
        super(parent.appViewModel);

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

    @observableProperty
    isSearching: boolean = false;

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
        if (this.isSearching) { return []; }

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

        this.isSearching = true;
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

            const results = await HostInterop.searchEIconsAsync(searchText, 0, 0);
            this._needsClear = true;
            if (this._currentSearchKey !== mySearchKey) { return; }

            this.isSearching = false;
            this._currentSearchText = searchText;
            this.searchResultCount = results.totalCount;
        }
        finally {
            if (this._currentSearchKey === mySearchKey) {
                this.isSearching = false;
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