import { CharacterName } from "../shared/CharacterName";
import { CancellationToken } from "../util/CancellationTokenSource";
import { ObservableBase } from "../util/ObservableBase";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";
import { ReadOnlyCharacterNameSet } from "./CharacterNameSet";


export class IgnoreListViewModel extends ObservableBase {
    constructor(
        public readonly session: ActiveLoginViewModel) {

        super();
    }

    isTabActive: boolean = false;

    get ignoredChars(): ReadOnlyCharacterNameSet { return this.session.ignoredChars; }

    async addIgnore(char: CharacterName) {
        await this.session.chatConnection.ignoreCharacterAsync(char);
    }

    async removeIgnore(char: CharacterName) {
        await this.session.chatConnection.unignoreCharacterAsync(char);
    }
}
