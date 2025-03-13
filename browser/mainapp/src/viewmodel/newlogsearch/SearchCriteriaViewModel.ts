import { CharacterName } from "../../shared/CharacterName";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { TaskUtils } from "../../util/TaskUtils";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { SuggestTextboxItemViewModel, SuggestTextboxViewModel } from "./SuggestTextboxViewModel";

export class SearchCriteriaViewModel extends ObservableBase {
    constructor(public readonly activeLoginViewModel: ActiveLoginViewModel) {
        super();
        this.speakingCharacter = new SuggestTextboxViewModel(
            activeLoginViewModel.appViewModel,
            async (v, ct) => { 
                // TODO:
                await TaskUtils.delay(2000, ct);
                return [ new SuggestTextboxItemViewModel(activeLoginViewModel.characterName.value) ];
            },
            async (v, ct) => {
                // TODO:
                return true;
            }
        );
    }

    speakingCharacter: SuggestTextboxViewModel;

    @observableProperty
    streamSpec: SearchStreamSpecViewModel | null = null;

    @observableProperty
    searchText: string | null = null;

    @observableProperty
    searchBefore: Date | null = null;

    @observableProperty
    searchAfter: Date | null = null;
}

export abstract class SearchStreamSpecViewModel extends ObservableBase { }

export class SearchStreamSpecChannelViewModel extends SearchStreamSpecViewModel {
    @observableProperty
    channelTitle: string | null = null;
}

export class SearchStreamSpecPMConvoViewModel extends SearchStreamSpecViewModel {
    @observableProperty
    myCharacterName: CharacterName | null = null;

    @observableProperty
    interlocutorCharacterName: CharacterName | null = null;
}

