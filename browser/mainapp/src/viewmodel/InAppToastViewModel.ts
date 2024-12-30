import { CharacterName } from "../shared/CharacterName";
import { CancellationToken } from "../util/CancellationTokenSource";
import { ObservableBase, observableProperty } from "../util/ObservableBase";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";
import { AppViewModel } from "./AppViewModel";

export class InAppToastViewModel extends ObservableBase {
    constructor(
        public readonly session: ActiveLoginViewModel) {

        super();
    }

    @observableProperty
    priority: number = 0;

    @observableProperty
    relatedToCharacter: CharacterName | null = null;

    @observableProperty
    title: string = "";

    @observableProperty
    message: string = "";

    @observableProperty
    showForMs: number = 3000;

    async showAsync(cancellationToken: CancellationToken) {
        await this.session.toastManager.showAsync(this, cancellationToken);
    }

    click: (() => any) = () => {};
}


