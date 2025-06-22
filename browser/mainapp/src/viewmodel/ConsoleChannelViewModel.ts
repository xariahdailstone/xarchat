import { CharacterName } from "../shared/CharacterName";
import { CancellationToken } from "../util/CancellationTokenSource";
import { URLUtils } from "../util/URLUtils";
import { ActiveLoginViewModel } from "./ActiveLoginViewModel";
import { ChannelViewModel } from "./ChannelViewModel";
import { SlashCommandViewModel } from "./SlashCommandViewModel";

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

    override getSlashCommands(): SlashCommandViewModel[] {
        return [
            ...super.getSlashCommands(),
            new SlashCommandViewModel(
                ["dump"],
                "[DEBUG] Toggle Protocol Dump",
                "Toggles writing of all FChat protocol messages to the console.",
                [],
                async (context, args) => {
                    context.activeLoginViewModel.debugProtocolDumpToConsole = !context.activeLoginViewModel.debugProtocolDumpToConsole;
                    return "Protocol dump to console is " + (context.activeLoginViewModel.debugProtocolDumpToConsole
                        ? "[b]enabled[/b]"
                        : "[b]disabled[/b]");
                }
            ).withShowInHelp(false),
            new SlashCommandViewModel(
                ["raw"],
                "[DEBUG] Send Raw Command",
                "Send a raw FChat protocol command.",
                ["text"],
                async (context, args) => {
                    context.activeLoginViewModel.chatConnection.debug_outputMessage(args[0] as string);
                }
            ).withShowInHelp(false),
            new SlashCommandViewModel(
                ["pro"],
                "[DEBUG] Get Profile Info with PRO",
                "Get profile info from FChat PRO command.",
                ["text"],
                async (context, args) => {
                    const pi = await context.activeLoginViewModel.chatConnection.getCharacterProfileInfoAsync(CharacterName.create(args[0] as string), CancellationToken.NONE);
                    return JSON.stringify(pi);
                }
            ).withShowInHelp(false)
        ]
    }
}