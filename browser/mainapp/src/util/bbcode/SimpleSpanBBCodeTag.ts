import { EL } from "../EL";
import { BBCodeTag } from "./BBCodeTag";

export class SimpleSpanBBCodeTag extends BBCodeTag {
    constructor(
        tagName: string,
        options?: SimpleSpanBBCodeTagOptions
    ) {
        super({
            tagName: tagName,
            hasClosingTag: true,
            acceptArg: false,
            convert: (context, arg, content) => {
                return EL(options?.htmlElementName ?? "div", {
                    class: options?.htmlClassName ?? `bbcode-${tagName.toLowerCase()}`,
                    "data-copyprefix": content.rawOpenTag,
                    "data-copysuffix": content.rawCloseTag,
                    "data-copyinline": "true"
                }, content.nodes)
            },
            disallowedContainedTags: options?.disallowedContainedTags
        });
    }
}

export interface SimpleSpanBBCodeTagOptions {
    htmlElementName?: string;
    htmlClassName?: string;
    disallowedContainedTags?: string[];
}