import { EL } from "../../EL";
import { BBCodeTag } from "../BBCodeTag";
import { SimpleSpanBBCodeTag } from "../SimpleSpanBBCodeTag";

export const BBCodeTagList = new SimpleSpanBBCodeTag("list", { htmlElementName: "ul" });
export const BBCodeTagListItem = new SimpleSpanBBCodeTag("listitem", { htmlElementName: "li" });