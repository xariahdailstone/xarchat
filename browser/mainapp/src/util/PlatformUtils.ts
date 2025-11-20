import { XarChatUtils } from "./XarChatUtils";

export class PlatformUtils {

    static get isWindows() {
        return XarChatUtils.clientPlatform.indexOf("win") != -1;
    }

    static get isMacOS() {
        return XarChatUtils.clientPlatform.indexOf("mac") != -1 ||
            XarChatUtils.clientPlatform.indexOf("osx") != -1;
    }

    static get isLinux() {
        return XarChatUtils.clientPlatform.indexOf("linux") != -1;
    }

    static isShortcutKey(e: KeyboardEvent | WheelEvent): boolean {
        if (this.isMacOS) {
            return e.metaKey;
        }
        else {
            return e.ctrlKey;
        }
    }

    static get shortcutKeyString(): string {
        if (this.isMacOS) {
            return "\u2318";
        }
        else {
            return "Ctrl";
        }
    }

    static get shortcutKeyCombiningPrefixString(): string {
        if (this.isMacOS) {
            return "\u2318";
        }
        else {
            return "Ctrl+";
        }
    }
}