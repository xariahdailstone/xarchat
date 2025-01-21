import { PartnerSearchFieldsDefinitions, PartnerSearchKink } from "../fchat/api/FListApi";
import { CharacterName } from "../shared/CharacterName";
import { CharacterStatus } from "../shared/CharacterSet";
import { OnlineStatus } from "../shared/OnlineStatus";
import { CancellationToken } from "../util/CancellationTokenSource";
import { CatchUtils } from "../util/CatchUtils";
import { HostInterop } from "../util/HostInterop";
import { ObservableBase, observableProperty } from "../util/ObservableBase";
import { Collection } from "../util/ObservableCollection";
import { ObservableExpression } from "../util/ObservableExpression";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";
import { AppViewModel } from "./AppViewModel";

export class PartnerSearchViewModel extends ObservableBase {
    constructor(public readonly activeLoginViewModel: ActiveLoginViewModel
    ) {
        super();
    }

    get appViewModel() { return this.activeLoginViewModel.appViewModel; }

    @observableProperty
    currentState: PartnerSearchState = PartnerSearchState.Uninitialized;

    @observableProperty
    partnerSearchFields: PartnerSearchFieldsDefinitions | null = null;

    @observableProperty
    searchResults: (readonly PartnerSearchResultItem[]) | null = null;

    @observableProperty
    errorMessage: string | null = null;

    private _canSearch: boolean = false;
    @observableProperty
    get canSearch(): boolean {
        return this._canSearch && (this.currentState == PartnerSearchState.Idle);
    }
    set canSearch(value: boolean) {
        this._canSearch = value;
    }

    searchGenders: Collection<string> = new Collection();
    searchOrientations: Collection<string> = new Collection();
    searchRoles: Collection<string> = new Collection();
    searchPositions: Collection<string> = new Collection();
    searchLanguages: Collection<string> = new Collection();
    searchFurryPrefs: Collection<string> = new Collection();
    searchKinks: Collection<PartnerSearchKink> = new Collection();

    async initialize() {
        if (this.currentState == PartnerSearchState.Uninitialized ||
            this.currentState == PartnerSearchState.FailedToLoadPartnerSearchFields) {

            this.currentState = PartnerSearchState.LoadingPartnerSearchFields;
            try
            {
                const pfi = await this.appViewModel.flistApi.getPartnerSearchFieldsAsync(CancellationToken.NONE);
                this.partnerSearchFields = pfi;
                this.currentState = PartnerSearchState.Idle;
                this.canSearch = true;
            }
            catch (e) {
                this.currentState = PartnerSearchState.FailedToLoadPartnerSearchFields;
            }
        }
    }

    resetSearch() {
        this.searchGenders.clear();
        this.searchOrientations.clear();
        this.searchRoles.clear();
        this.searchPositions.clear();
        this.searchLanguages.clear();
        this.searchKinks.clear();
    }

    private _nextSearchAt: number = 0;

    async executeSearch() {
        if (this.currentState == PartnerSearchState.Idle) {
            this.currentState = PartnerSearchState.AwaitingSearchResults;
            try {
                this.searchResults = null;
                this.errorMessage = null;
                this.canSearch = false;

                const r = await this.activeLoginViewModel.chatConnection.performPartnerSearchAsync({
                    genders: [...this.searchGenders],
                    orientations: [...this.searchOrientations],
                    roles: [...this.searchRoles],
                    positions: [...this.searchPositions],
                    languages: [...this.searchLanguages],
                    kinks: [...this.searchKinks.map(k => k.fetish_id)],
                    furryprefs: [...this.searchFurryPrefs]
                });
                const newResults: PartnerSearchResultItem[] = [];
                for (let char of r.characters) {
                    const cs = this.activeLoginViewModel.characterSet.getCharacterStatus(char);
                    const ritem: PartnerSearchResultItem = { characterName: char, status: cs };
                    newResults.push(ritem);
                }
                newResults.sort((a, b) => {
                    const aStatusPriority = (a.status.status == OnlineStatus.LOOKING) ? 0 : 1;
                    const bStatusPriority = (b.status.status == OnlineStatus.LOOKING) ? 0 : 1;
                    if (aStatusPriority < bStatusPriority) return -1;
                    if (aStatusPriority > bStatusPriority) return 1;

                    const aMessagePriority = (a.status.statusMessage != "") ? 0 : 1;
                    const bMessagePriority = (b.status.statusMessage != "") ? 0 : 1;
                    if (aMessagePriority < bMessagePriority) return -1;
                    if (aMessagePriority > bMessagePriority) return 1;

                    return CharacterName.compare(a.characterName, b.characterName);
                });
                this.searchResults = newResults;
            }
            catch (e) {
                this.errorMessage = CatchUtils.getMessage(e);
            }
            finally {
                this.currentState = PartnerSearchState.Idle;
                window.setTimeout(() => {
                    this.canSearch = true;
                }, 5000);
            }
        }
    }
}

export enum PartnerSearchState {
    Uninitialized,
    LoadingPartnerSearchFields,
    Idle,
    AwaitingSearchResults,

    FailedToLoadPartnerSearchFields
}

export interface PartnerSearchResultItem {
    characterName: CharacterName;
    status: CharacterStatus;
}