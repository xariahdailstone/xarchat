import { EL } from "../../EL";
import { BBCodeTag } from "../BBCodeTag";
import { SimpleSpanBBCodeTag } from "../SimpleSpanBBCodeTag";

export const BBCodeTabSubDisallowedContainedTags = [ "sub", "sup", "eicon", "icon", "noparse", "spoiler", "url", "user" ];

export const BBCodeTagSub = new SimpleSpanBBCodeTag("sub", { 
    htmlElementName: "span",
    disallowedContainedTags: BBCodeTabSubDisallowedContainedTags
});