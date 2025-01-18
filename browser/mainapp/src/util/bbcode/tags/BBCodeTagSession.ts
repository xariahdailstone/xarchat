import { EL } from "../../EL";
import { BBCodeClickContext, BBCodeParseContext, BBCodeTagContent, getContentText } from "../BBCode";
import { BBCodeTag } from "../BBCodeTag";

const sessionConvert: (context: BBCodeParseContext, arg: string | undefined, content: BBCodeTagContent) => (Node | Node[]) = (context, arg, content) => {
    const contentText = getContentText(content);
    const x = EL("span", { 
        class: "bbcode-session", 
        "data-target": getContentText(content),
        "data-copycontent": `${content.rawOpenTag}${contentText}${content.rawCloseTag}`
    }, [
        EL("div", {
            class: "bbcode-session-icon",
            "data-copycontent": ""
        }),
        document.createTextNode(arg ?? ((contentText && contentText != "") ? contentText : "Link")) 
    ]);
    if (typeof context.parseOptions.sink?.sessionClick == "function") {
        const sessionClick = context.parseOptions.sink!.sessionClick!; // as ((target: string, titleHint: string) => void);
        x.addEventListener("click", (ev) => {
            const clickContext: BBCodeClickContext = {
                channelContext: context.parseOptions.channelViewModel,
                rightClick: false,
                targetElement: x
            };
            sessionClick.call(context.parseOptions.sink!, contentText, arg ?? "Unknown Title", clickContext);
        });
    }
    return x;
}

export const BBCodeTagSession = new BBCodeTag("session", true, true, sessionConvert);

export const BBCodeTagChannel = new BBCodeTag("channel", true, false, sessionConvert);