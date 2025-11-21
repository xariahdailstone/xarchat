import { CharacterName } from "../shared/CharacterName";
import { ChannelViewModel } from "./ChannelViewModel";

export type ArgumentType = "channel" | "character" | "text" | "integer";
export type ArgumentTypeMap = {
    "channel": string,
    "character": CharacterName,
    "text": string,
    "!text": string,
    "integer": number
}

export class SlashCommandViewModel {
    constructor(
        public readonly command: string[],
        public readonly title: string,
        public readonly description: string,
        public readonly argTypes: Array<keyof ArgumentTypeMap>,
        public readonly onInvoke: (context: ChannelViewModel, args: unknown[]) => Promise<string | void>) {
    }

    showInHelp: boolean = true;

    withShowInHelp(value: boolean): this {
        this.showInHelp = value;
        return this;
    }

    grabArgumentValue(argType: keyof ArgumentTypeMap, argumentStr: string): [string, any] {
        let argumentValue: any;
        switch (argType) {
            case "integer":
                {
                    const m = argumentStr.match(/^\s*(\d+)\s*(.*)$/);
                    if (m) {
                        argumentValue = +m[1];
                        argumentStr = m[2];
                    }
                    else {
                        throw new Error("Invalid arguments, integer expected.");
                    }
                }
                break;
            case "channel":
                {
                    if (argumentStr.trim() == "") {
                        throw new Error("Channel title required.");
                    }
                    argumentValue = argumentStr.trim();
                    argumentStr = "";
                }
                break;
            case "character":
                {
                    let ax = argumentStr.trim();
                    if (ax == "") {
                        throw new Error("Character name required.");
                    }
                    if (ax.startsWith('"') && ax.endsWith('"')) {
                        ax = ax.substring(1, ax.length - 1);
                    }
                    argumentValue = CharacterName.create(ax);
                    argumentStr = "";
                }
                break;
            case "text":
                {
                    argumentValue = argumentStr.trim();
                    argumentStr = "";
                }
                break;
            case "!text":
                {
                    if (argumentStr.trim() == "") {
                        throw new Error("Argument required.");
                    }
                    argumentValue = argumentStr.trim();
                    argumentStr = "";
                }
                break;
            default:
                throw new Error(`Unknown arg type: ${argType}`);
        }
        return [argumentStr, argumentValue];
    }
}