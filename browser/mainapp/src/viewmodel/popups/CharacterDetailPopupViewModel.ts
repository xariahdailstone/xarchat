import { CharacterName } from "../../shared/CharacterName";
import { CancellationToken } from "../../util/CancellationTokenSource";
import { HostInterop } from "../../util/HostInterop";
import { ObservableValue } from "../../util/Observable";
import { ObservableBase, observableProperty } from "../../util/ObservableBase";
import { Collection } from "../../util/ObservableCollection";
import { ReadOnlyStdObservableCollection } from "../../util/collections/ReadOnlyStdObservableCollection";
import { ActiveLoginViewModel } from "../ActiveLoginViewModel";
import { AppViewModel } from "../AppViewModel";
import { ChannelViewModel } from "../ChannelViewModel";
import { ChatChannelViewModel } from "../ChatChannelViewModel";
import { DialogButtonStyle } from "../dialogs/DialogViewModel";
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

        (async () => {
            const memoText = await HostInterop.getMemoAsync(session.authenticatedApi.account, char, CancellationToken.NONE);
            this._memoText.value = memoText;
        })();
    }

    private readonly _memoText: ObservableValue<string | null> = new ObservableValue(null);
    get memoText() { return this._memoText.value; }

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

    showSettings() {
        this.parent.showSettingsDialogAsync(this.session, this.char);
    }

    async kick() {
        const confirmed = await this.appViewModel.promptAsync({
            title: "Are you sure?",
            message: `Are you sure you want to kick ${this.char.value}?`,
            buttons: [
                {
                    shortcutKeyCode: 27,  // ESC
                    style: DialogButtonStyle.CANCEL,
                    resultValue: false,
                    title: "Cancel"
                },
                {
                    shortcutKeyCode: 13,  // Enter
                    style: DialogButtonStyle.DEFAULT,
                    resultValue: true,
                    title: "Kick"
                }
            ]
        });
        if (confirmed) {
            (this.channelViewModel as ChatChannelViewModel).kickAsync(this.char);
        }
    }

    async timeout() {
        // TOOD:
    }

    async ban() {
        const confirmed = await this.appViewModel.promptAsync({
            title: "Are you sure?",
            message: `Are you sure you want to ban ${this.char.value}?`,
            buttons: [
                {
                    shortcutKeyCode: 27,  // ESC
                    style: DialogButtonStyle.CANCEL,
                    resultValue: false,
                    title: "Cancel"
                },
                {
                    shortcutKeyCode: 13,  // Enter
                    style: DialogButtonStyle.DEFAULT,
                    resultValue: true,
                    title: "Ban"
                }
            ]
        });
        if (confirmed) {
            (this.channelViewModel as ChatChannelViewModel).banAsync(this.char);
        }
    }

    async makeMod() {
        const confirmed = await this.appViewModel.promptAsync({
            title: "Are you sure?",
            message: `Are you sure you want to make ${this.char.value} a moderator of ${this.channelViewModel!.title}?`,
            buttons: [
                {
                    shortcutKeyCode: 27,  // ESC
                    style: DialogButtonStyle.CANCEL,
                    resultValue: false,
                    title: "Cancel"
                },
                {
                    shortcutKeyCode: 13,  // Enter
                    style: DialogButtonStyle.DEFAULT,
                    resultValue: true,
                    title: "Grant Moderator Powers"
                }
            ]
        });
        if (confirmed) {
            // TODO:
        }
    }

    async removeMod() {
        const confirmed = await this.appViewModel.promptAsync({
            title: "Are you sure?",
            message: `Are you sure you want to remove ${this.char.value} from the moderators of ${this.channelViewModel!.title}?`,
            buttons: [
                {
                    shortcutKeyCode: 27,  // ESC
                    style: DialogButtonStyle.CANCEL,
                    resultValue: false,
                    title: "Cancel"
                },
                {
                    shortcutKeyCode: 13,  // Enter
                    style: DialogButtonStyle.DEFAULT,
                    resultValue: true,
                    title: "Remove Moderator Powers"
                }
            ]
        });
        if (confirmed) {
            // TODO:
        }
    }

    async makeOwner() {
        const confirmed = await this.appViewModel.promptAsync({
            title: "Are you sure?",
            message: `Are you sure you want to make ${this.char.value} the new owner of ${this.channelViewModel!.title}?`,
            buttons: [
                {
                    shortcutKeyCode: 27,  // ESC
                    style: DialogButtonStyle.CANCEL,
                    resultValue: false,
                    title: "Cancel"
                },
                {
                    shortcutKeyCode: 13,  // Enter
                    style: DialogButtonStyle.DEFAULT,
                    resultValue: true,
                    title: "Give Ownership"
                }
            ]
        });
        if (confirmed) {
            // TODO:
        }
    }
}

export class AlsoInChannelLineItem extends ObservableBase {
    @observableProperty
    title: string = "";
}