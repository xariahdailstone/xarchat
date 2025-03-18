import { Optional } from "./Optional";

const intlDTFCache: Map<string, Intl.DateTimeFormat> = new Map();
const intlNFCache: Map<string, Intl.NumberFormat> = new Map();

let confusablesMap: Map<string, string> | undefined = undefined;

const FIRST_DIGIT_OR_ASCII = /^[0-9a-z]/i;
const SYNTAX_SOLIDUS = /^[$()*+./?[\\\]^{|}]/;
const WHITESPACES = '\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u2000\u2001\u2002' +
            '\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';
const OTHER_PUNCTUATORS_AND_WHITESPACES = RegExp('^[!"#%&\',\\-:;<=>@`~' + WHITESPACES + ']');
const ControlEscape: Record<string, string> = {
    '\u0009': 't',
    '\u000A': 'n',
    '\u000B': 'v',
    '\u000C': 'f',
    '\u000D': 'r'
};

export class StringUtils {
    static isNullOrWhiteSpace(str: Optional<string>): str is Exclude<Optional<string>, string> {
        if (str === null) return true;
        if (str === undefined) return true;
        if (str == "") return true;
        if (str.trim() == "") return true;

        return false;
    }

    static discardUnseen(str: string) {
        const xstr = [...str];
        return xstr.join("");
    }

    static dateToString(date: Date, formatting: Intl.DateTimeFormatOptions) {
        const key = JSON.stringify(formatting);
        let v = intlDTFCache.get(key);
        if (!v) {
            v = new Intl.DateTimeFormat(undefined, formatting);
            intlDTFCache.set(key, v);
        }
        const result = v.format(date);
        return result;
    }

    static numberToString(num: number, formatting: Intl.NumberFormatOptions) {
        const key = JSON.stringify(formatting);
        let v = intlNFCache.get(key);
        if (!v) {
            v = new Intl.NumberFormat(undefined, formatting);
            intlNFCache.set(key, v);
        }
        const result = v.format(num);
        return result;
    }

    static escapeHTMLFull(raw: Optional<string>): string {
        if (raw == null) return "";

        return raw
            .replaceAll("&", "&amp;")
            .replaceAll("'", "&apos;")
            .replaceAll("\"", "&quot;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
    }

    static unescapeHTMLChat(escaped: Optional<string>): string {
        if (escaped == null) return "";

        return escaped
            .replaceAll("&gt;", ">")
            .replaceAll("&lt;", "<")
            .replaceAll("&quot;", "\"")
            .replaceAll("&apos;", "'")
            .replaceAll("&amp;", "&");
    }

    static unescapeHTMLFull(escaped: Optional<string>): string {
        if (escaped == null) return "";

        var doc = new DOMParser().parseFromString(escaped, "text/html");
        return doc.documentElement.textContent!;
    }

    static canonicalizeConfusables(raw: Optional<string>): string {
        if (raw == null) return "";

        if (confusablesMap == null) { return raw; }

        const result: string[] = [];
        for (let ch of raw) {
            const repl = confusablesMap!.get(ch);
            if (repl != null) {
                result.push(repl);
            }
            else {
                result.push(ch);
            }
        }
        return result.join('');
    }

    public static *enumerateLines(str: string) {
        let startSearchAtPos = 0;
        while (true) {
            const lfPos = str.indexOf('\n', startSearchAtPos);
            if (lfPos == -1) { break; }
            const tstr = str.substring(startSearchAtPos, lfPos);
            yield tstr;
            startSearchAtPos = lfPos + 1;
        }
    }

    public static caseInsensitiveEquals(a: Optional<string>, b: Optional<string>): boolean {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return (a.toLowerCase() == b.toLowerCase());
    }

    public static toBoolean(str: string | null | undefined, defaultValue?: boolean): boolean {
        if (str != null) {
            const lowerStr = str.toLowerCase();
            if (lowerStr == "true" || lowerStr == "1" || lowerStr == "yes" || lowerStr == "t" || lowerStr == "y") {
                return true;
            }
            else if (lowerStr == "false" || lowerStr == "0" || lowerStr == "no" || lowerStr == "f" || lowerStr == "n") {
                return false;
            }
        }
        if (defaultValue != null) {
            return defaultValue;
        }
        else {
            throw new Error("cannot parse as boolean");
        }
    }

    public static channelTitleAsSortableString(title: string) {
        const canonicalizedTitle = StringUtils.canonicalizeConfusables(title)!;
        const result = canonicalizedTitle.replace(/ /g, "").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
        return result + "!!" + title;
    }

    public static msToVeryShortString(elapsedMs: number, forFormat: string, justNowString: string) {
        if (elapsedMs < 2000) {
            return justNowString;
        }
        else if (elapsedMs < (60 * 1000)) {
            const sec = Math.round(elapsedMs / (1000));
            return forFormat.replace("%", `${sec}s`);
        }
        else if (elapsedMs < (60 * 60 * 1000)) {
            const min = Math.round(elapsedMs / (60 * 1000));
            return forFormat.replace("%", `${min}m`);
        }
        else if (elapsedMs < (24 * 60 * 60 * 1000)) {
            const hr = Math.round(elapsedMs / (60 * 60 * 1000));
            return forFormat.replace("%", `${hr}h`);
        }
        else {
            const days = Math.round(elapsedMs / (24 * 60 * 60 * 1000));
            return forFormat.replace("%", `${days}d`);
        }
    }

    private static regexpEscapeChar(chr: string): string {
        var hex = chr.charCodeAt(0).toString(16);
        return hex.length < 3 ? '\\x' + hex.padStart(2, '0') : '\\u' + hex.padStart(4, '0');
    }

    public static regexpEscape(str: string): string {
        const length = str.length;
        const result = [];
        for (var i = 0; i < length; i++) {
            const chr = str.charAt(i);
            if (i == 0 && FIRST_DIGIT_OR_ASCII.exec(chr)) {
                result.push(this.regexpEscapeChar(chr));
            }
            else if (ControlEscape[chr]) {
                result.push("\\" + ControlEscape[chr]);
            }
            else if (SYNTAX_SOLIDUS.exec(chr)) {
                result.push("\\" + chr);
            }
            else if (OTHER_PUNCTUATORS_AND_WHITESPACES.exec(chr)) {
                result.push(this.regexpEscapeChar(chr));
            }
            else {
                const charCode = chr.charCodeAt(0);
                if ((charCode & 0xF800) !== 0xD800) { result.push(chr); }
                else if (charCode >= 0xDC00 || i + 1 >= length || (str.charCodeAt(i + 1) & 0xFC00) !== 0xDC00) { result.push(this.regexpEscapeChar(chr)); }
                else {
                    result.push(chr);
                    result[++i] = str.charAt(i);
                }
            }
        }

        return result.join("");
    }
}

(async function () {
    const parseChars = (hexStr: string): string => {
        const parseResult: string[] = [];
        const individualChars = hexStr.trim().split(' ');

        for (let ichar of individualChars) {
            const parsedChar = String.fromCodePoint(parseInt("0x" + ichar, 16));
            parseResult.push(parsedChar);
        }

        return parseResult.join('');
    };

    const result: Map<string, string> = new Map();
    const resp = await fetch("data/confusables.txt");
    const txt = await resp.text();
    for (let line of StringUtils.enumerateLines(txt)) {
        if (StringUtils.isNullOrWhiteSpace(line) || line.startsWith("#")) { continue; }

        const lineparts = line.split(" ;");
        if (lineparts.length < 2) { continue; }

        const srcCharsHex = lineparts[0];
        const targetCharsHex = lineparts[1];

        const srcChars = parseChars(srcCharsHex);
        const targetChars = parseChars(targetCharsHex);
        result.set(srcChars, targetChars);
    }
    confusablesMap = result;
})();