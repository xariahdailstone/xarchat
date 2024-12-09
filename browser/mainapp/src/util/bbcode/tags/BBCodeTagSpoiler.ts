import { EL } from "../../EL";
import { BBCodeTag } from "../BBCodeTag";

export const BBCodeTagSpoiler = new BBCodeTag("spoiler", true, false, (options, arg, content) => {
    const el = EL("span", { class: "bbcode-spoiler", "data-copyprefix": content.rawOpenTag, "data-copysuffix": content.rawCloseTag }, content.nodes);
    let revealed = false;
    el.addEventListener("click", (e) => {
        if (!revealed) {
            revealed = true;
            el.classList.add("revealed");
            e.stopPropagation();
            e.preventDefault();
            return false;
        }
    }, true);
    return el;
});