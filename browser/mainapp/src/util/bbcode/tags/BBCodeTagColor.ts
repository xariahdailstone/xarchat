import { EL } from "../../EL";
import { BBCodeTag } from "../BBCodeTag";

const ColorsPattern = new RegExp(/^(blue|red|white|black|yellow|green|pink|gray|orange|purple|brown|cyan)$/, "i");

export const BBCodeTagColor = new BBCodeTag("color", true, true, (context, arg, content) => {
    return EL("span", { class: `bbcode-color-${arg}`, "data-copyprefix": content.rawOpenTag, "data-copysuffix": content.rawCloseTag }, content.nodes);
});