import { CancellationTokenSource } from "../../CancellationTokenSource";
import { asDisposable } from "../../Disposable";
import { EIconLoadManager, LoadedEIcon } from "../../EIconLoadManager";
import { EL } from "../../EL";
import { EventListenerUtil } from "../../EventListenerUtil";
import { URLUtils } from "../../URLUtils";
import { BBCodeParseContext, getContentText } from "../BBCode";
import { BBCodeTag } from "../BBCodeTag";

let nextUniqueId = 1;
export const BBCodeTagEIcon = new BBCodeTag("eicon", true, false, 
    (context, arg, content) => {
        const contentText = getContentText(content);

        if (content.rawCloseTag == "") {
            return document.createTextNode(content.rawOpenTag + contentText);
        }

        const el = EL("x-eicondisplay", {
            class: "bbcode-eicon",
            title: arg ? `${contentText}\n@${arg}` : contentText,
            eiconname: contentText,
            charname: context.parseOptions.activeLoginViewModel?.characterName.canonicalValue,
            "data-copycontent": `${content.rawOpenTag}${contentText}${content.rawCloseTag}`
        });
        
        if (context.parseOptions.syncGifs) {
            if (!(context.parseOptions as any)["__syncgroup"]) {
                (context.parseOptions as any)["__syncgroup"] = `syncgroup${nextUniqueId++}`;
            }
            el.setAttribute("syncgroup", (context.parseOptions as any)["__syncgroup"]);
        }

        context.addUsedEIcon(contentText);
        
        return el;
    });