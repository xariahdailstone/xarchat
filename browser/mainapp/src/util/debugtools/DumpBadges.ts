import { ActiveLoginViewModel } from "../../viewmodel/ActiveLoginViewModel";
import { HostInterop } from "../hostinterop/HostInterop";
import { consoleCommand, ConsoleCommand, ExecuteArgs } from "./ConsoleCommand";

@consoleCommand("dump badges")
export class DumpBadges extends ConsoleCommand {
    
    async executeAsync(args: ExecuteArgs): Promise<void> {
        const printCount = (count: number) => {
            if (count == 0) {
                return "0";
            }
            else {
                return `[color=yellow][b]${count}[/b][/color]`;
            }
        };
        const printRow = (title: string, unseenCount: number, pingCount: number) => {
            if (unseenCount > 0 || pingCount > 0) {
                args.print(`[color=green][noparse]${title}[/noparse]: ${printCount(unseenCount)} unseen, ${pingCount} pings[/color]`);
            }
            else {
                args.print(`${title}: ${printCount(unseenCount)} unseen, ${pingCount} pings`);
            }
        }

        const hostLastBadge = HostInterop.getLastAppBadge();
        printRow("Host", hostLastBadge.unseenCount, hostLastBadge.pingCount);
        printRow("AppViewModel", args.appViewModel.unseenCount, args.appViewModel.pingCount);
        for (let login of args.appViewModel.logins) {
            printRow(`Login[${login.characterName.value}]`, login.unseenCount, login.pingCount);
            for (let ch of login.openChannels) {
                printRow(`Channel[${login.characterName.value}::${ch.title}]`, ch.unseenMessageCount, ch.pingMessagesCount);
            }
            for (let ch of login.pmConversations) {
                printRow(`PMConvo[${login.characterName.value}::${ch.character.value}]`, ch.unseenMessageCount, ch.pingMessagesCount);
            }
        }
    }

}