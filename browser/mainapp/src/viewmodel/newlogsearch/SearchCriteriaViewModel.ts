import { CharacterName } from "../../shared/CharacterName";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { StringUtils } from "../../util/StringUtils";
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
    searchText: string = "";

    @observableProperty
    searchBefore: Date | null = null;

    @observableProperty
    searchAfter: Date | null = null;

    @observableProperty
    get isValid() {
        return true
            && ((this.streamSpec) ? this.streamSpec?.isValid : true);
    }
}

export abstract class SearchStreamSpecViewModel extends ObservableBase {
    get isValid() { return true; }
}

export class SearchStreamSpecChannelViewModel extends SearchStreamSpecViewModel {
    @observableProperty
    channelTitle: string = "";
}

export class SearchStreamSpecPMConvoViewModel extends SearchStreamSpecViewModel {
    @observableProperty
    myCharacterName: string = "";

    @observableProperty
    interlocutorCharacterName: string = "";

    override get isValid() {
        const hasMy = StringUtils.isNullOrWhiteSpace(this.myCharacterName);
        const hasInterlocutor = StringUtils.isNullOrWhiteSpace(this.interlocutorCharacterName);

        return (!hasMy && !hasInterlocutor) || (hasMy && hasInterlocutor);
    }
}

