
export class XarChatUtils {
    static clientVersion: string = "(unknown)";
    static clientPlatform: string = "(unknown)";
    static clientBranch: string = "(unknown)";

    static getFullClientVersionString(): string {
        return `${this.clientVersion}-${this.clientBranch}:${this.clientPlatform}`;
    }
}