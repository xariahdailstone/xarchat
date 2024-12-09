import { EL } from "../../EL";
import { BBCodeParser, getContentText } from "../BBCode";
import { BBCodeTag } from "../BBCodeTag";

export const BBCodeTagNoParse = new BBCodeTag("noparse", true, false, (context, arg, content) => {
    const x = EL("span", {
        class: "bbcode-noparse",
        "data-copyprefix": content.rawOpenTag,
        "data-copysuffix": content.rawCloseTag
    }, [ getContentText(content) ]);
    BBCodeParser.markElementAsExcludedFromAutoUrlization(x);
    return x;
});