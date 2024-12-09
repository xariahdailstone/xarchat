import { InlineInfo } from "../../../fchat/api/FListApi";
import { EL } from "../../EL";
import { URLUtils } from "../../URLUtils";
import { getContentText } from "../BBCode";
import { BBCodeTag } from "../BBCodeTag";

export const BBCodeTagImg = new BBCodeTag("img", true, true, (options, arg, content) => {
    const contentText = getContentText(content);
    let iinfo: (InlineInfo | null) = null;

    if (options.parseOptions.inlineImageData) {
        iinfo = options.parseOptions.inlineImageData[(+arg!).toString()] ?? null;
    }

    if (iinfo) {
        const el = EL("div", { class: "bbcode-img-container" }, [
            EL("img", { 
                class: "bbcode-img", 
                src: URLUtils.getInlineImageUrl(iinfo),
                "data-copyprefix": content.rawOpenTag, 
                "data-copysuffix": content.rawCloseTag
            })
        ]);
        return el;
    }
    else {
        return document.createTextNode(`${content.rawOpenTag}${contentText}${content.rawCloseTag}`);
    }
});