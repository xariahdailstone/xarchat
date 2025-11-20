import { ConsoleCommand } from "../util/debugtools/ConsoleCommand";
import { URLUtils } from "../util/URLUtils";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";
import { ChannelViewModel } from "./ChannelViewModel";

export class ConsoleChannelViewModel extends ChannelViewModel {
    constructor(parent: ActiveLoginViewModel) {
        super(parent, "Console");

        this.canClose = false;
        this.canPin = false;
    }

    get collectiveName(): string { return `console`; }

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

    getMaxMessageSize(): number | null {
        return null;
    }

    override close() { }

    async processCommandInternalAsync(command: string): Promise<string> {
        const cc = ConsoleCommand.tryCreate(command);
        if (cc) {
            await cc.command.executeAsync({
                appViewModel: this.activeLoginViewModel.appViewModel,
                session: this.activeLoginViewModel,
                print: (msg: string) => {
                    this.addSystemMessage(new Date(), msg, false, true);
                },
                command: command,
                patternMatch: cc.patternMatch
            });
            return "";
        }
        else {
            return await super.processCommandInternalAsync(command);
        }
    }
}