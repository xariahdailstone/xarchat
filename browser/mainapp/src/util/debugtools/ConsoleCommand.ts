import { ActiveLoginViewModel } from "../../viewmodel/ActiveLoginViewModel";
import { AppViewModel } from "../../viewmodel/AppViewModel";

type ConstructorOf<T> = { new(): T }

interface RegisteredConsoleCommand {
    isMatch(cmd: string): RegExpExecArray | null;
    createInstance(): ConsoleCommand;
}

export abstract class ConsoleCommand {
    static readonly _registeredCommands: RegisteredConsoleCommand[] = [];

    static registerConsoleCommand(cmd: string | RegExp, factory: () => ConsoleCommand) {
        let pattern: RegExp;
        if (typeof cmd == "string") {
            // XXX: this doesn't escape, be careful
            pattern = new RegExp("^" + cmd + "$", "i");
        }
        else {
            pattern = cmd;
        }
        this._registeredCommands.push({
            isMatch: (providedCmd: string) => {
                return pattern.exec(providedCmd);
            },
            createInstance: () => {
                return factory();
            }
        })
    }

    static tryCreate(cmd: string): ({ command: ConsoleCommand, patternMatch: RegExpExecArray } | null) {
        for (let registration of this._registeredCommands) {
            const pmatch = registration.isMatch(cmd);
            if (pmatch) {
                return { command: registration.createInstance(), patternMatch: pmatch };
            }
        }
        return null;
    }

    abstract executeAsync(args: ExecuteArgs): Promise<void>;
}

export interface ExecuteArgs {
    readonly appViewModel: AppViewModel;
    readonly session: ActiveLoginViewModel;
    readonly print: (msg: string) => void;
    readonly command: string;
    readonly patternMatch: RegExpExecArray;
}

export function consoleCommand(command: string | RegExp) {
    return (target: ConstructorOf<ConsoleCommand>) => {
        ConsoleCommand.registerConsoleCommand(command, () => new target());
    };
}