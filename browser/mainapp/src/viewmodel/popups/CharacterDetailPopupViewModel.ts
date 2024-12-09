import { CharacterName } from "../../shared/CharacterName";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { Collection } from "../../util/ObservableCollection";
import { ReadOnlyStdObservableCollection } from "../../util/collections/ReadOnlyStdObservableCollection";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { AppViewModel } from "../AppViewModel";
import { ChannelViewModel } from "../ChannelViewModel";
import { ContextPopupViewModel, PopupViewModel } from "./PopupViewModel";

export class CharacterDetailPopupViewModel extends ContextPopupViewModel {
    constructor(
        public app: AppViewModel,
        public readonly session: ActiveLoginViewModel, 
        public readonly char: CharacterName,
        public readonly channelViewModel: ChannelViewModel | null,
        contextElement: HTMLElement) {

        super(app, contextElement);

        const alsoInChannels: string[] = [];
        for (let ch of session.openChannels) {
            if (!ch.actuallyInChannel) {
                continue;
            }
            if (ch.isCharacterInChannel(char)) {
                alsoInChannels.push(ch.title);
            }
        }
        alsoInChannels.sort()
        for (let aic of alsoInChannels) {
            const li = new AlsoInChannelLineItem();
            li.title = aic;
            this._alsoInChannels.push(li);
        }
    }

    private readonly _alsoInChannels = new Collection<AlsoInChannelLineItem>();
    @observableProperty
    get alsoInChannels(): ReadOnlyStdObservableCollection<AlsoInChannelLineItem> { return this._alsoInChannels; }

    async toggleIgnore() {
        if (!this.session.ignoredChars.has(this.char)) {
            await this.session.chatConnection.ignoreCharacterAsync(this.char);
        }
        else {
            await this.session.chatConnection.unignoreCharacterAsync(this.char);
        }
    }
}

export class AlsoInChannelLineItem extends ObservableBase {
    @observableProperty
    title: string = "";
}