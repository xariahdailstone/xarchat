import { EL } from "../../EL";
import { BBCodeTag } from "../BBCodeTag";

export const BBCodeTagHR = new BBCodeTag("hr", false, false, (options, arg, content) => {
    return EL("hr", { class: "bbcode-hr", "data-copycontent": content.rawOpenTag });
});