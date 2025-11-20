import { DialogButtonStyle } from "../../viewmodel/dialogs/DialogViewModel";
import { KeyCodes } from "../KeyCodes";
import { StringUtils } from "../StringUtils";
import { ConsoleCommand, consoleCommand, ExecuteArgs } from "./ConsoleCommand";

@consoleCommand(/^hotdebug (\S+)$/)
export class HotDebug extends ConsoleCommand {

    async executeAsync(args: ExecuteArgs): Promise<void> {
        const _ = this.executeInternalAsync(args);
    }

    async executeInternalAsync(args: ExecuteArgs): Promise<void> {
        try {
            const okToRun = await args.appViewModel.promptAsync({
                title: "Run Debug Command",
                message: "The command you entered will run a debugging command provided by Xariah. " +
                    "<b>DO NOT CONTINUE</b> unless you entered the command at Xariah's request to diagnose an issue!",
                messageAsHtml: true,
                closeBoxResult: false,
                buttons: [
                    {
                        title: "Cancel, Do Not Execute",
                        shortcutKeyCode: KeyCodes.ESCAPE,
                        resultValue: false,
                        style: DialogButtonStyle.BACKOFF
                    },
                    {
                        title: "OK, Execute",
                        resultValue: true,
                        style: DialogButtonStyle.NORMAL
                    }
                ]
            });
            if (!okToRun) {
                args.print("Execution cancelled due to lack of consent.");
                return;
            }

            const url = `https://xariah.net/temp/hotdebug/${args.patternMatch[1]}.js?d=${new Date().getTime()}`;
            const resp = await fetch(url);
            if (resp.status != 200) {
                args.print(`EXECUTION FAILED: Could not download debugging script, status code [color=yellow]${resp.status}[/color].`);
                return;
            }

            const scriptText = await resp.text();
            if (StringUtils.isNullOrWhiteSpace(scriptText)) {
                args.print(`EXECUTION FAILED: Debugging script is empty.`);
                return;
            }

            eval(scriptText);
        }
        catch (e) {
            args.print(`EXECUTION FAILED: Unhandled exception: ` + (e?.toString() ?? "null"));
        }
    }

}