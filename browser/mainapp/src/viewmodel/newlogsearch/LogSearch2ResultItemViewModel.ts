import { CharacterName } from "../../shared/CharacterName";
import { ObservableBase } from "../../util/ObservableBase";
import { LogSearch2ViewModel } from "./LogSearch2ViewModel";


export class LogSearch2ResultItemViewModel extends ObservableBase {
    constructor(
        public readonly parent: LogSearch2ViewModel,
        public readonly timestamp: Date,
        public readonly speakingCharacter: CharacterName,
        public readonly messageType: number,
        public readonly text: string) {

        super();
    }

    get activeLoginViewModel() { return this.parent.activeLoginViewModel; }
    get appViewModel() { return this.parent.appViewModel; }
}
