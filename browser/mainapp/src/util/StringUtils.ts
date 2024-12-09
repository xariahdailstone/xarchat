import { Optional } from "./Optional";

const intlDTFCache: Map<string, Intl.DateTimeFormat> = new Map();
const intlNFCache: Map<string, Intl.NumberFormat> = new Map();

let confusablesMap: Map<string, string> | undefined = undefined;

export class StringUtils {
    static isNullOrWhiteSpace(str: Optional<string>) {
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