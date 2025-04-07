import { EL } from "../../EL";
import { BBCodeTag } from "../BBCodeTag";
import { SimpleSpanBBCodeTag } from "../SimpleSpanBBCodeTag";
import { BBCodeTabSubDisallowedContainedTags } from "./BBCodeTagSub";

export const BBCodeTagSup = new SimpleSpanBBCodeTag("sup", {
    htmlElementName: "span",
    disallowedContainedTags: BBCodeTabSubDisallowedContainedTags
});