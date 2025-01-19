import { ChatBBCodeParser } from "./bbcode/BBCode";

const urlPattern = new RegExp(/(.*?)(http(s)?\:\/\/(\S+))/, "ig");

export class BBCodeUtils {
    static autoWrapUrls(str: string): string {
        const tokens = ChatBBCodeParser.tokenize(str);

        let inUrlCount = 0;
        for (let tok of tokens) {
            if (tok.type == "tag") {
                if (tok.tagName?.toUpperCase() == "URL") {
                    inUrlCount++;
                }
            }
            else if (tok.type == "closingtag") {
                if (tok.tagName?.toUpperCase() == "URL") {
                    inUrlCount = Math.max(0, inUrlCount - 1);
                }
            }
            else if (tok.type == "text") {
                if (inUrlCount == 0) {
                    const resultBuilder: string[] = [];
                    let charsConsumed = 0;
                    for (let m of [...tok.text!.matchAll(urlPattern)]) {
                        const allMatchText = m[0];
                        const beforeText = m[1];
                        let urlText = m[2];
                        let afterText = "";

                        charsConsumed += allMatchText.length;
                        if (urlText.endsWith(".") || urlText.endsWith("?") || urlText.endsWith("!") || urlText.endsWith(",")) {
                            afterText = urlText.charAt(urlText.length - 1);
                            urlText = urlText.substring(0, urlText.length - 1);
                        }
                        resultBuilder.push(beforeText);
                        resultBuilder.push("[url]");
                        resultBuilder.push(urlText);
                        resultBuilder.push("[/url]");
                        resultBuilder.push(afterText);
                    }
                    resultBuilder.push(tok.text!.substring(charsConsumed));
                    tok.text = resultBuilder.join("");
                }
            }
        }

        const finalResultBuilder: string[] = [];
        for (let tok of tokens) {
            if (tok.type == "text") {
                finalResultBuilder.push(tok.text!);
            }
            else {
                finalResultBuilder.push(tok.tagOrig!);
            }
        }
        return finalResultBuilder.join("");
    }
}

(window as any)["__bbcodeutils"] = BBCodeUtils;