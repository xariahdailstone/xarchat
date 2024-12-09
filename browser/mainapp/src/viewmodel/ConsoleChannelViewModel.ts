import { observableProperty } from "../util/ObservableBase";
import { ObservableExpression } from "../util/ObservableExpression";
import { URLUtils } from "../util/URLUtils";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";
import { ChannelViewModel } from "./ChannelViewModel";

export class ConsoleChannelViewModel extends ChannelViewModel {
    constructor(parent: ActiveLoginViewModel) {
        super(parent, "Console");
    }

    get collectiveName(): string { return `console`; }

    canClose: boolean = false;
    canPin: boolean = false;

    get description() { 
        const count = this.parent.characterSet.size;
        return `${count.toLocaleString()} character${count == 1 ? '' : 's'} online`; 
    }

    async sendTextboxInternalAsync(): Promise<void> {
        this.addSystemMessage(new Date(), "Cannot chat in the console.", true);
    }

    get iconUrl(): string {
        // TODO:
        return URLUtils.getEmptyImageUrl();
    }

    override close() { }
}