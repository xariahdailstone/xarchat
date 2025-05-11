import { EL } from "../../EL";
import { BBCodeTag } from "../BBCodeTag";

const ColorsPattern = new RegExp(/^(blue|red|white|black|yellow|green|pink|gray|grey|orange|purple|brown|cyan)$/);

export const BBCodeTagColor = new BBCodeTag("color", true, true, (context, arg, content) => {
    if ((arg ?? "").match(ColorsPattern)) {
        return EL("span", { class: `bbcode-color-${arg}`, "data-copyprefix": content.rawOpenTag, "data-copysuffix": content.rawCloseTag }, content.nodes);
    }
    else {
        return EL("span", { }, 
            [
                document.createTextNode(content.rawOpenTag),
                ...content.nodes,
                document.createTextNode(content.rawCloseTag)
            ]);
    }
});