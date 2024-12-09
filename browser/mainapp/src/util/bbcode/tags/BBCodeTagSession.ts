import { EL } from "../../EL";
import { getContentText } from "../BBCode";
import { BBCodeTag } from "../BBCodeTag";

export const BBCodeTagSession = new BBCodeTag("session", true, true, (context, arg, content) => {
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
        document.createTextNode(arg ?? "Link") 
    ]);
    if (typeof context.parseOptions.sink?.sessionClick == "function") {
        const sessionClick = context.parseOptions.sink!.sessionClick as ((target: string) => void);
        x.addEventListener("click", (ev) => {
            sessionClick.call(context.parseOptions.sink!, contentText);
        });
    }
    return x;
});