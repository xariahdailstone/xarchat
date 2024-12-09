import { EL } from "../../EL";
import { BBCodeTag } from "../BBCodeTag";

export const BBCodeTagQuote = new BBCodeTag("quote", true, false, (options, arg, content) => {
    const el = EL("blockquote", { class: "bbcode-quote", "data-copyprefix": content.rawOpenTag, "data-copysuffix": content.rawCloseTag }, [
        EL("div", { class: "bbcode-quote-header", "data-copycontent": "" }, [ "Quote:" ]),
        ...content.nodes
    ]);
    return el;
});