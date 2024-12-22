import { CharacterName } from "../../../shared/CharacterName";
import { ObservableBase, observableProperty } from "../../../util/ObservableBase";
import { CharacterProfileDetailViewModel } from "./CharacterProfileDetailViewModel";


export class CharacterProfileFriendsViewModel extends ObservableBase {
    constructor(
        public readonly parent: CharacterProfileDetailViewModel,
        characterName: CharacterName) {

        super();

        this.characterName = characterName;
    }

    @observableProperty
    characterName: CharacterName;

    click(targetElement: HTMLElement) {
        this.parent.activeLoginViewModel.bbcodeSink.userClick(this.characterName, {
            rightClick: false,
            channelContext: null,
            targetElement: targetElement
        });
    }
}
